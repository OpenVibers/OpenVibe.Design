'use strict';

/**
 * Crawl artifacts for openvibe.design, built with openvibe-shared/seo: robots.txt, sitemap.xml and llms.txt.
 * The public pages are for search engines and AI crawlers; the studio's writes, the API and sign-in are not.
 *
 * The sitemap leads with the four doors (/see, /make, /rules, /use), then /, /themes and one page per public theme in
 * the catalogue. A Network failure leaves the static pages in place rather than failing the crawl artifact.
 */
const fs = require('fs');
const path = require('path');
const seo = require('openvibe-shared/seo');
const glyphs = require('openvibe-shared/glyphs');
const { COMPONENTS } = require('../components/registry');
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
        // The four doors lead (the owner, 2026-11-10): the bar, and the first thing a crawler reads.
        { path: '/see', changefreq: 'weekly', priority: 1.0, title: 'See: how OpenVibe looks and moves', text: 'Look, tokens, the mark, components, the kit, forms, patterns, motion, loading, progress and native apps: how OpenVibe looks and moves.' },
        { path: '/make', changefreq: 'weekly', priority: 0.9, title: 'Make: what you make with it', text: 'Create, themes, icons, fonts, the uploader, prompts and the Arena: what you make with OpenVibe\'s design system.' },
        { path: '/rules', changefreq: 'weekly', priority: 0.9, title: 'How OpenVibe decides', text: 'Every style, design and organization rule behind OpenVibe, with the day it was decided, why, and what carries it out. Also as data at /api/v1/rules.' },
        { path: '/use', changefreq: 'weekly', priority: 0.8, title: 'Use: building with it', text: 'The SDK, the API, the files and the versions, and how to install and call them in your own app.' },
        { path: '/', changefreq: 'weekly', priority: 1.0, title: 'OpenVibe.Design', text: 'Browse OpenVibe\'s themes, try them on a preview, edit one with contrast checks, use it, and roll back to any earlier setting.' },
        { path: '/gallery', changefreq: 'daily', priority: 0.8, title: 'Elements and packs', text: 'Free buttons, controls and stream widgets people made with AI: install one on your Live channel, remix it as your own, or try it on sample data first.' },
        { path: '/themes', changefreq: 'weekly', priority: 0.9, title: 'Themes', text: 'Try a theme on a preview, edit its variables with contrast checks, use it across the network, submit it to the gallery, and roll back.' },
        { path: '/system', changefreq: 'weekly', priority: 0.8, title: 'The design system', text: 'Everything OpenVibe is made of in one map: themes, tokens, fonts, icons, the mark and motion; components, the kit and forms; the rules and patterns; apps and developer tools.' },
        { path: '/look', changefreq: 'monthly', priority: 0.6, title: 'Your look', text: 'Your theme, light or dark, text size, motion and seasonal themes for every OpenVibe site, in one place.' },
        { path: '/kit', changefreq: 'weekly', priority: 0.7, title: 'The OpenVibe Kit', text: 'Every part an OpenVibe page is made of, one function call each: drawn, with its code for the server and the page, and what its CSS weighs.' },
        { path: '/components', changefreq: 'weekly', priority: 0.7, title: 'Components', text: 'The component registry as one plain list: every Shared kit component as a design.component@1 entry with its props, states, example markup and Android and iOS notes.' },
        { path: '/changes', changefreq: 'daily', priority: 0.8, title: 'Shared releases', text: 'Every openvibe-shared release in the pinned changelog, newest first, with the component pages and rules it touches and its screenshots.' },
        { path: '/components/registry', changefreq: 'weekly', priority: 0.8, title: 'Component registry', text: 'Every shared OpenVibe interface as one design.component@1 definition: navbar, menu, You home, Dock and tabs, thread composer, sheets, pop-overs, keyboard behaviour, kit rows, cards, sections, empty states, switches, segmented controls, uploads, the model chip and motion, for web, Android and iOS.' },
        { path: '/tokens', changefreq: 'weekly', priority: 0.8, title: 'Your theme, as code', text: 'Any OpenVibe theme as design tokens: CSS variables, Tailwind, Jetpack Compose, SwiftUI, Flutter, Figma variables and W3C DTCG JSON, light and dark together.' },
        { path: '/brand', changefreq: 'monthly', priority: 0.7, title: 'The OpenVibe mark', text: 'The OpenVibe mark, a ring O and a round V: what each of its moves means, its forms, colours and the names beside it, with the SVG files and the code to use it on any site.' },
        { path: '/loading', changefreq: 'monthly', priority: 0.6, title: 'Loading: nothing spins', text: 'How OpenVibe waits: placeholders shaped like the content (kit.skeleton), the mark at work instead of a spinner (OpenVibeLoading), the navbar while a page moves (OpenVibeNavbar.busy), and the rules.' },
        { path: '/progress', changefreq: 'monthly', priority: 0.6, title: 'Upload progress', text: 'The shared ov-progress component: transfer, processing, pause, retry and completion, with tokens and code.' },
        { path: '/uploader', changefreq: 'monthly', priority: 0.6, title: 'Uploader', text: 'The shared file picker and upload queue for OpenVibe sites, with preview, Remove and code.' },
        { path: '/forms', changefreq: 'monthly', priority: 0.6, title: 'Forms: OpenVibe’s own controls', text: 'OpenVibe’s select and form controls on every site: a menu on a computer, a sheet on a phone, choices that say whether they are ready, switches, fields and choice cards (openvibe-shared ov-forms).' },
        { path: '/native', changefreq: 'monthly', priority: 0.6, title: 'Apps for Android and iOS', text: 'How an OpenVibe page becomes a real Android or iOS screen: one set of tokens, components, patterns and icons, three size classes, what each platform does its own way, and the road from the web to apps.' },
        { path: '/motion', changefreq: 'monthly', priority: 0.6, title: 'Motion', text: 'How OpenVibe moves: the mark\'s motion and one shared kit of effects (glint, glow, lift, press, ripple, tilt, reveal, count, confetti), the timing every site shares, the rules and the code (openvibe-shared/ov-fx).' },
        { path: '/icons', changefreq: 'weekly', priority: 0.7, title: 'The OpenVibe glyphs', text: 'Every OpenVibe icon in one hand, the mark\'s: search them, copy or download their SVG, use them in place of Font Awesome, and draw new ones with OpenVibe.AI.' },
        { path: '/fonts', changefreq: 'weekly', priority: 0.7, title: 'Open font library', text: 'Browse open licence font families by category, script and weight; preview every style and find its source and licence.' },
        { path: '/icons/font-awesome-alternative', changefreq: 'monthly', priority: 0.6, title: 'A free Font Awesome alternative', text: 'Keep your Font Awesome markup and show the OpenVibe glyphs: one script, the same classes, animations and transforms, plus free web and desktop fonts.' },
        { path: '/icons/migrate', changefreq: 'monthly', priority: 0.5, title: 'Switch from Font Awesome, Lucide or Material', text: 'Paste your HTML or code and see every Font Awesome, Lucide, Material or MUI icon it uses with its free OpenVibe twin.' },
        { path: '/arena', changefreq: 'daily', priority: 0.9, title: 'The Design Arena', text: 'One prompt, three AI designers, blind votes and an Elo leaderboard per category, with cost and time per generation.' },
        // The makers (plan R1 item 8): the pages an agent may drive. The drawings and the typefaces they
        // produce are the person's and stay out of the crawl.
        { path: '/fonts/make', changefreq: 'monthly', priority: 0.7, title: 'Make a typeface', text: 'Describe a typeface and the model draws it: the outlines, a WOFF2 and an OTF, under the SIL Open Font License.' },
        { path: '/vectors/make', changefreq: 'monthly', priority: 0.7, title: 'Make a vector', text: 'Describe an icon, an illustration or a pattern and the model draws it as one clean SVG you can download.' },
    ];
    const themePages = (Array.isArray(themes) ? themes : []).filter((t) => t && t.slug).map((t) => ({
        path: `/t/${encodeURIComponent(String(t.slug))}`,
        changefreq: 'monthly',
        priority: 0.6,
        title: String(t.name || t.slug),
        text: `${t.mode ? `${String(t.mode)} theme. ` : ''}${String(t.description || 'A theme in the OpenVibe catalogue.')}`.trim(),
    }));
    // One page per glyph, with its SVG and a PNG as images (Google Images reads the licence from the page's JSON-LD).
    const glyphPages = glyphs.NAMES.map((n) => ({
        path: `/icons/${n}`, changefreq: 'monthly', priority: 0.5, title: `${n} icon`,
        text: `The ${n.replace(/-/g, ' ')} icon from the OpenVibe glyphs: SVG, PNG at any size and colour, and the font.`,
        images: [`/icons/${n}.svg`, `/icons/${n}.png?size=512`],
    }));
    const componentPages = COMPONENTS.map((component) => ({
        path: `/components/${component.name}`, changefreq: 'weekly', priority: 0.6,
        title: `${component.title}: OpenVibe component`, text: component.summary,
    }));
    return [...static_, ...componentPages, ...themePages, ...glyphPages];
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

    // The site as llms.txt describes it, shared by /llms.txt and /llms-full.txt (SEO-33).
    const llmsSite = (list) => ({
            name: SITE_NAME,
            summary: DESCRIPTION,
            details: 'Theme selection stays in OpenVibe.Network (its theme API); this service signs the person in and proxies their calls. The pages here are server-rendered and readable without JavaScript, and the theme catalogue is public. MCP server: POST https://openvibe.design/mcp (Streamable HTTP); public themes, tokens, components and the icons (search, SVG, code in any format, a migration from Font Awesome, Lucide or Material).',
            markdown: true,
            base: config.baseUrl,
            sections: [
                // The four doors come first: the bar, and the map every page says it sits in.
                { title: 'The four doors', links: [
                    { title: 'See', url: abs('/see'), note: 'how OpenVibe looks and moves: look, tokens, the mark, components, the kit, forms, patterns, motion, loading, progress and native apps' },
                    { title: 'Make', url: abs('/make'), note: 'what you make with it: create, themes, icons, fonts, uploader, prompts and the Arena' },
                    { title: 'Rules', url: abs('/rules'), note: 'the register of every style, design and organization decision, then the system map at /system' },
                    { title: 'Use', url: abs('/use'), note: 'building with it: the SDK, the API, the files and the versions' },
                ] },
                { title: 'Start here', links: [
                    { title: 'OpenVibe.Design', url: abs('/'), note: 'the theme catalogue' },
                    { title: 'Themes', url: abs('/themes'), note: 'try, edit, use, submit and roll back a theme' },
                    { title: 'Rules', url: abs('/rules'), note: 'every style, design and organization decision behind OpenVibe, with the day and the reason; read it before designing for OpenVibe. JSON: GET /api/v1/rules' },
                    { title: 'Shared releases', url: abs('/changes'), note: 'every openvibe-shared release in the pinned changelog, newest first, with the component pages and rule numbers it touches and the screenshots the repo holds. JSON: GET /api/v1/changes' },
                    { title: 'The design system', url: abs('/system'), note: 'every reference page in four groups: foundations, components, guidance, platforms' },
                    { title: 'Tokens', url: abs('/tokens'), note: 'any theme as CSS, Tailwind, Compose (Android), SwiftUI (iOS), Flutter, Figma or DTCG JSON; the API is GET /api/v1/tokens/:theme?format=' },
                    { title: 'The OpenVibe glyphs', url: abs('/icons'), note: 'every icon in one hand, each with its own page (/icons/<name>): SVG, PNG at any size and colour (/icons/<name>.png?size=&color=&stroke=&pad=&ground=&bg=), the WOFF2/TTF/OTF fonts and the sprite (/icons/pack/<file>); style=auto|line|solid (auto: the solid drawing at 18 px and under); /icons/<name>.mjs (ES module), .xml (Android VectorDrawable), /icons/<name>/favicon.zip; the <ov-icon name=\"…\"> web component at /ov-icon.js; the registry as data at GET /api/v1/glyphs (?names=a,fa-b,lucide:c,material:d for just those); GET /api/v1/glyphs/suggest?label=&context=&rank=1 proposes the best glyphs for the words on a button (rank=1 asks a small model when the words are new); POST /api/v1/glyphs/migrate {text} lists every Font Awesome, Lucide, Material or MUI icon in a page or code with its OpenVibe twin (/icons/migrate is the page). All open, no sign-in, CORS *', html: true },
                    { title: 'Open font library', url: abs('/fonts'), note: 'Open licence typefaces with live previews, every style, licence, source, CSS and download. Search and filters at /fonts; JSON at GET /api/v1/fonts and /api/v1/fonts/<family>; MCP tools list and get fonts.' },
                    { title: 'A free Font Awesome alternative', url: abs('/icons/font-awesome-alternative'), note: 'one script keeps Font Awesome markup, classes, animations and data-fa-transform, and shows the OpenVibe glyphs', html: true },
                    { title: 'Loading', url: abs('/loading'), note: 'how OpenVibe waits: placeholders shaped like the content (kit.skeleton: card, row, tile, chip, line, chat, stat), the mark at work instead of a spinner (OpenVibeLoading), the navbar while a page moves (OpenVibeNavbar.busy), and the rules' },
                    { title: 'Progress', url: abs('/progress'), note: 'ov-progress in all six states, with time remaining, reduced motion, tokens and code' },
                    { title: 'Uploader', url: abs('/uploader'), note: 'the shared drop card, file preview, queue and total progress, with code' },
                    { title: 'Forms', url: abs('/forms'), note: 'OpenVibe’s own select (a menu on a computer, a sheet on a phone; options with state, badge and a setup link), switches, fields and choice cards: ov-forms.js and ov-forms.css' },
                    { title: 'The OpenVibe mark', url: abs('/brand'), note: 'the logo, its states and motion, colours, the brand face, SVG files and code (openvibe-shared/mark, ov-mark.js)' },
                    { title: 'The Design Arena', url: abs('/arena'), note: 'one prompt, three AI designers, blind votes and an Elo leaderboard' },
                    { title: 'For developers', url: abs('/developers'), note: 'the theme API proxy' },
                ] },
                // The makers: an agent can drive these two through the API and the MCP tools. Each run is
                // charged to the signed-in person who asks for it, and their drawings stay theirs.
                { title: 'Make things', links: [
                    { title: 'Make a typeface', url: abs('/fonts/make'), note: 'describe a typeface and the model draws the letters; POST /api/v1/typefaces {prompt, baseFamily?, name?} returns the outlines and the font files (/api/v1/typefaces/<id>/font.woff2 and .otf); redraw one letter with POST /api/v1/typefaces/<id>/glyph {char, note}; MCP tool openvibe_design_make_typeface' },
                    { title: 'Make a vector', url: abs('/vectors/make'), note: 'describe an icon, an illustration or a pattern and the model draws one clean SVG; POST /api/v1/vectors {prompt, kind} returns it; change it with POST /api/v1/vectors/<id>/edit {note}; the drawing as SVG or PNG at /vectors/made/<id>.svg and .png; MCP tool openvibe_design_make_vector' },
                ] },
                { title: 'Themes', links: list.filter((t) => t && t.slug).slice(0, 100).map((t) => ({ title: String(t.name || t.slug), url: abs(`/t/${encodeURIComponent(String(t.slug))}`), note: `${t.mode ? String(t.mode) : 'theme'}${t.description ? ` — ${String(t.description)}` : ''}` })) },
                { title: 'Component registry', links: [
                    { title: 'The component registry', url: abs('/components/registry'), note: 'every shared interface as a design.component@1 definition, for web, Android and iOS' },
                    ...COMPONENTS.map((c) => ({ title: c.title, url: abs(`/components/${c.name}`), note: `${c.summary} Definition: ${abs(`/api/v1/components/${c.name}`)}` })),
                ] },
                // The data an agent came for is a main section, not something to skip.
                { title: 'Machine-readable', links: [
                    { title: 'The theme catalogue (JSON)', url: abs('/api/themes'), note: 'public, cached for 5 minutes' },
                    { title: 'Font catalogue (JSON)', url: abs('/api/v1/fonts'), note: 'open licence families, cached for 5 minutes' },
                    { title: 'The component registry (JSON)', url: abs('/api/v1/components'), note: 'design.component@1 definitions for every shared interface; one at /api/v1/components/<name>; the SDK exposes ov.design.components()' },
                    { title: 'The Arena dataset (JSONL)', url: abs('/api/v1/arena/dataset.jsonl'), note: 'prompts, outputs and votes, no voters' },
                    { title: 'Agent manifest', url: abs('/.well-known/agent.json') },
                ] },
            ],
            optional: [
                { title: 'Sitemap', url: abs('/sitemap.xml') },
                { title: 'Release metadata (JSON)', url: abs('/release.json') },
                { title: 'OpenVibe.Network', url: 'https://openvibe.network', note: 'accounts and the theme API this service proxies' },
            ],
        });
    r.get('/llms.txt', async (_req, res) => {
        const list = await themes();
        res.type('text/plain').set('Cache-Control', TEXT).send(seo.llmsTxt(llmsSite(list)));
    });
    // The same, in full (SEO-33): what the site is, then every page llms.txt lists with what it holds.
    r.get('/llms-full.txt', async (_req, res) => {
        const d = llmsSite(await themes());
        res.type('text/plain').set('Cache-Control', TEXT).send(seo.llmsFull({
            site: d.name, summary: d.summary, base: abs('/'),
            sections: [
                { title: 'About', pages: [{ title: d.name, url: abs('/'), text: [d.summary, d.details].filter(Boolean).join('\n\n') }] },
                ...(d.sections || []).map((x) => ({ title: x.title, pages: (x.links || []).map((l) => ({ title: l.title, url: l.url, text: l.note || '' })) })),
            ],
        }));
    });

    r.get('/sitemap.xml', async (_req, res) => {
        const pages = publicPages(await themes());
        const lastmod = siteUpdated();
        const changePages = require('../changes').releases().map((release) => ({ path: `/changes/${release.version}`, changefreq: 'monthly', priority: 0.5 }));
        const urls = [...pages, ...changePages].map((e) => ({ loc: abs(e.path), ...(lastmod ? { lastmod } : {}), changefreq: e.changefreq, priority: e.priority, ...(e.images ? { images: e.images.map(abs) } : {}) }));
        res.type('application/xml').set('Cache-Control', TEXT).send(seo.sitemapXml(urls));
    });

    return r;
}

module.exports = { createDiscoveryRoutes, publicPages, DESCRIPTION, SITE_NAME, DISALLOW };
