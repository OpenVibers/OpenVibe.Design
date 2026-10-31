'use strict';
/**
 * The OpenVibe glyphs on openvibe.design (plan L32):
 *   GET  /icons                         the set, what is still Font Awesome, "Draw an icon" and the review list
 *   GET  /icons/<name>                  one glyph's own page: every export, the PNG maker, its Font Awesome names
 *   GET  /icons/<name>.svg              one glyph as a standalone SVG (anyone may fetch it); with the PNG maker's
 *                                       choices in the query (size, color, stroke, pad, ground, bg), drawn with them
 *   GET  /icons/<name>.png              the same as a PNG (resvg), any size up to 1024 at 1-3x
 *   GET  /icons/pack/<file>             the fonts (WOFF2, TTF, OTF), the sprite, the CSS, the code points, and
 *                                       ov-glyphs-svg.zip with every glyph
 *   GET  /icons/font-awesome-alternative  how to switch, and what keeps working
 *   POST /icons/draft                   signed in: OpenVibe.AI drafts candidates (same-origin form)
 *   POST /icons/drafts/:id/review       an admin approves or rejects one (same-origin form)
 *   GET  /api/v1/glyphs                 the registry as data
 *   GET  /api/v1/glyphs/drafts          approved drafts, for openvibe-shared to take in (an admin may ask for others)
 */
const express = require('express');
const { http } = require('openvibe-contracts');
const glyphs = require('openvibe-shared/glyphs');
const { asyncRouter } = require('./router');
const { send, baseUrl } = require('../render/layout');
const { writeAllowed } = require('./same-origin');
const { iconsPage, glyphsJson } = require('../views/icons');
const { glyphPage, faAlternativePage } = require('../views/icon-page');
const ex = require('../glyphs/export');
const { createGlyphDrafts } = require('../glyphs/drafts');

