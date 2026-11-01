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
// The short home (the owner's rule, 2026-10-30): pick blocks and folds.
const { pickBlock, pickRules, foldAround } = require('../render/short');
const sc = require('openvibe-shared/showcase');
const rooms = require('openvibe-shared/rooms');
const { iframeHtml } = require('../arena/sanitize');
const glyphs = require('openvibe-shared/glyphs');
const { DESIGN_KINDS, DEFAULT_KIND, kindOf } = require('../arena/kinds');
const ovServe = require('openvibe-shared/serve');
const { TARGETS } = require('openvibe-shared/tokens');

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
    const room = sc.room({
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
            { title: 'One theme, every site', text: 'Try a theme on a Live channel, a Chat room and a shop side by side. Every contrast check must pass, and colour-blind previews show it as everyone sees it. Use it, and the whole network wears it from its next page; any earlier look is one tap back. Comfort settings ride on top of any theme: more contrast, a readable font, colour-blind-safe colours, true black.', html: `<div class="ds-scene-pv">${previews()}</div>`, action: { href: '/studio', label: 'Open the studio' } },
            { title: 'Make it with AI, on your theme', text: 'Describe what you need and three AI designers draft it at once. Every draft wears your theme, so it already looks like it belongs.', html: make, action: { href: '/create', label: 'Make something' } },
            { title: 'See which AI designs best', text: 'The Arena sends one prompt to three models, shows two drafts without their names, and ranks the designers by the votes, with what each draft cost and how long it took. Every prompt, page and vote is open data.', html: vs, action: { href: '/arena', label: 'Vote in the Arena' } },
        ],
        dev: {
            title: 'Your theme, in your app',
            lede: 'Every theme is a set of W3C design tokens. The same values reach the web as CSS variables, Android as a Compose colour scheme and iOS as SwiftUI colours, so a native app wears your theme without being a web page in a frame. The Kotlin and Swift output is compiled on every change, and AI assistants read every theme and component through the Design MCP server.',
            samples: [
                { label: 'Android', code: 'MaterialTheme(\n    colorScheme = if (isSystemInDarkTheme()) VibeDarkColorScheme\n                  else VibeLightColorScheme,\n) { App() }' },
                { label: 'iOS', code: 'Text("Live now")\n    .foregroundStyle(VibeDarkTokens.colorTextPrimary)\n    .padding(OvScale.spaceLg)\n    .background(VibeDarkTokens.colorBgRaised,\n                in: .rect(cornerRadius: OvScale.radiusMd))' },
                { label: 'Web', code: 'curl "https://openvibe.design/api/v1/tokens/vibe?format=css" > vibe.css\n\n.card { background: var(--ov-color-bg-raised);\n        border-radius: var(--ov-radius-md); }' },
            ],
            links: [{ label: 'Every platform', href: '/tokens' }, { label: 'The API', href: '/developers' }, { label: 'MCP for AI assistants', href: '/developers#mcp' }],
        },
        explore: { title: 'More on Design', items: [
            { title: 'Tokens', text: 'Any theme as CSS, Compose, SwiftUI, Flutter or Figma', href: '/tokens', icon: 'ov:code' },
            { title: 'Create', text: 'Three AI drafts on your theme', href: '/create', icon: 'ov:ai' },
            { title: 'Your look', text: 'Light or dark, text size, motion, seasons and comfort settings, for every site', href: '/look', icon: 'ov:account' },
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
    // The short home (the owner's rule, 2026-10-30): the three scenes are one pick block, a row of chips picks one
    // of them, and the parts a reader rarely needs are folds.
    const sceneTitles = ['One theme, every site', 'Make it with AI, on your theme', 'See which AI designs best'];
    const arts = [...room.matchAll(/<article class="sc-scene[\s\S]*?<\/article>/g)];
    let body = room;
    if (arts.length) {
        const first = arts[0];
        const last = arts[arts.length - 1];
        const start = body.lastIndexOf('<section class="sc-room-scenes"', first.index);
        const end = body.indexOf('</section>', last.index + last[0].length) + '</section>'.length;
        const pick = pickBlock({
            key: 'scenes',
            label: 'What you can do',
            head: 'What you can do',
            panes: arts.map((a, i) => ({ id: `ds-scene-${i}`, label: sceneTitles[i] || `Scene ${i + 1}`, html: a[0] })),
        });
        // The section stays: its scenes are the pick block's panes, and a wide screen shows them as they were.
        body = start > 0 && end > 0 ? body.slice(0, start) + body.slice(start, body.indexOf('>', start) + 1) + pick + '</section>' + body.slice(end) : body;
    }
    // The code samples and the questions are the parts a reader rarely needs on a phone.
    body = foldAround(body, '>Your theme, in your app</h2>', 'dev', '<h2 id="ds-dev-h">Your theme, in your app</h2>');
    body = foldAround(body, '>Questions</h2>', 'faq', '<h2 id="ds-faq-h">Questions</h2>');
    return layout({
        title: null, description: 'Your look, everywhere: one theme across every OpenVibe site, the same theme as code for the web, Android and iOS, and AI design on it, ranked honestly by the Design Arena.',
        path: '/', body: `<div class="ds-wrap">${body}</div>`, active: '/',
        // The rule that shows the picked scene of the pick block: one per scene, written for this page.
        inlineStyles: [`@supports selector(:has(*)){@media (max-width:640px){${pickRules('scenes', arts.map((_, i) => `ds-scene-${i}`))}}}`],
    });
}

/** The studio's "As code" sheet: the edited theme compiled in the page (public/js/studio.js). */
function codeSheet() {
    const options = TARGETS.map((t) => `<option value="${esc(t.id)}">${esc(t.label)}</option>`).join('');
    return kit.sheet({ id: 'ds-code-sheet', title: 'Your edits, as code', body: `<label class="ds-code-pick">Platform <select id="ds-code-target">${options}</select></label>
<p class="ds-fine" id="ds-code-note">The theme as you have edited it, light or dark as it is, ready for your own app. Nothing is saved.</p>
${kit.snippet({ code: '', id: 'ds-code-out', label: 'Copy the code' })}
<p class="ds-code-acts"><button type="button" class="ovk-btn ovk-btn--quiet ovk-btn--small" id="ds-code-dl">Download</button> <a class="ds-fine" href="/tokens" id="ds-code-all">Every theme as code</a></p>` });
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
<a class="ovk-btn ovk-btn--quiet" id="ds-code" href="/tokens" data-tokens-src="${esc(ovServe.url('tokens.js'))}" title="This theme, with your edits, for the web, Android, iOS, Flutter and Figma">As code</a></div>
${codeSheet()}
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
        ['POST /api/v1/designs', 'Create three variants with {prompt, kind, themeId?, who?}: Claude Opus 5.5 first by default, or who: "compare" for three providers; guests receive a secret edit link.'],
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
        ['POST /mcp', 'MCP for AI assistants (Streamable HTTP, protocol 2025-06-18, no auth): openvibe_design_list_themes, openvibe_design_get_theme_tokens, openvibe_design_list_components, openvibe_design_get_component and openvibe_design_validate_kit_document, all read-only.'],
        ['GET /api/themes', 'Every public OpenVibe theme with its colours (Network\'s catalog).'],
        ['GET /api/themes/:id', 'One theme.'],
        ['GET /api/me/theme', 'Your active theme (signed in).'],
        ['PUT /api/me/theme', 'Use a theme, with optional custom colours (signed in; from this site only).'],
        ['GET /api/me/theme/history', 'Your earlier looks, newest first; POST /api/me/theme/history/:id/restore brings one back.'],
    ];
    const body = `<header class="ds-page-h"><p class="ds-kicker">For developers</p><h1>The Design API</h1><p class="ds-lede">The theme catalog is open JSON. A theme is a set of CSS custom properties every OpenVibe site reads; Network keeps which one each person uses.</p></header>
<section aria-labelledby="ds-ep-h" id="tokens"><span id="mcp"></span><h2 id="ds-ep-h">Endpoints</h2><dl class="ds-eps">${rows.map(([ep, what]) => `<div><dt><code>${esc(ep)}</code></dt><dd>${esc(what)}</dd></div>`).join('')}</dl></section>
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

/** One output of a pair, drawn by Bench's render origin. The frame runs the model's code with scripts only: no same
 *  origin, no forms, no popups, no navigation of this page, and Bench's own CSP refuses every network request. */
function arenaFrame(src, { width, height, title, className }) {
    return `<iframe class="ar-frame ${className}" src="${esc(src)}" width="${width}" height="${height}" data-width="${width}" title="${esc(title)}" sandbox="allow-scripts" referrerpolicy="no-referrer" allow="" loading="eager"></iframe>`;
}

/** A side of a pair: a page kind at phone and desktop widths, any other kind once, in a 4:3 frame. */
function arenaSide(kind, side, letter) {
    if (kind.viewports) {
        return ['390', '1280'].map((w) => {
            const phone = w === '390';
            return `<div class="ar-shot ${phone ? 'ar-shot--phone' : 'ar-shot--desktop'}" data-width="${w}"><div class="ar-shot-frame">${arenaFrame(side.frame, {
                width: phone ? 390 : 1280, height: phone ? 844 : 800, title: `Design ${letter} at ${w} pixels`, className: phone ? 'ar-frame--phone' : 'ar-frame--desktop',
            })}</div><p class="ar-shot-label">${phone ? 'Phone · 390 px' : 'Desktop · 1280 px'}</p></div>`;
        }).join('');
    }
    return `<div class="ar-art">${arenaFrame(side.frame, { width: 800, height: 600, title: `Design ${letter}`, className: 'ar-art-frame' })}</div>`;
}

/** A side's name: the letter as a badge, "Design A" for a screen reader. */
const arenaLetter = (letter) => `<span class="ar-letter" aria-hidden="true">${letter}</span><span class="dv-visually-hidden">Design ${letter}</span>`;
const arenaSecs = (ms) => (ms == null ? null : ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);

/**
 * The Design Arena (plan L51 step 1): a view of OpenVibe.Bench's nine design kinds. A blind pair of the chosen kind
 * is judged right on the page, signed in or not; the vote reveals both models; every kind's board follows.
 *
 *   kind     the chosen kind's id          pair    { kind, round, left, right } or null
 *   reveal   the vote just cast, or null    boards  [{ kind, rows, voters }]   cost  [{ category, leaderboard }]
 *   voters   null | 'people' | 'anon'       guestVotes  whether someone signed out may vote
 */
function arenaHome({ kind: kindId = DEFAULT_KIND, pair = null, reveal = null, notice = null, boards = [], cost = [], voters = null, me = {}, guestVotes = true, benchUrl: bench = 'https://bench.openvibe.services' } = {}) {
    const signedIn = Boolean(me.signedIn);
    const kind = kindOf(kindId);
    const benchUrl = String(bench || 'https://bench.openvibe.services').replace(/\/+$/, '');
    const kindHref = (id, hash = '#ar-pair') => `/arena?kind=${encodeURIComponent(id)}${voters ? `&voters=${voters}` : ''}${hash}`;
    const signIn = `/auth/login?next=${encodeURIComponent(`/arena?kind=${kind.id}`)}`;
    const total = boards.reduce((a, b) => a + ((b.voters && b.voters.total) || 0), 0);

    const rail = `<nav class="ar-kinds" id="ar-kinds" aria-label="Kinds of design">${DESIGN_KINDS.map((k) => `<a class="ar-kind" href="${kindHref(k.id)}"${k.id === kind.id ? ' aria-current="page"' : ''} data-kind="${esc(k.id)}">`
        + `<span class="ar-kind-i">${glyphs.svg(k.glyph, { size: 18 })}</span><span class="ar-kind-t"><b>${esc(k.name)}</b><small>${esc(k.line)}</small></span></a>`).join('')}</nav>`;

    const who = signedIn
        ? `<p class="ar-who" id="ar-who">You vote as yourself: your votes count with the signed-in people.</p>`
        : `<p class="ar-who" id="ar-who">You are not signed in: your vote counts with the signed-out voters, up to 30 a day. <a href="${esc(signIn)}">Sign in</a> to vote as yourself.</p>`;
    const hidden = (name, value) => `<input type="hidden" name="${name}" value="${esc(value)}">`;

    let judge;
    if (reveal) {
        const picked = { left: 'A', right: 'B', tie: 'a tie', both_bad: 'both bad' }[reveal.outcome] || reveal.outcome;
        const named = (s, letter, key) => {
            const won = reveal.outcome === key;
            const facts = [s.provider, s.cost_usd != null ? arenaCost(s.cost_usd) : null, arenaSecs(s.ms)].filter(Boolean).map(esc).join(' · ');
            return `<section class="ar-vote-side ar-reveal-side${won ? ' is-picked' : ''}" id="ar-vote-${key}" data-side="${key}"><h3>${arenaLetter(letter)}${won ? ' <span class="ar-pick">Your pick</span>' : ''}</h3>`
                + `<p class="ar-model"><b>${esc(s.model)}</b>${facts ? ` <span class="ar-fine">${facts}</span>` : ''}</p>${arenaSide(kind, s, letter)}</section>`;
        };
        judge = `<header class="ar-brief"><p class="ar-kicker">Vote recorded · ${esc(kind.name)}</p><h2 id="ar-pair-h">You picked ${esc(picked)}. Here are the models.</h2></header>
${kind.viewports ? arenaViewSwitch() : ''}
<div class="ar-vote-pair" id="ar-reveal">${named(reveal.left, 'A', 'left')}${named(reveal.right, 'B', 'right')}</div>
<div class="ar-vote-actions" id="ar-next"><a class="ovk-btn ovk-btn--primary" href="${kindHref(kind.id)}">Next pair ${glyphs.svg('arrow-right', { size: 16 })}</a><a class="ovk-btn ovk-btn--quiet" href="#ar-kb-${esc(kind.id.replace('.', '-'))}">See the ${esc(kind.name)} board</a></div>`;
    } else if (pair) {
        judge = `<header class="ar-brief"><p class="ar-kicker">Blind pair · ${esc(kind.name)}</p><h2 id="ar-pair-h">Which is better?</h2><blockquote class="ar-prompt" id="ar-prompt">${esc(String(pair.round.prompt).slice(0, 1200))}</blockquote></header>
<form id="ar-judge" class="ar-vote" method="post" action="/arena/vote">${hidden('kind', kind.id)}${hidden('round_id', pair.round.id)}${hidden('left_output', pair.left.id)}${hidden('right_output', pair.right.id)}${voters ? hidden('voters', voters) : ''}
${kind.viewports ? arenaViewSwitch() : ''}
<div class="ar-vote-pair" id="ar-vote-pair">
<section class="ar-vote-side" id="ar-vote-left" data-side="left"><h3>${arenaLetter('A')}</h3>${arenaSide(kind, pair.left, 'A')}</section>
<section class="ar-vote-side" id="ar-vote-right" data-side="right"><h3>${arenaLetter('B')}</h3>${arenaSide(kind, pair.right, 'B')}</section></div>
<div class="ar-vote-actions" id="ar-vote-actions"><button type="submit" class="ovk-btn ovk-btn--primary ar-vote-btn" name="winner" value="left" data-winner="left">A is better</button>
<button type="submit" class="ovk-btn ovk-btn--quiet ar-vote-btn" name="winner" value="tie" data-winner="tie">Tie</button>
<button type="submit" class="ovk-btn ovk-btn--primary ar-vote-btn" name="winner" value="right" data-winner="right">B is better</button>
<button type="submit" class="ovk-btn ovk-btn--quiet ar-vote-btn" name="winner" value="both_bad" data-winner="both_bad">Both bad</button></div>
${who}</form>`;
    } else if (!signedIn && !guestVotes) {
        judge = `<div class="ar-none" id="ar-none"><h2 id="ar-pair-h">Sign in to judge</h2><p>Every vote is blind: two designs from one brief, no model names until you pick.</p><p>${kit.button({ href: signIn, label: 'Sign in to vote' })}</p></div>`;
    } else {
        const next = DESIGN_KINDS[(DESIGN_KINDS.findIndex((k) => k.id === kind.id) + 1) % DESIGN_KINDS.length];
        judge = `<div class="ar-none" id="ar-none"><h2 id="ar-pair-h">${notice ? 'No pair right now' : `Nothing waiting in ${esc(kind.name)}`}</h2>
<p>${notice ? '' : `You have judged every ${esc(kind.name.toLowerCase())} pair there is, or none is ready yet. New rounds arrive every day.`}</p>
<p class="ar-actions"><a class="ovk-btn ovk-btn--primary" href="${kindHref(next.id)}">Try ${esc(next.name)}</a>${kind.id === 'design.page' || kind.id === 'design.component' ? ' <a class="ovk-btn ovk-btn--quiet" href="/arena/new">Start a round</a>' : ''}</p></div>`;
    }
    const alert = notice ? `<p class="ar-notice" id="ar-notice" role="alert">${esc(notice)}${!signedIn && /sign in/i.test(notice) ? ` <a href="${esc(signIn)}">Sign in</a>` : ''}</p>` : '';

    const boardCard = (b) => {
        const k = kindOf(b.kind);
        const rows = b.rows || [];
        const row = (r, i) => `<li class="ar-kb-row" data-model="${esc(r.model)}"><span class="ar-kb-rank">${i + 1}</span><span class="ar-kb-model">${esc(r.model)}${r.provisional ? ' <span class="ar-provisional" title="Fewer than 10 games">new</span>' : ''}</span><span class="ar-kb-elo">${Number(r.elo).toFixed(0)}</span><span class="ar-kb-games">${r.games}</span></li>`;
        const v = b.voters;
        const counts = v ? `${v.total} vote${v.total === 1 ? '' : 's'} · ${v.person} signed in · ${v.anon} signed out` : 'The board could not be read just now.';
        const first = rows.slice(0, 5).map(row).join('');
        const rest = rows.slice(5);
        return `<li class="ar-kb${k.id === kind.id ? ' is-on' : ''}" id="ar-kb-${esc(k.id.replace('.', '-'))}" data-kind="${esc(k.id)}">
<div class="ar-kb-h"><span class="ar-kind-i">${glyphs.svg(k.glyph, { size: 16 })}</span><h3>${esc(k.name)}</h3><a class="ar-kb-go" href="${kindHref(k.id)}">Judge</a></div>
<p class="ar-fine ar-kb-count">${esc(counts)}</p>
${rows.length ? `<ol class="ar-kb-rows" aria-label="${esc(k.name)} board"><li class="ar-kb-row ar-kb-th" aria-hidden="true"><span></span><span>Model</span><span>Elo</span><span>Games</span></li>${first}</ol>` : '<p class="ar-kb-empty">No votes yet. Be the first to judge it.</p>'}
${rest.length ? `<details class="ar-kb-more"><summary>${rest.length} more</summary><ol class="ar-kb-rows" start="6">${rest.map((r, i) => row(r, i + 5)).join('')}</ol></details>` : ''}
<p class="ar-kb-links"><a href="${esc(`${benchUrl}/gallery?kind=${encodeURIComponent(k.id)}`)}">Every entry</a> · <a href="${esc(`${benchUrl}/api/v1/datasets/${encodeURIComponent(k.id)}.jsonl`)}">Dataset</a></p></li>`;
    };
    const filter = [[null, 'Everyone'], ['people', 'Signed in'], ['anon', 'Signed out']].map(([v, label]) => `<a href="/arena?kind=${encodeURIComponent(kind.id)}${v ? `&voters=${v}` : ''}#ar-boards"${(voters || null) === v ? ' aria-current="true"' : ''}>${label}</a>`).join('');
    const costBoards = cost.map((c) => arenaLeaderboard(c.category, c.leaderboard || [], { type: 'cost' })).join('');

    const body = `<div class="ar-page ar-arena" id="ar-home" data-kind="${esc(kind.id)}">
<header class="ar-hero ar-hero--arena"><p class="ar-kicker">Design Arena · judged on OpenVibe.Bench</p><h1>Which AI designs it best?</h1>
<p class="ar-lede">Two designs from the same brief, the models hidden. Pick the better one and that kind's board moves. ${signedIn ? '' : 'No account needed.'}</p>
<p class="ar-fine" id="ar-total">${total ? `${total.toLocaleString('en-US')} votes so far across ${DESIGN_KINDS.length} kinds.` : `${DESIGN_KINDS.length} kinds of design, judged blind.`}</p></header>
${rail}
<section class="ar-judge" id="ar-pair" aria-labelledby="ar-pair-h">${alert}${judge}</section>
<section class="ar-boards ar-boards--kinds" id="ar-boards" aria-labelledby="ar-boards-h"><div class="ar-lb-head"><h2 id="ar-boards-h">The boards</h2><nav class="ar-voters" aria-label="Whose votes count">${filter}</nav></div>
<ul class="ar-kboards" id="ar-kboards">${boards.map(boardCard).join('')}</ul>
<p class="ar-fine">Elo from blind pairwise votes, K = 32. A tie is half a win; both bad is a game for neither model; <span class="ar-provisional">new</span> means fewer than 10 games. Signed-out votes are capped per voter and per day.</p></section>
<section class="ar-make" id="ar-make" aria-label="Make and download">
<div class="ar-make-card"><h2>Start a round</h2><p>Describe a page or a component once; three models build it, and the round joins the blind pairs. You cannot judge your own round.</p><p><a class="ovk-btn ovk-btn--primary" href="/arena/new">Start a round</a></p></div>
<div class="ar-make-card"><h2>Everything is open</h2><p>Every brief, every output and every vote can be downloaded from Bench, per kind. No voter is named.</p><p><a class="ovk-btn ovk-btn--quiet" href="/api/v1/arena/dataset.jsonl">Pages dataset</a> <a class="ovk-btn ovk-btn--quiet" href="${esc(`${benchUrl}/gallery`)}">The gallery on Bench</a></p></div></section>
${costBoards ? `<details class="ar-costs" id="ar-cost"><summary>What each model costs <span class="ar-fine">${cost.length} kind${cost.length === 1 ? '' : 's'}</span></summary><div class="ar-boards ar-boards--cost">${costBoards}</div></details>` : ''}
</div>`;
    return layout({
        title: `The Design Arena${kind.id === DEFAULT_KIND ? '' : ` · ${kind.name}`}`,
        description: 'Blind votes on AI designs across nine kinds (pages, screens, illustration, motion, charts, 3D, shaders and more), with an Elo board for each. No account needed.',
        path: '/arena', body: `<div class="ds-wrap">${body}</div>`, active: '/arena', scripts: ['js/arena.js'],
    });
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
    arenaHome, arenaNew, arenaRound, ARENA_CATEGORY, arenaShot,
    layout,
    setRelease: layoutLib.setRelease,
    configure: layoutLib.configure,
};
