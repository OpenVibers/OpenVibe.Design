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
function stillFontAwesome() {
    return usage.names.filter((n) => !glyphs.fromFa(n.name) && !BRANDS.has(n.name));
}

const inner = (name) => glyphs.path(name);
const svg = (d, size = 24) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${d}</svg>`;

function iconsPage({ base = 'https://openvibe.design', drafts = [], mine = [], reviewer = false, notice = '', error = '', draw = '' } = {}) {
    const fa = faByGlyph();
    const left = stillFontAwesome();
    const covered = usage.names.filter((n) => glyphs.fromFa(n.name)).reduce((a, n) => a + n.uses, 0);
    const total = usage.names.filter((n) => !BRANDS.has(n.name)).reduce((a, n) => a + n.uses, 0);
    const tile = (name) => {
        const aliases = fa.get(name) || [];
        const drawn = glyphs.META[name] && /Opus/.test(glyphs.META[name].by) ? 'Drawn for the set' : 'From the kit';
        return `<a class="ic-tile" href="/icons/${esc(name)}" data-name="${esc(name)}" data-fa="${esc(aliases.join(' '))}" data-by="${esc(drawn)}">${svg(inner(name))}<span>${esc(name)}</span></a>`;
    };

    const hero = `<header class="ic-hero">
  <p class="ic-eye">The OpenVibe glyphs</p>
  <h1 class="ic-h1">One hand for every icon.</h1>
  <p class="ic-lede">${glyphs.NAMES.length} icons in the mark&rsquo;s own line: a 24-unit grid, strokes two units wide with round ends, in the colour of the text around them. They stand in for ${Object.keys(glyphs.FA).length} Font Awesome names, ${Math.round((100 * covered) / Math.max(1, total))}% of what the network&rsquo;s pages ask for.</p>
  <div class="ic-acts">${kit.button({ href: '#get', label: 'Get them all', icon: 'download' })}${kit.button({ href: '#draw', label: 'Draw an icon', kind: 'quiet', icon: 'spark' })}${kit.button({ href: '/icons/font-awesome-alternative', label: 'Switch from Font Awesome', kind: 'quiet', icon: 'code' })}</div>
</header>`;

    const browse = `<section class="ic-sec" aria-labelledby="ic-all">
  <h2 id="ic-all" class="ovk-sr">Every glyph</h2>
  <div class="ic-tools" data-ic-tools hidden>
    <label class="ic-find">${kit.icon('search')}<span class="ovk-sr">Find a glyph</span><input type="search" placeholder="Find: a name, or a Font Awesome name" autocomplete="off" data-ic-find></label>
    <div class="ic-sizes" role="group" aria-label="Size">${[16, 20, 24, 32].map((n) => `<button type="button" class="ic-size" data-ic-size="${n}" aria-pressed="${n === 24 ? 'true' : 'false'}">${n}</button>`).join('')}</div>
  </div>
  <div class="ic-grid" data-ic-grid style="--ic-size:24px">${glyphs.NAMES.map(tile).join('')}</div>
  <p class="ic-none" data-ic-none hidden>No glyph has that name yet. <a href="#draw" data-ic-draw-link>Draw it</a>.</p>
</section>
<dialog class="ic-sheet" data-ic-sheet aria-labelledby="ic-sheet-h"><div class="ic-sheet-in">
  <div class="ic-sheet-head"><h2 id="ic-sheet-h" data-ic-sheet-name></h2><button type="button" class="ovk-icon-btn" data-ic-close aria-label="Close">${kit.icon('close')}</button></div>
  <div class="ic-sheet-big" data-ic-sheet-big></div>
  <p class="ic-sheet-meta" data-ic-sheet-meta></p>
  <div class="ic-sheet-acts"><button type="button" class="ic-btn" data-ic-copy>Copy the SVG</button><a class="ic-btn" data-ic-download href="#" download>SVG</a><a class="ic-btn" data-ic-png href="#" download>PNG</a><a class="ic-btn is-go" data-ic-page href="#">Its page ${kit.icon('arrow-right')}</a></div>
</div></dialog>`;

    const leftHtml = left.length ? `<section class="ic-sec" aria-labelledby="ic-left">
  <div class="ic-sec-head"><h2 id="ic-left">Still Font Awesome</h2><p>The names the network&rsquo;s pages still ask Font Awesome for, most used first (counted ${esc(usage.counted)}). Each one drawn moves a site closer to dropping it. Brand logos stay theirs.</p></div>
  <ul class="ic-left">${left.slice(0, 48).map((n) => `<li><a href="/icons?draw=${encodeURIComponent(n.name)}#draw">${esc(n.name)}</a><small>${n.uses}</small></li>`).join('')}</ul>
  ${left.length > 48 ? `<p class="ic-more">And ${left.length - 48} more, each used once or twice.</p>` : ''}