function createIconRoutes(ctx) {
    const { config, s, ai, log = console } = ctx;
    const drafts = ctx.glyphDrafts || createGlyphDrafts({ db: s.db, ai });
    const r = asyncRouter();
    const form = express.urlencoded({ extended: false, limit: '8kb' });
    const subjectOf = (req) => (req.viewer && req.viewer.kind === 'user' ? req.viewer.subject : null);
    const isAdmin = (req) => !!(req.viewer && req.viewer.kind === 'user' && req.viewer.role === 'admin');
    const problem = (res, req, status, code, detail) => http.sendProblem(res, status, code, { detail, ctx: req.ov });
    const back = (res, q) => res.redirect(303, `/icons?${new URLSearchParams(q)}#draw`);

    r.get('/icons', async (req, res) => {
        const subject = subjectOf(req);
        const reviewer = isAdmin(req);
        const [mine, waiting] = await Promise.all([
            subject ? drafts.list({ subject, limit: 24 }).catch(() => []) : [],
            reviewer ? drafts.list({ status: 'draft', limit: 60 }).catch(() => []) : [],
        ]);
        const notice = req.query.drafted != null ? (Number(req.query.drafted) ? `${Number(req.query.drafted)} candidate${Number(req.query.drafted) === 1 ? '' : 's'} drawn: they wait for review below.` : 'No candidate passed the checks this time: try saying more about it.') : req.query.reviewed ? `Draft ${String(req.query.reviewed).slice(0, 20)}.` : '';
        const draw = /^[a-z][a-z0-9-]{1,31}$/.test(String(req.query.draw || '')) ? String(req.query.draw) : '';
        send(res, 200, iconsPage({ base: baseUrl(), mine, drafts: waiting, reviewer, notice, error: String(req.query.error || '').slice(0, 200), draw }), { viewer: req.viewer });
    });

    r.get('/icons/font-awesome-alternative', (req, res) => send(res, 200, faAlternativePage({ base: baseUrl() }), { viewer: req.viewer }));

    r.get('/icons/pack/:file', (req, res, next) => {
        const file = req.params.file;
        res.set('Cache-Control', 'public, max-age=86400').set('Access-Control-Allow-Origin', '*');
        if (file === 'ov-glyphs-svg.zip') return res.type('application/zip').attachment(file).send(ex.zip());
        const p = Object.prototype.hasOwnProperty.call(ex.PACK, file) && ex.PACK[file];
        if (!p) return next();
        res.type(p.type).attachment(file).sendFile(p.path, (err) => { if (err && !res.headersSent) next(); });
    });

    r.get('/icons/:file', (req, res, next) => {
        const m = /^([a-z][a-z0-9-]{0,40})(?:\.(svg|png))?$/.exec(req.params.file);
        if (!m || !glyphs.path(m[1])) return next();
        const [, name, kind] = m;
        const opts = ex.options(req.query);
        if (!kind) return send(res, 200, glyphPage({ base: baseUrl(), name, opts }), { viewer: req.viewer });
        res.set('Cache-Control', 'public, max-age=86400').set('Access-Control-Allow-Origin', '*');
        if (kind === 'svg') return res.type('image/svg+xml').send(ex.isDefault(opts) ? glyphs.svg(name, { size: 24, title: name }) : ex.svg(name, opts));
        try { res.type('image/png').send(ex.png(name, opts)); } catch (err) {
            log.warn('[OpenVibe.Design] glyph PNG failed:', err && err.message);
            res.status(500).set('Cache-Control', 'no-store').type('text/plain').send('That PNG could not be drawn.');
        }
    });

    r.post('/icons/draft', form, async (req, res) => {
        if (!writeAllowed(req, config)) return res.status(403).send('Open this form on openvibe.design.');
        const subject = subjectOf(req);
        if (!subject) return res.redirect(303, `/auth/login?next=${encodeURIComponent('/icons#draw')}`);
        try {
            const out = await drafts.draft({ subject, name: (req.body || {}).name, sentence: (req.body || {}).sentence });
            back(res, { drafted: String(out.kept.length), draw: String((req.body || {}).name || '') });
        } catch (err) {
            if (!err.status || err.status >= 500) log.warn('[OpenVibe.Design] glyph draft failed:', err && err.message);
            back(res, { error: err.status && err.status < 500 ? err.message : 'Drawing did not work this time: try again in a minute.', draw: String((req.body || {}).name || '') });
        }
    });

    r.post('/icons/drafts/:id/review', form, async (req, res) => {
        if (!writeAllowed(req, config)) return res.status(403).send('Open this form on openvibe.design.');
        if (!isAdmin(req)) return res.status(403).send('Only an admin reviews drafts.');
        try {
            const row = await drafts.review({ id: req.params.id, action: (req.body || {}).action, reviewer: subjectOf(req) });
            back(res, { reviewed: row.status });
        } catch (err) { back(res, { error: err.message }); }
    });

    r.get('/api/v1/glyphs', (_req, res) => res.set('Cache-Control', 'public, max-age=300').set('Access-Control-Allow-Origin', '*').json(glyphsJson()));
    r.get('/api/v1/glyphs/drafts', async (req, res) => {
        const status = String(req.query.status || 'approved');
        if (status !== 'approved' && !isAdmin(req)) return problem(res, req, 403, 'design.glyph_drafts_private', 'Only approved drafts are public.');
        if (!['approved', 'draft', 'rejected'].includes(status)) return problem(res, req, 422, 'design.invalid', 'status is approved, draft or rejected.');
        const rows = await drafts.list({ status, limit: 500 });
        res.set('Cache-Control', status === 'approved' ? 'public, max-age=300' : 'private, no-store').json({ drafts: rows.map((d) => ({ id: d.id, name: d.name, sentence: d.sentence, svg: d.svg, model: d.model, status: d.status, created_at: d.created_at, reviewed_at: d.reviewed_at })) });
    });
    return r;
}

module.exports = { createIconRoutes };
