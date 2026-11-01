'use strict';
/**
 * /loading: how OpenVibe waits (plan L52 step 5; the owner, 11-01: "async loading… placeholder elements while it loads,
 * a fake thumbnail… so it is not jarring… the logo icon changing while it loads, a custom indicator… part of
 * openvibe.design… the whole package"). Every part live and copyable, from openvibe-shared:
 *   - placeholders shaped like the content (kit.skeleton), each with "Fill in", which swaps it for real content of the
 *     same shape and measures how far the page moved (it should be 0 px);
 *   - the mark at work (OpenVibeLoading: steps, slow, fail, done);
 *   - the navigation indicator (OpenVibeNavbar.busy), on this page's own navbar;
 *   - the rules.
 * Server-rendered: the placeholders are in the first HTML, as they should be anywhere. js/loading-page.js runs the demos.
 *
 *   loadingPage({ base })
 */
const kit = require('openvibe-shared/kit');
const { layout, esc } = require('../render/layout');

// Real content of each placeholder's shape, at its sizes (kit.css .ovk-skel-*), so filling in moves nothing.
const FILLED = {
    card: (i) => `<div class="ovk-skel-card ld-real"><span class="ld-thumb" style="--h:${[212, 268, 32][i % 3]}"></span><span class="ld-l1">${['Building a rocket from scratch', 'Late night chill and chat', 'Speedrun practice'][i % 3]}</span><span class="ld-l2">${['iZoR_One · 1.2k watching', 'mia · 340 watching', 'kai · 88 watching'][i % 3]}</span></div>`,
    row: (i) => `<div class="ovk-skel-row ld-real"><span class="ld-avatar" style="--h:${[212, 32, 150][i % 3]}">${['A', 'M', 'K'][i % 3]}</span><span class="ovk-skel-lines"><span class="ld-l1">${['Ana', 'Mia', 'Kai'][i % 3]}</span><span class="ld-l2">${['Live now · Just chatting', 'Offline · 2h ago', 'Live now · Games'][i % 3]}</span></span></div>`,
    tile: (i) => `<span class="ld-tile" style="--h:${(i * 47 + 190) % 360}"></span>`,
    chip: (i) => `<span class="ld-chip">${['Music', 'Games', 'Art', 'Talk', 'Code', 'IRL'][i % 6]}</span>`,
    line: (i) => `<span class="ld-line">${['The first line of a paragraph that arrives a moment later.', 'And another, a little shorter.', 'A third, the shortest.'][i % 3]}</span>`,
    chat: (i) => `<div class="ovk-skel-chat ld-real"><span class="ld-dot" style="--h:${[150, 32, 270][i % 3]}"></span><span class="ld-l1"><b>${['mia', 'kai', 'ana'][i % 3]}</b> ${['that was so clean', 'lol same', 'welcome back!'][i % 3]}</span></div>`,
    stat: (i) => `<div class="ovk-skel-stat ld-real"><span class="ld-num">${['1,284', '96%', '12h'][i % 3]}</span><span class="ld-l2">${['viewers today', 'went smoothly', 'streamed this week'][i % 3]}</span></div>`,
};
const SHAPES = [
    ['card', 'Card', 'A video or stream: its 16:9 picture and two lines.', 3],
    ['row', 'Row', 'A person or a result: an avatar and two lines.', 3],
    ['tile', 'Tile', 'A square in a grid: an emote, an icon, a cover.', 6],
    ['chip', 'Chip', 'A tag or a filter.', 6],
    ['line', 'Line', 'Text that is on its way.', 3],
    ['chat', 'Chat', 'A chat message: a dot and a line.', 3],
    ['stat', 'Stat', 'A number and what it counts.', 3],
];

