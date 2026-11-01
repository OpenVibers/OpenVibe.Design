'use strict';

/**
 * The pages:
 *   /                       the theme catalogue's front door
 *   /studio                 the theme studio
 *   /t/:slug                one public theme
 *   /arena                  the Arena leaderboard and its front door
 *   /arena/new              start a round (the form also posts here, so it works without JavaScript)
 *   /arena/vote             the next blind pair, and the reveal after a vote
 *   /arena/r/:id            one round: every output at 390 px and 1280 px, with cost and time
 *   /developers             the API
 *   /brand                  the OpenVibe mark: its moves, forms, colours, names, files and code
 *   /brand/<file>.svg       the mark's files (server/views/brand.js FILES)
 *
 * Every page is server-rendered. The Arena's model HTML is only ever inside `<iframe sandbox srcdoc>`; the pages
 * themselves never contain it. `me` comes from the session the SSO middleware already resolved.
 */
const express = require('express');
const path = require('path');
const nodeCrypto = require('crypto');
const views = require('../views');
const tokensView = require('../views/tokens');
const lookView = require('../views/look');
const componentsView = require('../views/components');
const themeTokens = require('../tokens');
const designView = require('../views/design');
const patternsView = require('../views/patterns');
const brandView = require('../views/brand');
const motionView = require('../views/motion');
const { baseUrl: layoutBase } = require('../render/layout');
const { asyncRouter } = require('./router');
const { send } = require('../render/layout');
const { ArenaError } = require('../arena/store');
const { writeAllowed, sameOrigin } = require('./same-origin');
const arenaKinds = require('../arena/kinds');

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

const subjectOf = (req) => (req.viewer && req.viewer.kind === 'user' ? req.viewer.subject : null);
const tokenOf = (req) => (req.viewer && req.viewer.kind === 'user' ? req.viewer.token : null);

