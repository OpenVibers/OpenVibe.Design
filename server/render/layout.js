'use strict';

/**
 * Page shell for OpenVibe.Design. Every page is server-rendered through openvibe-shared/shell and is complete
 * without JavaScript: the OpenVibe Frame (theme, navbar, footer) comes from the shared shell and the room's accent
 * from openvibe-shared/rooms. The views themselves are plain placeholders for now (server/views/index.js).
 *
 *   - <head>: the shared app icon, the room's stylesheets, this site's content-hashed design.css
 *   - the navbar's session probe (/auth/me), sign-in and sign-out URLs and silent sign-in, as every site's
 *   - the product's own script only where a page offers an in-browser convenience (/studio)
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
    { label: 'Home', href: '/', icon: 'fa-house' },
    { label: 'Create', href: '/create', icon: 'fa-palette' },
    { label: 'Studio', href: '/studio', icon: 'fa-palette' },
    { label: 'Your look', href: '/look', icon: 'fa-circle-half-stroke' },
    { label: 'Arena', href: '/arena', icon: 'fa-crown' },
    { label: 'Tokens', href: '/tokens', icon: 'fa-code' },
    { label: 'The mark', href: '/brand', icon: 'fa-star', more: true },
    { label: 'Motion', href: '/motion', icon: 'fa-wand-magic-sparkles', more: true },
    { label: 'Icons', href: '/icons', icon: 'fa-shapes', more: true },
    { label: 'Patterns', href: '/patterns', icon: 'fa-shapes', more: true },
    { label: 'Components', href: '/components', icon: 'fa-puzzle-piece', more: true },
    { label: 'Developers', href: '/developers', icon: 'fa-code', more: true },
    { label: 'Prompts', href: '/prompts', icon: 'fa-quote-left', more: true },
];

let RELEASE = 'dev';
let BASE = 'https://openvibe.design';
function setRelease(id) { if (id) RELEASE = String(id); }
function configure({ baseUrl } = {}) { if (baseUrl) BASE = String(baseUrl).replace(/\/+$/, ''); }
const baseUrl = () => BASE;
const canonical = (p) => `${BASE}${p || '/'}`;

/** The page around a body: the shared shell with the room's stylesheets and behaviour. */
function layout({ title, description, canonical, path, robots = 'index, follow', body, active = '/', scripts = [], styles = [], jsonLd = [], inlineStyles = [], image, imageAlt } = {}) {
    const pathNow = path || active || '/';
    canonical = canonical || (path ? `${BASE}${path}` : undefined);
    const navbar = {
        service: 'design',
        apiBase: NETWORK,
        links: NAV.map((l) => ({ ...l, active: l.href === active || (l.href !== '/' && String(active).startsWith(`${l.href}/`)) })),
        appBar: [{ label: 'Home', href: '/', icon: 'fa-house' }, { label: 'Studio', href: '/studio', icon: 'fa-palette' }, { label: 'Your look', href: '/look', icon: 'fa-circle-half-stroke' }, { label: 'Arena', href: '/arena', icon: 'fa-crown' }],
        history: { type: 'page', title: title || NAME },
        silentLogin: `${BASE}/auth/login?silent=1&next={url}`,
        sessionUrl: '/auth/me',
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
${(styles || []).map((rel) => `<link rel="stylesheet" href="${esc(asset(rel))}">`).join('\n')}
${(inlineStyles || []).map((css) => `<style>${css}</style>`).join('\n')}
<script src="${esc(ovServe.url('kit-web.js'))}" defer></script>
<script src="${esc(ovServe.url('motion.js'))}" defer></script>
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
