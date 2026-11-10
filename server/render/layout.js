'use strict';

/**
 * Page shell for OpenVibe.Design. Every page is server-rendered through openvibe-shared/shell and is complete
 * without JavaScript: the OpenVibe Frame (theme, navbar, footer) comes from the shared shell and the room's accent
 * from openvibe-shared/rooms. The views themselves are plain placeholders for now (server/views/index.js).
 *
 *   - <head>: the shared app icon, the room's stylesheets, this site's content-hashed design.css
 *   - the navbar's session probe (/auth/me), sign-in and sign-out URLs and silent sign-in, as every site's
 *   - the product's own script only where a page offers an in-browser convenience (/themes)
 */
const shell = require('openvibe-shared/shell');
const ovServe = require('openvibe-shared/serve');
const appIcon = require('openvibe-shared/app-icon');
const kit = require('openvibe-shared/kit');
const rooms = require('openvibe-shared/rooms');
const { asset, assetVersion } = require('../assets');

const NAME = 'OpenVibe.Design';
const NETWORK = 'https://openvibe.network';
const ROOM = rooms.get('design');
const esc = kit.esc;

const NAV = [
    // Six places in the bar (the six-places rule); everything else under More, in the System page's order.
    { label: 'Home', href: '/', icon: 'fa-house' },
    { label: 'Create', href: '/create', icon: 'fa-wand-magic-sparkles' },
    { label: 'Themes', href: '/themes', icon: 'fa-palette' },
    { label: 'Your look', href: '/look', icon: 'fa-circle-half-stroke' },
    { label: 'Arena', href: '/arena', icon: 'fa-crown' },
    { label: 'System', href: '/system', icon: 'fa-layer-group' },
    { label: 'Tokens', href: '/tokens', icon: 'fa-code', more: true },
    { label: 'Fonts', href: '/fonts', icon: 'fa-font', more: true },
    { label: 'Icons', href: '/icons', icon: 'fa-shapes', more: true },
    { label: 'The mark', href: '/brand', icon: 'fa-star', more: true },
    { label: 'Motion', href: '/motion', icon: 'fa-wind', more: true },
    { label: 'Components', href: '/components', icon: 'fa-puzzle-piece', more: true },
    { label: 'Kit', href: '/kit', icon: 'fa-cubes', more: true },
    { label: 'Forms', href: '/forms', icon: 'fa-list-check', more: true },
    { label: 'Loading', href: '/loading', icon: 'fa-hourglass-half', more: true },
    { label: 'Progress', href: '/progress', icon: 'fa-gauge-high', more: true },
    { label: 'Uploader', href: '/uploader', icon: 'fa-upload', more: true },
    { label: 'Rules', href: '/rules', icon: 'fa-scale-balanced', more: true },
    { label: 'Patterns', href: '/patterns', icon: 'fa-table-cells', more: true },
    { label: 'Prompts', href: '/prompts', icon: 'fa-quote-left', more: true },
    { label: 'Apps (Android, iOS)', href: '/native', icon: 'fa-mobile-screen', more: true },
    { label: 'Developers', href: '/developers', icon: 'fa-terminal', more: true },
];

let RELEASE = 'dev';
let BASE = 'https://openvibe.design';
function setRelease(id) { if (id) RELEASE = String(id); }
function configure({ baseUrl } = {}) { if (baseUrl) BASE = String(baseUrl).replace(/\/+$/, ''); }
const baseUrl = () => BASE;
const canonical = (p) => `${BASE}${p || '/'}`;