function createPageRoutes(ctx) {
    const { config, catalog, arena, log } = ctx;
    const r = asyncRouter();
    const safe = (fn) => Promise.resolve().then(fn).catch((err) => {
        log.warn('[OpenVibe.Design] page catalogue failed:', (err && err.message) || err);
        return null;
    });
    const page = (res, status, html, viewer, options = {}) => send(res, status, html, { viewer, ...options });
    const categories = arena.CATEGORIES;
    const aria = async (viewer) => {
        const subject = viewer && viewer.kind === 'user' ? viewer.subject : null;
        return subject ? await arena.counts(subject).catch(() => null) : null;
    };

    // ── Production patterns: one data-backed page and generated native spec per pattern ──
    // ── The OpenVibe mark, and its files ──
    r.get('/brand', (req, res) => page(res, 200, brandView.brandPage({ base: layoutBase() }), req.viewer));
    // A hundred takes on the Loop and the Pair, for feedback (the owner, 2026-11-01). Before /brand/:file.
    // Every prompt the service sends, word for word (the owner, 2026-11-01).
    r.get('/prompts', (req, res) => page(res, 200, require('../views/prompts').promptsPage(), req.viewer));
    r.get('/brand/explore', async (req, res) => {
        // What people picked so far, at the top (a database hiccup leaves the page whole, without it).
        const tally = ctx.picks ? await safe(() => ctx.picks.tally()) : null;
        // The Wildcards are off the vote (the owner, 11-01: "I've changed my mind on them… keep them, they're cool to
        // look at"): ?wild=1 still shows them.
        page(res, 200, require('../views/marks-explore').explorePage({ tally, wild: req.query.wild === '1' }), req.viewer);
    });
    r.get('/brand/:file', (req, res) => {
        const svg = brandView.file(req.params.file);
        if (!svg) return page(res, 404, views.notFound(), req.viewer);
        res.set('Cache-Control', 'public, max-age=86400').set('Access-Control-Allow-Origin', '*').type('image/svg+xml').send(svg);
    });
    // ── How OpenVibe moves: the mark's motion and the shared effects kit (plan L45) ──
    r.get('/motion', (req, res) => page(res, 200, motionView.motionPage({ base: layoutBase() }), req.viewer));
    r.get('/loading', (req, res) => page(res, 200, require('../views/loading').loadingPage({ base: layoutBase() }), req.viewer));
    r.get('/patterns', (req, res) => page(res, 200, patternsView.index(), req.viewer));
    r.get('/patterns/mark/studies', (req, res) => res.sendFile(path.join(__dirname, '../../public/mark-studies.html')));
    r.get('/patterns/:slug', (req, res) => {
        const pattern = patternsView.patterns.find((item) => item.slug === req.params.slug);
        return pattern ? page(res, 200, patternsView.page(pattern), req.viewer) : page(res, 404, views.notFound(), req.viewer);
    });

    r.get('/create', async (req, res) => {
        res.set('Cache-Control', 'private, no-store');
        let links = [];
        try { links = JSON.parse(req.cookies.design_drafts || '[]'); if (!Array.isArray(links)) links = []; } catch { /* empty */ }
        const recent = await ctx.designs.recent(subjectOf(req), links);
        return page(res, 200, designView.create({ recent }), req.viewer, { cacheControl: 'private, no-store' });
    });
    r.post('/create', express.urlencoded({ extended: false, limit: '8kb' }), async (req, res) => {
        if (!writeAllowed(req, config)) return res.status(403).send('Open this form on openvibe.design.');
        try {
            const out = await ctx.designs.create({ prompt: req.body.prompt, kind: req.body.kind || 'page',
                owner: subjectOf(req), ip: req.ip, who: req.body.who });
            if (out.editKey) {
                let links = [];
                try { links = JSON.parse(req.cookies.design_drafts || '[]'); if (!Array.isArray(links)) links = []; } catch { /* empty */ }
                links = [{ id: out.design.id, key: out.editKey }, ...links.filter(x => x.id !== out.design.id)].slice(0, 3);
                res.cookie('design_drafts', JSON.stringify(links), { httpOnly: true, sameSite: 'lax',
                    secure: config.cookies.secure, maxAge: 30 * 86400000, path: '/' });
            }
            return res.redirect(303, out.editUrl || `/d/${out.design.id}`);
        } catch (err) {
            return res.status(err.status || 500).type('text/plain').send(err.detail || 'Could not create the design.');
        }
    });
    r.get('/d/:id', async (req, res) => {
        res.set('Cache-Control', 'private, no-store');
        res.set('Referrer-Policy', 'no-referrer');
        try {
            const data = await ctx.designs.read(req.params.id, subjectOf(req), req.query.key);
            const themes = (await catalog.list()).themes;
            return page(res, 200, designView.canvas({ data, themes, editKey: req.query.key || '' }), req.viewer,
                { cacheControl: 'private, no-store' });
        } catch (err) {
            return res.status(err.status || 500).type('text/plain').send(err.detail || 'Could not read the design.');
        }
    });
    r.post('/d/:id/theme', express.urlencoded({ extended: false }), async (req, res) => {
        if (!writeAllowed(req, config)) return res.status(403).send('Open this form on openvibe.design.');
        try {
            const key = req.body.key || '';
            await ctx.designs.setTheme(req.params.id, req.body.themeId, subjectOf(req), key);
            return res.redirect(303, `/d/${req.params.id}${key ? `?key=${encodeURIComponent(key)}` : ''}`);
        } catch (err) {
            return res.status(err.status || 500).type('text/plain').send(err.detail || 'Could not change theme.');
        }
    });
    const backToCanvas = (req, res, key) => res.redirect(303, `/d/${encodeURIComponent(req.params.id)}${key ? `?key=${encodeURIComponent(key)}` : ''}`);
    r.post('/d/:id/pick', express.urlencoded({ extended: false, limit: '8kb' }), async (req, res) => {
        if (!writeAllowed(req, config)) return res.status(403).send('Open this form on openvibe.design.');
        const key = req.body.key || '';
        try {
            await ctx.designs.pick({ id: req.params.id, variantIndex: req.body.variantIndex, variantId: req.body.variantId,
                owner: subjectOf(req), key, subject: subjectOf(req), token: tokenOf(req) });
            return backToCanvas(req, res, key);
        } catch (err) {
            return res.status(err.status || 500).type('text/plain').send(err.detail || 'Could not choose that frame.');
        }
    });
    r.post('/d/:id/edit', express.urlencoded({ extended: false, limit: '16kb' }), async (req, res) => {
        if (!writeAllowed(req, config)) return res.status(403).send('Open this form on openvibe.design.');
        const key = req.body.key || '';
        try {
            await ctx.designs.chatEdit({ id: req.params.id, instruction: req.body.instruction,
                owner: subjectOf(req), key, subject: subjectOf(req) });
            return backToCanvas(req, res, key);
        } catch (err) {
            return res.status(err.status || 500).type('text/plain').send(err.detail || 'Could not edit that frame.');
        }
    });
    for (const action of ['undo', 'redo']) {
        r.post(`/d/:id/${action}`, express.urlencoded({ extended: false, limit: '8kb' }), async (req, res) => {
            if (!writeAllowed(req, config)) return res.status(403).send('Open this form on openvibe.design.');
            const key = req.body.key || '';
            try {
                await ctx.designs[action](req.params.id, subjectOf(req), key);
                return backToCanvas(req, res, key);
            } catch (err) {
                return res.status(err.status || 500).type('text/plain').send(err.detail || `Could not ${action} that edit.`);
            }
        });
    }

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

    // ── Your look: the theme worn and the comfort settings, for every site (views/look.js) ──
    r.get('/look', async (req, res) => {
        const list = await safe(() => catalog.list());
        return page(res, 200, lookView.lookPage({ themes: list ? list.themes : [], me: meOf(req.viewer) }), req.viewer);
    });

    // ── Components: the design system's components for web, Android and iOS (views/components.js) ──
    r.get('/components', (req, res) => page(res, 200, componentsView.componentsPage({ id: String(req.query.c || ''), platform: String(req.query.p || 'web') }), req.viewer));

    // ── Tokens: any public theme as code (views/tokens.js) ──
    r.get('/tokens', async (req, res) => {
        const list = await safe(() => catalog.list());
        const themes = list ? list.themes : [];
        const want = String(req.query.theme || 'vibe');
        const flag = [].concat(req.query.both || []);
        const both = flag.length ? flag.includes('1') : true;
        const found = themeTokens.resolve(themes, want, { both }) || (req.query.theme ? null : themeTokens.resolve(themes, (themes[0] || {}).slug, { both }));
        const format = String(req.query.format || 'css');
        return page(res, found || !req.query.theme ? 200 : 404, tokensView.tokensPage({ themes, found, format, both }), req.viewer);
    });

    // ── Arena: a view of Bench's nine design kinds (plan L51 step 1) ──
    // Someone who has not signed in may judge too. Their voter is a random id in an httpOnly cookie that only the
    // arena reads; Bench gets a keyed hash of it (X-OV-Voter) and caps each voter a day. Bench does not cap the
    // address behind a relayed vote, so Design does: a count per day of a keyed hash of the address, in memory.
    const VOTER_COOKIE = 'ovd_voter';
    const voterKey = (config.oauth && config.oauth.clientSecret) ? `arena-voter:${config.oauth.clientSecret}` : nodeCrypto.randomBytes(32).toString('hex');
    const keyed = (v) => nodeCrypto.createHmac('sha256', voterKey).update(String(v)).digest('hex').slice(0, 40);
    const guestCap = Math.max(0, Number(config.arena && config.arena.guestVotesPerAddress) || 0);
    const voterOf = (req, res, { make = false } = {}) => {
        let raw = String((req.cookies && req.cookies[VOTER_COOKIE]) || '');
        if (!/^[0-9a-f]{32}$/.test(raw)) {
            if (!make) return null;
            raw = nodeCrypto.randomBytes(16).toString('hex');
            res.cookie(VOTER_COOKIE, raw, { httpOnly: true, sameSite: 'lax', secure: /^https:/.test(String(config.baseUrl || '')), maxAge: 365 * 86400 * 1000, path: '/arena' });
        }
        return keyed(raw);
    };
    const addressVotes = { day: '', counts: new Map() };
    const addressAllows = (req, { spend = false } = {}) => {
        const day = new Date().toISOString().slice(0, 10);
        if (addressVotes.day !== day) { addressVotes.day = day; addressVotes.counts.clear(); }
        const key = keyed(`${day}|${req.ip || ''}`);
        const used = addressVotes.counts.get(key) || 0;
        if (used >= guestCap) return false;
        if (spend) addressVotes.counts.set(key, used + 1);
        return true;
    };
    const votersOf = (q) => (q === 'people' || q === 'anon' ? q : null);
    const arenaBoards = async (voters) => {
        const [boards, cost] = await Promise.all([
            arena.boardsAll({ voters }).catch((err) => { log.warn('[OpenVibe.Design] arena boards failed:', (err && err.message) || err); return []; }),
            arena.costAll().catch(() => []),
        ]);
        return { boards, cost };
    };
    const arenaPage = (res, status, req, data) => page(res, status, views.arenaHome({
        me: meOf(req.viewer), guestVotes: guestCap > 0, benchUrl: config.bench && config.bench.publicUrl, ...data,
    }), req.viewer, { cacheControl: 'private, no-store' });

    r.get('/arena', async (req, res) => {
        const kind = arenaKinds.kindOf(req.query.kind);
        const voters = votersOf(req.query.voters);
        const token = tokenOf(req);
        let pair = null;
        let notice = null;
        if (token || guestCap > 0) {
            try {
                pair = await arena.pairFor(kind.id, token ? { token } : { voter: voterOf(req, res, { make: true }) });
            } catch (err) {
                if (err instanceof ArenaError) notice = err.detail;
                else {
                    log.warn('[OpenVibe.Design] picking a pair failed:', (err && err.message) || err);
                    notice = 'The next pair could not be read. Try again in a moment.';
                }
            }
        }
        return arenaPage(res, 200, req, { kind: kind.id, pair, notice, voters, ...(await arenaBoards(voters)) });
    });

    r.get('/arena/new', async (req, res) => {
        return page(res, 200, views.arenaNew({ me: meOf(req.viewer), limits: await aria(req.viewer), categories }), req.viewer);
    });

    r.post('/arena/new', express.urlencoded({ extended: false, limit: '64kb' }), async (req, res) => {
        const me = meOf(req.viewer);
        if (!subjectOf(req)) return res.redirect(303, '/auth/login?next=%2Farena%2Fnew');
        if (!writeAllowed(req, config)) return res.status(403).type('text/plain').send('A round must be started from openvibe.design itself.');
        const b = req.body || {};
        try {
            const round = await arena.createRound({ category: String(b.category || ''), prompt: b.prompt, subject: subjectOf(req), token: tokenOf(req) });
            return res.redirect(303, `/arena/r/${encodeURIComponent(round.id)}`);
        } catch (err) {
            const notice = err instanceof ArenaError ? err.detail : 'The round could not be started. Try again in a moment.';
            if (!(err instanceof ArenaError)) log.warn('[OpenVibe.Design] starting a round failed:', (err && err.message) || err);
            return page(res, err instanceof ArenaError ? err.status : 500,
                views.arenaNew({ me, limits: await aria(req.viewer), categories, notice }), req.viewer);
        }
    });

    // The old address of the vote: the vote is on /arena now, for every kind.
    r.get('/arena/vote', (req, res) => {
        const kind = req.query.category === 'logo' ? 'design.component' : arenaKinds.kindOf(req.query.kind).id;
        return res.redirect(302, `/arena?kind=${encodeURIComponent(kind)}#ar-pair`);
    });

    // One vote, as the signed-in person or as a voter Design relays. The answer is the arena with the two designs
    // revealed. A plain form post, so it works without JavaScript.
    r.post('/arena/vote', express.urlencoded({ extended: false, limit: '16kb' }), async (req, res) => {
        const b = req.body || {};
        const kind = arenaKinds.kindOf(b.kind || (b.category === 'logo' ? 'design.component' : null));
        const voters = votersOf(b.voters);
        const token = tokenOf(req);
        const again = (status, notice) => arenaBoards(voters).then((more) => arenaPage(res, status, req, { kind: kind.id, pair: null, notice, voters, ...more }));
        if (token) {
            if (!writeAllowed(req, config)) return res.status(403).type('text/plain').send('A vote must come from openvibe.design itself.');
        } else {
            if (!guestCap) return res.redirect(303, `/auth/login?next=${encodeURIComponent(`/arena?kind=${kind.id}`)}`);
            if (!sameOrigin(req, config)) return res.status(403).type('text/plain').send('Vote on openvibe.design itself.');
            if (!addressAllows(req)) return again(429, 'Sign in to keep voting today.');
        }
        const voter = token ? null : voterOf(req, res, { make: true });
        try {
            const result = await arena.judge({
                kind: kind.id,
                roundId: String(b.round_id || ''),
                left: String(b.left_output || ''),
                right: String(b.right_output || ''),
                outcome: String(b.winner || ''),
                ...(token ? { token } : { voter }),
            });
            if (!token) addressAllows(req, { spend: true });
            return arenaPage(res, 200, req, { kind: kind.id, reveal: result, voters, ...(await arenaBoards(voters)) });
        } catch (err) {
            if (!(err instanceof ArenaError)) log.warn('[OpenVibe.Design] vote failed:', (err && err.message) || err);
            return again(err instanceof ArenaError ? err.status : 500, err instanceof ArenaError ? err.detail : 'The vote could not be recorded. Try again in a moment.');
        }
    });

    r.get('/arena/r/:id', async (req, res) => {
        let round = null;
        try { round = await arena.getRound(String(req.params.id || ''), { token: tokenOf(req) }); } catch (err) {
            log.warn('[OpenVibe.Design] round page failed:', (err && err.message) || err);
        }
        if (!round) return page(res, 404, views.notFound(), req.viewer);
        return page(res, 200, views.arenaRound({ round, me: meOf(req.viewer) }), req.viewer);
    });

    r.get('/developers', (req, res) => page(res, 200, views.developers(), req.viewer));

    r.use((req, res) => page(res, 404, views.notFound(), req.viewer));
    return r;
}

module.exports = { createPageRoutes, meOf };
