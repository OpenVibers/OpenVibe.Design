'use strict';

/**
 * The Design Studio API, /api/v1/designs:
 *
 *   POST /                         create three model variants (part A)
 *   GET  /:id                      generation status, the working frame and the version list
 *   POST /:id/theme                change the token theme
 *   POST /:id/pick                 choose the working frame; the pick is one Arena vote
 *   POST /:id/edit                 chat edit the working frame (paid AI, small per-design budget)
 *   POST /:id/click                apply one validated click edit to the working frame
 *   GET  /:id/versions             the readable, append-only version list
 *   POST /:id/undo, /:id/redo      move the working-frame pointer; history is never deleted
 *
 * A design is private: its owner sees it through the session, a guest through the secret key header or query.
 * A cookie-authenticated write must come from this site; every answer is `private, no-store`.
 */
const { http } = require('openvibe-contracts');
const { asyncRouter } = require('./router');
const { requireSameOrigin } = require('./same-origin');

const owner = req => req.viewer && req.viewer.kind === 'user' ? req.viewer.subject : null;
/** The session viewer the share check reads (`kind`, `subject`), never a token. */
const viewer = req => req.viewer && req.viewer.kind === 'user' ? req.viewer : null;
const token = req => req.viewer && req.viewer.kind === 'user' ? req.viewer.token : null;
const keyOf = (req) => req.get('x-design-key') || req.query.key || (req.body && req.body.editKey) || null;

