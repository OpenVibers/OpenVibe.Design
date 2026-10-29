'use strict';

const { http } = require('openvibe-contracts');
const { asyncRouter } = require('./router');
const { requireSameOrigin } = require('./same-origin');

const owner = req => req.viewer && req.viewer.kind === 'user' ? req.viewer.subject : null;
const key = req => req.get('x-design-key') || req.query.key;

function createDesignApi(ctx) {
    const routes = asyncRouter();
    const safe = fn => async (req, res) => {
        try { return await fn(req, res); }
        catch (err) {
            ctx.log.warn('[OpenVibe.Design] Studio:', err.message);
            return http.sendProblem(res, err.status || 500, err.code || 'design.error', {
                detail: err.status ? err.detail : 'The design could not be completed.', ctx: req.ov,
            });
        }
    };
    routes.post('/', requireSameOrigin(ctx.config), safe(async (req, res) => {
        const body = req.body || {};
        const result = await ctx.designs.create({ prompt: body.prompt, kind: body.kind || 'page',
            themeId: body.themeId, owner: owner(req), ip: req.ip });
        if (result.editKey) {
            let links = [];
            try { links = JSON.parse(req.cookies.design_drafts || '[]'); if (!Array.isArray(links)) links = []; } catch { /* empty */ }
            links = [{ id: result.design.id, key: result.editKey }, ...links.filter(x => x.id !== result.design.id)].slice(0, 3);
            res.cookie('design_drafts', JSON.stringify(links), { httpOnly: true, sameSite: 'lax',
                secure: ctx.config.cookies.secure, maxAge: 30 * 86400000, path: '/' });
        }
        return res.status(201).set('Cache-Control', 'private, no-store').json(result);
    }));
    routes.get('/:id', safe(async (req, res) => res.set('Cache-Control', 'private, no-store')
        .json(await ctx.designs.read(req.params.id, owner(req), key(req)))));
    routes.post('/:id/theme', requireSameOrigin(ctx.config), safe(async (req, res) => res
        .json(await ctx.designs.setTheme(req.params.id, (req.body || {}).themeId, owner(req), key(req) || (req.body || {}).editKey))));
    return routes;
}

module.exports = { createDesignApi };