</section>` : '';

    const draftCard = (d, actions = '') => `<li class="ic-draft is-${esc(d.status)}"><div class="ic-draft-art">${svg(d.svg, 40)}${svg(d.svg, 20)}</div><div class="ic-draft-t"><b>${esc(d.name)}</b>${actions && d.sentence ? `<span>${esc(d.sentence)}</span>` : ''}<small>${esc(d.status === 'draft' ? 'waiting for review' : d.status)}${d.model ? ` · ${esc(d.model)}` : ''}</small></div>${actions}</li>`;
    const reviewForm = (d) => `<div class="ic-draft-acts">${['approve', 'reject'].map((a) => `<form method="post" action="/icons/drafts/${esc(d.id)}/review"><input type="hidden" name="action" value="${a}"><button type="submit" class="ic-btn${a === 'approve' ? ' is-go' : ''}">${a === 'approve' ? 'Approve' : 'Reject'}</button></form>`).join('')}</div>`;
    const drawSec = `<section class="ic-sec" id="draw" aria-labelledby="ic-draw">
  <div class="ic-sec-head"><h2 id="ic-draw">Draw an icon</h2><p>Name it and say what it stands for. OpenVibe.AI draws a few candidates in this hand; each is checked (strokes only, on the grid, a few shapes) before it is kept, and an admin reviews it before it joins the set.</p></div>
  ${notice ? kit.notice({ kind: 'ok', text: notice }) : ''}${error ? kit.notice({ kind: 'error', text: error }) : ''}
  <form class="ic-form" method="post" action="/icons/draft">
    <label><span>Name</span><input name="name" required pattern="[a-z][a-z0-9-]{1,31}" maxlength="32" placeholder="hot-tub" value="${esc(draw)}" autocomplete="off" spellcheck="false"></label>
    <label class="ic-grow"><span>What it stands for</span><input name="sentence" maxlength="200" placeholder="A tub with steam over it: a hot tub at a rental"></label>
    <button type="submit" class="ic-btn is-go">${kit.icon('spark')} Draw it</button>
  </form>
  ${mine.length ? `<h3>Your drafts</h3><ul class="ic-drafts">${mine.map((d) => draftCard(d)).join('')}</ul>` : ''}
  ${reviewer ? `<h3>Waiting for review</h3>${drafts.length ? `<ul class="ic-drafts">${drafts.map((d) => draftCard(d, reviewForm(d))).join('')}</ul>` : '<p class="ic-more">Nothing waiting.</p>'}` : ''}
</section>`;

    const packs = [
        ['ov-glyphs-svg.zip', 'Every SVG', `${glyphs.NAMES.length} files and the licence, in a ZIP`],
        ...['ov-glyphs.woff2', 'ov-glyphs.ttf', 'ov-glyphs.otf', 'ov-glyphs.svg', 'ov-glyphs-font.css', 'ov-glyphs-fa.css'].map((f) => [f, ex.PACK[f].label, ex.PACK[f].about]),
    ];
    const get = `<section class="ic-sec" id="get" aria-labelledby="ic-get">
  <div class="ic-sec-head"><h2 id="ic-get">Get them all</h2><p>Free, MIT. The fonts carry every glyph at its own character (U+E001 up, never reused), so a document made with them keeps working. Each glyph&rsquo;s page makes a PNG at any size and colour.</p></div>
  <ul class="ic-packs">${packs.map(([f, label, about]) => `<li><a href="/icons/pack/${esc(f)}" download><b>${esc(label)}</b><small>${esc(about)}</small><code>${esc(f)}</code></a></li>`).join('')}</ul>
</section>`;

    const use = `<section class="ic-sec" id="use" aria-labelledby="ic-use">
  <div class="ic-sec-head"><h2 id="ic-use">Use them</h2><p>Every OpenVibe site already shows them in place of Font Awesome&rsquo;s (the navbar loads the drop-in). Anyone else can too; it is open source (MIT).</p></div>
  <div class="ic-use">
    <div><h3>In place of Font Awesome</h3>${kit.snippet({ code: `<script src="${base}/shared/ov-glyphs.js" defer></script>\n<!-- your <i class="fa-solid fa-eye"> now shows the glyph -->`, id: 'ic-use-web', label: 'Copy the HTML' })}<p class="ic-more">Sizes, animations and transforms keep working: <a href="/icons/font-awesome-alternative">what keeps working</a>.</p></div>
    <div><h3>As a font</h3>${kit.snippet({ code: `<link rel="stylesheet" href="${base}/shared/ov-glyphs-font.css">\n<i class="ovi ovi-eye"></i>`, id: 'ic-use-font', label: 'Copy the HTML' })}</div>
    <div><h3>On a server</h3>${kit.snippet({ code: "const glyphs = require('openvibe-shared/glyphs');\n\nglyphs.svg('live', { size: 20 });   // a standalone SVG\nglyphs.fromFa('fa-eye');             // 'eye'", id: 'ic-use-node', label: 'Copy the code' })}</div>
    <div><h3>As data</h3>${kit.snippet({ code: `GET ${base}/api/v1/glyphs\nGET ${base}/icons/<name>.svg`, id: 'ic-use-api', label: 'Copy' })}</div>
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
    return { count: glyphs.NAMES.length, glyphs: glyphs.NAMES.map((n) => ({ name: n, svg: glyphs.path(n), fa: fa.get(n) || [], by: glyphs.META[n].by })), fa: glyphs.FA };
}

module.exports = { iconsPage, glyphsJson, stillFontAwesome };
