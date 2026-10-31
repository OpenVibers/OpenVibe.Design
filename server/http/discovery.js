'use strict';

/**
 * Crawl artifacts for openvibe.design, built with openvibe-shared/seo: robots.txt, sitemap.xml and llms.txt.
 * The public pages are for search engines and AI crawlers; the studio's writes, the API and sign-in are not.
 *
 * The sitemap is /, /studio and one page per public theme in the catalogue. A Network failure leaves the static
 * pages in place rather than failing the crawl artifact.
 */
const fs = require('fs');
const path = require('path');
const seo = require('openvibe-shared/seo');
const { asyncRouter } = require('./router');

const SITE_NAME = 'OpenVibe.Design';
const DESCRIPTION = 'OpenVibe.Design is the Design room of the OpenVibe network: browse OpenVibe\'s themes, try them on previews, edit one with contrast checks, use it, submit it to the gallery, and roll back to any earlier setting.';
const DISALLOW = ['/auth/', '/api/'];

function dayOf(ts) {
    const m = String(ts == null ? '' : ts).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
}
function siteUpdated() {
    try { return dayOf(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'STATUS.json'), 'utf8')).updated); } catch { return null; }
}

/** Every public page, in the order a crawler should read them. */
function publicPages(themes = []) {
    const static_ = [
        { path: '/', changefreq: 'weekly', priority: 1.0, title: 'OpenVibe.Design', text: 'Browse OpenVibe\'s themes, try them on a preview, edit one with contrast checks, use it, and roll back to any earlier setting.' },
        { path: '/studio', changefreq: 'weekly', priority: 0.9, title: 'The theme studio', text: 'Try a theme on a preview, edit its variables with contrast checks, use it across the network, submit it to the gallery, and roll back.' },
        { path: '/look', changefreq: 'monthly', priority: 0.6, title: 'Your look', text: 'Your theme, light or dark, text size, motion and seasonal themes for every OpenVibe site, in one place.' },
        { path: '/components', changefreq: 'weekly', priority: 0.7, title: 'Components', text: 'The OpenVibe design system\'s components, each with its parts, tokens, states and accessibility, and code for the web, Jetpack Compose and SwiftUI.' },
        { path: '/tokens', changefreq: 'weekly', priority: 0.8, title: 'Your theme, as code', text: 'Any OpenVibe theme as design tokens: CSS variables, Tailwind, Jetpack Compose, SwiftUI, Flutter, Figma variables and W3C DTCG JSON, light and dark together.' },
        { path: '/brand', changefreq: 'monthly', priority: 0.7, title: 'The OpenVibe mark', text: 'The OpenVibe mark, a ring O and a round V: what each of its moves means, its forms, colours and the names beside it, with the SVG files and the code to use it on any site.' },
        { path: '/icons', changefreq: 'weekly', priority: 0.7, title: 'The OpenVibe glyphs', text: 'Every OpenVibe icon in one hand, the mark\'s: search them, copy or download their SVG, use them in place of Font Awesome, and draw new ones with OpenVibe.AI.' },
        { path: '/arena', changefreq: 'daily', priority: 0.9, title: 'The Design Arena', text: 'One prompt, three AI designers, blind votes and an Elo leaderboard per category, with cost and time per generation.' },
    ];
    const themePages = (Array.isArray(themes) ? themes : []).filter((t) => t && t.slug).map((t) => ({
        path: `/t/${encodeURIComponent(String(t.slug))}`,
        changefreq: 'monthly',
        priority: 0.6,
        title: String(t.name || t.slug),
        text: `${t.mode ? `${String(t.mode)} theme. ` : ''}${String(t.description || 'A theme in the OpenVibe catalogue.')}`.trim(),
    }));
    return [...static_, ...themePages];
}

