'use strict';
/**
 * The typefaces and vectors a person makes with the model (plan R1 item 8, Seven Domains §11).
 *
 *   GET  /fonts/make             the typeface maker: describe a face, start from an open one
 *   POST /fonts/make             draw it
 *   GET  /fonts/made/:id         the specimen, the download and the redraw
 *   POST /fonts/made/:id/glyph   redraw one glyph with a note
 *
 *   GET  /vectors/make           the vector maker: one drawing from a prompt
 *   POST /vectors/make           draw it
 *   GET  /vectors/made/:id       the drawing, the downloads and the notes
 *   POST /vectors/made/:id/edit  regenerate it, or edit it with a note
 *
 *   The API, for agents and for the pages themselves:
 *   POST /api/v1/typefaces       draw a typeface
 *   GET  /api/v1/typefaces/:id   read it
 *   POST /api/v1/typefaces/:id/glyph  redraw one glyph
 *   POST /api/v1/vectors         draw a vector
 *   GET  /api/v1/vectors/:id     read it
 *   POST /api/v1/vectors/:id/edit     regenerate it, or edit it with a note
 *
 * Signed in only: a run is charged to the person's own allowance, so there is always a person behind it.
 * The outputs are the person's: nobody else's, and the site does not list them.
 */
const express = require('express');
const { asyncRouter } = require('./router');
const views = require('../views/typefaces');
const { send } = require('../render/layout');
const { writeAllowed } = require('./same-origin');

/** The plain words a person gets when the model is not there or says no. */
function plainError(err) {
    if (!err) return 'Something went wrong.';
    const status = Number(err.status) || 500;
    const detail = String(err.detail || err.message || '').trim();
    if (status === 503) return 'OpenVibe.AI is not configured for OpenVibe.Design right now. Try again later.';
    if (status === 429) return detail || 'You have made all the runs you can today. More tomorrow.';
    if (status === 401) return 'Sign in to make this on openvibe.design.';
    if (status === 403) return detail || 'This belongs to somebody else.';
    if (status === 404) return 'Not found.';
    return detail && status < 500 ? detail : 'Something went wrong.';
}

