'use strict';
/**
 * /motion: how OpenVibe moves (plan L45). The mark's motion (openvibe-shared 4.65.0) and the network's effects kit
 * (openvibe-shared/ov-fx, 4.66.0) in one place: every effect live, with the line of markup that turns it on; the
 * timing every site shares (the motion tokens) drawn as curves; the rules; and the code to use it anywhere.
 *
 * Server-rendered and whole without JavaScript: the demos are plain markup with data-fx, which the navbar's ov-fx.js
 * brings to life; motion.js only adds the replay, the timing races and the copy buttons' neighbours.
 *
 *   motionPage({ base })   base: this site's origin, for the snippets
 *   EFFECTS                the effects shown, in order: { id, name, says, fx, demo(kind) }
 *   CURVES                 the shared curves: { token, name, bezier, use }
 */
const kit = require('openvibe-shared/kit');
const mark = require('openvibe-shared/mark');
const { layout, esc } = require('../render/layout');

let n = 0;
const art = (o = {}) => mark.svg({ id: `mo${++n}`, title: 'OpenVibe', ...o });
const live = (attrs = '', o = {}) => `<span class="ov-mark" ${attrs}>${art(o)}</span>`;

const EFFECTS = Object.freeze([
    { id: 'glint', name: 'Glint', says: 'A band of light crosses it when you point at it. For the one thing on a page you want found.', fx: 'glint', demo: 'button' },
    { id: 'glow', name: 'Glow', says: 'The accent glows up behind it. For cards and tiles that open something.', fx: 'glow', demo: 'card' },
    { id: 'lift', name: 'Lift', says: 'It rises a little, with a softer shadow, and settles on a spring.', fx: 'lift press', demo: 'card' },
    { id: 'press', name: 'Press', says: 'It gives under your finger and springs back. Every button should.', fx: 'press', demo: 'button' },
    { id: 'ripple', name: 'Ripple', says: 'A ring spreads from the exact point you pressed, in the text colour.', fx: 'ripple press', demo: 'button' },
    { id: 'tilt', name: 'Tilt', says: 'It leans toward the pointer, like a card in the hand. Mouse only.', fx: 'tilt glint', demo: 'poster' },
    { id: 'reveal', name: 'Reveal', says: 'Its items rise in, one after another, the first time they come on screen.', fx: 'reveal', demo: 'list' },
    { id: 'count', name: 'Count', says: 'A number counts up when it is first seen, and ends on exactly its own text.', fx: 'count', demo: 'number' },
    { id: 'confetti', name: 'Confetti', says: 'For real moments only: a first stream, a tip, a goal reached.', fx: 'confetti press', demo: 'cta' },
    { id: 'shimmer', name: 'Shimmer', says: 'A placeholder that breathes until its content lands. Never a spinning ring.', fx: 'shimmer', demo: 'skeleton' },
]);

// The curves every site shares (openvibe-shared/ov-fx's tokens), drawn from their cubic-bezier points.
const CURVES = Object.freeze([
    { token: '--ov-ease-out', name: 'Out', bezier: [0.2, 0.8, 0.2, 1], use: 'Things arriving: a panel opening, a tooltip, a reveal.' },
    { token: '--ov-ease-spring', name: 'Spring', bezier: [0.34, 1.56, 0.64, 1], use: 'Things you touched: a press springing back, a lift, the mark’s V.' },
    { token: '--ov-ease-in-out', name: 'In and out', bezier: [0.65, 0, 0.35, 1], use: 'Things crossing: a glint, a slide from one place to another.' },
]);
const DURATIONS = Object.freeze([
    ['--ov-dur-1', '120 ms', 'a press'], ['--ov-dur-2', '200 ms', 'a hover'], ['--ov-dur-3', '320 ms', 'a panel or a lift'], ['--ov-dur-4', '520 ms', 'a spring settling'],
]);

