'use strict';

/**
 * The create API, /api/create:
 *
 *   GET  /options          kinds, frames, looks, models and takes (signed in or not)
 *   POST /estimate         the same body a create takes → per model, total, Balance, whether it covers it
 *   POST /                 the create request → the design and its takes
 *   GET  /recent           the person's designs, newest first, paged
 *   GET  /designs/:id/thumb.svg   the recent list's card (a generated look card, not a screenshot)
 *
 * A guest is a guest (today's two-a-day IP limit and secret edit key); a signed-in person is their own owner
 * and their Balance is read with their own token. The create and the estimate share server/create/plan.js, so a
 * price and a run can never be planned from different choices.
 */
const { http } = require('openvibe-contracts');
const { asyncRouter } = require('../http/router');
const { requireSameOrigin } = require('../http/same-origin');
const { resolvePlan, estimatePlan, withBalance } = require('./plan');

const owner = (req) => (req.viewer && req.viewer.kind === 'user' ? req.viewer.subject : null);
const viewer = (req) => (req.viewer && req.viewer.kind === 'user' ? req.viewer : null);
const token = (req) => (req.viewer && req.viewer.kind === 'user' ? req.viewer.token : null);
const keyOf = (req) => req.get('x-design-key') || req.query.key || (req.body && (req.body.key || (req.body.start && req.body.start.key))) || null;

function draftsOf(req) {
    try {
        const links = JSON.parse((req.cookies && req.cookies.design_drafts) || '[]');
        return Array.isArray(links) ? links : [];
    } catch { return []; }
}

function draftKeyFor(req, id) {
    const found = draftsOf(req).find((item) => item && item.id === id);
    return found ? found.key : null;
}

function createCreateApi(ctx) {
    const routes = asyncRouter();
    const sameOrigin = requireSameOrigin(ctx.config);
    const privateJson = (res, status, body) => res.status(status).set('Cache-Control', 'private, no-store').json(body);
    const safe = (fn) => async (req, res) => {
        try { return await fn(req, res); } catch (err) {
            ctx.log.warn('[OpenVibe.Design] create:', (err && err.message) || err);
            if (res.headersSent) return;
            return http.sendProblem(res, err.status || 500, err.code || 'create.error', {
                detail: err.status ? err.detail : 'The request could not be completed.', ctx: req.ov,
            });
        }
    };

    routes.get('/options', safe(async (req, res) => {
        const signedIn = Boolean(owner(req));
        const all = await ctx.createOptions.options({ token: token(req) });
        if (signedIn) res.set('Cache-Control', 'private, no-store');
        else res.set({ 'Cache-Control': 'public, max-age=300', Vary: 'Cookie' });
        return res.json(ctx.createOptions.publicOptions(all));
    }));

    const requestKey = (req) => {
        const startId = req.body && req.body.start && req.body.start.design_id;
        return keyOf(req) || (startId ? draftKeyFor(req, String(startId)) : null);
    };

    routes.post('/estimate', sameOrigin, safe(async (req, res) => {
        const all = await ctx.createOptions.options({ token: token(req) });
        const plan = await resolvePlan(req.body || {}, {
            options: all, designs: ctx.designs, ai: ctx.ai, owner: owner(req), key: requestKey(req), viewer: viewer(req), config: ctx.config,
        });
        const estimate = estimatePlan(plan);
        const signedIn = Boolean(owner(req));
        const balance = signedIn ? await ctx.balance.read(token(req)) : null;
        return privateJson(res, 200, {
            ...withBalance(estimate, balance),
            kind: plan.kind, frame: plan.frame, look: plan.look,
            legacy: plan.legacy,
            ...(signedIn ? {} : { balance_note: 'Sign in to see your Balance.' }),
        });
    }));

    routes.post('/', sameOrigin, safe(async (req, res) => {
        const all = await ctx.createOptions.options({ token: token(req) });
        const plan = await resolvePlan(req.body || {}, {
            options: all, designs: ctx.designs, ai: ctx.ai, owner: owner(req), key: requestKey(req), viewer: viewer(req), config: ctx.config,
        });
        const estimate = estimatePlan(plan);
        const out = await ctx.designs.create({
            prompt: plan.prompt,
            kind: plan.kind,
            frame: plan.frame,
            themeId: plan.themeId,
            look: plan.look,
            lookVariables: plan.lookVariables,
            models: plan.legacy ? null : plan.models,
            takes: plan.legacy ? null : plan.takes,
            start: plan.start,
            sourceDesignId: plan.start.source_design_id || null,
            estimate,
            who: (req.body || {}).who,
            owner: owner(req), ip: req.ip,
        });
        if (out.editKey) {
            let links = draftsOf(req);
            links = [{ id: out.design.id, key: out.editKey }, ...links.filter((x) => x && x.id !== out.design.id)].slice(0, 3);
            res.cookie('design_drafts', JSON.stringify(links), { httpOnly: true, sameSite: 'lax',
                secure: ctx.config.cookies.secure, maxAge: 30 * 86400000, path: '/' });
        }
        const signedIn = Boolean(owner(req));
        const balance = signedIn ? await ctx.balance.read(token(req)) : null;
        return privateJson(res, 201, {
            design: out.design,
            takes: out.takes || [],
            estimate: withBalance(estimate, balance),
            ...(out.editKey ? { editKey: out.editKey, editUrl: out.editUrl } : {}),
        });
    }));

    routes.get('/recent', safe(async (req, res) => {
        const limit = Math.max(1, Math.min(48, Number.parseInt(req.query.limit, 10) || 12));
        const before = typeof req.query.before === 'string' && req.query.before ? req.query.before : null;
        const links = draftsOf(req);
        const rows = await ctx.designs.recent(owner(req), links, { limit, before });
        const last = rows.length ? rows[rows.length - 1].createdAt : null;
        return privateJson(res, 200, {
            designs: rows,
            next: rows.length === limit && last ? last : null,
            limit,
        });
    }));

    routes.get('/designs/:id/thumb.svg', safe(async (req, res) => {
        const id = String(req.params.id || '');
        const key = keyOf(req) || draftKeyFor(req, id);
        const out = await ctx.designs.thumbnail(id, owner(req), key, viewer(req));
        res.set({
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'private, max-age=60',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
            'X-Content-Type-Options': 'nosniff',
        });
        return res.send(out.svg);
    }));

    return routes;
}

module.exports = { createCreateApi };
