'use strict';
/**
 * /components/name-effects with the maker ("make me an effect", plan §AD.15): the fifteen effects, then a form that
 * asks a model on Exchange for a new one, the person's own drafts drawn live, and, for an admin, the drafts waiting.
 *
 *   GET  /components/name-effects                    the page (notePage + the maker)
 *   POST /components/name-effects/make               { words, name? , model? } → a draft, or why not
 *   POST /components/name-effects/drafts/:id/review  { action: approve|reject } (admin)
 *   GET  /api/v1/name-effects/drafts                 the approved ones, as data (Inventory, openvibe-shared)
 */
const express = require('express');
const { writeAllowed } = require('./same-origin');
const { esc } = require('../render/layout');
const { notePage } = require('../views/component-notes');
const { createNameEffectDrafts } = require('../namefx/drafts');
const iconMethods = require('../glyphs/methods');

const OPEN = { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' };

function createNameEffectRoutes(ctx) {
    const { config, s, ai, log = console } = ctx;
    const r = express.Router();
    const drafts = ctx.nameEffectDrafts || createNameEffectDrafts({ db: s.db, ai });
    const form = express.urlencoded({ extended: false, limit: '4kb' });
    const subjectOf = (req) => (req.viewer && req.viewer.kind === 'user' ? req.viewer.subject : null);
    const isAdmin = (req) => !!(req.viewer && req.viewer.kind === 'user' && req.viewer.role === 'admin');
    const tokenOf = (req) => req.token || (req.viewer && req.viewer.token) || null;
    const back = (res, q) => res.redirect(303, `/components/name-effects?${new URLSearchParams(q)}#make`);

    // A draft drawn live: its own checked CSS (css.js rebuilt it: one class, its keyframes, safe properties).
    const card = (d, admin) => `<li class="nfx-draft"><style>${d.css.replace(/<\//g, '<\\/')}</style>
      <p class="spec-namefx-name"><span class="name-fx-${esc(d.slug)}">Juniper</span></p>
      <p class="spec-namefx-label"><b>${esc(d.label || d.slug)}</b><span class="nfx-state nfx-state--${esc(d.status)}">${esc(d.status === 'draft' ? 'waiting for review' : d.status)}</span></p>
      <p class="spec-namefx-what">${esc(d.words)}</p>
      <p class="nfx-meta"><code>.name-fx-${esc(d.slug)}</code>${d.model ? ` · ${esc(d.model)}` : ''}</p>
      ${admin && d.status === 'draft' ? `<form method="post" action="/components/name-effects/drafts/${esc(d.id)}/review" class="nfx-review">
        <button class="ic-btn is-go" name="action" value="approve">Approve</button><button class="ic-btn" name="action" value="reject">Reject</button></form>` : ''}</li>`;

    r.get('/components/name-effects', async (req, res) => {
        const subject = subjectOf(req);
        const admin = isAdmin(req);
        const [mine, waiting, ways] = await Promise.all([
            subject ? drafts.list({ subject, limit: 12 }).catch(() => []) : [],
            admin ? drafts.list({ status: 'draft', limit: 40 }).catch(() => []) : [],
            subject ? iconMethods.options({ ai, codes: null, log, token: tokenOf(req) }).catch(() => null) : null,
        ]);
        const models = ways && ways.models ? ways.models.draw : [];
        const notice = req.query.made ? 'Made: it waits for review below, drawn as it will look.' : '';
        const error = String(req.query.error || '').slice(0, 200);
        const maker = `<section class="nfx-make" id="make" aria-labelledby="nfx-make-h">
  <div class="cn-head"><h2 id="nfx-make-h">Make one</h2><p class="ds-fine">Say what it looks like; a model on <a href="https://openvibe.exchange/models">Exchange</a> writes it in the house's shape (one class, its own motion, Calm slower and Off still, readable on light themes), and Design checks every line before it is drawn here.</p></div>
  ${notice ? `<p class="nfx-notice" role="status">${esc(notice)}</p>` : ''}${error ? `<p class="nfx-error" role="alert">${esc(error)}</p>` : ''}
  ${subject ? `<form method="post" action="/components/name-effects/make" class="ic-form nfx-form">
    <label class="ic-grow"><span>What it looks like</span><input name="words" required minlength="4" maxlength="300" placeholder="Molten copper that cools to blue at the edges, a slow glow"></label>
    <label><span>Its name <small>optional</small></span><input name="name" pattern="[a-z][a-z0-9-]{1,23}" maxlength="24" placeholder="ember"></label>
    <label><span>Model</span><select name="model" data-ov-title="The model that writes it"${models.length > 8 ? ' data-ov-search="on"' : ''}><option value="">Auto: AI picks for effects</option>${models.map((m) => `<option value="${esc(m.id)}"${m.note ? ` data-desc="${esc(m.note)}"` : ''}>${esc(m.name)}</option>`).join('')}</select></label>
    <button type="submit" class="ic-btn is-go">Make it</button>
  </form>` : `<p><a class="ic-btn is-go" href="/auth/login?next=${encodeURIComponent('/components/name-effects#make')}">Sign in to make one</a></p>`}
  ${mine.length ? `<h3>Your effects</h3><ul class="spec-namefx-grid nfx-list">${mine.map((d) => card(d, false)).join('')}</ul>` : ''}
  ${admin ? `<h3>Waiting for review</h3>${waiting.length ? `<ul class="spec-namefx-grid nfx-list">${waiting.map((d) => card(d, true)).join('')}</ul>` : '<p class="ds-fine">Nothing waiting.</p>'}` : ''}
</section>`;
        const html = notePage('name-effects', { extra: maker });
        res.set('Cache-Control', subject ? 'private, no-store' : 'public, max-age=120').type('html').send(html);
    });

    r.post('/components/name-effects/make', form, async (req, res) => {
        if (!writeAllowed(req, config)) return res.status(403).send('Open this form on openvibe.design.');
        const subject = subjectOf(req);
        if (!subject) return back(res, { error: 'Sign in to make an effect.' });
        try {
            const body = req.body || {};
            let model = null;
            if (body.model) {
                const o = await iconMethods.options({ ai, codes: null, log, token: tokenOf(req) }).catch(() => null);
                model = o ? o.models.draw.find((m) => m.id === String(body.model)) || null : null;
            }
            const out = await drafts.draft({ subject, words: body.words, name: body.name, model });
            if (!out.kept) return back(res, { error: `Not kept: ${out.why}. Try saying it another way.` });
            back(res, { made: out.kept.slug });
        } catch (err) { back(res, { error: err.message || 'That did not work.' }); }
    });

    r.post('/components/name-effects/drafts/:id/review', form, async (req, res) => {
        if (!writeAllowed(req, config)) return res.status(403).send('Open this form on openvibe.design.');
        if (!isAdmin(req)) return res.status(403).send('Only an admin reviews effects.');
        try { await drafts.review({ id: req.params.id, action: (req.body || {}).action, reviewer: subjectOf(req) }); back(res, {}); }
        catch (err) { back(res, { error: err.message }); }
    });

    // The approved effects as data: what Inventory offers and openvibe-shared can take into items.css.
    r.get('/api/v1/name-effects/drafts', async (req, res) => {
        const rows = await drafts.list({ status: 'approved', limit: 100 }).catch(() => []);
        res.set('Cache-Control', 'public, max-age=300').set(OPEN).json({ effects: rows.map((d) => ({ id: d.id, name: d.slug, label: d.label, words: d.words, css: d.css, model: d.model })) });
    });
    return r;
}

module.exports = { createNameEffectRoutes };