/** One effect's live demo, as markup a reader could copy. */
function demo(e) {
    const fx = `data-fx="${esc(e.fx)}"`;
    switch (e.demo) {
    case 'button': return `<button type="button" class="mo-btn" ${fx}>${e.id === 'glint' ? 'Go live' : e.id === 'ripple' ? 'Press anywhere on me' : 'Press me'}</button>`;
    case 'card': return `<a class="mo-card" href="#mo-${esc(e.id)}" ${fx}><span class="mo-card-art">${art({})}</span><span><b>Goosely is live</b><small>Geese at dawn · 41 watching</small></span></a>`;
    case 'poster': return `<div class="mo-poster" ${fx} tabindex="0"><span class="mo-poster-art">${art({ tone: 'white' })}</span><b>OpenVibe.Live</b><small>Go live from your browser</small></div>`;
    case 'list': return `<ul class="mo-list" ${fx} data-fx-stagger="70"><li>Live</li><li>Design</li><li>Codes</li><li>Tools</li><li>Games</li></ul>`;
    case 'number': return `<p class="mo-num"><b ${fx}>12,480</b><span>people went live from a browser</span></p>`;
    case 'cta': return `<button type="button" class="mo-btn mo-btn-strong" ${fx}>Send the tip</button>`;
    case 'skeleton': return `<div class="mo-skel" aria-hidden="true"><span ${fx}> </span><span ${fx}> </span><span ${fx}> </span></div>`;
    default: return '';
    }
}

/** A cubic-bezier as an SVG path in a 100 × 100 box (y up), padded so a spring's overshoot shows. */
function curvePath([x1, y1, x2, y2]) {
    const X = (x) => +(x * 100).toFixed(1), Y = (y) => +(100 - y * 100).toFixed(1);
    return `M0 100C${X(x1)} ${Y(y1)} ${X(x2)} ${Y(y2)} 100 0`;
}

