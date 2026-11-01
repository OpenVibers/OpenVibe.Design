'use strict';
/**
 * /icons: the OpenVibe glyphs (plan L32). Every glyph the network draws, in one hand: search them, see one large with
 * the Font Awesome names it stands for, copy or download its SVG, and use them on any site. Below: the Font Awesome
 * names the network still uses that have no glyph yet (most used first), and "Draw an icon", where OpenVibe.AI drafts
 * candidates that an admin reviews before any of them joins the set.
 *
 * Server-rendered and whole without JavaScript: the grid, the drafts and the forms work as they are; icons.js adds the
 * live search, the sizes, the detail panel and the copy buttons; kit-web.js the snippet copy buttons.
 *
 *   iconsPage({ base, drafts, mine, reviewer, notice, error, draw })
 */
const kit = require('openvibe-shared/kit');
const { words: findWords } = require('../glyphs/aliases');
const glyphs = require('openvibe-shared/glyphs');
const { layout, esc } = require('../render/layout');
const usage = require('../glyphs/fa-usage.json');
const ex = require('../glyphs/export');

const BRANDS = new Set(['youtube', 'twitch', 'github', 'discord', 'twitter', 'x-twitter', 'facebook', 'instagram', 'tiktok', 'reddit', 'google', 'apple', 'android', 'windows', 'linux', 'steam', 'spotify', 'kickstarter', 'patreon', 'paypal', 'stripe', 'bitcoin', 'ethereum', 'telegram', 'whatsapp', 'slack', 'linkedin', 'mastodon', 'bluesky', 'vimeo', 'soundcloud', 'itch-io', 'npm', 'node-js', 'docker', 'cloudflare', 'chrome', 'firefox', 'safari', 'edge', 'opera', 'gitlab', 'bitbucket', 'figma', 'openai', 'markdown', 'kick', 'rumble', 'trello']);

/** Each glyph's Font Awesome names, for search and the detail panel. */
function faByGlyph() {
    const m = new Map();
    for (const [fa, g] of Object.entries(glyphs.FA)) { if (!m.has(g)) m.set(g, []); m.get(g).push(fa); }
    return m;
}

/** The names the network asks Font Awesome for that no glyph covers yet, brand logos aside; most used first. */
// Brand logos are drawn too since Shared 4.72.0 (Simple Icons, CC0): a name the brands draw is not still Font Awesome's.
let brands = null;
try { brands = require('openvibe-shared/brands'); } catch { brands = null; }
const brandDrawn = (name) => !!(brands && brands.fromFa && brands.fromFa(name));
function stillFontAwesome() {
    return usage.names.filter((n) => !glyphs.fromFa(n.name) && !BRANDS.has(n.name) && !brandDrawn(n.name));
}

const inner = (name) => glyphs.path(name);
const svg = (d, size = 24) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${d}</svg>`;
// A draft's solid twin (L50): filled, its class="ln" parts drawn as lines (icons.css .is-solid).
const solidSvg = (d, size = 24) => `<svg class="is-solid" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${d}</svg>`;

function iconsPage({ base = 'https://openvibe.design', drafts = [], mine = [], reviewer = false, notice = '', error = '', draw = '', guest = null } = {}) {
    const fa = faByGlyph();
    const left = stillFontAwesome();
    const covered = usage.names.filter((n) => glyphs.fromFa(n.name)).reduce((a, n) => a + n.uses, 0);
    const total = usage.names.filter((n) => !BRANDS.has(n.name)).reduce((a, n) => a + n.uses, 0);
    const tile = (name) => {
        const aliases = fa.get(name) || [];
        const drawn = glyphs.META[name] && /Opus/.test(glyphs.META[name].by) ? 'Drawn for the set' : 'From the kit';
        return `<a class="ic-tile" href="/icons/${esc(name)}" data-name="${esc(name)}" data-fa="${esc(aliases.join(' '))}" data-words="${esc(findWords(name).join(' '))}" data-by="${esc(drawn)}">${svg(inner(name))}<span>${esc(name)}</span></a>`;
    };

    const hero = `<header class="ic-hero">
  <p class="ic-eye">The OpenVibe glyphs</p>
  <h1 class="ic-h1">One hand for every icon.</h1>
  <p class="ic-lede">${glyphs.NAMES.length} icons in the mark&rsquo;s own line: a 24-unit grid, strokes two units wide with round ends, in the colour of the text around them. They stand in for ${Object.keys(glyphs.FA).length} Font Awesome names, ${Math.round((100 * covered) / Math.max(1, total))}% of what the network&rsquo;s pages ask for.</p>
  <div class="ic-acts">${kit.button({ href: '#get', label: 'Get them all', icon: 'download' })}${kit.button({ href: '#draw', label: 'Draw an icon', kind: 'quiet', icon: 'spark' })}${kit.button({ href: '/icons/font-awesome-alternative', label: 'Switch from Font Awesome', kind: 'quiet', icon: 'code' })}</div>
