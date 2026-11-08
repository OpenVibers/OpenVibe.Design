'use strict';

// GET /api/v1/fonts?q=&category=&script=&weight= — open licence font families.
// GET /api/v1/fonts/:family — metadata, CDN file URLs and three rule based pairings.
const { asyncRouter } = require('./router');
const views = require('../views/fonts');

function createFontRoutes({ fonts }) {
    const r = asyncRouter();
    const filters = req => ({ q: String(req.query.q || '').slice(0, 100), category: String(req.query.category || '').slice(0, 40),
        script: String(req.query.script || '').slice(0, 40), weight: String(req.query.weight || '').slice(0, 4) });
    r.get('/api/v1/fonts', async (req, res) => {
        const list = await fonts.list(filters(req));
        res.set('Access-Control-Allow-Origin', '*').set('Cache-Control', 'public, max-age=300').json({ fonts: list, count: list.length });
    });
    r.get('/api/v1/fonts/:family', async (req, res) => {
        const font = await fonts.get(req.params.family);
        res.set('Access-Control-Allow-Origin', '*').set('Cache-Control', 'public, max-age=300');
        return font ? res.json(font) : res.status(404).json({ error: 'Font family not found' });
    });
    r.get('/fonts', async (req, res) => res.set('Cache-Control', 'public, max-age=120').send(views.index(await fonts.list(), filters(req))));
    r.get('/fonts/:family', async (req, res) => {
        const font = await fonts.get(req.params.family);
        return font ? res.set('Cache-Control', 'public, max-age=120').send(views.detail(font)) : res.status(404).send('Font family not found');
    });
    return r;
}

module.exports = { createFontRoutes };
