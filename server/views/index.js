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
const { iframeHtml } = require('../arena/sanitize');

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

// The sites a theme can be tried on for real (openvibe-shared 4.41.0's ?ov-try=: painted on that site for the tab, nothing
// saved until Use it there).
const TRY_SITES = [['Live', 'https://openvibe.live/'], ['Chat', 'https://openvibe.chat/'], ['Games', 'https://openvibe.games/'], ['Community', 'https://openvibe.community/'], ['Network', 'https://openvibe.network/']];
/** "Try it on" links for a catalog theme (id: its slug); data-try lets the studio point them at the picked theme. */
function tryOn(id) {
    const q = id ? `?ov-try=${encodeURIComponent(id)}` : '';
    return `<p class="ds-try"><span>Try it on the real sites, nothing saved:</span>${TRY_SITES.map(([name, url]) => `<a href="${esc(url + q)}" data-try="${esc(url)}" rel="noopener">${esc(name)}</a>`).join('')}</p>`;
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

/**
 * The front door (the overhaul, 2026-10-29: "Your look, everywhere"). Three things Design is for, in the order people
 * meet them: wear a theme across every OpenVibe site (the studio), take it into your own app as code (OpenVibe Tokens:
 * the web, Android, iOS), and make pages with AI on it (Create, ranked honestly by the Arena).
 */
function home({ themes } = {}) {
    const all = listOf(themes);
    const picks = ['vibe', 'violet-hour', 'forest', 'neon-tokyo', 'sunset', 'cloud', 'daylight', 'meadow'].map((id) => all.find((t) => t.id === id)).filter(Boolean);
    const shown = picks.concat(all.filter((t) => !picks.includes(t))).slice(0, 8);
    const strip = shown.map((t) => `<li>${swatch(t)}</li>`).join('');
    const orb = `<div class="ds-orb" aria-hidden="true"><span class="ds-orb-ring"></span><span class="ds-orb-core"></span>${(picks.length ? picks : all).slice(0, 6).map((t, i) => `<i style="--i:${i};background:${esc(col(t.variables, '--accent', '#888'))}"></i>`).join('')}</div>`;
    const make = `<ol class="ds-flow" aria-label="How Create works"><li><b>Describe it</b><span>A page, an app screen or a component, in a sentence.</span></li><li><b>Three models draft it</b><span>At once, on your theme, at phone and desktop sizes.</span></li><li><b>Make it yours</b><span>Pick one, click any part to change it or ask for a change, and keep every version.</span></li></ol>`;
    const draft = (side) => `<figure class="ds-vs-card"><span class="ds-vs-bar"></span><span class="ds-vs-hero"></span><span class="ds-vs-row"><i></i><i></i><i></i></span><figcaption>${side}</figcaption></figure>`;
    const vs = `<div class="ds-vs" role="img" aria-label="Two drafts side by side, their models hidden">${draft('Left')}<span class="ds-vs-or">or</span>${draft('Right')}</div><p class="ds-fine ds-vs-note">The models' names stay hidden until you vote.</p>`;
    const body = sc.room({
        room: 'design',
        hero: {
            title: 'Your look, everywhere',
            lede: 'Pick or make a theme once and every OpenVibe site wears it. Take it into your own app as code for the web, Android and iOS, and design pages on it with AI.',
            start: { href: '/studio', label: 'Change your theme' },
            chips: picks.slice(0, 5).map((t) => ({ label: t.name, href: `/studio?theme=${encodeURIComponent(t.id)}` })),
            motif: orb,
        },
        proof: [
            { value: all.length, label: all.length === 1 ? 'theme to wear' : 'themes to wear' },
            { value: all.filter((t) => t.mode === 'light').length, label: 'with a light side' },
            { value: 7, label: 'platforms to export to' },
        ].filter((p) => p.value),
        scenes: [
            { title: 'One theme, every site', text: 'Try a theme on a Live channel, a Chat room and a shop side by side. Every contrast check must pass, and colour-blind previews show it as everyone sees it. Use it, and the whole network wears it from its next page; any earlier look is one tap back.', html: `<div class="ds-scene-pv">${previews()}</div>`, action: { href: '/studio', label: 'Open the studio' } },
            { title: 'Make it with AI, on your theme', text: 'Describe what you need and three AI designers draft it at once. Every draft wears your theme, so it already looks like it belongs.', html: make, action: { href: '/create', label: 'Make something' } },
            { title: 'See which AI designs best', text: 'The Arena sends one prompt to three models, shows two drafts without their names, and ranks the designers by the votes, with what each draft cost and how long it took. Every prompt, page and vote is open data.', html: vs, action: { href: '/arena', label: 'Vote in the Arena' } },
        ],
        dev: {
            title: 'Your theme, in your app',
            lede: 'Every theme is a set of W3C design tokens. The same values reach the web as CSS variables, Android as a Compose colour scheme and iOS as SwiftUI colours, so a native app wears your theme without being a web page in a frame.',
            samples: [
                { label: 'Android', code: 'MaterialTheme(\n    colorScheme = if (isSystemInDarkTheme()) VibeDarkColorScheme\n                  else VibeLightColorScheme,\n) { App() }' },
                { label: 'iOS', code: 'Text("Live now")\n    .foregroundStyle(VibeDarkTokens.colorTextPrimary)\n    .padding(OvScale.spaceLg)\n    .background(VibeDarkTokens.colorBgRaised,\n                in: .rect(cornerRadius: OvScale.radiusMd))' },
                { label: 'Web', code: 'curl "https://openvibe.design/api/v1/tokens/vibe?format=css" > vibe.css\n\n.card { background: var(--ov-color-bg-raised);\n        border-radius: var(--ov-radius-md); }' },
            ],
            links: [{ label: 'Every platform', href: '/tokens' }, { label: 'The API', href: '/developers' }],
        },
        explore: { title: 'More on Design', items: [
            { title: 'Tokens', text: 'Any theme as CSS, Compose, SwiftUI, Flutter or Figma', href: '/tokens', icon: 'ov:code' },
            { title: 'Create', text: 'Three AI drafts on your theme', href: '/create', icon: 'ov:ai' },
            { title: 'Your look', text: 'Light or dark, text size, motion and seasons, for every site', href: '/look', icon: 'ov:account' },
        ] },
        html: strip ? `<section aria-labelledby="ds-strip-h"><div class="ds-head-row"><h2 id="ds-strip-h">Themes to wear</h2><a class="ds-more" href="/studio">All ${all.length} in the studio${kit.icon('chevron')}</a></div><ul class="ds-strip">${strip}</ul></section>` : '',
        faq: { items: [
            ['Where does my theme apply?', 'Everywhere you are signed in to OpenVibe: the theme lives on your account, and every site picks it up on its next page.'],
            ['Can I use it in my own app?', 'Yes. Tokens gives any theme as CSS variables, a Tailwind config, a Jetpack Compose colour scheme, SwiftUI colours, a Flutter colour scheme, Figma variables or W3C design-token JSON, with its light and dark halves together. The API is open.'],
            ['Can I undo a change?', 'Yes. Every change keeps the look it replaced; the studio\'s history brings any of the last fifty back.'],
            ['Can others use my theme?', 'Submit it to the gallery. A person reviews each submission before anyone else sees it.'],
            ['What is coming next?', 'Publishing a design straight to OpenVibe.Website and OpenVibe.Space, brand kits that dress a creator\'s channel, overlays and shop in one go, and the kit\'s components as native Android and iOS views.'],
        ] },
    });
    return layout({ title: null, description: 'Your look, everywhere: one theme across every OpenVibe site, the same theme as code for the web, Android and iOS, and AI design on it, ranked honestly by the Design Arena.', path: '/', body: `<div class="ds-wrap">${body}</div>`, active: '/' });
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
<button type="button" class="ovk-btn ovk-btn--quiet" id="ds-reset" disabled>Undo my edits</button>
<a class="ovk-btn ovk-btn--quiet" id="ds-code" href="/tokens" title="This theme for the web, Android, iOS, Flutter and Figma">As code</a></div>
<div id="ds-try" hidden>${tryOn('')}</div>
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
<p class="ds-act">${kit.button({ href: `/studio?theme=${encodeURIComponent(t.id)}`, label: 'Open in the studio' })} ${kit.button({ href: `/tokens?theme=${encodeURIComponent(t.slug || t.id)}`, label: 'As code', kind: 'quiet' })}</p>${tryOn(t.slug || t.id)}</header>
${rows ? `<dl class="ds-colours">${rows}</dl>` : ''}
<section aria-labelledby="ds-pv-h"><h2 id="ds-pv-h">How it looks</h2><div class="ds-previews ds-previews--static" style="${esc(varsStyle(v))}">${previews()}</div></section>`;
    return layout({ title: `${t.name}: an OpenVibe theme`, description: t.description || `${t.name}, a ${t.mode === 'light' ? 'light' : 'dark'} OpenVibe theme: its colours and how Live, Chat and a shop look in it.`, path: `/t/${encodeURIComponent(t.slug || t.id)}`, body: `<div class="ds-wrap">${body}</div>`, active: '/studio' });
}

function developers() {
    const rows = [
        ['POST /api/v1/designs', 'Create three model variants with {prompt, kind, themeId?}; guests receive a secret edit link.'],
        ['GET /api/v1/designs/:id', 'Poll generation status, read each frame, the pick and the version list; guests send X-Design-Key.'],
        ['POST /api/v1/designs/:id/theme', 'Change the token theme with {themeId}.'],
        ['POST /api/v1/designs/:id/pick', 'Choose the working frame with {variantIndex}; the pick is recorded as one Arena vote.'],
        ['POST /api/v1/designs/:id/edit', 'Chat edit the working frame with {instruction}; one paid AI run and a small per-design budget.'],
        ['POST /api/v1/designs/:id/click', 'Apply {path, text?, color?, spacing?, align?} to one element; validated paths and theme tokens only.'],
        ['GET /api/v1/designs/:id/versions', 'Every saved version with its model/provider provenance; POST /undo and /redo move the pointer.'],
        ['GET /api/v1/tokens/:theme?format=', 'A theme as code (OpenVibe Tokens): css, tailwind, compose (Android), swiftui (iOS), flutter, figma or json (W3C DTCG). Its other half comes along unless both=0; download=1 names a file.'],
        ['GET /api/v1/tokens', 'The export targets.'],
        ['GET /api/v1/components', 'The components\' contract: anatomy and tokens, props, states, a11y, layout, and Compose and SwiftUI reference views.'],
        ['POST /api/v1/components/validate', 'Check a kit document ({ doc }): known components and props, typed values, children, size, links. Answers { ok, errors }.'],
        ['GET /api/themes', 'Every public OpenVibe theme with its colours (Network\'s catalog).'],
        ['GET /api/themes/:id', 'One theme.'],
        ['GET /api/me/theme', 'Your active theme (signed in).'],
        ['PUT /api/me/theme', 'Use a theme, with optional custom colours (signed in; from this site only).'],
        ['GET /api/me/theme/history', 'Your earlier looks, newest first; POST /api/me/theme/history/:id/restore brings one back.'],
    ];
    const body = `<header class="ds-page-h"><p class="ds-kicker">For developers</p><h1>The Design API</h1><p class="ds-lede">The theme catalog is open JSON. A theme is a set of CSS custom properties every OpenVibe site reads; Network keeps which one each person uses.</p></header>
<section aria-labelledby="ds-ep-h" id="tokens"><h2 id="ds-ep-h">Endpoints</h2><dl class="ds-eps">${rows.map(([ep, what]) => `<div><dt><code>${esc(ep)}</code></dt><dd>${esc(what)}</dd></div>`).join('')}</dl></section>
<p class="ds-fine">Themes also export and import as <code>openvibe-theme@1</code> files through <a href="https://openvibe.network/api/themes">Network's theme API</a>.</p>`;
    return layout({ title: 'The Design API', path: '/developers', body: `<div class="ds-wrap">${body}</div>`, active: '/developers' });
}

const ARENA_CATEGORY = {
    landing: 'Landing page',
    dashboard: 'Dashboard',
    mobile_app: 'Mobile app',
    game_ui: 'Game UI',
    logo: 'Logo',
    slides: 'Slides',
    'design.page': 'Design page arena',
    'design.component': 'Design component arena',
};

const arenaCost = (v) => `$${Number(v || 0).toFixed(4)}`;
const arenaMs = (v) => (Number(v || 0) >= 1000 ? `${(Number(v) / 1000).toFixed(1)} s` : `${Math.round(Number(v) || 0)} ms`);
const arenaPct = (v) => `${(Number(v || 0) * 100).toFixed(1)}%`;

/** One output at one viewport width, inside the sandboxed, CSP-capped iframe. */
function arenaShot(o, width) {
    const phone = Number(width) === 390;
    return `<div class="ar-shot ${phone ? 'ar-shot--phone' : 'ar-shot--desktop'}" data-width="${phone ? 390 : 1280}">
<div class="ar-shot-frame">${iframeHtml({
        html: o.html || '',
        width: phone ? 390 : 1280,
        height: phone ? 844 : 800,
        title: `${o.model ? `${o.model} ` : ''}at ${phone ? 390 : 1280} pixels`,
        id: `ar-frame-${String(o.id || 'x').replace(/[^a-z0-9_-]/gi, '')}-${phone ? 390 : 1280}`,
        className: phone ? 'ar-frame--phone' : 'ar-frame--desktop',
    })}</div>
<p class="ar-shot-label">${phone ? 'Phone · 390 px' : 'Desktop · 1280 px'}</p></div>`;
}

// Which viewport the pair (or the round's outputs) shows. The radios belong to no form, so a vote never sends them.
function arenaViewSwitch() {
    return `<div class="ar-view" role="radiogroup" aria-label="Viewport">
<input type="radio" id="ar-view-desktop" name="ar_view" value="desktop" form="ar-view-none" checked><label for="ar-view-desktop">Desktop</label>
<input type="radio" id="ar-view-phone" name="ar_view" value="phone" form="ar-view-none"><label for="ar-view-phone">Phone</label></div>`;
}

function arenaLeaderboard(category, rows, { type = 'elo' } = {}) {
    if (type === 'cost') {
        const body = rows.length ? rows.map((r, i) => `<tr class="ar-lb-row" data-model="${esc(r.model)}">
<td class="ar-lb-rank">${i + 1}</td>
<td class="ar-lb-model">${esc(r.model)}</td>
<td class="ar-lb-entries">${r.entries}</td>
<td class="ar-lb-usable">${r.usable}</td>
<td class="ar-lb-total-cost">${arenaCost(r.total_cost_usd)}</td>
<td class="ar-lb-solved">${r.solved}</td>
<td class="ar-lb-cost-per-solved">${r.cost_per_solved == null ? '—' : arenaCost(r.cost_per_solved)}</td>
<td class="ar-lb-cost">${r.median_cost_usd == null ? '—' : arenaCost(r.median_cost_usd)}</td>
<td class="ar-lb-ms">${r.median_ms == null ? '—' : arenaMs(r.median_ms)}</td></tr>`).join('') : '<tr class="ar-lb-empty"><td colspan="9">No entries yet. Start a round to generate some.</td></tr>';
        return `<section class="ar-lb ar-lb--cost" id="ar-lb-cost-${esc(category)}" aria-labelledby="ar-lb-cost-h-${esc(category)}">
<div class="ar-lb-head"><h2 id="ar-lb-cost-h-${esc(category)}">${esc(ARENA_CATEGORY[category] || category)} · Cost</h2></div>
<table class="ar-table"><thead><tr><th scope="col">#</th><th scope="col">Model</th><th scope="col">Entries</th><th scope="col">Usable</th><th scope="col">Total cost</th><th scope="col">Solved</th><th scope="col">Cost per solved</th><th scope="col">Median cost</th><th scope="col">Median time</th></tr></thead>
<tbody>${body}</tbody></table></section>`;
    }
    const body = rows.length ? rows.map((r, i) => `<tr class="ar-lb-row" data-model="${esc(r.model)}">
<td class="ar-lb-rank">${i + 1}</td>
<td class="ar-lb-model">${esc(r.model)}${r.provisional ? ' <span class="ar-provisional" title="Fewer than 10 games">provisional</span>' : ''}</td>
<td class="ar-lb-elo">${Number(r.elo).toFixed(0)}${r.ci_lower != null && r.ci_upper != null ? ` <span class="ar-ci">(${Number(r.ci_lower).toFixed(0)}–${Number(r.ci_upper).toFixed(0)})</span>` : ''}</td>
<td class="ar-lb-games">${r.games}</td>
<td class="ar-lb-winrate">${arenaPct(r.win_rate)}</td>
<td class="ar-lb-cost">${r.median_cost_usd == null ? '—' : arenaCost(r.median_cost_usd)}</td>
<td class="ar-lb-ms">${r.median_ms == null ? '—' : arenaMs(r.median_ms)}</td></tr>`).join('') : '<tr class="ar-lb-empty"><td colspan="7">No votes yet. Be the first to judge this category.</td></tr>';
    return `<section class="ar-lb" id="ar-lb-${esc(category)}" aria-labelledby="ar-lb-h-${esc(category)}">
<div class="ar-lb-head"><h2 id="ar-lb-h-${esc(category)}">${esc(ARENA_CATEGORY[category] || category)}</h2><a class="ar-more" href="/arena/vote${category === 'logo' ? '?category=logo' : ''}">Vote on this category</a></div>
<table class="ar-table"><thead><tr><th scope="col">#</th><th scope="col">Model</th><th scope="col">Elo</th><th scope="col">Games</th><th scope="col">Win rate</th><th scope="col">Median cost</th><th scope="col">Median time</th></tr></thead>
<tbody>${body}</tbody></table></section>`;
}

function arenaHome({ categories = [], costCategories = [], me = {}, limits = null } = {}) {
    const signedIn = Boolean(me.signedIn);
    const boards = categories.map((c) => arenaLeaderboard(c.category, c.leaderboard || [])).join('');
    const costBoards = costCategories.map((c) => arenaLeaderboard(c.category, c.leaderboard || [], { type: 'cost' })).join('');
    const rows = categories.flatMap((c) => c.leaderboard || []);
    const body = `<div class="ar-page" id="ar-home">
<header class="ar-hero"><p class="ar-kicker">Design Arena</p><h1>Which model designs it best?</h1>
<p class="ar-lede">One prompt goes to three models. They each build the same page; you see two at phone and desktop sizes, vote blind, and an Elo leaderboard per category ranks the designers, with the cost and time of every generation.</p>
<div class="ar-actions"><a class="ovk-btn ovk-btn--primary" href="/arena/new">Start a round</a> <a class="ovk-btn ovk-btn--quiet" href="/arena/vote">Vote blind</a></div>
<p class="ar-fine" id="ar-limits">${signedIn
        ? (limits ? `You have ${limits.remaining} of ${limits.per_day} rounds left today. The Arena has ${limits.site_remaining} of ${limits.site_daily} left.` : 'Signed in: you can start a round or vote.')
        : 'Sign in to start a round or vote. The leaderboard and the dataset are open to everyone.'}</p></header>
<section class="ar-boards" id="ar-leaderboard" aria-labelledby="ar-boards-h"><div class="ar-lb-head"><h2 id="ar-boards-h">The leaderboard</h2><span class="ar-fine">${rows.length} model${rows.length === 1 ? '' : 's'} ranked · K = 32</span></div>
${boards || '<p class="ar-empty">No rounds have been judged yet. Start the first one.</p>'}
<p class="ar-fine">A win rate counts a tie as half a win. <code>both_bad</code> is a game for neither model. The cost and time are the median over the outputs. Ranges are 95% confidence intervals; <span class="ar-provisional">provisional</span> means fewer than 10 games.</p></section>
<section class="ar-boards ar-boards--cost" id="ar-cost" aria-labelledby="ar-cost-h"><div class="ar-lb-head"><h2 id="ar-cost-h">Cost view</h2><span class="ar-fine">Per model across all entries</span></div>
${costBoards || '<p class="ar-empty">No entries yet.</p>'}</section>
<section class="ar-open" id="ar-open"><h2>Everything is open</h2><p class="ar-lede">The prompts, every generated page and every vote are downloadable. No voter is named.</p>
<p><a class="ovk-btn ovk-btn--quiet" href="/api/v1/arena/dataset.jsonl">Download dataset.jsonl</a></p></section>
</div>`;
    return layout({ title: 'The Design Arena', description: 'One prompt, three AI designers, blind votes and an Elo leaderboard per category, with cost and time per generation.', path: '/arena', body: `<div class="ds-wrap">${body}</div>`, active: '/arena', scripts: ['js/arena.js'] });
}

function arenaNew({ me = {}, limits = null, categories = [], notice = null } = {}) {
    const signedIn = Boolean(me.signedIn);
    const options = (categories.length ? categories : Object.keys(ARENA_CATEGORY)).map((c) => `<option value="${esc(c)}">${esc(ARENA_CATEGORY[c] || c)}</option>`).join('');
    const body = `<div class="ar-page" id="ar-new">
<header class="ar-page-h"><p class="ar-kicker">Start a round</p><h1>Describe the page</h1>
<p class="ar-lede">Three models will build it from this prompt. You cannot vote on a round you started, so the vote stays blind.</p></header>
${notice ? `<p class="ar-notice" id="ar-new-notice" role="alert">${esc(notice)}</p>` : ''}
${signedIn ? '' : `<p class="ar-notice" id="ar-signin">${kit.button({ href: '/auth/login?next=%2Farena%2Fnew', label: 'Sign in to start a round' })}</p>`}
<form class="ar-form" id="ar-new-form" method="post" action="/arena/new">
<label>Category <select id="ar-category" name="category" ${signedIn ? '' : 'disabled'}>${options}</select></label>
<label>Prompt <textarea id="ar-prompt" name="prompt" rows="8" maxlength="4000" required ${signedIn ? '' : 'disabled'} placeholder="A landing page for a tiny coffee roastery in Seattle: warm, editorial, one product shot and a subscribe form."></textarea></label>
<div class="ar-actions"><button type="submit" class="ovk-btn ovk-btn--primary" ${signedIn ? '' : 'disabled'}>Start the round</button><a class="ovk-btn ovk-btn--quiet" href="/arena">Back to the Arena</a></div>
<p class="ar-status" id="ar-new-status" role="status"></p>
<p class="ar-fine" id="ar-new-limits">${limits ? `${limits.remaining} of ${limits.per_day} rounds left for you today; ${limits.site_remaining} of ${limits.site_daily} for the whole site.` : 'A signed-in person may start a few rounds a day; the whole site has a daily cap too.'}</p>
</form></div>`;
    return layout({ title: 'Start an Arena round', description: 'Describe a page once; three AI designers build it and the Arena ranks them.', path: '/arena/new', body: `<div class="ds-wrap">${body}</div>`, active: '/arena', scripts: ['js/arena.js'] });
}

function arenaVote({ pair = null, me = {}, result = null, notice = null } = {}) {
    const signedIn = Boolean(me.signedIn);
    let body;
    if (!signedIn) {
        body = `<div class="ar-page" id="ar-vote"><header class="ar-page-h"><p class="ar-kicker">Vote blind</p><h1>Sign in to judge</h1><p class="ar-lede">The two designs are shown without their models. Sign in to record one vote per round; you cannot vote on a round you started.</p></header><p>${kit.button({ href: '/auth/login?next=%2Farena%2Fvote', label: 'Sign in to vote' })}</p></div>`;
    } else if (result) {
        const left = result.revealed.left;
        const right = result.revealed.right;
        body = `<div class="ar-page" id="ar-vote"><header class="ar-page-h"><p class="ar-kicker">Vote recorded</p><h1>The models are revealed</h1><p class="ar-lede">You chose <b>${esc(result.vote.winner === 'both_bad' ? 'both bad' : result.vote.winner)}</b>. The Elo leaderboard has been updated.</p></header>
<div class="ar-reveal" id="ar-reveal"><div class="ar-reveal-side" id="ar-reveal-left"><h2>Left</h2><p><b>${esc(left.model)}</b>${left.provider ? ` · ${esc(left.provider)}` : ''}</p><p class="ar-fine">${arenaCost(left.cost_usd)} · ${arenaMs(left.ms)} · ${left.tokens} tokens</p></div>
<div class="ar-reveal-side" id="ar-reveal-right"><h2>Right</h2><p><b>${esc(right.model)}</b>${right.provider ? ` · ${esc(right.provider)}` : ''}</p><p class="ar-fine">${arenaCost(right.cost_usd)} · ${arenaMs(right.ms)} · ${right.tokens} tokens</p></div></div>
<p class="ar-actions"><a class="ovk-btn ovk-btn--primary" href="/arena/vote">Vote on another</a> <a class="ovk-btn ovk-btn--quiet" href="/arena/r/${encodeURIComponent(result.vote.round)}">See the round</a></p></div>`;
    } else if (!pair) {
        body = `<div class="ar-page" id="ar-vote"><header class="ar-page-h"><p class="ar-kicker">Vote blind</p><h1>Nothing waiting</h1><p class="ar-lede">${esc(notice || 'There is no ready round you have not voted on. Start one, or come back when another is ready.')}</p></header><p class="ar-actions"><a class="ovk-btn ovk-btn--primary" href="/arena/new">Start a round</a> <a class="ovk-btn ovk-btn--quiet" href="/arena">The leaderboard</a></p></div>`;
    } else {
        body = `<div class="ar-page" id="ar-vote"><header class="ar-page-h"><p class="ar-kicker">Vote blind · ${esc(ARENA_CATEGORY[pair.round.category] || pair.round.category)}</p><h1>Which design is better?</h1><p class="ar-lede">${esc(pair.round.prompt)}</p><p class="ar-fine">The models are hidden until you vote. Compare at phone and desktop sizes.</p></header>
<form id="ar-vote-form" class="ar-vote" method="post" action="/arena/vote">
<input type="hidden" id="ar-vote-round" name="round_id" value="${esc(pair.round.id)}">
<input type="hidden" id="ar-vote-left-id" name="left_output" value="${esc(pair.left.id)}">
<input type="hidden" id="ar-vote-right-id" name="right_output" value="${esc(pair.right.id)}">
${arenaViewSwitch()}
<div class="ar-vote-pair" id="ar-vote-pair">
<section class="ar-vote-side" id="ar-vote-left" data-side="left"><h2>Left</h2>${arenaShot(pair.left, 390)}${arenaShot(pair.left, 1280)}</section>
<section class="ar-vote-side" id="ar-vote-right" data-side="right"><h2>Right</h2>${arenaShot(pair.right, 390)}${arenaShot(pair.right, 1280)}</section></div>
<div class="ar-vote-actions" id="ar-vote-actions"><button type="submit" class="ovk-btn ovk-btn--primary ar-vote-btn" name="winner" value="left" data-winner="left">Left is better</button>
<button type="submit" class="ovk-btn ovk-btn--primary ar-vote-btn" name="winner" value="right" data-winner="right">Right is better</button>
<button type="submit" class="ovk-btn ovk-btn--quiet ar-vote-btn" name="winner" value="tie" data-winner="tie">It is a tie</button>
<button type="submit" class="ovk-btn ovk-btn--quiet ar-vote-btn" name="winner" value="both_bad" data-winner="both_bad">Both are bad</button></div>
<p class="ar-status" id="ar-vote-status" role="status"></p></form></div>`;
    }
    return layout({ title: 'Vote blind · The Design Arena', description: 'Two generated designs, no model names: vote for the better one.', path: '/arena/vote', body: `<div class="ds-wrap">${body}</div>`, active: '/arena', scripts: ['js/arena.js'] });
}

function arenaRound({ round, me = {} } = {}) {
    const outputs = round.outputs || [];
    const ok = outputs.filter((o) => !o.error);
    const totalCost = ok.reduce((a, o) => a + Number(o.cost_usd || 0), 0);
    const totalMs = ok.reduce((a, o) => a + Number(o.ms || 0), 0);
    const cards = outputs.map((o, i) => `<li class="ar-output" id="ar-output-${esc(o.id)}" data-model="${esc(o.model)}">
<div class="ar-output-h"><h2>${esc(o.model)}</h2><p class="ar-fine">${esc(o.provider || 'unknown provider')} · ${arenaCost(o.cost_usd)} · ${arenaMs(o.ms)} · ${o.tokens} tokens</p></div>
${o.error ? `<p class="ar-output-error" role="status">This model did not finish: ${esc(o.error)}</p>` : `<div class="ar-output-shots">${arenaShot(o, 390)}${arenaShot(o, 1280)}</div>`}</li>`).join('');
    const body = `<div class="ar-page" id="ar-round" data-round="${esc(round.id)}">
<header class="ar-page-h"><p class="ar-kicker">${esc(ARENA_CATEGORY[round.category] || round.category)} · Arena round</p><h1>${esc(String(round.prompt).slice(0, 240))}</h1>
<p class="ar-meta" id="ar-round-meta">Status: <b>${esc(round.status)}</b> · ${outputs.length} model${outputs.length === 1 ? '' : 's'} · ${arenaCost(totalCost)} · ${arenaMs(totalMs)} in generation · ${round.votes || 0} vote${Number(round.votes) === 1 ? '' : 's'}</p>
<p class="ar-actions"><a class="ovk-btn ovk-btn--primary" href="/arena/vote">Vote blind</a> <a class="ovk-btn ovk-btn--quiet" href="/arena">The leaderboard</a> <a class="ovk-btn ovk-btn--quiet" href="/api/v1/arena/rounds/${encodeURIComponent(round.id)}">This round as JSON</a></p></header>
${round.status === 'queued' || round.status === 'generating' ? '<p class="ar-notice" id="ar-round-wait">The models are working. This page refreshes itself.</p>' : ''}
${round.pool_fallback ? '<p class="ar-notice" id="ar-round-pool">Fewer than three distinct offers were available for this round, so the rest came from the routing pool.</p>' : ''}
${outputs.some((o) => !o.error) ? arenaViewSwitch() : ''}
<ul class="ar-outputs" id="ar-outputs">${cards || '<li class="ar-empty">No output yet.</li>'}</ul></div>`;
    return layout({ title: `${ARENA_CATEGORY[round.category] || round.category}: an Arena round`, description: `Three AI designs for: ${round.prompt.slice(0, 140)}`, path: `/arena/r/${encodeURIComponent(round.id)}`, body: `<div class="ds-wrap">${body}</div>`, active: '/arena', scripts: ['js/arena.js'], robots: 'noindex, follow' });
}

function notFound() {
    const body = `<header class="ds-page-h"><h1>Nothing here</h1><p class="ds-lede">That page does not exist. <a href="/studio">Open the studio</a> or <a href="/">browse the themes</a>.</p></header>`;
    return layout({ title: 'Not found', robots: 'noindex, follow', body: `<div class="ds-wrap">${body}</div>`, active: '/' });
}

module.exports = {
    home, studio, theme, developers, notFound,
    arenaHome, arenaNew, arenaVote, arenaRound, ARENA_CATEGORY, arenaShot,
    layout,
    setRelease: layoutLib.setRelease,
    configure: layoutLib.configure,
};
