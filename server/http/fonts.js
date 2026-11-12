'use strict';

// GET /fonts/css2?family=Name+With+Spaces[:wght@400;700]&display=swap — the self-hosted fonts as @font-face CSS.
// GET /api/v1/fonts — public/fonts/fonts.json: the self-hosted families (family, slug, weights, licence, source).
// GET /api/v1/fonts/library?q=&category=&script=&weight= — the wider open licence catalogue (Fontsource CDN).
// GET /api/v1/fonts/library/:family and /api/v1/fonts/:family — one catalogue family, metadata and pairings.
const { asyncRouter } = require('./router');
const views = require('../views/fonts');
const vendored = require('../fonts/vendored');

function createFontRoutes({ fonts }) {
    const r = asyncRouter();
    const filters = req => ({ q: String(req.query.q || '').slice(0, 100), category: String(req.query.category || '').slice(0, 40),
        script: String(req.query.script || '').slice(0, 40), weight: String(req.query.weight || '').slice(0, 4) });

    // The self-hosted CSS. The font files are under /fonts/<slug>/ and served by app.js with immutable caching.
    r.get('/fonts/css2', (req, res) => {
        vendored.allowFontCors(req, res);
        res.set('Cache-Control', 'public, max-age=86400').type('text/css; charset=utf-8').send(vendored.cssFor(req.query));
    });
    r.options('/fonts/css2', (req, res) => {
        vendored.allowFontCors(req, res);
        res.set('Access-Control-Allow-Methods', 'GET, OPTIONS').set('Cache-Control', 'public, max-age=86400').status(204).end();
    });

    // The catalogue's index moved to make /api/v1/fonts the self-hosted list (the same file /fonts uses).
    r.get('/api/v1/fonts/library', async (req, res) => {
        const list = await fonts.list(filters(req));
        res.set('Access-Control-Allow-Origin', '*').set('Cache-Control', 'public, max-age=300').json({ fonts: list, count: list.length });
    });
    r.get('/api/v1/fonts', (req, res) => {
        res.set('Access-Control-Allow-Origin', '*').set('Cache-Control', 'public, max-age=86400').json(vendored.FONTS);
    });
    r.get('/api/v1/fonts/:family', async (req, res) => {
        const font = await fonts.get(req.params.family);
        if (font) return res.set('Access-Control-Allow-Origin', '*').set('Cache-Control', 'public, max-age=300').json(font);
        const selfHosted = vendored.fontFor(req.params.family);
        if (!selfHosted) return res.status(404).json({ error: 'Font family not found' });
        return res.set('Access-Control-Allow-Origin', '*').set('Cache-Control', 'public, max-age=86400')
            .json({ ...selfHosted, files: vendored.fontFiles(selfHosted) });
    });
    r.get('/fonts', async (req, res) => res.set('Cache-Control', 'public, max-age=120').send(views.index(await fonts.list(), filters(req))));
    r.get('/fonts/:family', async (req, res) => {
        const font = await fonts.get(req.params.family);
        return font ? res.set('Cache-Control', 'public, max-age=120').send(views.detail(font)) : res.status(404).send('Font family not found');
    });
    return r;
}

module.exports = { createFontRoutes };
