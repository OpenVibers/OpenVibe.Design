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
const seo = require('openvibe-shared/seo');
const rooms = require('openvibe-shared/rooms');
const { asset, assetVersion } = require('../assets');
const { DOORS, breadcrumbOf, doorHrefOf } = require('../site/doors');

const NAME = 'OpenVibe.Design';
const NETWORK = 'https://openvibe.network';
const ROOM = rooms.get('design');
const esc = kit.esc;

// Four doors, in this order, are the site's whole bar (the owner, 2026-11-10). The brand is the way home.
const NAV = DOORS.map((door) => ({ label: door.name, href: door.href, icon: { eye: 'eye', spark: 'wand', scale: 'scale', terminal: 'terminal' }[door.icon] }));

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
    // The bar marks the door a page sits under, not the page itself (there are four places now).
    const barActive = doorHrefOf(pathNow) || active;
    // Where this page sits, above its own h1. A page that already carries its own local breadcrumb keeps it.
    const found = breadcrumbOf(pathNow);
    const crumb = found && !/aria-label="Breadcrumb"/.test(String(body || '')) ? found : null;
    if (crumb) {
        const html = `<nav class="ds-crumbs" aria-label="Breadcrumb"><a href="${esc(crumb.door.href)}">${esc(crumb.door.name)}</a><span aria-hidden="true">${kit.icon('chevron')}</span><span aria-current="page">${esc(crumb.name)}</span></nav>`;
        const at = String(body || '').indexOf('<h1');
        body = at === -1 ? `${html}${body || ''}` : `${String(body).slice(0, at)}${html}${String(body).slice(at)}`;
        jsonLd = [...(jsonLd || []), seo.jsonLd.breadcrumbs([
            { name: crumb.door.name, url: `${BASE}${crumb.door.href}` },
            { name: crumb.name, url: `${BASE}${pathNow}` },
        ])];
    }
    const navbar = {
        service: 'design',
        apiBase: NETWORK,
        links: NAV.map((l) => ({ ...l, active: l.href === barActive || (l.href !== '/' && String(barActive).startsWith(`${l.href}/`)) })),
        appBar: NAV.map(({ label, href, icon }) => ({ label, href, icon })),
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
