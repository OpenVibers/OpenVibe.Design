'use strict';

/**
 * The Arena's data access, now backed by OpenVibe.Bench. Design keeps its own `arena_*` tables read-only
 * (legacy data and the migration script); the active engine lives on Bench.
 *
 *   createRound()  -> Bench task (service token) + round (creator token)
 *   getRound()     -> Bench round read
 *   nextPair()     -> Bench /judgements/next (person's Network token)
 *   vote()         -> Bench /rounds/:id/judgements (person's Network token)
 *   leaderboard()  -> Bench /boards/:kind?type=elo|cost
 *   datasetJsonl() -> redirect to Bench /datasets/:kind.jsonl
 */
const { ArenaError, CATEGORIES, WINNERS, K, BASE_ELO, shuffle } = require('./legacy-store');
const { sanitizeHtml } = require('./sanitize');
const { DESIGN_KINDS, kindOf, isKind } = require('./kinds');

function entryToOutput(e) {
    const payload = e.payload || {};
    return {
        id: e.id,
        round: e.round_id,
        model: e.model || 'unknown',
        provider: e.provider || null,
        html: sanitizeHtml(payload.html || ''),
        cost_usd: e.cost_usd == null ? 0 : Number(e.cost_usd),
        ms: e.ms == null ? 0 : Number(e.ms),
        tokens: e.tokens == null ? 0 : Number(e.tokens),
        error: e.error || null,
        ui_check: e.ui_check == null ? null : e.ui_check,
        created_at: e.created_at,
    };
}

function roundToLocal(r) {
    const entries = (r.entries || []).map(entryToOutput);
    const category = r.task_class || (r.kind_id === 'design.component' ? 'logo' : 'landing');
    return {
        id: r.id,
        category,
        prompt: r.prompt || '',
        status: r.status === 'finished' ? 'ready' : (r.status === 'failed' ? 'failed' : (r.status || 'queued')),
        offers: r.offers || [],
        pool_fallback: Boolean(r.pool_fallback),
        created_at: r.created_at,
        outputs: entries,
        votes: Number(r.votes || 0),
    };
}

