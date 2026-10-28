'use strict';

/**
 * The Arena API, /api/v1/arena/*:
 *
 *   GET  /categories                 the six categories
 *   POST /rounds                     start a Bench task and round (signed in, same-origin)
 *   GET  /rounds/:id                 one round with its outputs
 *   GET  /vote                       the next blind pair for this person
 *   POST /vote                       Bench records a vote and reveals the two models
 *   GET  /leaderboard[?type=cost]     Bench Elo or Cost board
 *   GET  /dataset.jsonl              redirect to Bench's design.page dataset
 *
 * Bench queues and generates each round. The request never waits for a model.
 */
const { http } = require('openvibe-contracts');
const { asyncRouter } = require('../http/router');
const { ArenaError, CATEGORIES } = require('../arena/store');
const { BenchClientError } = require('../arena/bench');
const { ownOrigin, requireSameOrigin } = require('./same-origin');

function subjectOf(req) {
    return req.viewer && req.viewer.kind === 'user' && req.viewer.subject ? req.viewer.subject : null;
}

function tokenOf(req) {
    return req.viewer && req.viewer.kind === 'user' ? req.viewer.token : null;
}

function createArenaApi(ctx) {
    const { arena, config, log } = ctx;
    const r = asyncRouter();

    const problem = (res, req, status, code, detail) => http.sendProblem(res, status, code, { detail, ctx: req.ov });

    // A cookie-authenticated write must carry Sec-Fetch-Site: same-origin or an Origin equal to this
    // site; a missing signal is refused. A Bearer write is not cookie-authenticated and is unaffected.
    const requireOrigin = requireSameOrigin(config, { detail: 'An Arena change must come from openvibe.design itself.' });

    function requireSubject(req, res, next) {
        if (!subjectOf(req)) return problem(res, req, 401, 'token.required', 'Sign in at openvibe.design to use the Arena.');
        return next();
    }

    const failed = (res, req, err) => {
        if (err instanceof ArenaError) return problem(res, req, err.status, err.code, err.detail);
        if (err instanceof BenchClientError) return problem(res, req, err.status >= 500 ? err.status : 502, err.code, err.detail);
        log.warn('[OpenVibe.Design] Arena API failed:', (err && err.message) || err);
        return problem(res, req, 500, 'internal.error', 'The Arena could not answer. Try again in a moment.');
    };

    r.get('/categories', (_req, res) => res.json({ categories: CATEGORIES }));

    async function leaderboard(req, res) {
        const category = req.query.category == null || req.query.category === '' ? null : String(req.query.category);
        const kind = req.query.kind == null || req.query.kind === '' ? null : String(req.query.kind);
        const type = req.query.type === 'cost' ? 'cost' : 'elo';
        if (category && !CATEGORIES.includes(category)) {
            return problem(res, req, 400, 'arena.invalid_category', `Pick a category: ${CATEGORIES.join(', ')}.`);
        }
        if (kind && kind !== 'design.page' && kind !== 'design.component') {
            return problem(res, req, 400, 'arena.invalid_category', 'Pick design.page or design.component.');
        }
        try {
            const query = kind || category || null;
            const list = type === 'cost' ? await arena.costLeaderboard(query) : await arena.leaderboard(query);
            res.set('Cache-Control', 'public, max-age=30');
            if (query) return res.json({ category: query, type, leaderboard: list[0] ? list[0].leaderboard : [] });
            return res.json({ categories: list, type, leaderboard: list.flatMap((c) => c.leaderboard) });
        } catch (err) { return failed(res, req, err); }
    }
    r.get('/leaderboard', leaderboard);
    r.get('/leaderboards', leaderboard);

    async function dataset(req, res) {
        try {
            const out = await arena.datasetJsonl();
            if (out && out.redirect) {
                res.set('Cache-Control', 'public, max-age=60');
                return res.redirect(302, out.redirect);
            }
            const text = typeof out === 'string' ? out : '';
            res.set('Cache-Control', 'public, max-age=60');
            res.set('Content-Disposition', 'attachment; filename="arena-dataset.jsonl"');
            return res.type('application/x-ndjson').send(text);
        } catch (err) { return failed(res, req, err); }
    }
    r.get('/dataset.jsonl', dataset);
    r.get('/dataset', dataset);

    r.post('/rounds', requireOrigin, requireSubject, async (req, res) => {
        const b = req.body && typeof req.body === 'object' ? req.body : {};
        try {
            const round = await arena.createRound({ category: String(b.category || ''), prompt: b.prompt, subject: subjectOf(req), token: tokenOf(req) });
            res.set('Cache-Control', 'private, no-store');
            res.set('Location', `/api/v1/arena/rounds/${round.id}`);
            return res.status(201).json({ round });
        } catch (err) { return failed(res, req, err); }
    });

    async function readRound(req, res) {
        try {
            const round = await arena.getRound(String(req.params.id || ''), { token: tokenOf(req) });
            if (!round) return problem(res, req, 404, 'arena.round_not_found', 'No such Arena round.');
            res.set('Cache-Control', tokenOf(req) ? 'private, no-store' : 'public, max-age=30');
            return res.json({ round });
        } catch (err) { return failed(res, req, err); }
    }
    r.get('/rounds/:id', readRound);
    r.get('/round/:id', readRound);

    async function nextPair(req, res) {
        try {
            const category = String(req.query.category || 'landing');
            if (!CATEGORIES.includes(category)) return problem(res, req, 400, 'arena.invalid_category', 'Pick a valid category.');
            const pair = await arena.nextPair(subjectOf(req), { token: tokenOf(req), category, random: ctx.random || Math.random });
            res.set('Cache-Control', 'private, no-store');
            if (!pair) return res.json({ pair: null, detail: 'There is no round waiting for your vote. Start one, or come back when another is ready.' });
            return res.json(pair);
        } catch (err) { return failed(res, req, err); }
    }
    r.get('/vote', requireSubject, nextPair);
    r.get('/vote/next', requireSubject, nextPair);
    r.get('/next', requireSubject, nextPair);

    async function castVote(req, res) {
        const b = req.body && typeof req.body === 'object' ? req.body : {};
        try {
            const out = await arena.vote({
                roundId: String(b.round_id || b.round || ''),
                subject: subjectOf(req),
                leftOutput: String(b.left_output || b.left || ''),
                rightOutput: String(b.right_output || b.right || ''),
                winner: String(b.winner || ''),
                token: tokenOf(req),
            });
            res.set('Cache-Control', 'private, no-store');
            return res.status(201).json({
                vote: { round: out.round.id, left_output: out.left.id, right_output: out.right.id, winner: out.winner, at: out.at },
                revealed: { left: out.left, right: out.right },
            });
        } catch (err) { return failed(res, req, err); }
    }
    r.post('/vote', requireOrigin, requireSubject, castVote);
    r.post('/votes', requireOrigin, requireSubject, castVote);

    return r;
}

module.exports = { createArenaApi, ownOrigin, subjectOf };