</header>`;

    // The most used first, in view; the rest in a fold that says how many it holds (the owner, 10-31: short pages by
    // counted folds, never by hiding). Wide screens open it (icons.js); the finder searches inside it and opens it.
    const used = new Map();
    for (const n of usage.names) { const g = glyphs.fromFa(n.name); if (g) used.set(g, (used.get(g) || 0) + n.uses); }
    const ranked = [...glyphs.NAMES].sort((a, b) => (used.get(b) || 0) - (used.get(a) || 0) || (a < b ? -1 : 1));
    const FIRST = 48;
    const first = ranked.slice(0, FIRST);
    const rest = glyphs.NAMES.filter((n) => !first.includes(n));
    const browse = `<section class="ic-sec" aria-labelledby="ic-all">
  <h2 id="ic-all" class="ovk-sr">Every glyph</h2>
  <div class="ic-tools" data-ic-tools hidden>
    <label class="ic-find">${kit.icon('search')}<span class="ovk-sr">Find a glyph</span><input type="search" placeholder="Find: a name, or a Font Awesome name" autocomplete="off" data-ic-find></label>
    <div class="ic-sizes" role="group" aria-label="Size">${[16, 20, 24, 32].map((n) => `<button type="button" class="ic-size" data-ic-size="${n}" aria-pressed="${n === 24 ? 'true' : 'false'}">${n}</button>`).join('')}</div>
  </div>
  <p class="ic-grid-cap">The ${FIRST} the network uses most</p>
  <div class="ic-grid" data-ic-grid style="--ic-size:24px">${first.map(tile).join('')}</div>
  <details class="ic-fold" data-ic-more><summary>All ${glyphs.NAMES.length} glyphs <span>${rest.length} more, A to Z</span></summary>
  <div class="ic-grid" data-ic-grid style="--ic-size:24px">${rest.map(tile).join('')}</div></details>
  <p class="ic-none" data-ic-none hidden>No glyph has that name yet. <a href="#draw" data-ic-draw-link>Draw it</a>.</p>
</section>
<dialog class="ic-sheet" data-ic-sheet aria-labelledby="ic-sheet-h"><div class="ic-sheet-in">
  <div class="ic-sheet-head"><h2 id="ic-sheet-h" data-ic-sheet-name></h2><button type="button" class="ovk-icon-btn" data-ic-close aria-label="Close">${kit.icon('close')}</button></div>
  <div class="ic-sheet-big" data-ic-sheet-big></div>
  <p class="ic-sheet-meta" data-ic-sheet-meta></p>
  <div class="ic-sheet-acts"><button type="button" class="ic-btn" data-ic-copy>Copy the SVG</button><a class="ic-btn" data-ic-download href="#" download>SVG</a><a class="ic-btn" data-ic-png href="#" download>PNG</a><a class="ic-btn is-go" data-ic-page href="#">Its page ${kit.icon('arrow-right')}</a></div>
</div></dialog>`;

    const leftHtml = left.length ? `<section class="ic-sec" aria-labelledby="ic-left">
  <div class="ic-sec-head"><h2 id="ic-left">Still Font Awesome</h2><p>The names the network&rsquo;s pages asked Font Awesome for that no glyph draws yet, most used first (counted ${esc(usage.counted)}). Brand logos are drawn too now. Tap one to draw it.</p></div>
  <ul class="ic-left">${left.slice(0, 24).map((n) => `<li><a href="/icons?draw=${encodeURIComponent(n.name)}#draw">${esc(n.name)}</a><small>${n.uses}</small></li>`).join('')}</ul>
  ${left.length > 24 ? `<details class="ic-fold ic-left-fold"><summary>${left.length - 24} more <span>each used a few times</span></summary><ul class="ic-left">${left.slice(24).map((n) => `<li><a href="/icons?draw=${encodeURIComponent(n.name)}#draw">${esc(n.name)}</a><small>${n.uses}</small></li>`).join('')}</ul></details>` : ''}
