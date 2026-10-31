'use strict';
/**
 * /brand: the OpenVibe mark, for anyone who wants to use it. The mark (the Pair: a ring O and a round V with a gap of
 * the ground around the V), what each of its moves means, its forms at every size, the grounds it sits on, the names
 * beside it in the brand face, its colours, the files to download and the code to use it on any site.
 *
 * Server-rendered and whole without JavaScript: every mark here is openvibe-shared/mark's static SVG, and the shared
 * ov-mark.js (loaded by the navbar) brings the live ones to life. brand.js adds the state buttons and the progress
 * demo; kit-web.js adds the copy buttons.
 *
 *   brandPage({ base })   base: this site's origin, for the snippets
 *   FILES                 the downloads served under /brand/: { name, form, tone, wide, title }
 */
const fs = require('fs');
const path = require('path');
const kit = require('openvibe-shared/kit');
const mark = require('openvibe-shared/mark');
const appIcons = require('openvibe-shared/app-icons');
const { layout, esc } = require('../render/layout');
const { asset } = require('../assets');

const FILES = Object.freeze([
    { name: 'openvibe-mark.svg', label: 'The mark', note: 'blue and violet, square', form: 'pair', tone: 'brand', wide: false },
    { name: 'openvibe-mark-wide.svg', label: 'Wide', note: 'the box hugs the mark, for beside a name', form: 'pair', tone: 'brand', wide: true },
    { name: 'openvibe-mark-small.svg', label: 'Small', note: 'the heavy form, for 22 px and under', form: 'heavy', tone: 'brand', wide: false },
    { name: 'openvibe-mark-ink.svg', label: 'Ink', note: 'one colour: it takes the text colour', form: 'pair', tone: 'ink', wide: false },
    { name: 'openvibe-mark-white.svg', label: 'White', note: 'for a colour or a photo', form: 'pair', tone: 'white', wide: false },
]);

/**
 * The mark's intro as files: the animation people download, and the still that stands in for it. The sizes are read
 * from the files themselves, so the page never promises a size the file does not have.
 */
