'use strict';
/**
 * The Design room's pages (plan 2026-10-28 §5.2, v1: the theme studio and rollback). Server-rendered and whole without
 * JavaScript (the gallery and each theme's page are plain links); public/js/studio.js makes the studio live: the
 * previews recolour as you pick or edit, the checks run, and Use, Submit and History talk to /api (server/http/api.js,
 * which proxies Network's theme API as the signed-in person).
 *
 *   home({ themes })          the front door: the room's hero, a strip of themes, what the studio does
 *   studio({ themes, me })    me: { signedIn, user }
 *   theme({ theme })          one theme: its colours, a preview, and "Open in the studio"
 *   developers()              the API
 *   notFound()
 */
const layoutLib = require('../render/layout');
const kit = require('openvibe-shared/kit');
const sc = require('openvibe-shared/showcase');
const rooms = require('openvibe-shared/rooms');

const { layout, esc, NAME } = layoutLib;
const ROOM = rooms.get('design');
const listOf = (themes) => (Array.isArray(themes) ? themes : (themes && Array.isArray(themes.themes) ? themes.themes : []));
const HEX = /^#[0-9a-f]{3,8}$/i;
const col = (v, k, d) => (v && HEX.test(String(v[k] || '')) ? v[k] : d);
const SWATCH = ['--bg-primary', '--bg-card', '--accent', '--text-primary'];
const CORE = [
    ['--bg-primary', 'Background'], ['--bg-card', 'Surface'], ['--text-primary', 'Text'],
    ['--text-muted', 'Muted text'], ['--accent', 'Accent'], ['--border', 'Lines'],
];

