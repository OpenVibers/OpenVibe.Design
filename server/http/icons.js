'use strict';
/**
 * The OpenVibe glyphs on openvibe.design (plan L32):
 *   GET  /icons                         the set, what is still Font Awesome, "Draw an icon" and the review list
 *   GET  /icons/<name>                  one glyph's own page: every export, the PNG maker, its Font Awesome names
 *   GET  /icons/<name>.svg              one glyph as a standalone SVG (anyone may fetch it); with the PNG maker's
 *                                       choices in the query (size, color, stroke, pad, ground, bg), drawn with them
 *   GET  /icons/<name>.png              the same as a PNG (resvg), any size up to 1024 at 1-3x
 *   GET  /icons/<name>.mjs              an ES module with the line and solid drawings (L50)
 *   GET  /icons/<name>.xml              an Android VectorDrawable, with the maker's colour and style
 *   GET  /icons/<name>/favicon.zip      a favicon set from the maker's choices: SVG, PNGs, manifest, the <head> lines
 *   GET  /ov-icon.js (also /icons.js)   the <ov-icon name="…"> web component: any page, no sign-in (L50 step 2)
 *   GET  /icons/pack/<file>             the fonts (WOFF2, TTF, OTF), the sprite, the CSS, the code points, and
 *                                       ov-glyphs-svg.zip with every glyph
 *   GET  /icons/font-awesome-alternative  how to switch, and what keeps working
 *   GET  /icons/migrate, POST /icons/migrate   paste a page or code: every Font Awesome, Lucide, Material or MUI icon in
 *                                       it with its OpenVibe twin (L50 step 4); POST /api/v1/glyphs/migrate as data
 *   GET  /icons/kit, POST /icons/kit    pick glyphs, get a font with only those (WOFF2, TTF, CSS, code points) as a ZIP
 *   GET  /icons/kit.zip?names=&name=&fa=  the same kit from a link
 *   POST /icons/draft                   signed in: OpenVibe.AI drafts candidates (same-origin form)
 *   POST /icons/drafts/:id/review       an admin approves or rejects one (same-origin form)
 *   GET  /api/v1/glyphs                 the registry as data; ?names=a,b,fa-c (up to 120) for just those, with solids
 *   GET  /api/v1/glyphs/drafts          approved drafts, for openvibe-shared to take in (an admin may ask for others)
 */
const express = require('express');
const { http } = require('openvibe-contracts');
const glyphs = require('openvibe-shared/glyphs');
const { asyncRouter } = require('./router');
const { send, baseUrl } = require('../render/layout');
const { writeAllowed } = require('./same-origin');
const { iconsPage, glyphsJson } = require('../views/icons');
const { glyphPage, faAlternativePage, kitPage, migratePage } = require('../views/icon-page');
const aliases = require('../glyphs/aliases');
const kits = require('../glyphs/kits');
const ex = require('../glyphs/export');
const { createGlyphDrafts } = require('../glyphs/drafts');
const formats = require('../glyphs/formats');
const fs = require('fs');
const path = require('path');

