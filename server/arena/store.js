'use strict';

/**
 * The Arena's data access: rounds, outputs, votes, ratings, the open dataset and the day's budgets. Every
 * person-facing write is a transaction; a vote and the rating changes it causes commit together, so a crash can
 * never leave a vote without its Elo update. Votes are keyed by (round, voter_subject): one per person per round.
 */
const { ids } = require('openvibe-contracts');

const CATEGORIES = Object.freeze(['landing', 'dashboard', 'mobile_app', 'game_ui', 'logo', 'slides']);
const WINNERS = Object.freeze(['left', 'right', 'tie', 'both_bad']);
const K = 32;
const BASE_ELO = 1000;

class ArenaError extends Error {
    constructor(status, code, detail, extra = {}) {
        super(detail);
        this.name = 'ArenaError';
        this.status = status;
        this.code = code;
        this.detail = detail;
        this.extra = extra;
    }
}

const num = (v, d = 0) => (v == null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const roundOf = (r) => (r ? {
    id: r.id,
    category: r.category,
    prompt: r.prompt,
    status: r.status,
    // The offers the round asked AI for ({provider, model}); a pool slot is provider 'ai' with no model.
    offers: Array.isArray(r.offers) ? r.offers : [],
    // True only when the routing offered fewer than three distinct offers, so the rest came from the pool.
    pool_fallback: Boolean(r.pool_fallback),
    created_at: r.created_at,
} : null);
const outputOf = (o) => ({
    id: o.id,
    round: o.round,
    model: o.model,
    provider: o.provider,
    html: o.html,
    cost_usd: num(o.cost_usd),
    ms: num(o.ms),
    tokens: num(o.tokens),
    error: o.error || null,
    ui_check: o.ui_check == null ? null : o.ui_check,
    created_at: o.created_at,
});
const voteOf = (v) => ({ round: v.round, left_output: v.left_output, right_output: v.right_output, winner: v.winner, at: v.at });

/** Fisher–Yates, with an injectable random source so a test can pin the order. */
function shuffle(list, random = Math.random) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function createArenaStore({ s, config, log = console }) {
    const db = s.db;
    const perDay = config.arena.perDay;
    const daily = config.arena.daily;

    const dayStart = (at = s.now()) => {
        const d = new Date(at);
        d.setUTCHours(0, 0, 0, 0);
        return d.toISOString();
    };

    async function counts(subject) {
        const start = dayStart();
        const used = num(await db.value('SELECT COUNT(*)::int AS n FROM arena_rounds WHERE created_by = $1 AND created_at >= $2::timestamptz', [subject, start]));
        const siteUsed = num(await db.value('SELECT COUNT(*)::int AS n FROM arena_rounds WHERE created_at >= $1::timestamptz', [start]));
        return {
            used,
            remaining: Math.max(0, perDay - used),
            per_day: perDay,
            site_used: siteUsed,
            site_daily: daily,
            site_remaining: Math.max(0, daily - siteUsed),
        };
    }

    async function createRound({ category, prompt, subject }) {
        if (!CATEGORIES.includes(category)) throw new ArenaError(422, 'arena.invalid_category', `Pick a category: ${CATEGORIES.join(', ')}.`);
        const text = String(prompt == null ? '' : prompt).trim();
        if (!text) throw new ArenaError(422, 'arena.prompt_required', 'Describe the page you want the models to design.');
        if (text.length > config.arena.maxPrompt) throw new ArenaError(422, 'arena.prompt_too_long', `The prompt must be at most ${config.arena.maxPrompt} characters.`);
        const at = s.now();
        const start = dayStart(at);
        const id = `arr_${ids.ulid(at)}`;
        const row = await db.maybe(
            `INSERT INTO arena_rounds (id, category, prompt, created_by, status, created_at)
             SELECT $1, $2, $3, $4, 'queued', $5::timestamptz
             WHERE (SELECT COUNT(*) FROM arena_rounds WHERE created_by = $4 AND created_at >= $6::timestamptz) < $7
               AND (SELECT COUNT(*) FROM arena_rounds WHERE created_at >= $6::timestamptz) < $8
             RETURNING *`,
            [id, category, text, subject, s.iso(), start, perDay, daily],
        );
        if (!row) {
            const c = await counts(subject);
            if (c.used >= perDay) {
                throw new ArenaError(429, 'arena.limit_person',
                    `You can start ${perDay} Arena round${perDay === 1 ? '' : 's'} a day. You have started ${c.used} today; try again tomorrow.`);
            }
            throw new ArenaError(429, 'arena.limit_site',
                `The Arena has reached its ${daily} round${daily === 1 ? '' : 's'} for today. Try again tomorrow.`);
        }
        return await getRound(id);
    }

    async function getRound(id) {
        const r = await db.maybe('SELECT * FROM arena_rounds WHERE id = $1', [id]);
        if (!r) return null;
        const outputs = (await db.many('SELECT * FROM arena_outputs WHERE "round" = $1 ORDER BY created_at, id', [id])).map(outputOf);
        const votes = num(await db.value('SELECT COUNT(*)::int AS n FROM arena_votes WHERE "round" = $1', [id]));
        return { ...roundOf(r), outputs, votes };
    }

    /** A ready round this person has not voted on and did not start, with its two successful outputs shuffled. */
    async function nextPair(subject, { random = Math.random } = {}) {
        const r = await db.maybe(
            `SELECT r.* FROM arena_rounds r
             WHERE r.status = 'ready' AND r.created_by <> $1
               AND (SELECT COUNT(*) FROM arena_outputs o WHERE o."round" = r.id AND o.error IS NULL AND o.html <> '') >= 2
               AND NOT EXISTS (SELECT 1 FROM arena_votes v WHERE v."round" = r.id AND v.voter_subject = $1)
             ORDER BY random() LIMIT 1`,
            [subject],
        );
        if (!r) return null;
        const outputs = (await db.many('SELECT * FROM arena_outputs WHERE "round" = $1 AND error IS NULL AND html <> \'\' ORDER BY id', [r.id])).map(outputOf);
        if (outputs.length < 2) return null;
        const [left, right] = shuffle(outputs, random).slice(0, 2);
        // Blind: the model, provider, cost and time are not part of this answer. The HTML is (in the iframe).
        return {
            round: { id: r.id, category: r.category, prompt: r.prompt },
            left: { id: left.id, html: left.html },
            right: { id: right.id, html: right.html },
        };
    }

    async function applyElo(t, category, left, right, winner, atIso) {
        if (winner === 'both_bad') return; // a game for neither
        if (left.model === right.model) return; // two outputs of one model are not a match between designers
        const models = [left.model, right.model];
        for (const model of models) {
            await t.exec(`INSERT INTO arena_ratings (category, model, elo, games, wins, losses, ties, updated_at)
                          VALUES ($1, $2, $3, 0, 0, 0, 0, $4::timestamptz)
                          ON CONFLICT (category, model) DO NOTHING`, [category, model, BASE_ELO, atIso]);
        }
        const rows = await t.many('SELECT * FROM arena_ratings WHERE category = $1 AND model = ANY($2::text[]) ORDER BY model FOR UPDATE', [category, models]);
        const byModel = new Map(rows.map((r) => [r.model, r]));
        const a = byModel.get(left.model);
        const b = byModel.get(right.model);
        if (!a || !b) return;
        const ra = num(a.elo, BASE_ELO);
        const rb = num(b.elo, BASE_ELO);
        const ea = 1 / (1 + (10 ** ((rb - ra) / 400)));
        const eb = 1 - ea;
        const sa = winner === 'left' ? 1 : (winner === 'right' ? 0 : 0.5);
        const sb = 1 - sa;
        const nextA = Math.round((ra + K * (sa - ea)) * 100) / 100;
        const nextB = Math.round((rb + K * (sb - eb)) * 100) / 100;
        const update = async (row, elo, score, oppScore) => {
            await t.exec(`UPDATE arena_ratings SET elo = $1, games = games + 1,
                          wins = wins + $2, losses = losses + $3, ties = ties + $4, updated_at = $5::timestamptz
                          WHERE category = $6 AND model = $7`,
            [elo, score > oppScore ? 1 : 0, score < oppScore ? 1 : 0, score === oppScore ? 1 : 0, atIso, category, row.model]);
        };
        await update(a, nextA, sa, sb);
        await update(b, nextB, sb, sa);
    }

    async function vote({ roundId, subject, leftOutput, rightOutput, winner }) {
        if (!WINNERS.includes(winner)) throw new ArenaError(422, 'arena.invalid_winner', 'The winner must be left, right, tie or both_bad.');
        if (!leftOutput || !rightOutput || leftOutput === rightOutput) throw new ArenaError(422, 'arena.invalid_pair', 'A vote needs two different outputs.');
        try {
            const result = await s.tx(async () => {
                const r = await db.maybe('SELECT * FROM arena_rounds WHERE id = $1 FOR UPDATE', [roundId]);
                if (!r) throw new ArenaError(404, 'arena.round_not_found', 'No such Arena round.');
                if (r.created_by === subject) throw new ArenaError(403, 'arena.creator_cannot_vote', 'You cannot vote on a round you started.');
                if (r.status !== 'ready') throw new ArenaError(409, 'arena.round_not_ready', 'This round is not ready to vote on yet.');
                const outputs = (await db.many('SELECT * FROM arena_outputs WHERE "round" = $1 AND id = ANY($2::text[]) AND error IS NULL AND html <> \'\'', [roundId, [leftOutput, rightOutput]])).map(outputOf);
                if (outputs.length !== 2) throw new ArenaError(422, 'arena.invalid_pair', 'Those two outputs are not both part of this round.');
                const left = outputs.find((o) => o.id === leftOutput);
                const right = outputs.find((o) => o.id === rightOutput);
                const prior = await db.maybe('SELECT 1 AS n FROM arena_votes WHERE "round" = $1 AND voter_subject = $2', [roundId, subject]);
                if (prior) throw new ArenaError(409, 'arena.already_voted', 'You have already voted on this round.');
                const at = s.iso();
                await db.exec('INSERT INTO arena_votes ("round", voter_subject, left_output, right_output, winner, at) VALUES ($1, $2, $3, $4, $5, $6::timestamptz)',
                    [roundId, subject, leftOutput, rightOutput, winner, at]);
                await applyElo(db, r.category, left, right, winner, at);
                return { round: roundOf(r), winner, at, left, right };
            });
            return result;
        } catch (err) {
            if (err && err.code === '23505') throw new ArenaError(409, 'arena.already_voted', 'You have already voted on this round.');
            throw err;
        }
    }

    async function leaderboard(category = null) {
        const rows = await db.many(
            `WITH models AS (
                 SELECT category, model FROM arena_ratings WHERE ($1::text IS NULL OR category = $1)
                 UNION
                 SELECT r.category, o.model FROM arena_outputs o JOIN arena_rounds r ON r.id = o."round"
                 WHERE r.status = 'ready' AND o.error IS NULL AND ($1::text IS NULL OR r.category = $1)
             ), medians AS (
                 SELECT r.category, o.model,
                        percentile_cont(0.5) WITHIN GROUP (ORDER BY o.cost_usd) AS median_cost,
                        percentile_cont(0.5) WITHIN GROUP (ORDER BY o.ms) AS median_ms
                 FROM arena_outputs o JOIN arena_rounds r ON r.id = o."round"
                 WHERE r.status = 'ready' AND o.error IS NULL AND ($1::text IS NULL OR r.category = $1)
                 GROUP BY r.category, o.model
             )
             SELECT m.category, m.model, COALESCE(rt.elo, $2) AS elo,
                    COALESCE(rt.games, 0) AS games, COALESCE(rt.wins, 0) AS wins,
                    COALESCE(rt.losses, 0) AS losses, COALESCE(rt.ties, 0) AS ties,
                    med.median_cost, med.median_ms
             FROM models m
             LEFT JOIN arena_ratings rt ON rt.category = m.category AND rt.model = m.model
             LEFT JOIN medians med ON med.category = m.category AND med.model = m.model
             ORDER BY m.category, elo DESC, games DESC, m.model`,
            [category, BASE_ELO],
        );
        const all = rows.map((r) => {
            const games = num(r.games);
            const wins = num(r.wins);
            const ties = num(r.ties);
            return {
                category: r.category,
                model: r.model,
                elo: Math.round(num(r.elo, BASE_ELO) * 100) / 100,
                games,
                wins,
                losses: num(r.losses),
                ties,
                // A tie is half a win, as in Elo's expected score.
                win_rate: games ? Math.round(((wins + ties * 0.5) / games) * 10000) / 10000 : 0,
                median_cost_usd: r.median_cost == null ? null : Math.round(num(r.median_cost) * 1e6) / 1e6,
                median_cost: r.median_cost == null ? null : Math.round(num(r.median_cost) * 1e6) / 1e6,
                median_ms: r.median_ms == null ? null : Math.round(num(r.median_ms)),
            };
        });
        if (category) return all;
        return CATEGORIES.map((c) => ({ category: c, leaderboard: all.filter((r) => r.category === c) }));
    }

    /** The open dataset: prompts, every output (HTML included) and every vote without its voter. */
    async function dataset() {
        const rounds = await db.many('SELECT id, category, prompt, status, created_at FROM arena_rounds ORDER BY created_at, id');
        const outputs = (await db.many('SELECT * FROM arena_outputs ORDER BY created_at, id')).map(outputOf);
        const votes = (await db.many('SELECT "round", left_output, right_output, winner, at FROM arena_votes ORDER BY at, "round"')).map(voteOf);
        const byRound = new Map(rounds.map((r) => [r.id, { ...r, outputs: [], votes: [] }]));
        for (const o of outputs) { const r = byRound.get(o.round); if (r) r.outputs.push(o); }
        for (const v of votes) { const r = byRound.get(v.round); if (r) r.votes.push(v); }
        return [...byRound.values()];
    }

    async function datasetJsonl() {
        const lines = (await dataset()).map((r) => JSON.stringify(r));
        return lines.length ? `${lines.join('\n')}\n` : '';
    }

    /** A current day's budget summary for the pages and the create answer. */
    return {
        CATEGORIES, WINNERS, K, BASE_ELO,
        counts, createRound, getRound, nextPair, vote, leaderboard, dataset, datasetJsonl, shuffle,
    };
}

module.exports = { createArenaStore, ArenaError, CATEGORIES, WINNERS, K, BASE_ELO, shuffle };