const MOTION_DIR = path.join(__dirname, '..', '..', 'public', 'brand', 'motion');
const MOTION = Object.freeze([
    { name: 'ov-mark-intro.webm', label: 'The intro', note: '512 px · VP9', art: 'ov-mark-poster.png' },
    { name: 'ov-mark-intro.mp4', label: 'The intro', note: '1080 px · H.264', art: 'ov-mark-poster.png' },
    { name: 'ov-mark-intro.gif', label: 'The intro', note: '256 px · GIF, transparent', art: 'ov-mark-poster.png' },
    { name: 'ov-mark-intro.png', label: 'The intro', note: '256 px · APNG, transparent', art: 'ov-mark-poster.png' },
    { name: 'ov-mark-live-intro.webm', label: 'The Live intro', note: '512 px · VP9', art: 'ov-mark-live-poster.png' },
    { name: 'ov-mark-live-intro.mp4', label: 'The Live intro', note: '1080 px · H.264', art: 'ov-mark-live-poster.png' },
    { name: 'ov-mark-live-intro.gif', label: 'The Live intro', note: '256 px · GIF, transparent', art: 'ov-mark-live-poster.png' },
    { name: 'ov-mark-live-intro.png', label: 'The Live intro', note: '256 px · APNG, transparent', art: 'ov-mark-live-poster.png' },
    { name: 'ov-mark-poster.png', label: 'The mark, still', note: '1024 px · PNG, transparent', art: 'ov-mark-poster.png' },
    { name: 'ov-mark-live-poster.png', label: 'The Live mark, still', note: '1024 px · PNG, transparent', art: 'ov-mark-live-poster.png' },
]);
/** The size of a motion file, as it is on disk (0 when it is not there yet). */
function motionSize(name) {
    try { return fs.statSync(path.join(MOTION_DIR, name)).size; } catch { return 0; }
}
/** A size a person can read: 84 KB, 1.2 MB. */
function humanSize(bytes) {
    if (!bytes) return '—';
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

let n = 0;
/** A static mark, its mask ids unique on the page. */
const art = (o = {}) => mark.svg({ id: `br${++n}`, title: 'OpenVibe', ...o });
/** A live mark: the static SVG until ov-mark.js mounts it. */
const live = (attrs = '', o = {}) => `<span class="ov-mark" ${attrs}>${art(o)}</span>`;

const STATES = [
    ['', 'At rest', 'Still. It moves for a moment on your first visit, and when you point at it.'],
    ['busy', 'Working', 'The V bobs while the O breathes, in turn: something is on its way.'],
    ['ok', 'Done', 'The V becomes a tick and goes green. The tick only ever means done.'],
    ['error', 'Failed', 'The V becomes an exclamation mark, red, and the mark shakes once.'],
    ['no', 'Declined', 'The V becomes a cross, grey: cancelled, turned down, not now.'],
    ['notify', 'Something new', 'A dot pops up by the V: something is waiting for you.'],
    ['live', 'Live', 'The O is the record light and the signal goes out from it.'],
    ['sleep', 'Asleep', 'The O closes like an eye: offline, or down for maintenance.'],
];

const SIZES = [16, 20, 24, 32, 48, 96];

function brandPage({ base = 'https://openvibe.design' } = {}) {
    n = 0;
    const C = mark.COLORS;
    const hero = `<header class="br-hero">
  <div class="br-hero-stage">${live('data-size="300" data-wide data-br-hero', { wide: true })}</div>
  <div class="br-hero-words">
    <p class="br-eye">The OpenVibe mark</p>
    <h1 class="br-h1">A ring and a round&nbsp;V.</h1>
    <p class="br-lede">The O is the network, open to everyone; the V is the vibe in it. Where they cross, the ground shows through, so the mark holds on anything: a dark theme, a light one, a photo. It moves only when it has something to say.</p>
    <div class="br-acts">${kit.button({ href: '/brand/openvibe-mark.svg', label: 'Download the SVG', icon: 'download', attrs: { download: 'openvibe-mark.svg' } })}${kit.button({ href: '#use', label: 'Use it on your site', kind: 'quiet', icon: 'code' })}<button type="button" class="br-replay" data-br-replay hidden>Play the intro again</button></div>
  </div>
</header>`;

    const moves = `<section class="br-sec" aria-labelledby="br-moves">
  <div class="br-sec-head"><h2 id="br-moves">It moves when it means something</h2><p>Every move is a word: one shape says working, done, failed and live, in colour and in form. Nothing spins.</p></div>
  <div class="br-play">
    <div class="br-play-stage">${live('data-size="190" data-wide data-br-demo', { wide: true })}</div>
    <div class="br-play-side">
      <div class="br-states" role="group" aria-label="Show a state">${STATES.map(([id, label, line], i) => `<button type="button" class="br-chip" data-br-state="${esc(id)}" data-say="${esc(line)}" aria-pressed="${i === 0 ? 'true' : 'false'}" hidden>${esc(label)}</button>`).join('')}<button type="button" class="br-chip" data-br-load hidden>A page on its way</button></div>
      <p class="br-say" data-br-say aria-live="polite">${esc(STATES[0][2])}</p>
      <ul class="br-meanings">${STATES.slice(1).map(([id, label, say]) => `<li><span class="br-mini">${live(`data-size="44" data-state="${esc(id)}" data-static`)}</span><span><b>${esc(label)}</b> ${esc(say)}</span></li>`).join('')}
        <li><span class="br-mini">${live('data-size="44" data-progress="0.62" style="--ovm-p:.62" data-static')}</span><span><b>A page on its way</b> Follow a link and the navbar&rsquo;s ring empties, then draws itself round as the next page loads, at the pace this site usually takes in your browser. It closes and the V hops when the page is here.</span></li></ul>
    </div>
  </div>
</section>`;

    const sizes = `<section class="br-sec" aria-labelledby="br-sizes">
  <div class="br-sec-head"><h2 id="br-sizes">One shape at every size</h2><p>At 22 px and under the strokes thicken (the heavy form), so the gap around the V stays open on a favicon or inside a button.</p></div>
  <div class="br-sizes">${SIZES.map((s) => `<figure><div class="br-size-box" style="--s:${s}px">${art({ form: s <= 22 ? 'heavy' : 'pair', size: s })}</div><figcaption>${s} px<small>${s <= 22 ? 'heavy' : 'pair'}</small></figcaption></figure>`).join('')}</div>
</section>`;

    const grounds = `<section class="br-sec" aria-labelledby="br-grounds">
  <div class="br-sec-head"><h2 id="br-grounds">On any ground</h2><p>The gap is cut out of the ring, not painted, so whatever is behind the mark shows through it.</p></div>
  <div class="br-grounds">
    <figure class="br-g br-g--night">${art({})}<figcaption>Night</figcaption></figure>
    <figure class="br-g br-g--day">${art({})}<figcaption>Day</figcaption></figure>
    <figure class="br-g br-g--photo">${art({})}<figcaption>A picture</figcaption></figure>
    <figure class="br-g br-g--tile">${art({ tone: 'white' })}<figcaption>White, on colour</figcaption></figure>
    <figure class="br-g br-g--paper">${art({ tone: 'ink' })}<figcaption>Ink, one colour</figcaption></figure>
    <figure class="br-g br-g--app"><img src="${esc(appIcons.url('network', 192))}" width="96" height="96" alt="The OpenVibe app icon"><figcaption>The app icon</figcaption></figure>
  </div>
</section>`;

    const site = (name, variant, tld) => `<div class="br-lock"><span class="ov-mark" data-size="44" data-wide data-variant="${esc(variant)}">${art({ wide: true })}</span><span class="br-word">${name}${tld ? `<span class="br-dot">.</span><span class="br-tld">${esc(tld)}</span>` : ''}</span></div>`;
    const names = `<section class="br-sec" aria-labelledby="br-names">
  <div class="br-sec-head"><h2 id="br-names">The names beside it</h2><p>Names are set in Nunito, round like the mark, at 800 and 900. Everything you read is set in Inter where you have it, and otherwise in your system&rsquo;s own face.</p></div>
  <div class="br-locks">${site('OpenVibe', 'network', '')}${site('OpenVibe', 'live', 'Live')}${site('OpenVibe', 'codes', 'Codes')}${site('OpenVibe', 'chat', 'Chat')}${site('OpenVibe', 'games', 'Games')}${site('OpenVibe', 'vip', 'VIP')}</div>
  <div class="br-type">
    <div class="br-face br-face--brand"><p class="br-face-name">Nunito <small>for names · 800, 900</small></p><p class="br-face-sample" aria-hidden="true">OpenVibe.Live</p><p class="br-face-set" aria-hidden="true">Aa Bb Cc 0123456789</p></div>
    <div class="br-face br-face--text"><p class="br-face-name">Inter <small>for everything you read, or your system&rsquo;s face</small></p><p class="br-face-sample" aria-hidden="true">Go live from your browser</p><p class="br-face-set" aria-hidden="true">Aa Bb Cc 0123456789</p></div>
  </div>
</section>`;

    const swatch = (name, hex, note) => `<div class="br-sw"><span class="br-sw-chip" style="background:${esc(hex)}"></span><span class="br-sw-t"><b>${esc(name)}</b><code>${esc(hex)}</code><small>${esc(note)}</small></span><button type="button" class="br-copy" data-br-copy="${esc(hex)}" aria-label="Copy ${esc(hex)}" hidden>Copy</button></div>`;
    const colours = `<section class="br-sec" aria-labelledby="br-colours">
  <div class="br-sec-head"><h2 id="br-colours">Colours</h2><p>Two for the mark. The rest belong to its states, and come from the theme where the theme has them.</p></div>
  <div class="br-sws">${swatch('O blue', C.o, 'the ring')}${swatch('V violet', C.v, 'the V')}${swatch('Done', '#22c55e', 'the tick')}${swatch('Failed', '#ef4444', 'the "!"')}${swatch('Live', '#ff3b5c', 'the record light')}${swatch('Declined', '#94a3b8', 'the cross')}</div>
</section>`;

    const useScript = `<script src="${base}/shared/ov-mark.js" async></script>

<span class="ov-mark" data-size="48"></span>
<span class="ov-mark" data-size="34" data-wide></span>
<span class="ov-mark" data-size="20" data-state="busy"></span>

<!-- data-state    busy, ok, error, no, notify, live, sleep
     data-progress 0.4, with style="--ovm-p:.4"
     data-tone     ink or white: one colour
     data-wide     the box hugs the mark
     OVMark.intro(el) plays the intro again -->`;
    const useLive = `<script src="${base}/shared/ov-mark.js"></script>
<span class="ov-mark" data-size="64"></span>`;
    const useNode = `const mark = require('openvibe-shared/mark');

mark.svg({ size: 64 });             // 64 px square
mark.svg({ wide: true, size: 32 }); // 53 × 32
mark.svg({ tone: 'white' });        // one colour
mark.svg({ form: 'heavy' });        // 22 px and under`;
    const useFont = `@font-face {
  font-family: 'OV Brand';
  src: url(${base}/shared/ov-brand.woff2) format('woff2');
  font-weight: 700 900;
  font-display: swap;
}
.name { font: 800 1em 'OV Brand', Nunito, sans-serif; }`;
    const use = `<section class="br-sec" id="use" aria-labelledby="br-use">
  <div class="br-sec-head"><h2 id="br-use">Use it</h2><p>On any page, in any app, with every move above. It is open source (MIT); the font is Nunito (SIL Open Font License).</p></div>
  <div class="br-use">
    <div><h3>On a web page</h3>${kit.snippet({ code: useScript, id: 'br-use-web', label: 'Copy the HTML' })}</div>
    <div><h3>On a server, or in an app <small class="br-h3-note">openvibe-shared v4.59.0 or later</small></h3>${kit.snippet({ code: useNode, id: 'br-use-node', label: 'Copy the code' })}</div>
    <div><h3>The names&rsquo; face</h3>${kit.snippet({ code: useFont, id: 'br-use-font', label: 'Copy the CSS' })}</div>
  </div>
  <h3 class="br-files-h">Files</h3>
  <ul class="br-files">${FILES.map((f) => `<li><a href="/brand/${esc(f.name)}" download="${esc(f.name)}"><span class="br-file-art${f.tone === 'white' ? ' is-white' : ''}">${art({ form: f.form, tone: f.tone, wide: f.wide })}</span><span><b>${esc(f.label)}</b><small>${esc(f.note)} · SVG</small></span></a></li>`).join('')}
    <li><a href="${esc(appIcons.url('network', 512))}" download="openvibe-app-icon-512.png"><span class="br-file-art"><img src="${esc(appIcons.url('network', 192))}" width="40" height="40" alt=""></span><span><b>App icon</b><small>512 px · PNG</small></span></a></li>
    <li><a href="/shared/ov-brand.woff2" download="ov-brand.woff2"><span class="br-file-art br-file-aa" aria-hidden="true">Aa</span><span><b>The brand face</b><small>Nunito, Latin, 700 to 900 · WOFF2</small></span></a></li></ul>
</section>`;

    const rule = (ok, title, text, demo) => `<div class="br-rule${ok ? '' : ' is-dont'}"><div class="br-rule-art">${demo}</div><p><b>${ok ? 'Do' : 'Don&rsquo;t'}: ${title}</b> ${text}</p></div>`;
    const rules = `<section class="br-sec" aria-labelledby="br-rules">
  <div class="br-sec-head"><h2 id="br-rules">Keep it itself</h2></div>
  <div class="br-rules">
    ${rule(true, 'give it room.', 'Leave the width of the ring&rsquo;s stroke clear on every side, and more beside a name.', `<span class="br-room">${art({})}</span>`)}
    ${rule(true, 'use one colour when two won&rsquo;t do.', 'Ink on paper and white on colour are the only other ways to draw it.', `${art({ tone: 'ink' })}`)}
    ${rule(false, 'recolour, rotate or outline it.', 'A violet O or a slanted V is someone else&rsquo;s mark.', `<span class="br-wrong">${art({ tone: { o: C.v, v: C.o } })}</span>`)}
    ${rule(false, 'spin it, or tick it for anything but done.', 'A loading mark bobs and breathes; the tick is the only way it says yes.', `<span class="br-wrong br-wrong--spin">${art({})}</span>`)}
  </div>
</section>`;

    // The motion as files, one card per variant: the intro playing, what it is, and each format as a chip with its size.
    const VARIANTS = [
        { id: '', label: 'The intro', say: 'The ring draws round, the V drops in on a spring, a glint crosses and the glow comes up. About two seconds, once.', stem: 'ov-mark' },
        { id: 'live', label: 'The Live intro', say: 'The same arrival, with Live&rsquo;s record light in the O.', stem: 'ov-mark-live' },
    ];
    const FORMATS = [['intro.webm', 'WebM', '512 px'], ['intro.mp4', 'MP4', '1080 px'], ['intro.gif', 'GIF', '256 px, clear'], ['intro.png', 'APNG', '256 px, clear'], ['poster.png', 'Still', '1024 px PNG']];
    const chip = (file, fmt, dims) => `<li><a class="br-mo-fmt" href="${esc(asset('brand/motion/' + file))}" download="${esc(file)}"><b>${fmt}</b><span>${esc(dims)} &middot; ${esc(humanSize(motionSize(file)))}</span></a></li>`;
    const card = (v) => `<figure class="br-mo-card">
      <div class="br-mo-stage"><video class="br-motion-video" src="${esc(asset(`brand/motion/${v.stem}-intro.webm`))}" poster="${esc(asset(`brand/motion/${v.stem}-poster.png`))}" width="512" height="512" muted loop playsinline autoplay preload="metadata" aria-label="${esc(v.label)}: the OpenVibe mark arriving"></video></div>
      <figcaption><b>${v.label}</b><small>${v.say}</small>
        <ul class="br-mo-fmts">${FORMATS.map(([end, fmt, dims]) => chip(`${v.stem}-${end}`, fmt, dims)).join('')}</ul></figcaption>
    </figure>`;
    const motion = `<section class="br-sec" id="motion" aria-labelledby="br-motion">
  <div class="br-sec-head"><h2 id="br-motion">The motion, as files</h2><p>For a video, a slide or a stream overlay. Each one is rendered from the same ov-mark.js the navbar runs, so what you download is how the mark really moves. On a web page, drop in the live mark instead: it moves, and it keeps still under reduced motion.</p></div>
  <div class="br-mo">${VARIANTS.map(card).join('')}</div>
  <div class="br-mo-use"><h3>The live mark, on any page</h3>${kit.snippet({ code: useLive, id: 'br-motion-live', label: 'Copy the HTML' })}</div>
</section>`;

    const body = `<article class="br">${hero}${moves}${motion}${sizes}${grounds}${names}${colours}${use}${rules}</article>`;
    return layout({
        title: 'The OpenVibe mark',
        description: 'The OpenVibe mark: a ring O and a round V. What each of its moves means, its forms, colours and the names beside it, with the SVG files and the code to use it on any site.',
        path: '/brand',
        active: '/brand',
        styles: ['css/brand.css'],
        scripts: ['js/brand.js'],
        body,
    });
}

/** One of the downloads, as a standalone SVG; null for a name that is not one. */
function file(name) {
    const f = FILES.find((x) => x.name === name);
    return f ? mark.svg({ form: f.form, tone: f.tone, wide: f.wide, title: 'OpenVibe', id: 'ov' }) : null;
}

module.exports = { brandPage, file, FILES, STATES, MOTION, motionSize, humanSize };