function createTypefaceRoutes(ctx) {
    const { config, ai, aiStore, maker, fonts, s } = ctx;
    const store = aiStore;
    const r = asyncRouter();
    const subjectOf = (req) => (req.viewer && req.viewer.kind === 'user' ? req.viewer.subject : null);
    const page = (res, status, html, viewer, options = {}) => send(res, status, html, { viewer, ...options });

    /** A face of this person's, or a refusal in words. */
    async function own(req, res, id) {
        const owner = subjectOf(req);
        if (!owner) { res.status(401).type('text/plain').send('Sign in to open this on openvibe.design.'); return null; }
        const row = await store.typeface(id, owner);
        if (!row) { res.status(404).type('text/plain').send('Not found.'); return null; }
        return row;
    }

    // ── The maker ──
    r.get('/fonts/make', async (req, res) => {
        res.set('Cache-Control', 'private, no-store');
        const owner = subjectOf(req);
        const bases = await fonts.list().catch(() => []);
        const mine = owner ? await store.typefacesOf(owner).catch(() => []) : [];
        return page(res, 200, views.make({ bases, mine, signedIn: Boolean(owner), left: owner ? await maker.left(owner) : 0, perDay: maker.perDay }), req.viewer,
            { cacheControl: 'private, no-store' });
    });

    r.post('/fonts/make', express.urlencoded({ extended: false, limit: '8kb' }), async (req, res) => {
        if (!writeAllowed(req, config)) return res.status(403).type('text/plain').send('Open this form on openvibe.design.');
        const owner = subjectOf(req);
        if (!owner) return res.status(401).type('text/plain').send('Sign in to make a typeface on openvibe.design.');
        try {
            const prompt = String(req.body.prompt || '').trim();
            const baseId = String(req.body.base || '').trim();
            const name = String(req.body.name || '').trim().slice(0, 60);
            if (!prompt) return res.status(422).type('text/plain').send('Describe the typeface you want.');
            const base = baseId ? await fonts.get(baseId).catch(() => null) : null;
            const id = s.newId('typ');
            const drawn = await maker.drawTypeface({
                owner, prompt,
                baseFamily: base ? base.family : null,
                baseNote: base ? 'Keep the letterforms of ' + base.family + ' (' + base.category + '), and change the style to the description above.' : null,
                name: name || null,
            });
            await store.saveTypeface({
                id, owner, name: drawn.name, prompt,
                baseFamily: base ? base.family : null,
                styleNotes: prompt,
                glyphs: drawn.glyphs,
                metrics: drawn.metrics,
                provider: drawn.provider, model: drawn.model,
                license: drawn.license, state: 'ready',
            });
            return res.redirect(303, '/fonts/made/' + encodeURIComponent(id));
        } catch (err) {
            return res.status(err.status || 500).type('text/plain').send(plainError(err));
        }
    });

    // ── The specimen ──
    r.get('/fonts/made/:id', async (req, res) => {
        res.set('Cache-Control', 'private, no-store');
        const row = await own(req, res, req.params.id);
        if (!row) return undefined;
        const compiled = await require('../typefaces/compile').compile({
            familyName: row.name, glyphs: row.glyphs, license: row.license, model: row.model, designer: 'Made on OpenVibe.Design',
        }).catch(() => null);
        return page(res, 200, views.specimen({ face: row, compiled, chars: maker.CORE }), req.viewer,
            { cacheControl: 'private, no-store' });
    });

    r.post('/fonts/made/:id/glyph', express.urlencoded({ extended: false, limit: '4kb' }), async (req, res) => {
        if (!writeAllowed(req, config)) return res.status(403).type('text/plain').send('Open this form on openvibe.design.');
        const owner = subjectOf(req);
        if (!owner) return res.status(401).type('text/plain').send('Sign in to redraw this on openvibe.design.');
        const row = await store.typeface(req.params.id, owner);
        if (!row) return res.status(404).type('text/plain').send('Not found.');
        try {
            const char = String(req.body.char || '').slice(0, 4);
            const note = String(req.body.note || '').trim().slice(0, 400);
            if (!char || !note) return res.status(422).type('text/plain').send('Say which letter and what to change.');
            const redrawn = await maker.redrawGlyph({ owner, face: row, char, note });
            if (!redrawn) return res.status(502).type('text/plain').send('The model did not draw that letter. Try again.');
            const glyphs = row.glyphs.filter((g) => g.char !== char).concat([redrawn]);
            await store.saveTypeface({
                id: row.id, owner: row.owner, name: row.name, prompt: row.prompt,
                baseFamily: row.baseFamily, styleNotes: row.styleNotes,
                glyphs, metrics: { ...row.metrics, glyphs: glyphs.length },
                provider: row.provider, model: redrawn.model || row.model,
                license: row.license, state: 'ready', note: note,
            });
            return res.redirect(303, '/fonts/made/' + encodeURIComponent(row.id));
        } catch (err) {
            return res.status(err.status || 500).type('text/plain').send(plainError(err));
        }
    });

    // ── The API ──
    r.post('/api/v1/typefaces', express.json({ limit: '32kb' }), async (req, res) => {
        const owner = subjectOf(req);
        if (!owner) return res.status(401).json({ error: 'Sign in to make a typeface on openvibe.design.' });
        try {
            const prompt = String((req.body && req.body.prompt) || '').trim();
            if (!prompt) return res.status(422).json({ error: 'Describe the typeface you want.' });
            const drawn = await maker.drawTypeface({ owner, prompt, baseFamily: (req.body && req.body.baseFamily) || null, name: (req.body && req.body.name) || null });
            const id = s.newId('typ');
            const saved = await store.saveTypeface({
                id, owner, name: drawn.name, prompt, baseFamily: (req.body && req.body.baseFamily) || null,
                styleNotes: prompt, glyphs: drawn.glyphs, metrics: drawn.metrics,
                provider: drawn.provider, model: drawn.model, license: drawn.license, state: 'ready',
            });
            return res.status(201).json(saved);
        } catch (err) {
            return res.status(err.status || 500).json({ error: plainError(err) });
        }
    });

    r.get('/api/v1/typefaces/:id', async (req, res) => {
        const owner = subjectOf(req);
        if (!owner) return res.status(401).json({ error: 'Sign in to open this on openvibe.design.' });
        const row = await store.typeface(req.params.id, owner);
        if (!row) return res.status(404).json({ error: 'Not found.' });
        return res.json(row);
    });

    // The font files. They are compiled from the stored outlines on the way out, so a redrawn letter
    // is in the next download without anything being rebuilt by hand.
    for (const [ext, type] of [['woff2', 'font/woff2'], ['otf', 'font/otf']]) {
        r.get('/api/v1/typefaces/:id/font.' + ext, async (req, res) => {
            const row = await own(req, res, req.params.id);
            if (!row) return undefined;
            const compiled = await require('../typefaces/compile').compile({
                familyName: row.name, glyphs: row.glyphs, license: row.license, model: row.model, designer: 'Made on OpenVibe.Design',
            }).catch(() => null);
            if (!compiled || !compiled.ok) return res.status(502).type('text/plain').send('The font could not be compiled.');
            const file = ext === 'woff2' ? compiled.woff2 : compiled.otf;
            return res.set('Cache-Control', 'private, no-store')
                .set('Content-Disposition', 'attachment; filename="' + row.name.replace(/[^A-Za-z0-9 .'-]/g, '') + '.' + ext + '"')
                .type(type).send(file);
        });
    }

    r.post('/api/v1/typefaces/:id/glyph', express.json({ limit: '8kb' }), async (req, res) => {
        const owner = subjectOf(req);
        if (!owner) return res.status(401).json({ error: 'Sign in to redraw this on openvibe.design.' });
        const row = await store.typeface(req.params.id, owner);
        if (!row) return res.status(404).json({ error: 'Not found.' });
        try {
            const char = String((req.body && req.body.char) || '').slice(0, 4);
            const note = String((req.body && req.body.note) || '').trim().slice(0, 400);
            if (!char || !note) return res.status(422).json({ error: 'Say which letter and what to change.' });
            const redrawn = await maker.redrawGlyph({ owner, face: row, char, note });
            if (!redrawn) return res.status(502).json({ error: 'The model did not draw that letter. Try again.' });
            const glyphs = row.glyphs.filter((g) => g.char !== char).concat([redrawn]);
            const saved = await store.saveTypeface({
                id: row.id, owner: row.owner, name: row.name, prompt: row.prompt,
                baseFamily: row.baseFamily, styleNotes: row.styleNotes, glyphs,
                metrics: { ...row.metrics, glyphs: glyphs.length },
                provider: row.provider, model: redrawn.model || row.model, license: row.license, state: 'ready', note,
            });
            return res.json(saved);
        } catch (err) {
            return res.status(err.status || 500).json({ error: plainError(err) });
        }
    });

    return r;
}

function createVectorRoutes(ctx) {
    const { config, ai, aiStore, maker, s, sharing } = ctx;
    const store = aiStore;
    const r = asyncRouter();
    const subjectOf = (req) => (req.viewer && req.viewer.kind === 'user' ? req.viewer.subject : null);
    const page = (res, status, html, viewer, options = {}) => send(res, status, html, { viewer, ...options });

    async function own(req, res, id) {
        const owner = subjectOf(req);
        if (!owner) { res.status(401).type('text/plain').send('Sign in to open this on openvibe.design.'); return null; }
        const row = await store.vector(id, owner);
        if (!row) { res.status(404).type('text/plain').send('Not found.'); return null; }
        return row;
    }

    r.get('/vectors/make', async (req, res) => {
        res.set('Cache-Control', 'private, no-store');
        const owner = subjectOf(req);
        const mine = owner ? await store.vectorsOf(owner).catch(() => []) : [];
        return page(res, 200, views.vectorMake({ mine, signedIn: Boolean(owner), left: owner ? await maker.left(owner) : 0, perDay: maker.perDay }), req.viewer,
            { cacheControl: 'private, no-store' });
    });

    r.post('/vectors/make', express.urlencoded({ extended: false, limit: '8kb' }), async (req, res) => {
        if (!writeAllowed(req, config)) return res.status(403).type('text/plain').send('Open this form on openvibe.design.');
        const owner = subjectOf(req);
        if (!owner) return res.status(401).type('text/plain').send('Sign in to make a vector on openvibe.design.');
        try {
            const prompt = String(req.body.prompt || '').trim();
            const kind = ['icon', 'illustration', 'pattern'].includes(req.body.kind) ? req.body.kind : 'icon';
            if (!prompt) return res.status(422).type('text/plain').send('Describe the drawing you want.');
            const drawn = await maker.drawVector({ owner, prompt, kind });
            const id = s.newId('vec');
            await store.saveVector({ id, owner, prompt, kind, svg: drawn.svg, provider: drawn.provider, model: drawn.model, license: drawn.license, state: 'drawn' });
            return res.redirect(303, '/vectors/made/' + encodeURIComponent(id));
        } catch (err) {
            return res.status(err.status || 500).type('text/plain').send(plainError(err));
        }
    });

    // The drawing itself, as a file. These come before the page, so /vectors/made/<id>.svg is the file
    // and not a drawing called "<id>.svg".
    r.get('/vectors/made/:id.svg', async (req, res) => {
        const row = await own(req, res, req.params.id);
        if (!row) return undefined;
        // A saved drawing opened on its own is a document: no script, no fetches, whatever the sanitiser missed.
        return res.set('Cache-Control', 'private, no-store').set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
            .set('X-Content-Type-Options', 'nosniff').type('image/svg+xml').send(row.svg);
    });
    r.get('/vectors/made/:id.png', async (req, res) => {
        const row = await own(req, res, req.params.id);
        if (!row) return undefined;
        const png = await maker.png(row.svg, Number(req.query.size) || 512).catch(() => null);
        if (!png) return res.status(502).type('text/plain').send('The drawing could not be rendered as a PNG.');
        return res.set('Cache-Control', 'private, no-store').type('image/png').send(png);
    });

    r.get('/vectors/made/:id', async (req, res) => {
        res.set('Cache-Control', 'private, no-store');
        const row = await own(req, res, req.params.id);
        if (!row) return undefined;
        return page(res, 200, views.vector({ vector: row }), req.viewer, { cacheControl: 'private, no-store' });
    });

    r.post('/vectors/made/:id/edit', express.urlencoded({ extended: false, limit: '8kb' }), async (req, res) => {
        if (!writeAllowed(req, config)) return res.status(403).type('text/plain').send('Open this form on openvibe.design.');
        const owner = subjectOf(req);
        if (!owner) return res.status(401).type('text/plain').send('Sign in to change this on openvibe.design.');
        const row = await store.vector(req.params.id, owner);
        if (!row) return res.status(404).type('text/plain').send('Not found.');
        try {
            const note = String(req.body.note || '').trim().slice(0, 400);
            const drawn = await maker.drawVector({ owner, prompt: row.prompt, kind: row.kind, note: note || null });
            await store.saveVector({ id: row.id, owner: row.owner, prompt: row.prompt, kind: row.kind, svg: drawn.svg,
                provider: drawn.provider, model: drawn.model, license: row.license, state: 'drawn', note: note || null });
            return res.redirect(303, '/vectors/made/' + encodeURIComponent(row.id));
        } catch (err) {
            return res.status(err.status || 500).type('text/plain').send(plainError(err));
        }
    });

    // ── The API ──
    r.post('/api/v1/vectors', express.json({ limit: '32kb' }), async (req, res) => {
        const owner = subjectOf(req);
        if (!owner) return res.status(401).json({ error: 'Sign in to make a vector on openvibe.design.' });
        try {
            const prompt = String((req.body && req.body.prompt) || '').trim();
            const kind = ['icon', 'illustration', 'pattern'].includes(req.body && req.body.kind) ? req.body.kind : 'icon';
            if (!prompt) return res.status(422).json({ error: 'Describe the drawing you want.' });
            const drawn = await maker.drawVector({ owner, prompt, kind });
            const id = s.newId('vec');
            const saved = await store.saveVector({ id, owner, prompt, kind, svg: drawn.svg, provider: drawn.provider, model: drawn.model, license: drawn.license, state: 'drawn' });
            return res.status(201).json(saved);
        } catch (err) {
            return res.status(err.status || 500).json({ error: plainError(err) });
        }
    });

    r.get('/api/v1/vectors/:id', async (req, res) => {
        const owner = subjectOf(req);
        if (!owner) return res.status(401).json({ error: 'Sign in to open this on openvibe.design.' });
        const row = await store.vector(req.params.id, owner);
        if (!row) return res.status(404).json({ error: 'Not found.' });
        return res.json(row);
    });

    r.post('/api/v1/vectors/:id/edit', express.json({ limit: '8kb' }), async (req, res) => {
        const owner = subjectOf(req);
        if (!owner) return res.status(401).json({ error: 'Sign in to change this on openvibe.design.' });
        const row = await store.vector(req.params.id, owner);
        if (!row) return res.status(404).json({ error: 'Not found.' });
        try {
            const note = String((req.body && req.body.note) || '').trim().slice(0, 400);
            const drawn = await maker.drawVector({ owner, prompt: row.prompt, kind: row.kind, note: note || null });
            const saved = await store.saveVector({ id: row.id, owner: row.owner, prompt: row.prompt, kind: row.kind, svg: drawn.svg,
                provider: drawn.provider, model: drawn.model, license: row.license, state: 'drawn', note: note || null });
            return res.json(saved);
        } catch (err) {
            return res.status(err.status || 500).json({ error: plainError(err) });
        }
    });

    return r;
}

module.exports = { createTypefaceRoutes, createVectorRoutes, plainError };