</section>` : '';

    const draftCard = (d, actions = '') => `<li class="ic-draft is-${esc(d.status)}"><div class="ic-draft-art"${d.solid_svg ? ' title="The line drawing, and its solid twin as the sites show it at 18 px and under"' : ''}>${svg(d.svg, 40)}${d.solid_svg ? solidSvg(d.solid_svg, 20) : svg(d.svg, 20)}</div><div class="ic-draft-t"><b>${esc(d.name)}</b>${actions && d.sentence ? `<span>${esc(d.sentence)}</span>` : ''}<small>${esc(d.status === 'draft' ? 'waiting for review' : d.status)}${d.model ? ` · ${esc(d.model)}` : ''}</small></div>${actions}</li>`;
    const reviewForm = (d) => `<div class="ic-draft-acts">${['approve', 'reject'].map((a) => `<form method="post" action="/icons/drafts/${esc(d.id)}/review"><input type="hidden" name="action" value="${a}"><button type="submit" class="ic-btn${a === 'approve' ? ' is-go' : ''}">${a === 'approve' ? 'Approve' : 'Reject'}</button></form>`).join('')}</div>`;
    const drawSec = `<section class="ic-sec" id="draw" aria-labelledby="ic-draw">
  <div class="ic-sec-head"><h2 id="ic-draw">Draw an icon</h2><p>Name it and say what it stands for. OpenVibe.AI draws a few candidates in this hand; each is checked (strokes only, on the grid, a few shapes) before it is kept, and an admin reviews it before it joins the set.</p></div>
  ${notice ? kit.notice({ kind: 'ok', text: notice }) : ''}${error ? kit.notice({ kind: 'error', text: error }) : ''}
  <form class="ic-form" method="post" action="/icons/draft">
    <label><span>Name</span><input name="name" required pattern="[a-z][a-z0-9-]{1,31}" maxlength="32" placeholder="hot-tub" value="${esc(draw)}" autocomplete="off" spellcheck="false"></label>
    <label class="ic-grow"><span>What it stands for</span><input name="sentence" maxlength="200" placeholder="A tub with steam over it: a hot tub at a rental"></label>
    ${guest && guest.turnstile ? `<div class="cf-turnstile ic-human" data-sitekey="${esc(guest.turnstile)}" data-theme="auto" data-size="flexible"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` : ''}
    <button type="submit" class="ic-btn is-go">${kit.icon('spark')} Draw it</button>
  </form>
  ${guest ? `<p class="ic-more">No account needed: you can draw ${guest.perDay} icon${guest.perDay === 1 ? '' : 's'} a day as a guest. <a href="/auth/login?next=${encodeURIComponent('/icons#draw')}">Sign in</a> to draw more and see your drafts on any device.</p>` : ''}
  ${mine.length ? `<h3>${guest ? 'Your drafts, on this browser' : 'Your drafts'}</h3><ul class="ic-drafts">${mine.map((d) => draftCard(d)).join('')}</ul>` : ''}
  ${reviewer ? `<h3>Waiting for review</h3>${drafts.length ? `<ul class="ic-drafts">${drafts.map((d) => draftCard(d, reviewForm(d))).join('')}</ul>` : '<p class="ic-more">Nothing waiting.</p>'}` : ''}
</section>`;

    const packs = [
        ['ov-glyphs-svg.zip', 'Every SVG', `${glyphs.NAMES.length} files and the licence, in a ZIP`],
        ...['ov-glyphs.woff2', 'ov-glyphs.ttf', 'ov-glyphs.otf', 'ov-glyphs.svg', 'ov-glyphs-font.css', 'ov-glyphs-fa.css'].map((f) => [f, ex.PACK[f].label, ex.PACK[f].about]),
    ];
    const get = `<section class="ic-sec" id="get" aria-labelledby="ic-get">
  <div class="ic-sec-head"><h2 id="ic-get">Get them all</h2><p>Free, MIT. The fonts carry every glyph at its own character (U+E001 up, never reused), so a document made with them keeps working. Each glyph&rsquo;s page makes a PNG at any size and colour.</p></div>
  <p class="ic-more"><a href="/icons/kit"><b>Make a kit</b></a>: a font with only the icons your site uses, from a few hundred bytes.</p>
  <ul class="ic-packs">${packs.map(([f, label, about]) => `<li><a href="/icons/pack/${esc(f)}" download><b>${esc(label)}</b><small>${esc(about)}</small><code>${esc(f)}</code></a></li>`).join('')}</ul>
