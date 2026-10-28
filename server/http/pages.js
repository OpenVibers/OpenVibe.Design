'use strict';

/**
 * The public pages:
 *   /                 the theme catalogue's front door
 *   /studio           the theme studio (the shell the main session's public/js/studio.js fills)
 *   /t/:slug          one public theme
 *   /developers       the API, for people and agents
 *
 * Every page is server-rendered and complete without JavaScript. A page for a signed-in person is private and
 * never cached; a public page gets the short 120-second window. `me` comes from the session the SSO middleware
 * already resolved — a guest never causes a Network call to find out they are a guest.
 */
const views = require('../views');
const { asyncRouter } = require('./router');
const { send } = require('../render/layout');

function meOf(viewer) {
    if (!viewer || viewer.kind !== 'user') return { signedIn: false, user: null };
    return {
        signedIn: true,
        user: {
            subject_id: viewer.subject || null,
            username: viewer.username || null,
            display_name: viewer.displayName || null,
            role: viewer.role || 'user',
            avatar_url: viewer.avatarUrl || null,
            profile_color: viewer.profileColor || null,
        },
    };
}

function createPageRoutes(ctx) {
    const { catalog, log } = ctx;
    const r = asyncRouter();
    // The catalogue never throws in a page: a Network failure degrades to the page without its list.
    const safe = (fn) => Promise.resolve().then(fn).catch((err) => {
        log.warn('[OpenVibe.Design] page catalogue failed:', (err && err.message) || err);
        return null;
    });
    const page = (res, status, html, viewer) => send(res, status, html, { viewer });

    r.get('/', async (req, res) => {
        const list = await safe(() => catalog.list());
        return page(res, 200, views.home({ themes: list ? list.themes : null }), req.viewer);
    });

    r.get('/studio', async (req, res) => {
        const list = await safe(() => catalog.list());
        return page(res, 200, views.studio({ themes: list ? list.themes : null, me: meOf(req.viewer) }), req.viewer);
    });

    r.get('/t/:slug', async (req, res) => {
        let up;
        try {
            up = await catalog.get(req.params.slug);
        } catch (err) {
            log.warn('[OpenVibe.Design] theme page failed:', (err && err.message) || err);
            res.set('Cache-Control', 'no-store');
            return res.status(502).type('text/plain').send('OpenVibe.Network did not answer. Try again in a moment.');
        }
        if (up.status === 404) return page(res, 404, views.notFound(), req.viewer);
        if (!up.ok || !up.data || !up.data.theme) {
            res.set('Cache-Control', 'no-store');
            return res.status(502).type('text/plain').send('That theme could not be read right now. Try again in a moment.');
        }
        return page(res, 200, views.theme({ theme: up.data.theme }), req.viewer);
    });

    r.get('/developers', (req, res) => page(res, 200, views.developers(), req.viewer));

    r.use((req, res) => page(res, 404, views.notFound(), req.viewer));
    return r;
}

module.exports = { createPageRoutes, meOf };
