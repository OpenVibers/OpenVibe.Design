'use strict';

/**
 * The theme API proxy: OpenVibe.Design signs the person in and forwards their theme calls to OpenVibe.Network's
 * /api/themes, with the access token from the httpOnly design_at cookie as a Bearer. The token is never logged,
 * echoed, put in a URL or sent anywhere but the configured Network.
 *
 *   GET  /api/themes                              public catalogue, cached in memory for 5 minutes
 *   GET  /api/themes/:idOrSlug                    one public theme
 *   GET  /api/me/theme                            Network GET /api/themes/me/active → { theme_id, theme, custom_variables }
 *   PUT  /api/me/theme                            Network PUT /api/themes/me with source 'studio'
 *   GET  /api/me/theme/history                    Network GET /api/themes/me/history
 *   POST /api/me/theme/history/:id/restore        Network's restore (id a positive integer)
 *   POST /api/themes/submit                       Network POST /api/themes
 *   GET  /api/v1/tokens                           the export targets and the token names (OpenVibe Tokens)
 *   GET  /api/v1/tokens/:idOrSlug?format=&both=&download=   a theme as code: css, tailwind, compose, swiftui, flutter,
 *                                                 figma or json (DTCG); both=0 leaves out its other half; download=1
 *                                                 names a file
 *
 * Writes need the request's Origin to be this site's own origin (CSRF), otherwise 403 design.cross_site. A Network
 * 4xx answer is passed through with its status and body; a Network failure is 502. Everything under /api/me is
 * private, no-store.
 */
const { http } = require('openvibe-contracts');
const { asyncRouter } = require('./router');
const { ACCESS_COOKIE } = require('../auth/sso');
const { ownOrigin, bearer, requireSameOrigin } = require('./same-origin');
const themeTokens = require('../tokens');

/** A Network 4xx answer, with its own status and body. A 2xx answer is passed through the same way. */
function passThrough(res, r) {
    res.status(r.status);
    if (r.contentType) res.set('Content-Type', r.contentType);
    if (r.status === 204 || (!r.text && r.data == null)) return res.end();
    return res.send(r.text || JSON.stringify(r.data));
}

function failure(res, req, err) {
    const r = err && err.response;
    if (r && r.status >= 400 && r.status < 500) return passThrough(res, r);
    return http.sendProblem(res, 502, 'network.unavailable', {
        detail: 'OpenVibe.Network did not answer. Try again in a moment.',
        ctx: req.ov,
    });
}

/** A Network answer: its 4xx status and body pass through; a 5xx (or no answer) is this service's 502. */
function forward(res, req, up) {
    if (up.status >= 500) return failure(res, req, { response: up });
    return passThrough(res, up);
}