/** The variables a preview frame carries inline (only allow-listed token names with colour values). */
function varsStyle(v) {
    return Object.entries(v || {}).filter(([k, x]) => /^--[a-z][a-z0-9-]{1,40}$/.test(k) && /^(#[0-9a-f]{3,8}|rgba?\([0-9., ]+\)|[0-9., ]+)$/i.test(String(x))).map(([k, x]) => `${k}:${x}`).join(';');
}

/** A theme as a swatch button (the studio) or link (the home and gallery without JavaScript). */
function swatch(t, { tag = 'a' } = {}) {
    const v = t.variables || {};
    const dots = SWATCH.map((k) => `<i style="background:${esc(col(v, k, '#888'))}"></i>`).join('');
    const inner = `<span class="ds-dots" aria-hidden="true">${dots}</span><span class="ds-swatch-name">${esc(t.name)}</span><span class="ds-swatch-mode">${t.mode === 'light' ? 'Light' : 'Dark'}</span>`;
    if (tag === 'button') return `<button type="button" class="ds-swatch" data-theme-id="${esc(t.id)}" data-mode="${t.mode === 'light' ? 'light' : 'dark'}" aria-pressed="false">${inner}</button>`;
    return `<a class="ds-swatch" href="/t/${encodeURIComponent(t.slug || t.id)}">${inner}</a>`;
}

/** The three surfaces every theme is tried on: a Live channel, a Chat room and a shop's grid (open.shoes, Deals). */
function previews() {
    const msg = (who, hue, text) => `<li><span class="pv-av" style="--h:${hue}">${esc(who.slice(0, 1))}</span><span><b>${esc(who)}</b> ${esc(text)}</span></li>`;
    const shoe = (name, price, was, best) => `<li class="pv-shoe"><span class="pv-shoe-pic" aria-hidden="true">${kit.icon('shoe')}</span><b>${esc(name)}</b><span class="pv-price">${esc(price)}${was ? ` <s>${esc(was)}</s>` : ''}</span>${best ? '<em class="pv-chip">Best price</em>' : ''}</li>`;
    return `<div class="pv-frame pv-live" aria-label="Preview: a Live channel"><p class="pv-label">OpenVibe.Live</p>
<div class="pv-video"><span class="pv-badge">LIVE</span><span class="pv-viewers">1.2k watching</span></div>
<div class="pv-row"><span class="pv-av pv-av-lg" style="--h:30">G</span><span class="pv-col"><b>Seattle at night, chat picks the route</b><small>goosely · IRL</small></span><button type="button" class="pv-btn" tabindex="-1">Follow</button></div>
<ul class="pv-chat">${msg('maru', 200, 'left at the light!')}${msg('kiwi', 120, 'the view from here 😮')}${msg('teddy', 320, 'clip that')}</ul></div>
<div class="pv-frame pv-chatroom" aria-label="Preview: a Chat room"><p class="pv-label">OpenVibe.Chat</p>
<p class="pv-room"># night-owls <span class="pv-muted">· 38 here</span></p>
<ul class="pv-chat pv-chat-lg">${msg('ana', 10, 'anyone up for the surf race?')}${msg('jules', 260, 'in five, warming up on utopia')}<li class="pv-me"><span>count me in</span></li></ul>
<div class="pv-composer"><span>Message #night-owls</span><button type="button" class="pv-send" tabindex="-1" aria-hidden="true">${kit.icon('send')}</button></div></div>
<div class="pv-frame pv-shop" aria-label="Preview: a shop's grid"><p class="pv-label">open.shoes</p>
<p class="pv-chips"><span class="is-on">Running</span><span>Trail</span><span>Size 10</span></p>
<ul class="pv-grid">${shoe('Cloudrunner 2', '$119', '$150', true)}${shoe('Trail Pro', '$139')}${shoe('Daily 3', '$89', '$110')}${shoe('Racer X', '$179')}</ul></div>`;
}

const CVD = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
<filter id="ds-cvd-protan"><feColorMatrix type="matrix" values="0.152 1.053 -0.205 0 0 0.115 0.786 0.099 0 0 -0.004 -0.048 1.052 0 0 0 0 0 1 0"/></filter>
<filter id="ds-cvd-deutan"><feColorMatrix type="matrix" values="0.367 0.861 -0.228 0 0 0.280 0.673 0.047 0 0 -0.012 0.043 0.969 0 0 0 0 0 1 0"/></filter>
<filter id="ds-cvd-tritan"><feColorMatrix type="matrix" values="1.256 -0.077 -0.179 0 0 -0.078 0.931 0.148 0 0 0.005 0.691 0.304 0 0 0 0 0 1 0"/></filter></defs></svg>`;

function home({ themes } = {}) {
    const all = listOf(themes);
    const picks = ['vibe', 'violet-hour', 'forest', 'neon-tokyo', 'sunset', 'cloud', 'daylight', 'meadow'].map((id) => all.find((t) => t.id === id)).filter(Boolean);
    const shown = picks.concat(all.filter((t) => !picks.includes(t))).slice(0, 8);
    const strip = shown.map((t) => `<li>${swatch(t)}</li>`).join('');
    const orb = `<div class="ds-orb" aria-hidden="true"><span class="ds-orb-ring"></span><span class="ds-orb-core"></span>${(picks.length ? picks : all).slice(0, 6).map((t, i) => `<i style="--i:${i};background:${esc(col(t.variables, '--accent', '#888'))}"></i>`).join('')}</div>`;
    const body = sc.room({
        room: 'design',
        hero: {
            title: ROOM.line,
            lede: 'Pick a theme and watch Live, Chat and a shop wear it side by side. Change a colour, see every contrast check pass or fail, and use it on every OpenVibe site at once. Any earlier look is one tap back.',
            start: { href: '/studio', label: 'Open the studio' },
            chips: picks.slice(0, 5).map((t) => ({ label: t.name, href: `/studio?theme=${encodeURIComponent(t.id)}` })),
            motif: orb,
        },
        proof: [{ value: all.length, label: all.length === 1 ? 'theme to try' : 'themes to try' }, { value: all.filter((t) => t.mode === 'light').length, label: 'with a light side' }].filter((p) => p.value),
        html: strip ? `<section aria-labelledby="ds-strip-h"><div class="ds-head-row"><h2 id="ds-strip-h">Themes to try</h2><a class="ds-more" href="/studio">All of them in the studio${kit.icon('chevron')}</a></div><ul class="ds-strip">${strip}</ul></section>` : '',
        scenes: [
            { title: 'One theme, three sites, side by side', text: 'Every theme is tried on a Live channel, a Chat room and a shop\'s grid at once, so you see the buttons, the chat and the prices before you choose.', html: `<div class="ds-scene-pv">${previews()}</div>`, action: { href: '/studio', label: 'Try one' } },
            { title: 'Checks that must pass', text: 'Text on every surface, buttons, links and muted text are measured against WCAG as you edit, and the previews can be seen as people with colour-vision differences see them.', html: `<ul class="ds-checks is-demo"><li class="is-pass"><b>Text on background</b><span>14.2:1</span></li><li class="is-pass"><b>Button text</b><span>7.1:1</span></li><li class="is-fail"><b>Muted text on surface</b><span>3.1:1 · needs 4.5</span></li></ul>`, action: { href: '/studio', label: 'Edit a theme' } },
        ],
        explore: { title: 'More on Design', items: [
            { title: 'The studio', text: 'Pick, edit, check and use a theme', href: '/studio', icon: 'ov:theme' },
            { title: 'Your themes on Network', text: 'Display, motion and text size', href: 'https://openvibe.network/my', icon: 'ov:account' },
            { title: 'The API', text: 'The theme catalog as open JSON', href: '/developers', icon: 'ov:code' },
        ] },
        faq: { items: [
            ['Where does my theme apply?', 'Everywhere you are signed in to OpenVibe: the theme lives on your account, and every site picks it up on its next page.'],
            ['Can I undo a change?', 'Yes. Every change keeps the look it replaced; the studio\'s history brings any of the last fifty back.'],
            ['Can others use my theme?', 'Submit it to the gallery. A person reviews each submission before anyone else sees it.'],
        ] },
    });
    return layout({ title: null, path: '/', body: `<div class="ds-wrap">${body}</div>`, active: '/' });
}

function studio({ themes, me = {} } = {}) {
    const all = listOf(themes).filter((t) => t && t.id);
    const signedIn = !!me.signedIn;
    const gallery = all.map((t) => `<li>${swatch(t, { tag: 'button' })}</li>`).join('');
    const data = JSON.stringify(all.map((t) => ({ id: t.id, name: t.name, mode: t.mode, variables: t.variables || {} }))).replace(/</g, '\\u003c');
    const body = `${CVD}<div class="ds-studio" data-signed-in="${signedIn ? '1' : '0'}">
<header class="ds-studio-h"><div><p class="ds-kicker">Theme studio</p><h1>Make it yours</h1>
<p class="ds-lede">Pick a theme, change any colour, and see it on three sites at once. Every check must pass before it can be used.</p></div>
${signedIn ? `<p class="ds-sign ds-fine">Signed in as <b>${esc((me.user && (me.user.display_name || me.user.username)) || 'you')}</b>: Use changes your look on every OpenVibe site.</p>` : `<p class="ds-sign">${kit.button({ href: '/auth/login?next=%2Fstudio', label: 'Sign in to use a theme', kind: 'quiet', small: true })}</p>`}</header>
<div class="ds-grid">
<aside class="ds-gallery" aria-labelledby="ds-gal-h"><div class="ds-gal-head"><h2 id="ds-gal-h">Themes</h2>
<div class="ds-seg" role="group" aria-label="Show"><button type="button" data-show="all" aria-pressed="true">All</button><button type="button" data-show="dark" aria-pressed="false">Dark</button><button type="button" data-show="light" aria-pressed="false">Light</button></div></div>
<ul class="ds-gal-list">${gallery || '<li class="ds-fine">The catalog is not answering. Try again in a minute.</li>'}</ul></aside>
<section class="ds-stage" aria-labelledby="ds-stage-h"><div class="ds-stage-head"><h2 id="ds-stage-h"><span id="ds-current">Your current theme</span></h2>
<label class="ds-see">See it as <select id="ds-cvd"><option value="">Typical colour vision</option><option value="protan">Protanopia (red-blind)</option><option value="deutan">Deuteranopia (green-blind)</option><option value="tritan">Tritanopia (blue-blind)</option><option value="gray">Grayscale</option></select></label></div>
<div class="ds-previews" id="ds-previews">${previews()}</div></section>
<aside class="ds-editor" aria-labelledby="ds-ed-h"><h2 id="ds-ed-h">Edit</h2>
<div class="ds-fields">${CORE.map(([k, l]) => `<label class="ds-field"><span>${esc(l)}</span><input type="color" data-var="${k}" aria-label="${esc(l)}"><input type="text" data-hex="${k}" inputmode="text" maxlength="7" spellcheck="false" aria-label="${esc(l)}, hex"></label>`).join('')}</div>
<h3>Checks</h3><ul class="ds-checks" id="ds-checks" aria-live="polite"><li class="ds-fine">Pick a theme to check it.</li></ul>
<div class="ds-actions"><button type="button" class="ovk-btn ovk-btn--primary" id="ds-use" disabled>${signedIn ? 'Use this theme' : 'Sign in to use it'}</button>
<button type="button" class="ovk-btn ovk-btn--quiet" id="ds-reset" disabled>Undo my edits</button></div>
<p class="ds-status" id="ds-status" role="status"></p>
<details class="ds-submit"><summary>Share it in the gallery</summary><form id="ds-submit-form"><label>Name <input type="text" id="ds-name" maxlength="60" minlength="2" required placeholder="Cozy autumn"></label>
<label>One line about it <input type="text" id="ds-desc" maxlength="300" placeholder="Warm browns and a pumpkin accent"></label>
<button type="submit" class="ovk-btn ovk-btn--quiet" ${signedIn ? '' : 'disabled'}>Send for review</button><p class="ds-fine">A person reviews each theme before anyone else sees it.</p></form></details>
${signedIn ? '<details class="ds-history" id="ds-history"><summary>History</summary><ol id="ds-history-list"><li class="ds-fine">Your earlier looks appear here.</li></ol></details>' : ''}
</aside></div></div>
<script type="application/json" id="ds-themes">${data}</script>`;
    return layout({ title: 'Theme studio', description: 'Pick an OpenVibe theme, edit any colour with contrast and colour-vision checks, see it on Live, Chat and a shop at once, and use it everywhere.', path: '/studio', body: `<div class="ds-wrap">${body}</div>`, active: '/studio', scripts: ['js/studio.js'] });
}

function theme({ theme: t } = {}) {
    const v = (t && t.variables) || {};
    const rows = CORE.map(([k, l]) => (HEX.test(String(v[k] || '')) ? `<div><dt>${esc(l)}</dt><dd><i style="background:${esc(v[k])}"></i><code>${esc(v[k])}</code></dd></div>` : '')).join('');
    const body = `<header class="ds-page-h"><p class="ds-kicker">${t.mode === 'light' ? 'Light theme' : 'Dark theme'}</p><h1>${esc(t.name)}</h1>${t.description ? `<p class="ds-lede">${esc(t.description)}</p>` : ''}
<p class="ds-act">${kit.button({ href: `/studio?theme=${encodeURIComponent(t.id)}`, label: 'Open in the studio' })} ${kit.button({ href: `/api/themes/${encodeURIComponent(t.slug || t.id)}`, label: 'As JSON', kind: 'quiet' })}</p></header>
${rows ? `<dl class="ds-colours">${rows}</dl>` : ''}
<section aria-labelledby="ds-pv-h"><h2 id="ds-pv-h">How it looks</h2><div class="ds-previews ds-previews--static" style="${esc(varsStyle(v))}">${previews()}</div></section>`;
    return layout({ title: `${t.name}: an OpenVibe theme`, description: t.description || `${t.name}, a ${t.mode === 'light' ? 'light' : 'dark'} OpenVibe theme: its colours and how Live, Chat and a shop look in it.`, path: `/t/${encodeURIComponent(t.slug || t.id)}`, body: `<div class="ds-wrap">${body}</div>`, active: '/studio' });
}

function developers() {
    const rows = [
        ['GET /api/themes', 'Every public OpenVibe theme with its colours (Network\'s catalog).'],
        ['GET /api/themes/:id', 'One theme.'],
        ['GET /api/me/theme', 'Your active theme (signed in).'],
        ['PUT /api/me/theme', 'Use a theme, with optional custom colours (signed in; from this site only).'],
        ['GET /api/me/theme/history', 'Your earlier looks, newest first; POST /api/me/theme/history/:id/restore brings one back.'],
    ];
    const body = `<header class="ds-page-h"><p class="ds-kicker">For developers</p><h1>The Design API</h1><p class="ds-lede">The theme catalog is open JSON. A theme is a set of CSS custom properties every OpenVibe site reads; Network keeps which one each person uses.</p></header>
<section aria-labelledby="ds-ep-h"><h2 id="ds-ep-h">Endpoints</h2><dl class="ds-eps">${rows.map(([ep, what]) => `<div><dt><code>${esc(ep)}</code></dt><dd>${esc(what)}</dd></div>`).join('')}</dl></section>
<p class="ds-fine">Themes also export and import as <code>openvibe-theme@1</code> files through <a href="https://openvibe.network/api/themes">Network's theme API</a>.</p>`;
    return layout({ title: 'The Design API', path: '/developers', body: `<div class="ds-wrap">${body}</div>`, active: '/developers' });
}

function notFound() {
    const body = `<header class="ds-page-h"><h1>Nothing here</h1><p class="ds-lede">That page does not exist. <a href="/studio">Open the studio</a> or <a href="/">browse the themes</a>.</p></header>`;
    return layout({ title: 'Not found', robots: 'noindex, follow', body: `<div class="ds-wrap">${body}</div>`, active: '/' });
}

module.exports = {
    home, studio, theme, developers, notFound,
    layout,
    setRelease: layoutLib.setRelease,
    configure: layoutLib.configure,
};
