'use strict';

/**
 * The deep dive API used by /create, the canvas and the owner's rules page:
 *
 *   GET  /api/deep-dive/options           the depths and their price, plus the person's finished dives to attach
 *   GET  /api/deep-dive/mine              the person's dives, newest first
 *   GET  /api/deep-dive/:id               one dive (the owner only), its progress, points and proposals
 *   POST /api/deep-dive/attach            attach a dive the person already ran (a report link or a run id)
 *   POST /api/deep-dive/:id/cancel        stop a dive that is still running
 *   GET  /api/v1/rules/proposals          the proposed rules (owner only)
 *   POST /api/v1/rules/proposals/:id/approve|dismiss   the owner's decision
 *
 * The start of a dive for /create is not a separate call: the create plan carries the chosen depth and the
 * design's background run starts it (server/designs.js), so a price and a run are planned from the same choices.
 */
const { http } = require('openvibe-contracts');
const { asyncRouter } = require('../http/router');
const { requireSameOrigin } = require('../http/same-origin');

const owner = (req) => (req.viewer && req.viewer.kind === 'user' ? req.viewer.subject : null);
const tokenOf = (req) => (req.viewer && req.viewer.kind === 'user' ? req.viewer.token : null);
const viewer = (req) => (req.viewer && req.viewer.kind === 'user' ? req.viewer : null);

function createDeepDiveApi(ctx) {
    const routes = asyncRouter();
    const sameOrigin = requireSameOrigin(ctx.config);
    const privateJson = (res, status, body) => res.status(status).set('Cache-Control', 'private, no-store').json(body);
    const safe = (fn) => async (req, res) => {
        try { return await fn(req, res); } catch (err) {
            ctx.log.warn('[OpenVibe.Design] deep dive:', (err && err.message) || err);
            if (res.headersSent) return;
            return http.sendProblem(res, err.status || 500, err.code || 'deep_dive.error', { detail: err.status ? err.detail : 'The request could not be completed.', ctx: req.ov });
        }
    };

    routes.get('/deep-dive/options', safe(async (req, res) => {
        const options = await ctx.deepDive.options();
        const recent = owner(req) ? await ctx.deepDive.list(owner(req), { limit: 6 }) : [];
        return privateJson(res, 200, {
            ...options,
            recent: recent.filter((r) => r.status === 'done' || r.status === 'running'),
            signed_in: Boolean(owner(req)),
            note: owner(req) ? options.note : 'Sign in to start a deep dive; its price is held on your Balance before it runs.',
            design_href: '/create',
        });
    }));

    routes.get('/deep-dive/mine', safe(async (req, res) => {
        if (!owner(req)) return privateJson(res, 401, { error: 'auth.required', detail: 'Sign in to see your deep dives.' });
        return privateJson(res, 200, { dives: await ctx.deepDive.list(owner(req), { limit: Number(req.query.limit) || 8 }) });
    }));

    routes.get('/deep-dive/:id', safe(async (req, res) => {
        if (!owner(req)) return privateJson(res, 401, { error: 'auth.required', detail: 'Sign in to see this deep dive.' });
        const research = await ctx.deepDive.get(req.params.id, owner(req));
        return privateJson(res, 200, { deep_dive: research });
    }));

    routes.post('/deep-dive/attach', sameOrigin, safe(async (req, res) => {
        if (!owner(req)) return privateJson(res, 401, { error: 'auth.required', detail: 'Sign in to attach a deep dive.' });
        const body = req.body || {};
        const out = await ctx.deepDive.attach({ owner: owner(req), token: tokenOf(req), ref: body.ref || body.id || body.url || '' });
        return privateJson(res, out.existing ? 200 : 201, out);
    }));

    routes.post('/deep-dive/:id/cancel', sameOrigin, safe(async (req, res) => {
        if (!owner(req)) return privateJson(res, 401, { error: 'auth.required', detail: 'Sign in to stop a deep dive.' });
        const research = await ctx.deepDive.get(req.params.id, owner(req));
        if (!research || !research.runId) return privateJson(res, 409, { error: 'deep_dive.no_run', detail: 'That deep dive has no run to stop.' });
        if (research.status === 'done' || research.status === 'failed') return privateJson(res, 200, { deep_dive: research });
        await ctx.deepDive.client.cancel(research.runId);
        const updated = await ctx.deepDive.get(req.params.id, owner(req));
        return privateJson(res, 200, { deep_dive: updated });
    }));

    routes.get('/v1/rules/proposals', safe(async (req, res) => {
        if (!ctx.proposals.isOwner(viewer(req))) return privateJson(res, 403, { error: 'rules.owner_only', detail: 'Only the owner decides a proposed rule.' });
        return privateJson(res, 200, { proposals: await ctx.proposals.list({ state: req.query.state || 'proposed' }) });
    }));

    routes.post('/v1/rules/proposals/:id/:action', sameOrigin, safe(async (req, res) => {
        const out = await ctx.proposals.decide(req.params.id, req.params.action, viewer(req));
        return privateJson(res, 200, out);
    }));

    return routes;
}

module.exports = { createDeepDiveApi };