function createDiscoveryRoutes(ctx) {
    const { config, catalog } = ctx;
    const r = asyncRouter();
    const site = String(config.baseUrl).replace(/\/+$/, '');
    const abs = (p) => `${site}${p}`;
    const TEXT = 'public, max-age=3600';

    async function themes() {
        try { const list = await catalog.list(); return list.themes; } catch { return []; }
    }

    r.get('/robots.txt', async (_req, res) => {
        res.type('text/plain').set('Cache-Control', TEXT).send(
            '# openvibe.design: the public pages are for search and AI crawlers; sign-in and the API are not.\n'
            + seo.robotsTxt({ sitemaps: [abs('/sitemap.xml')], disallow: DISALLOW }));
    });

    r.get('/llms.txt', async (_req, res) => {
        const list = await themes();
        res.type('text/plain').set('Cache-Control', TEXT).send(seo.llmsTxt({
            name: SITE_NAME,
            summary: DESCRIPTION,
            details: 'Theme selection stays in OpenVibe.Network (its theme API); this service signs the person in and proxies their calls. The pages here are server-rendered and readable without JavaScript, and the theme catalogue is public.',
            sections: [
                { title: 'Start here', links: [
                    { title: 'OpenVibe.Design', url: abs('/'), note: 'the theme catalogue' },
                    { title: 'The studio', url: abs('/studio'), note: 'try, edit, use, submit and roll back a theme' },
                    { title: 'Tokens', url: abs('/tokens'), note: 'any theme as CSS, Tailwind, Compose (Android), SwiftUI (iOS), Flutter, Figma or DTCG JSON; the API is GET /api/v1/tokens/:theme?format=' },
                    { title: 'The OpenVibe glyphs', url: abs('/icons'), note: 'every icon in one hand; the registry as data at GET /api/v1/glyphs; openvibe-shared/glyphs and ov-glyphs.js' },
                    { title: 'The OpenVibe mark', url: abs('/brand'), note: 'the logo, its states and motion, colours, the brand face, SVG files and code (openvibe-shared/mark, ov-mark.js)' },
                    { title: 'The Design Arena', url: abs('/arena'), note: 'one prompt, three AI designers, blind votes and an Elo leaderboard' },
                    { title: 'For developers', url: abs('/developers'), note: 'the theme API proxy' },
                ] },
                { title: 'Themes', links: list.filter((t) => t && t.slug).slice(0, 100).map((t) => ({ title: String(t.name || t.slug), url: abs(`/t/${encodeURIComponent(String(t.slug))}`), note: `${t.mode ? String(t.mode) : 'theme'}${t.description ? ` — ${String(t.description)}` : ''}` })) },
                { title: 'Machine-readable', links: [
                    { title: 'MCP tools', url: abs('/mcp'), note: 'POST, Streamable HTTP; public themes, tokens and components' },
                    { title: 'Agent manifest', url: abs('/.well-known/agent.json') },
                    { title: 'The theme catalogue (JSON)', url: abs('/api/themes'), note: 'public, cached for 5 minutes' },
                    { title: 'The Arena dataset (JSONL)', url: abs('/api/v1/arena/dataset.jsonl'), note: 'prompts, outputs and votes, no voters' },
                    { title: 'Sitemap', url: abs('/sitemap.xml') },
                    { title: 'Release metadata (JSON)', url: abs('/release.json') },
                ] },
                { title: 'Elsewhere', links: [
                    { title: 'OpenVibe.Network', url: 'https://openvibe.network', note: 'accounts and the theme API this service proxies' },
                ] },
            ],
        }));
    });

    r.get('/sitemap.xml', async (_req, res) => {
        const pages = publicPages(await themes());
        const lastmod = siteUpdated();
        const urls = pages.map((e) => ({ loc: abs(e.path), ...(lastmod ? { lastmod } : {}), changefreq: e.changefreq, priority: e.priority }));
        res.type('application/xml').set('Cache-Control', TEXT).send(seo.sitemapXml(urls));
    });

    return r;
}

module.exports = { createDiscoveryRoutes, publicPages, DESCRIPTION, SITE_NAME, DISALLOW };