function motionPage({ base = 'https://openvibe.design' } = {}) {
    n = 0;
    const hero = `<header class="mo-hero">
  <div class="mo-hero-stage">${live('data-size="260" data-glow data-mo-hero')}<button type="button" class="mo-replay" data-mo-replay hidden>Play it again</button></div>
  <div class="mo-hero-words">
    <p class="mo-eye">Motion</p>
    <h1 class="mo-h1">Motion that means something.</h1>
    <p class="mo-lede">The mark draws its ring, drops its V in on a spring and catches the light once. Everything else on OpenVibe moves the same way: one timing, one set of effects, shared by every site. Nothing spins, nothing loops, and with Calm on, nothing moves at all.</p>
    <div class="mo-acts">${kit.button({ href: '#use', label: 'Use it on your site' })}${kit.button({ href: '/brand', label: 'The mark', kind: 'quiet' })}</div>
  </div>
</header>`;

    const effects = `<section class="mo-sec" aria-labelledby="mo-fx">
  <div class="mo-sec-head"><h2 id="mo-fx">The effects</h2><p>Each one is a word in <code>data-fx</code>, and words combine: <code>data-fx="lift press"</code>. Point at them, press them, scroll to them.</p></div>
  <div class="mo-grid">${EFFECTS.map((e) => `<figure class="mo-fx" id="mo-${esc(e.id)}">
    <div class="mo-fx-stage">${demo(e)}</div>
    <figcaption><b>${esc(e.name)}</b><span>${esc(e.says)}</span><code>data-fx="${esc(e.fx)}"</code></figcaption>
  </figure>`).join('\n  ')}</div>
</section>`;

    const timing = `<section class="mo-sec" aria-labelledby="mo-time">
  <div class="mo-sec-head"><h2 id="mo-time">The timing</h2><p>Three curves and four lengths, as CSS variables on every OpenVibe page. A look can bring its own, and Calm sets every length to zero.</p></div>
  <div class="mo-curves">${CURVES.map((c) => `<div class="mo-curve">
    <svg viewBox="-8 -28 116 136" aria-hidden="true"><path class="mo-curve-grid" d="M0 0H100M0 100H100M0 0V100M100 0V100"/><path class="mo-curve-line" d="${curvePath(c.bezier)}"/></svg>
    <div class="mo-race" data-mo-race style="--mo-ease:var(${esc(c.token)})"><i></i></div>
    <p><b>${esc(c.name)}</b> <code>${esc(c.token)}</code></p>
    <p class="mo-curve-use">${esc(c.use)}</p>
  </div>`).join('')}</div>
  <ul class="mo-durs">${DURATIONS.map(([t, v, use]) => `<li><code>${esc(t)}</code><span class="mo-dur-bar" style="--w:${parseInt(v, 10) / 5.2}%"></span><b>${esc(v)}</b><small>${esc(use)}</small></li>`).join('')}</ul>
  <button type="button" class="mo-btn" data-mo-run hidden>Race the curves</button>
</section>`;

    const rule = (title, text) => `<div class="mo-rule"><b>${title}</b><p>${text}</p></div>`;
    const rules = `<section class="mo-sec" aria-labelledby="mo-rules">
  <div class="mo-sec-head"><h2 id="mo-rules">The rules</h2><p>So that motion stays a signal, never noise.</p></div>
  <div class="mo-rules">
    ${rule('It means something.', 'Every move says one thing: this is new, this worked, this is yours to press. A move that says nothing is cut.')}
    ${rule('Nothing spins.', 'A wait is a shimmer, a bob or a ring drawing round, never a circle chasing its tail.')}
    ${rule('Once, then still.', 'Effects play on a hover, a press or the first time something is seen, then rest. Nothing runs on its own, and nothing moves off screen.')}
    ${rule('Calm wins.', 'With reduced motion or Calm on, nothing moves, nothing counts and no confetti falls. The page looks the same, only still.')}
    ${rule('Never hide to animate.', 'What is on screen when the page opens is never hidden for an entrance. Only what is further down rises in.')}
    ${rule('One kit.', 'Every site uses the same effects and the same timing, so the network feels like one place.')}
  </div>
</section>`;

    const useHtml = `<script src="${base}/shared/ov-fx.js" defer></script>

<a class="card" data-fx="lift press glow">…</a>
<b data-fx="count">12,480</b>
<button data-fx="confetti press">Send the tip</button>`;
    const useJs = `// From script, for a moment of your own:
OVFx.confetti({ x: 200, y: 120 });

// Markup added later is wired by itself; or ask for it:
OVFx.scan(document.querySelector('#feed'));`;
    const useCss = `.panel {
  transition: transform var(--ov-dur-3) var(--ov-ease-spring),
              opacity var(--ov-dur-2) var(--ov-ease-out);
}`;
    const use = `<section class="mo-sec" id="use" aria-labelledby="mo-use">
  <div class="mo-sec-head"><h2 id="mo-use">Use it</h2><p>On OpenVibe sites the navbar loads the kit by itself, only on a page that asks with <code>data-fx</code>. Anywhere else, one script tag. Open source (MIT).</p></div>
  <div class="mo-use">
    <div><h3>On a web page</h3>${kit.snippet({ code: useHtml, id: 'mo-use-web', label: 'Copy the HTML' })}</div>
    <div><h3>From script</h3>${kit.snippet({ code: useJs, id: 'mo-use-js', label: 'Copy the code' })}</div>
    <div><h3>The timing in your own CSS</h3>${kit.snippet({ code: useCss, id: 'mo-use-css', label: 'Copy the CSS' })}</div>
  </div>
</section>`;

    const body = `<article class="mo">${hero}${effects}${timing}${rules}${use}</article>`;
    return layout({
        title: 'Motion',
        description: 'How OpenVibe moves: the mark’s motion and one shared kit of effects (glint, glow, lift, press, ripple, tilt, reveal, count, confetti), the timing every site shares, the rules, and the code to use it anywhere.',
        path: '/motion',
        active: '/motion',
        styles: ['css/motion.css'],
        scripts: ['js/motion.js'],
        body,
    });
}

module.exports = { motionPage, EFFECTS, CURVES, curvePath };