function loadingPage({ base = 'https://openvibe.design' } = {}) {
    const demo = ([kind, name, says, n]) => `<li class="ld-demo" data-ld-kind="${kind}">
  <div class="ld-demo-head"><b>${esc(name)}</b><button type="button" class="ld-fill" data-ld-fill aria-pressed="false">Fill in</button></div>
  <p>${esc(says)}</p>
  <div class="ld-stage" data-ld-stage>${kit.skeleton({ kind, count: n, label: `Loading ${name.toLowerCase()}s` })}</div>
  <template data-ld-real><div class="ovk-skels ovk-skels-${kind}">${Array.from({ length: n }, (_, i) => FILLED[kind](i)).join('')}</div></template>
  <div class="ld-foot"><code>kit.skeleton({ kind: '${kind}', count: ${n} })</code><output data-ld-moved aria-live="polite"></output></div>
</li>`;

    const RULES = [
        ['The page arrives drawn.', 'Server-rendered HTML with its icons already drawn (no icon font to wait for), and only the CSS the first screen needs before it paints.'],
        ['A list shows its shape at once.', 'Its placeholders are in the first HTML, the same size as what replaces them, so filling in moves nothing (each demo above measures it).'],
        ['A picture sits on its own colour first.', 'Its dominant colour, or a tiny blurred copy, until it arrives. The first picture asks for itself first (fetchpriority="high"); the rest wait until they are near (loading="lazy").'],
        ['Moving between pages feels like one app.', 'The mark works in the navbar with a two-pixel line under it. Links are fetched when pointed at (speculation rules), and the navbar and app bar stay still while the page cross-fades (view transitions).'],
        ['Nothing spins.', 'The mark bobs and breathes, a line fills. Calm and reduced motion keep everything still.'],
        ['Slow says so.', 'After a few seconds a load explains itself and offers what to do. A failure says what happened and offers Retry, never an endless wait.'],
        ['Off screen costs nothing.', 'Long lists skip the work for what is not on screen yet (content-visibility: auto).'],
    ];

    const body = `<article class="ld">
<header class="ld-hero">
  <p class="ld-eye">Loading</p>
  <h1 class="ld-h1">Nothing spins. Everything has its shape.</h1>
  <p class="ld-lede">How OpenVibe waits: the page arrives drawn, a list shows its own shape until it fills in, the mark works while a page moves, and a slow load says so. The same parts on every site, from <code>openvibe-shared</code>.</p>
  <nav class="ld-jump" aria-label="On this page"><a href="#shapes">Placeholders</a><a href="#mark">The mark at work</a><a href="#nav">Between pages</a><a href="#rules">The rules</a><a href="#use">Use it</a></nav>
</header>

<section class="ld-sec" id="shapes" aria-labelledby="ld-shapes">
  <div class="ld-sec-head"><h2 id="ld-shapes">Placeholders shaped like the content</h2><p>Seven shapes cover the network&rsquo;s lists. Press <b>Fill in</b>: the real content takes the placeholder&rsquo;s place, and the page says how far everything below it moved.</p></div>
  <ul class="ld-demos">${SHAPES.map(demo).join('')}</ul>
</section>

<section class="ld-sec" id="mark" aria-labelledby="ld-mark">
  <div class="ld-sec-head"><h2 id="ld-mark">The mark at work</h2><p>For a stream or a player that takes a moment: its own picture blurred behind, the V bobbing and the O breathing, one word of status and a line that fills with each step. Slow, it explains; failed, it says what happened.</p></div>
  <div class="ld-mark">
    <div class="ld-screen" data-ld-screen><span class="ld-screen-idle">Press Start</span></div>
    <div class="ld-ctrls" role="group" aria-label="The loader">
      <button type="button" class="ic-btn is-go" data-ld-do="start">Start</button>
      <button type="button" class="ic-btn" data-ld-do="step">Next step</button>
      <button type="button" class="ic-btn" data-ld-do="slow">It is slow</button>
      <button type="button" class="ic-btn" data-ld-do="fail">It failed</button>
      <button type="button" class="ic-btn" data-ld-do="done">Done</button>
    </div>
  </div>
  ${kit.snippet({ code: `const l = OpenVibeLoading.mount(player, { poster, label: 'Connecting', sub: 'Getting your viewer ready', steps: 4 });\nl.update({ step: 1, label: 'Joining' });\nl.slow({ hint: 'Still connecting', actions: [{ label: 'Try again', onClick: retry }] });\nl.fail({ title: 'The stream ended', actions: [{ label: 'Retry', onClick: retry }] });\nl.done();`, id: 'ld-mark-code', label: 'Copy' })}
</section>

<section class="ld-sec" id="nav" aria-labelledby="ld-nav">
  <div class="ld-sec-head"><h2 id="ld-nav">Between pages</h2><p>While a page or a route loads, the mark in the navbar works and a two-pixel line runs under it; it settles when the page is in. boost.js and the route loaders call it for you; anything else can too.</p></div>
  <div class="ld-navdemo"><button type="button" class="ic-btn is-go" data-ld-busy>Show it on this navbar</button><span data-ld-busy-note>Look at the mark, top left.</span></div>
  ${kit.snippet({ code: 'OpenVibeNavbar.busy(true);   // the mark works, the line runs\n// …the page or route arrives…\nOpenVibeNavbar.busy(false);', id: 'ld-nav-code', label: 'Copy' })}
</section>

<section class="ld-sec" id="rules" aria-labelledby="ld-rules">
  <div class="ld-sec-head"><h2 id="ld-rules">The rules</h2><p>What every OpenVibe site does while you wait. Live&rsquo;s measurements are in <a href="https://openvibe.live/docs/performance-audit">its performance audit</a>.</p></div>
  <ol class="ld-rules">${RULES.map(([h, p]) => `<li><b>${esc(h)}</b> ${esc(p)}</li>`).join('')}</ol>
</section>

<section class="ld-sec" id="use" aria-labelledby="ld-use">
  <div class="ld-sec-head"><h2 id="ld-use">Use it</h2><p>On an OpenVibe site the navbar brings all of it. Anywhere else, the files are free (MIT).</p></div>
  <div class="ld-use">
    <div><h3>Placeholders, on the server</h3>${kit.snippet({ code: "const kit = require('openvibe-shared/kit');\nkit.skeleton({ kind: 'card', count: 6, label: 'Loading streams' });\n// card · row · tile · chip · line · chat · stat", id: 'ld-use-skel', label: 'Copy' })}</div>
    <div><h3>The loader, in a page</h3>${kit.snippet({ code: `<link rel="stylesheet" href="${base}/shared/kit.css">\n<script src="${base}/shared/loading.js" defer></script>`, id: 'ld-use-load', label: 'Copy' })}</div>
    <div><h3>App-like page moves</h3>${kit.snippet({ code: `<script src="${base}/shared/boost.js" defer></script>\n<meta name="ov-boost" content="mysite@1">`, id: 'ld-use-boost', label: 'Copy' })}</div>
  </div>
</section>
</article>`;
    return layout({
        title: 'Loading: nothing spins',
        description: 'How OpenVibe waits: placeholders shaped like the content, the mark at work instead of a spinner, the navbar while a page moves, and the rules. Live demos and the code, free.',
        path: '/loading', active: '/loading', styles: ['css/icons.css', 'css/loading.css'], scripts: ['js/loading-page.js'], shared: ['loading.js'], body,
    });
}

module.exports = { loadingPage, SHAPES };