function createArenaStore({ config, bench }) {
    async function counts(/* subject */) {
        // Bench enforces per-person and site budgets; Design no longer mirrors them.
        return null;
    }

    async function createRound({ category, prompt, token }) {
        if (!CATEGORIES.includes(category)) throw new ArenaError(422, 'arena.invalid_category', `Pick a category: ${CATEGORIES.join(', ')}.`);
        const text = String(prompt == null ? '' : prompt).trim();
        if (!text) throw new ArenaError(422, 'arena.prompt_required', 'Describe the page you want the models to design.');
        if (text.length > config.arena.maxPrompt) throw new ArenaError(422, 'arena.prompt_too_long', `The prompt must be at most ${config.arena.maxPrompt} characters.`);
        if (!token) throw new ArenaError(401, 'token.required', 'Sign in to use the Arena.');
        const { round } = await bench.createRound({ category, prompt: text, token });
        return await getRound(round.id, { token });
    }

    async function getRound(id, { token = null } = {}) {
        const r = await bench.getRound(id, { token });
        if (!r) return null;
        return roundToLocal(r);
    }

    async function nextPair(_subject, { token, category = 'landing', random: rng = Math.random } = {}) {
        if (!token) throw new ArenaError(401, 'token.required', 'Sign in at openvibe.design to use the Arena.');
        const kindId = categoryToKind(category);
        const pair = await bench.nextPair(kindId, token);
        if (!pair) return null;
        const [left, right] = shuffle([pair.left, pair.right], rng);
        return {
            round: { id: pair.round.id, category: pair.round.task_class || (pair.round.kind_id === 'design.component' ? 'logo' : 'landing'), prompt: pair.round.prompt },
            left: { id: left.id, html: sanitizeHtml((left.payload || {}).html || '') },
            right: { id: right.id, html: sanitizeHtml((right.payload || {}).html || '') },
        };
    }

    async function vote({ roundId, leftOutput, rightOutput, winner, token }) {
        if (!WINNERS.includes(winner)) throw new ArenaError(422, 'arena.invalid_winner', 'The winner must be left, right, tie or both_bad.');
        if (!leftOutput || !rightOutput || leftOutput === rightOutput) throw new ArenaError(422, 'arena.invalid_pair', 'A vote needs two different outputs.');
        if (!token) throw new ArenaError(401, 'token.required', 'Sign in at openvibe.design to use the Arena.');
        const out = await bench.castVote({ roundId, token, pair: { left: leftOutput, right: rightOutput }, winner });
        const left = out.revealed && out.revealed.left ? entryToOutput(out.revealed.left) : null;
        const right = out.revealed && out.revealed.right ? entryToOutput(out.revealed.right) : null;
        return { round: { id: roundId }, winner, at: out.judgement && out.judgement.at, left, right };
    }

    function boardRowToLocal(r) {
        return {
            category: r.category || 'all',
            model: r.subject || r.model || 'unknown',
            elo: r.elo == null ? BASE_ELO : Number(r.elo),
            games: Number(r.games || 0),
            wins: Number(r.wins || 0),
            losses: Number(r.losses || 0),
            ties: Number(r.ties || 0),
            win_rate: Number(r.win_rate || 0),
            median_cost_usd: r.median_cost_usd == null ? null : Number(r.median_cost_usd),
            median_cost: r.median_cost_usd == null ? null : Number(r.median_cost_usd),
            median_ms: r.median_ms == null ? null : Number(r.median_ms),
            ci_lower: r.ci_lower == null ? null : Number(r.ci_lower),
            ci_upper: r.ci_upper == null ? null : Number(r.ci_upper),
            provisional: Boolean(r.provisional),
            entries: Number(r.entries || 0),
            usable: Number(r.usable || 0),
            total_cost_usd: Number(r.total_cost_usd || 0),
            solved: Number(r.solved || 0),
            cost_per_solved: r.cost_per_solved == null ? null : Number(r.cost_per_solved),
        };
    }

    function categoryToKind(category) {
        return category === 'logo' || category === 'design.component' ? 'design.component' : 'design.page';
    }

    async function leaderboard(query = null) {
        const kindId = (!query || query === 'all') ? null : categoryToKind(query);
        if (kindId) {
            const elo = await bench.getBoard(kindId, { type: 'elo' });
            const rows = (elo.rows || []).map(boardRowToLocal);
            return [{ category: kindId === 'design.component' ? 'logo' : 'design.page', leaderboard: rows }];
        }
        const kinds = ['design.page', 'design.component'];
        const out = [];
        for (const kindId of kinds) {
            const elo = await bench.getBoard(kindId, { type: 'elo' });
            const category = kindId === 'design.component' ? 'logo' : 'design.page';
            out.push({ category, leaderboard: (elo.rows || []).map(boardRowToLocal) });
        }
        return out;
    }

    async function costLeaderboard(query = null) {
        const kindId = (!query || query === 'all') ? null : categoryToKind(query);
        if (kindId) {
            const cost = await bench.getBoard(kindId, { type: 'cost' });
            return [{ category: kindId === 'design.component' ? 'logo' : 'design.page', leaderboard: (cost.rows || []).map(boardRowToLocal) }];
        }
        const kinds = ['design.page', 'design.component'];
        const out = [];
        for (const kindId of kinds) {
            const cost = await bench.getBoard(kindId, { type: 'cost' });
            const category = kindId === 'design.component' ? 'logo' : 'design.page';
            out.push({ category, leaderboard: (cost.rows || []).map(boardRowToLocal) });
        }
        return out;
    }

    // ── The nine design kinds (plan L51 step 1): a blind pair of any kind for a person or a relayed voter, the vote,
    //    and every kind's board. The outputs are drawn by Bench's render origin, never by this document.
    const frameOf = (entryId) => (bench.renderUrl ? bench.renderUrl(entryId) : '');

    async function pairFor(kindId, { token = null, voter = null } = {}) {
        const kind = kindOf(kindId);
        const pair = await bench.nextJudgement(kind.id, { token, voter });
        if (!pair) return null;
        return {
            kind: kind.id,
            round: { id: pair.round.id, prompt: String(pair.round.prompt || '') },
            left: { id: pair.left.id, frame: frameOf(pair.left.id) },
            right: { id: pair.right.id, frame: frameOf(pair.right.id) },
        };
    }

    async function judge({ kind: kindId, roundId, left, right, outcome, token = null, voter = null }) {
        if (!WINNERS.includes(outcome)) throw new ArenaError(422, 'arena.invalid_winner', 'Pick left, right, a tie or both bad.');
        if (!left || !right || left === right) throw new ArenaError(422, 'arena.invalid_pair', 'A vote needs two different designs.');
        if (!roundId) throw new ArenaError(422, 'arena.invalid_pair', 'That pair has no round.');
        const out = await bench.castJudgement({ roundId, pair: { left, right }, outcome, token, voter });
        const side = (e, id) => ({
            id,
            frame: frameOf(id),
            model: (e && e.model) || 'unknown',
            provider: (e && e.provider) || null,
            cost_usd: e && e.cost_usd != null ? Number(e.cost_usd) : null,
            ms: e && e.ms != null ? Number(e.ms) : null,
        });
        const revealed = out.revealed || {};
        return {
            kind: isKind(kindId) ? kindId : kindOf(kindId).id,
            round: { id: roundId },
            outcome,
            left: side(revealed.left, left),
            right: side(revealed.right, right),
        };
    }

    // Nine boards on every view of /arena: kept for a minute (Bench's own answer is public for 30 s).
    const boardCache = new Map();
    async function boardsAll({ voters = null, now = Date.now() } = {}) {
        const key = voters === 'people' || voters === 'anon' ? voters : 'all';
        const hit = boardCache.get(key);
        if (hit && now - hit.at < 60_000) return hit.boards;
        const boards = await Promise.all(DESIGN_KINDS.map(async (kind) => {
            try {
                const b = await bench.getBoard(kind.id, { type: 'elo', voters: key === 'all' ? null : key });
                const v = (b && b.voters) || {};
                return {
                    kind: kind.id,
                    rows: ((b && b.rows) || []).map(boardRowToLocal),
                    voters: { person: Number(v.person || 0), anon: Number(v.anon || 0), total: Number(v.total || 0) },
                };
            } catch {
                return { kind: kind.id, rows: [], voters: null, failed: true };
            }
        }));
        if (!boards.every((b) => b.failed)) boardCache.set(key, { at: now, boards });
        return boards;
    }

    let costCache = null;
    async function costAll({ now = Date.now() } = {}) {
        if (costCache && now - costCache.at < 60_000) return costCache.boards;
        const boards = await costLeaderboard(null);
        costCache = { at: now, boards };
        return boards;
    }

    async function datasetJsonl() {
        // The open dataset now lives on Bench; Design redirects to it.
        return { redirect: bench.datasetUrl('design.page') };
    }

    return {
        CATEGORIES, WINNERS, K, BASE_ELO, shuffle,
        counts, createRound, getRound, nextPair, vote, leaderboard, costLeaderboard, datasetJsonl,
        pairFor, judge, boardsAll, costAll,
    };
}

module.exports = { createArenaStore, ArenaError, CATEGORIES, WINNERS, K, BASE_ELO, shuffle };