function createApi(ctx) {
    const { config, catalog, log } = ctx;
    const r = asyncRouter();
    // A cookie write needs a same-origin signal; a Bearer write is not cookie-authenticated and is left alone.
    const requireOrigin = requireSameOrigin(config, { detail: 'A change to a theme must come from openvibe.design itself.' });

    /** The person's Network access token: the Bearer they sent, else the httpOnly cookie. */
    function requireToken(req, res, next) {
        const token = bearer(req) || (req.cookies && req.cookies[ACCESS_COOKIE]);
        if (!token) {
            return http.sendProblem(res, 401, 'token.required', {
                detail: 'Sign in at openvibe.design to use your theme.',
                ctx: req.ov,
            });
        }
        req.themeToken = token;
        return next();
    }

    // /api/me/* is a person's own setting: no shared cache, no browser cache.
    r.use('/me', (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

    // ── Public catalogue ────────────────────────────────────
    r.get('/themes', async (req, res) => {
        try {
            const data = await catalog.list();
            res.set('Cache-Control', 'public, max-age=120');
            return res.json(data);
        } catch (err) {
            log.warn('[OpenVibe.Design] theme catalogue failed:', (err && err.message) || err);
            return failure(res, req, err);
        }
    });

    // ── OpenVibe Tokens: any public theme as code for every platform (public, cacheable) ──
    r.get('/v1/tokens', (req, res) => {
        res.set('Cache-Control', 'public, max-age=3600');
        return res.json({ targets: themeTokens.TARGETS.map(({ id, label, ext, lang }) => ({ id, label, ext, lang })), docs: 'https://openvibe.design/tokens' });
    });
    r.get('/v1/tokens/:idOrSlug', async (req, res) => {
        const format = String(req.query.format || 'json');
        const target = themeTokens.TARGETS.find((t) => t.id === format);
        if (!target) return http.sendProblem(res, 400, 'tokens.format', { detail: `format is one of ${themeTokens.TARGETS.map((t) => t.id).join(', ')}.`, ctx: req.ov });
        let list;
        try { list = await catalog.list(); } catch (err) { return failure(res, req, err); }
        const found = themeTokens.resolve(list.themes, req.params.idOrSlug, { both: req.query.both !== '0' });
        if (!found) return http.sendProblem(res, 404, 'theme.not_found', { detail: 'No public theme by that name.', ctx: req.ov });
        const body = themeTokens.compile(found.docs.length > 1 ? found.docs : found.docs[0], target.id);
        res.set('Cache-Control', 'public, max-age=600');
        res.type(`${target.type}; charset=utf-8`);
        if (req.query.download === '1') res.set('Content-Disposition', `attachment; filename="${themeTokens.fileName(found.docs[0], target.id)}"`);
        return res.send(body);
    });

    // A submission is a write: same-origin, signed in, and the same body Network expects.
    r.post('/themes/submit', requireOrigin, requireToken, async (req, res) => {
        const b = req.body && typeof req.body === 'object' ? req.body : {};
        const body = { name: b.name, slug: b.slug, description: b.description, mode: b.mode, variables: b.variables, tags: b.tags };
        try {
            const up = await catalog.request('', { method: 'POST', token: req.themeToken, body });
            return forward(res, req, up);
        } catch (err) {
            log.warn('[OpenVibe.Design] theme submission failed:', (err && err.message) || err);
            return failure(res, req, err);
        }
    });

    r.get('/themes/:idOrSlug', async (req, res) => {
        try {
            const up = await catalog.get(req.params.idOrSlug);
            if (up.ok) res.set('Cache-Control', 'public, max-age=120');
            return forward(res, req, up);
        } catch (err) {
            log.warn('[OpenVibe.Design] theme lookup failed:', (err && err.message) || err);
            return failure(res, req, err);
        }
    });

    // ── The signed-in person's theme ────────────────────────
    r.get('/me/theme', requireToken, async (req, res) => {
        try {
            const up = await catalog.request('/me/active', { token: req.themeToken });
            if (up.status >= 400) return forward(res, req, up);
            if (!up.ok) return failure(res, req, { response: up });
            const d = up.data || {};
            const out = {
                theme_id: d.theme_id === undefined ? null : d.theme_id,
                theme: d.theme === undefined ? null : d.theme,
                custom_variables: d.custom_variables === undefined ? null : d.custom_variables,
            };
            // Network's active answer names the theme; the page wants what it is. Ask the catalogue/detail only
            // when the answer did not carry the object itself, and never fail the read because of it.
            if (!out.theme && out.theme_id) {
                try {
                    const found = await catalog.get(out.theme_id, { token: req.themeToken });
                    if (found.ok && found.data && found.data.theme) out.theme = found.data.theme;
                } catch { /* the id is still useful without the object */ }
            }
            return res.json(out);
        } catch (err) {
            log.warn('[OpenVibe.Design] active theme failed:', (err && err.message) || err);
            return failure(res, req, err);
        }
    });

    r.put('/me/theme', requireOrigin, requireToken, async (req, res) => {
        const b = req.body && typeof req.body === 'object' ? req.body : {};
        const body = { theme_id: b.theme_id, custom_variables: b.custom_variables, source: 'studio' };
        try {
            const up = await catalog.request('/me', { method: 'PUT', token: req.themeToken, body });
            return forward(res, req, up);
        } catch (err) {
            log.warn('[OpenVibe.Design] saving the theme failed:', (err && err.message) || err);
            return failure(res, req, err);
        }
    });

    r.get('/me/theme/history', requireToken, async (req, res) => {
        try {
            const up = await catalog.request('/me/history', { token: req.themeToken });
            return forward(res, req, up);
        } catch (err) {
            log.warn('[OpenVibe.Design] theme history failed:', (err && err.message) || err);
            return failure(res, req, err);
        }
    });

    r.post('/me/theme/history/:id/restore', requireOrigin, requireToken, async (req, res) => {
        const id = String(req.params.id || '');
        const n = Number(id);
        if (!/^\d+$/.test(id) || !Number.isSafeInteger(n) || n < 1) {
            return http.sendProblem(res, 400, 'design.invalid_history_id', {
                detail: 'The history id must be a positive integer.',
                ctx: req.ov,
            });
        }
        try {
            const up = await catalog.request(`/me/history/${n}/restore`, { method: 'POST', token: req.themeToken });
            return forward(res, req, up);
        } catch (err) {
            log.warn('[OpenVibe.Design] restoring a theme failed:', (err && err.message) || err);
            return failure(res, req, err);
        }
    });

    return r;
}

module.exports = { createApi, ownOrigin };