function createDesignApi(ctx) {
    const routes = asyncRouter();
    const sameOrigin = requireSameOrigin(ctx.config);
    const priv = (res, status, body) => res.status(status).set('Cache-Control', 'private, no-store').json(body);
    const safe = fn => async (req, res) => {
        try { return await fn(req, res); }
        catch (err) {
            ctx.log.warn('[OpenVibe.Design] Studio:', err.message);
            return http.sendProblem(res, err.status || 500, err.code || 'design.error', {
                detail: err.status ? err.detail : 'The design could not be completed.', ctx: req.ov,
            });
        }
    };
    routes.post('/', sameOrigin, safe(async (req, res) => {
        const body = req.body || {};
        const result = await ctx.designs.create({ prompt: body.prompt, kind: body.kind || 'page',
            themeId: body.themeId, owner: owner(req), ip: req.ip, who: body.who });
        if (result.editKey) {
            let links = [];
            try { links = JSON.parse(req.cookies.design_drafts || '[]'); if (!Array.isArray(links)) links = []; } catch { /* empty */ }
            links = [{ id: result.design.id, key: result.editKey }, ...links.filter(x => x.id !== result.design.id)].slice(0, 3);
            res.cookie('design_drafts', JSON.stringify(links), { httpOnly: true, sameSite: 'lax',
                secure: ctx.config.cookies.secure, maxAge: 30 * 86400000, path: '/' });
        }
        return priv(res, 201, result);
    }));
    routes.get('/:id', safe(async (req, res) => priv(res, 200,
        await ctx.designs.read(req.params.id, owner(req), keyOf(req), viewer(req)))));
    routes.post('/:id/theme', sameOrigin, safe(async (req, res) => priv(res, 200,
        await ctx.designs.setTheme(req.params.id, (req.body || {}).themeId, owner(req), keyOf(req), viewer(req)))));
    // Publish the working frame on openvibe.space (open item D8): the owner only; { name? } for a new site.
    routes.post('/:id/publish', sameOrigin, safe(async (req, res) => priv(res, 200,
        await ctx.designs.publish({ id: req.params.id, owner: owner(req), name: (req.body || {}).name || '', publisher: ctx.publisher }))));
    routes.post('/:id/pick', sameOrigin, safe(async (req, res) => {
        const body = req.body || {};
        const result = await ctx.designs.pick({ id: req.params.id, variantIndex: body.variantIndex,
            variantId: body.variantId, owner: owner(req), key: keyOf(req), subject: owner(req), token: token(req), viewer: viewer(req) });
        return priv(res, result.idempotent ? 200 : 201, result);
    }));
    routes.post('/:id/edit', sameOrigin, safe(async (req, res) => {
        const body = req.body || {};
        const result = await ctx.designs.chatEdit({ id: req.params.id, instruction: body.instruction,
            owner: owner(req), key: keyOf(req), subject: owner(req), viewer: viewer(req) });
        return priv(res, 200, result);
    }));
    routes.post('/:id/click', sameOrigin, safe(async (req, res) => {
        const body = req.body || {};
        const result = await ctx.designs.clickEdit({ id: req.params.id, path: body.path, text: body.text,
            color: body.color, spacing: body.spacing, align: body.align, owner: owner(req), key: keyOf(req), subject: owner(req), viewer: viewer(req) });
        return priv(res, 201, result);
    }));
    // ── Elements (OpenVibe Elements stage 2) ────────────────
    // A design of kind Element keeps a ui.element@1 document instead of an HTML take. These routes move its
    // generated sliders, run it on sample data, add it to the maker's Live channel, and publish it to
    // Exchange's free gallery. In every one the person's own token is the credential.
    const authorNameOf = (req) => (req.viewer && (req.viewer.displayName || req.viewer.username)) || 'A maker';
    routes.get('/:id/element/simulate', safe(async (req, res) => priv(res, 200,
        await ctx.designs.simulate(req.params.id, { owner: owner(req), key: keyOf(req), viewer: viewer(req) }))));
    routes.post('/:id/element/tweak', sameOrigin, safe(async (req, res) => priv(res, 200,
        await ctx.designs.tweakElement({ id: req.params.id, values: req.body || {}, owner: owner(req), key: keyOf(req), viewer: viewer(req) }))));
    routes.post('/:id/element/channel', sameOrigin, safe(async (req, res) => {
        if (!owner(req)) return priv(res, 401, { error: 'design.sign_in', detail: 'Sign in to add an element to your channel.' });
        const { element } = await ctx.designs.elementOf({ id: req.params.id, owner: owner(req), key: keyOf(req), viewer: viewer(req), authorName: authorNameOf(req), sharing: 'private' });
        let channel;
        try {
            channel = await ctx.elementHandoff.addToChannel({ element, token: token(req) });
            channel.at = new Date().toISOString();
        } catch (err) {
            channel = { error: String(err.message || 'Live did not accept the element.').slice(0, 300), at: new Date().toISOString() };
            await ctx.designs.rememberHandoff({ id: req.params.id, owner: owner(req), key: keyOf(req), viewer: viewer(req), kind: 'channel', value: channel });
            return priv(res, err.status || 502, { error: err.code || 'design.handoff_refused', detail: channel.error, channel });
        }
        const data = await ctx.designs.rememberHandoff({ id: req.params.id, owner: owner(req), key: keyOf(req), viewer: viewer(req), kind: 'channel', value: channel });
        return priv(res, 200, { channel, ...data });
    }));
    routes.post('/:id/element/gallery', sameOrigin, safe(async (req, res) => {
        if (!owner(req)) return priv(res, 401, { error: 'design.sign_in', detail: 'Sign in to publish an element to the gallery.' });
        const { design, element } = await ctx.designs.elementOf({ id: req.params.id, owner: owner(req), key: keyOf(req), viewer: viewer(req),
            authorName: (req.viewer && (req.viewer.displayName || req.viewer.username)) || 'A maker', sharing: 'gallery' });
        try {
            const listing = await ctx.gallery.publish({ subject: owner(req), authorName: (req.viewer && (req.viewer.displayName || req.viewer.username)) || 'A maker',
                authorUsername: (req.viewer && req.viewer.username) || null, document: element, source: 'design', sourceId: req.params.id, remixOf: design.elementRemixOf || null });
            const value = { id: listing.id, slug: listing.slug, url: `/gallery/${encodeURIComponent(listing.slug)}`, at: new Date().toISOString() };
            const data = await ctx.designs.rememberHandoff({ id: req.params.id, owner: owner(req), key: keyOf(req), viewer: viewer(req), kind: 'listing', value });
            return priv(res, 201, { listing: value, ...data });
        } catch (err) {
            return priv(res, err.status || 502, { error: err.code || 'design.gallery_refused', detail: String(err.message || 'The gallery did not accept the element.').slice(0, 300) });
        }
    }));

    routes.get('/:id/versions', safe(async (req, res) => priv(res, 200,
        await ctx.designs.versions(req.params.id, owner(req), keyOf(req), viewer(req)))));
    routes.post('/:id/undo', sameOrigin, safe(async (req, res) => priv(res, 200,
        await ctx.designs.undo(req.params.id, owner(req), keyOf(req), viewer(req)))));
    routes.post('/:id/redo', sameOrigin, safe(async (req, res) => priv(res, 200,
        await ctx.designs.redo(req.params.id, owner(req), keyOf(req), viewer(req)))));
    return routes;
}

module.exports = { createDesignApi };
