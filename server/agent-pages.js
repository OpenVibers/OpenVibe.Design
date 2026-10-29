'use strict';
// The Markdown twins of openvibe.design's public pages (openvibe-shared/agent-layer), rendered by the same
// view builders and page shell the routes use (views/index.js through render/layout.js), signed out so a
// twin can never carry a person's studio state, drafts or Arena vote. The pages are the theme catalogue,
// the studio's signed-out shell, one public theme, /developers and the three public Arena pages. /create,
// /d/:id and /arena/r/:id are private or noindex on the site, so they have no twin and advertise none.
const views = require('./views');
const { meOf } = require('./http/pages');

const TWIN_PATHS = /^\/(?:studio|developers|arena(?:\/new|\/vote)?|t\/[^/]+)?$/;

function createAgentPages(ctx) {
    const { catalog, arena, log } = ctx;
    const safe = (fn) => Promise.resolve().then(fn).catch((err) => {
        log.warn('[OpenVibe.Design] agent twin catalogue failed:', (err && err.message) || err);
        return null;
    });
    const twin = (html) => ({ html });

    async function home() {
        const list = await safe(() => catalog.list());
        return twin(views.home({ themes: list ? list.themes : null }));
    }

    async function studio() {
        const list = await safe(() => catalog.list());
        return twin(views.studio({ themes: list ? list.themes : null, me: meOf(null) }));
    }

    async function theme(slug) {
        const up = await safe(() => catalog.get(slug));
        if (!up || up.status === 404 || !up.ok || !up.data || !up.data.theme) return null;
        return twin(views.theme({ theme: up.data.theme }));
    }

    async function arenaHome() {
        let boards;
        let costBoards;
        try {
            boards = await arena.leaderboard(null);
            costBoards = await arena.costLeaderboard(null);
        } catch (err) {
            log.warn('[OpenVibe.Design] agent twin leaderboard failed:', (err && err.message) || err);
            boards = arena.CATEGORIES.map((category) => ({ category, leaderboard: [] }));
            costBoards = [];
        }
        return twin(views.arenaHome({ categories: boards, costCategories: costBoards, me: meOf(null), limits: null }));
    }

    function arenaNew() {
        return twin(views.arenaNew({ me: meOf(null), limits: null, categories: arena.CATEGORIES }));
    }

    function arenaVote() {
        return twin(views.arenaVote({ pair: null, me: meOf(null), notice: null }));
    }

    async function renderPublicPage(path) {
        const p = String(path || '/').replace(/\/+$/, '') || '/';
        if (!TWIN_PATHS.test(p)) return null;
        if (p === '/') return home();
        if (p === '/studio') return studio();
        if (p === '/developers') return twin(views.developers());
        if (p === '/arena') return arenaHome();
        if (p === '/arena/new') return arenaNew();
        if (p === '/arena/vote') return arenaVote();
        const m = /^\/t\/([^/]+)$/.exec(p);
        if (m) return theme(decodeURIComponent(m[1]));
        return null;
    }

    return { renderPublicPage };
}

module.exports = { createAgentPages };