</section>`;

    const use = `<section class="ic-sec" id="use" aria-labelledby="ic-use">
  <div class="ic-sec-head"><h2 id="ic-use">Use them</h2><p>Every OpenVibe site already shows them in place of Font Awesome&rsquo;s (the navbar loads the drop-in). Anyone else can too; it is open source (MIT).</p></div>
  <div class="ic-use">
    <div><h3>On any page</h3>${kit.snippet({ code: `<script src="${base}/ov-icon.js" defer></script>\n<ov-icon name="heart"></ov-icon>\n<ov-icon name="mic" size="16" label="Microphone"></ov-icon>`, id: 'ic-use-wc', label: 'Copy the HTML' })}<p class="ic-more">A web component: no sign-in, any framework. It follows the text&rsquo;s size and colour and turns solid when small.</p></div>
    <div><h3>In place of Font Awesome</h3>${kit.snippet({ code: `<script src="${base}/shared/ov-glyphs.js" defer></script>\n<!-- your <i class="fa-solid fa-eye"> now shows the glyph -->`, id: 'ic-use-web', label: 'Copy the HTML' })}<p class="ic-more">Sizes, animations and transforms keep working: <a href="/icons/font-awesome-alternative">what keeps working</a>.</p></div>
    <div><h3>In React, Vue or Svelte</h3>${kit.snippet({ code: `npm i ${base}/icons/npm/openvibe-icons-react.tgz\n\nimport { Icon, BellIcon } from 'openvibe-icons-react';\n<Icon name="bell" size={16} />`, id: 'ic-use-npm', label: 'Copy' })}<p class="ic-more">No registry account: npm installs it from this site. <a href="/icons/npm/openvibe-icons-vue.tgz">Vue</a>, <a href="/icons/npm/openvibe-icons-svelte.tgz">Svelte</a> and <a href="/icons/npm/openvibe-icons.tgz">plain JavaScript</a> (<code>svg('bell', { size: 16 })</code>) the same way. Solid at 18 px and under, like the sites.</p></div>
    <div><h3>As a font</h3>${kit.snippet({ code: `<link rel="stylesheet" href="${base}/shared/ov-glyphs-font.css">\n<i class="ovi ovi-eye"></i>`, id: 'ic-use-font', label: 'Copy the HTML' })}</div>
    <div><h3>On a server</h3>${kit.snippet({ code: "const glyphs = require('openvibe-shared/glyphs');\n\nglyphs.svg('live', { size: 20 });   // a standalone SVG\nglyphs.fromFa('fa-eye');             // 'eye'", id: 'ic-use-node', label: 'Copy the code' })}</div>
    <div><h3>Switching from another set?</h3><p class="ic-more">Font Awesome, Lucide, Material or MUI: <a href="/icons/migrate">paste your page</a> and see every icon with its OpenVibe twin. Their names work in <code>&lt;ov-icon name="lucide:settings"&gt;</code> too.</p></div>
    <div><h3>As data</h3>${kit.snippet({ code: `GET ${base}/api/v1/glyphs\nGET ${base}/api/v1/glyphs?names=heart,fa-gear\nGET ${base}/icons/<name>.svg?style=auto|line|solid\nGET ${base}/icons/<name>.mjs | .xml | /favicon.zip`, id: 'ic-use-api', label: 'Copy' })}</div>
  </div>
</section>`;

    return layout({
        title: 'The OpenVibe glyphs',
        description: `${glyphs.NAMES.length} icons in one hand, the OpenVibe mark's: search them, copy or download their SVG, use them in place of Font Awesome, and draw new ones with OpenVibe.AI.`,
        path: '/icons', active: '/icons', styles: ['css/icons.css'], scripts: ['js/icons.js'],
        body: `<article class="ic">${hero}${browse}${get}${leftHtml}${drawSec}${use}</article>`,
    });
}

/** The registry as data (GET /api/v1/glyphs). */
function glyphsJson() {
    const fa = faByGlyph();
    return { count: glyphs.NAMES.length, glyphs: glyphs.NAMES.map((n) => ({ name: n, svg: glyphs.path(n), solid: glyphs.solid(n) || '', fa: fa.get(n) || [], by: glyphs.META[n].by })), fa: glyphs.FA };
}

module.exports = { iconsPage, glyphsJson, stillFontAwesome };