// The web component, read once: a stable address other sites put in a <script> tag, so a day's cache, not immutable.
let ovIconJs = null;
const ovIcon = () => (ovIconJs = ovIconJs || fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'ov-icon.js'), 'utf8'));
const OPEN = { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' };

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

    // Switching from another set (L50 step 4). The text is only read, never stored, fetched from or run.
    const bigForm = express.urlencoded({ extended: false, limit: '450kb' });
    r.get('/icons/migrate', (req, res) => send(res, 200, migratePage({ base: baseUrl() }), { viewer: req.viewer }));
    r.post('/icons/migrate', bigForm, (req, res) => {
        if (!writeAllowed(req, config)) return res.status(403).send('Open this form on openvibe.design.');
        const text = String((req.body || {}).text || '').slice(0, 400000);
        send(res, 200, migratePage({ base: baseUrl(), text, found: aliases.scan(text) }), { viewer: req.viewer, cacheControl: 'private, no-store' });
    });
    r.options('/api/v1/glyphs/migrate', (_req, res) => res.set(OPEN).set('Access-Control-Allow-Methods', 'POST, OPTIONS')
        .set('Access-Control-Allow-Headers', 'Content-Type').set('Access-Control-Max-Age', '86400').status(204).end());
    r.post('/api/v1/glyphs/migrate', (req, res) => {
        res.set(OPEN).set('Cache-Control', 'no-store');
        const text = req.body && typeof req.body.text === 'string' ? req.body.text : null;
        if (text == null) return problem(res, req, 422, 'design.invalid', 'Send { "text": "…" }: a page, a template or code, up to 64 KB.');
        const found = aliases.scan(text);
        res.json({ count: found.length, matched: found.filter((f) => f.glyph || f.brand).length, icons: found });
    });

    // Kits: a font with only the glyphs a site uses (L32 I5). The form posts the picks; the link form is for a build step.
    const sendKit = async (req, res, choice) => {
        let parsed;
        try { parsed = kits.parse(choice); } catch (err) {
            if (req.method === 'POST') return send(res, 422, kitPage({ picked: [], name: choice.name, fa: choice.fa != null, error: err.message }), { viewer: req.viewer });
            return res.status(422).type('text/plain').send(`${err.message}\n`);
        }
        const out = await kits.build(parsed);
        res.set('Cache-Control', req.method === 'GET' ? 'public, max-age=86400' : 'no-store').set('Access-Control-Allow-Origin', '*')
            .type('application/zip').attachment(`ov-glyphs-kit-${parsed.slug}.zip`).send(out.zip);
    };
    r.get('/icons/kit', (req, res) => {
        const picked = String(req.query.names || '').split(',').map((n) => n.trim()).filter((n) => glyphs.path(n));
        send(res, 200, kitPage({ picked, name: String(req.query.name || '').slice(0, 40) }), { viewer: req.viewer });
    });
    r.post('/icons/kit', form, (req, res) => sendKit(req, res, { names: (req.body || {}).names, name: (req.body || {}).name, fa: (req.body || {}).fa }));
    r.get('/icons/kit.zip', (req, res) => sendKit(req, res, { names: req.query.names, name: req.query.name, fa: req.query.fa }));

    r.get('/icons/pack/:file', (req, res, next) => {
        const file = req.params.file;
        res.set('Cache-Control', 'public, max-age=86400').set('Access-Control-Allow-Origin', '*');
        if (file === 'ov-glyphs-svg.zip') return res.type('application/zip').attachment(file).send(ex.zip());
        if (file === 'ov-icon-motion.css') return res.type('text/css').send(require('../glyphs/motion').CSS);
        const p = Object.prototype.hasOwnProperty.call(ex.PACK, file) && ex.PACK[file];
        if (!p) return next();
        res.type(p.type).attachment(file).sendFile(p.path, (err) => { if (err && !res.headersSent) next(); });
    });

    r.get(['/ov-icon.js', '/icons.js'], (_req, res) => {
        res.set(OPEN).set('Cache-Control', 'public, max-age=86400').type('application/javascript').send(ovIcon());
    });

    r.get('/icons/:name/favicon.zip', (req, res, next) => {
        const name = req.params.name;
        if (!/^[a-z][a-z0-9-]{0,40}$/.test(name) || !glyphs.path(name)) return next();
        const q = { ground: 'squircle', bg: '0b1020', color: 'mark', pad: '14', ...req.query };
        res.set(OPEN).set('Cache-Control', 'public, max-age=86400').type('application/zip').attachment(`${name}-favicon.zip`)
            .send(formats.faviconZip(name, ex.options(q)));
    });

    r.get('/icons/:file', (req, res, next) => {
        const m = /^([a-z][a-z0-9-]{0,40})(?:\.(svg|png|mjs|xml))?$/.exec(req.params.file);
        if (!m || !glyphs.path(m[1])) return next();
        const [, name, kind] = m;
        const opts = ex.options(req.query);
        if (!kind) return send(res, 200, glyphPage({ base: baseUrl(), name, opts }), { viewer: req.viewer });
        res.set('Cache-Control', 'public, max-age=86400').set(OPEN);
        if (kind === 'mjs') return res.type('text/javascript').send(formats.esModule(name));
        if (kind === 'xml') return res.type('application/xml').send(formats.vectorDrawable(name, ex.options({ size: 24, ...req.query })));
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

    r.get('/api/v1/glyphs', (req, res) => {
        res.set('Cache-Control', 'public, max-age=300').set(OPEN);
        if (req.query.names == null) return res.json(glyphsJson());
        // Just the names asked for (<ov-icon> asks for a page's in one go): a glyph or a Font Awesome name, each answered
        // under the name it was asked by; an unknown one is left out.
        // Any set's name works (L50 step 4): "gear", "fa-gear", "lucide:settings", "material:delete", or a bare "settings".
        const asked = [...new Set(String(req.query.names).split(',').map((n) => n.trim().toLowerCase()).filter((n) => /^(?:(?:lucide|material|mui|fa):)?[a-z][a-z0-9_-]{0,47}$/.test(n)))].slice(0, 120);
        const out = asked.map((a) => {
            const name = aliases.resolve(a);
            return name ? { asked: a, name, svg: glyphs.path(name), solid: glyphs.solid(name) || '' } : null;
        }).filter(Boolean);
        res.json({ count: out.length, glyphs: out });
    });
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