/** The page around a body: the shared shell with the room's stylesheets and behaviour. */
function layout({ title, description, canonical, path, robots = 'index, follow', body, active = '/', scripts = [], styles = [], jsonLd = [], inlineStyles = [], preloads = [], image, imageAlt, shared = [], sharedStyles = [] } = {}) {
    const pathNow = path || active || '/';
    canonical = canonical || (path ? `${BASE}${path}` : undefined);
    const navbar = {
        service: 'design',
        apiBase: NETWORK,
        links: NAV.map((l) => ({ ...l, active: l.href === active || (l.href !== '/' && String(active).startsWith(`${l.href}/`)) })),
        appBar: [{ label: 'Home', href: '/', icon: 'fa-house' }, { label: 'Create', href: '/create', icon: 'fa-wand-magic-sparkles' }, { label: 'Themes', href: '/themes', icon: 'fa-palette' }, { label: 'Arena', href: '/arena', icon: 'fa-crown' }, { label: 'System', href: '/system', icon: 'fa-layer-group' }],
        history: { type: 'document', title: title || NAME, image_url: image || null },
        silentLogin: `${BASE}/auth/login?silent=1&next={url}`,
        sessionUrl: '/auth/me',
        tokenUrl: '/auth/navbar-token',
        loginUrl: '/auth/login?next={path}',
        logoutUrl: '/auth/logout?next={path}',
    };
    const footer = { service: 'design', variant: 'full', mount: '#ov-footer', brandName: NAME };
    return shell.page({
        name: NAME,
        lang: 'en',
        title: title || `${NAME}: ${ROOM.line}`,
        titleSuffix: title ? ` · ${NAME}` : '',
        siteName: NAME,
        description: description || `${ROOM.line}. Browse OpenVibe's themes, try them on a preview, edit one with contrast checks, and use it across the network.`,
        canonical,
        robots,
        jsonLd,
        ...(image ? { image, imageAlt } : {}),
        home: '/',
        navLinks: NAV,
        navbar,
        footer,
        head: `${appIcon.headTags({ site: 'design' })}
<link rel="stylesheet" href="${esc(ovServe.url('kit.css'))}">
<link rel="stylesheet" href="${esc(ovServe.url('room.css'))}">
<link rel="stylesheet" href="${esc(ovServe.url('showcase.css'))}">
<link rel="stylesheet" href="${esc(asset('css/design.css'))}">
${(sharedStyles || []).map((file) => `<link rel="stylesheet" href="${esc(ovServe.url(file))}">`).join('\n')}
${(styles || []).map((rel) => `<link rel="stylesheet" href="${esc(asset(rel))}">`).join('\n')}
${(inlineStyles || []).map((css) => `<style>${css}</style>`).join('\n')}
${preloads.map(p => `<link rel="preload" as="font" type="font/woff2" href="${esc(p.url)}" crossorigin integrity="${esc(p.sri)}">`).join('\n')}
<script src="${esc(ovServe.url('kit-web.js'))}" defer></script>
<script src="${esc(ovServe.url('motion.js'))}" defer></script>
${(shared || []).map((file) => `<script src="${esc(ovServe.url(file))}" defer></script>`).join('\n')}
${(scripts || []).map((rel) => `<script src="${esc(asset(rel))}" defer></script>`).join('\n')}
<meta name="ov-boost" content="design@${esc(RELEASE)}">`,
        body: `<a class="skip" href="#main">Skip to content</a>
<div id="navbar-mount"></div>
<main id="main" class="ds ov-room" style="${rooms.style('design')}">${body || ''}</main>
<script>window.__OV_PAGE = ${JSON.stringify({ navbar, footer, path: pathNow }).replace(/</g, '\\u003c')};
document.addEventListener('DOMContentLoaded', function () { try { if (window.OpenVibeFooter) OpenVibeFooter.init(window.__OV_PAGE.footer); } catch (e) { /* the Frame is optional */ } });</script>`,
    });
}

/**
 * Send a page; a page rendered for a signed-in person is private and never cached. A public page gets the short
 * public window the whole network uses for HTML.
 */
function send(res, status, html, { viewer, cacheControl } = {}) {
    const personal = viewer && viewer.kind === 'user';
    res.set('Cache-Control', cacheControl || (personal ? 'private, no-store' : 'public, max-age=120'));
    res.set('Vary', 'Cookie');
    res.status(status).type('html').send(html);
}

module.exports = { layout, send, setRelease, configure, baseUrl, canonical, NAME, NETWORK, ROOM, NAV, esc, asset, assetVersion };
