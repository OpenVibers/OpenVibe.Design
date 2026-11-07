'use strict';
/**
 * /native: from the web to Android and iOS, without a frame (the owner, 2026-11-07: "make sure OpenVibe.design
 * supports Android and iOS apps … seamless"; 10-29: real apps, not web views). One page that ties the system
 * together: one screen at three sizes, the four layers every platform shares (tokens, components, patterns, icons),
 * the size classes, what each platform does its own way, the road from here, and a checklist for a page that is
 * about to become an app screen.
 *
 * Server-rendered, no script: the three frames are markup and CSS (public/css/native.css).
 *
 *   nativePage()
 *   LAYERS, CLASSES, PLATFORM, ROAD, CHECKLIST   the content, so tests and the Markdown twin read the same words
 */
const { layout, esc } = require('../render/layout');

const LAYERS = Object.freeze([
    { name: 'Tokens', href: '/tokens', what: 'Colour, type, space, radius and motion as data (DTCG JSON). Android gets a Compose theme, iOS gets OvTokens and OvScale, the web gets CSS variables: one source, three files.' },
    { name: 'Components', href: '/components', what: 'Each part described by what it is: its pieces, the tokens they wear, its states and how a screen reader hears it, with code for the web, Jetpack Compose and SwiftUI.' },
    { name: 'Patterns', href: '/patterns', what: 'The rules production taught, each with the bug behind it, a live demo, and SwiftUI and Compose specs generated from the same tokens.' },
    { name: 'Icons', href: '/icons', what: 'One glyph set for every platform: SVG and a font for the web, vector drawables for Android, PDF vectors for iOS, the same names everywhere.' },
]);

const CLASSES = Object.freeze([
    { name: 'Compact', width: 'under 600 px', nav: 'A bottom tab bar, five places at most', add: 'A floating New over a sheet', detail: 'Full screen; Back returns to the list' },
    { name: 'Medium', width: '600 to 839 px', nav: 'A navigation rail of icons', add: 'New at the top of the rail', detail: 'Side by side from 720 px' },
    { name: 'Expanded', width: '840 px and wider', nav: 'A sidebar with words', add: 'New at the top of the sidebar', detail: 'The list and the open item together' },
]);

const PLATFORM = Object.freeze([
    ['Back', 'Closes the top sheet or menu first, then leaves the screen. Android’s predictive back shows where it goes; on iOS a sheet swipes down and the edge swipe goes back; on the web, Back closes the menu before it leaves the page.'],
    ['Safe areas', 'Nothing sits under the notch, the home indicator or a system bar: bars pad themselves by the insets, content scrolls under them.'],
    ['Text size', 'Dynamic Type and Android font scale up to 200%. Rows wrap and grow; nothing clips or truncates a name to an ellipsis it did not need.'],
    ['Motion', 'Durations from the motion tokens (180, 260, 360 ms); reduced motion removes entrances and keeps state changes as instant swaps.'],
    ['Touch', 'Every target is 44 px (48 dp on Android). A press becomes a drag only after 6 px.'],
    ['Haptics', 'A light tap when something is confirmed or sent (apps only); never for scrolling or ambient changes.'],
    ['Your look', 'The theme you wear on openvibe.design reaches apps through the same tokens (GET /api/me/theme), so the app looks like your sites.'],
    ['Notifications', 'Web push on the web; FCM on Android and APNs on iOS through OpenVibe.Network, with the same quiet hours and the same Do not disturb.'],
]);

const ROAD = Object.freeze([
    { step: 'Phones first on the web', state: 'now', text: 'Every site at 390 px: no sideways scroll, 44 px targets, sheets instead of popovers, Back that closes them. Measured site by site.' },
    { step: 'Install from the browser', state: 'next', text: 'A manifest and an offline shell for each site people use daily, so it opens like an app and the last screen shows without a network.' },
    { step: 'Android', state: 'planned', text: 'A Compose shell. Native screens first where the web cannot reach: messages, the Live player, the camera, and Link’s phone automation (accessibility). Other screens render kit documents with native views. A direct APK first; Google Play when the account is opened.' },
    { step: 'iOS', state: 'planned', text: 'A SwiftUI shell with the same screens and the same documents. The App Store when the account is opened.' },
    { step: 'Desktop', state: 'planned', text: 'The OpenVibe app: Codes and Link in one native shell, with your machines, your agent and your files.' },
]);

const CHECKLIST = Object.freeze([
    'It is made of kit components, not one-off markup, so each part has a native twin.',
    'Every colour, size and duration is a token; no literal hex in a rule.',
    'At 390 px nothing scrolls sideways and nothing is hidden to make it fit.',
    'Adding is one button; its choices are in a sheet.',
    'Back closes what is open before it leaves.',
    'It reads well at 200% text.',
    'It works with reduced motion, and with JavaScript off on the web.',
    'Its data comes from a documented API, so an app can ask for the same thing.',
]);

/** One screen, drawn at three sizes: the same parts, a different arrangement. Markup only. */
function frames() {
    const rows = (n) => Array.from({ length: n }, (_, i) => `<span class="nv-row"><i></i><b style="--w:${60 + ((i * 17) % 30)}%"></b></span>`).join('');
    const tiles = (n) => Array.from({ length: n }, () => '<span class="nv-tile"><i></i><b></b></span>').join('');
    return `<div class="nv-frames" role="img" aria-label="The same files screen on a phone, a tablet and a computer: bottom tabs and a floating New on the phone, a rail on the tablet, a sidebar with the open item beside the list on the computer">
<figure class="nv-frame nv-compact"><div class="nv-screen"><span class="nv-top"><b>My files</b></span><div class="nv-list">${rows(6)}</div><span class="nv-fab">+ New</span><span class="nv-tabs"><i></i><i class="on"></i><i></i><i></i></span></div><figcaption><b>Compact</b> a phone</figcaption></figure>
<figure class="nv-frame nv-medium"><div class="nv-screen"><span class="nv-rail"><i class="nv-new"></i><i class="on"></i><i></i><i></i><i></i></span><div class="nv-main"><span class="nv-top"><b>My files</b></span><div class="nv-grid">${tiles(6)}</div></div></div><figcaption><b>Medium</b> a tablet or a fold</figcaption></figure>
<figure class="nv-frame nv-expanded"><div class="nv-screen"><span class="nv-side"><span class="nv-new-w">+ New</span><span class="on">My files</span><span>Shared</span><span>Backups</span></span><div class="nv-main"><span class="nv-top"><b>My files</b></span><div class="nv-grid">${tiles(8)}</div></div><span class="nv-detail"><i></i><b></b><b></b><span class="nv-btn"></span></span></div><figcaption><b>Expanded</b> a computer</figcaption></figure>
</div>`;
}

function nativePage() {
    const body = `<header class="ds-page-h"><p class="ds-kicker">Apps</p><h1>From the web to Android and iOS, without a frame</h1>
<p class="ds-lede">An OpenVibe app is never a web page in a frame. Every platform draws the same parts with its own views: the tokens, the components, the patterns and the icons on this site. The web stays the source of truth, and an app follows it screen by screen.</p></header>
<section class="nv-sec" aria-labelledby="nv-one"><h2 id="nv-one">One screen, three sizes</h2>
<p class="ds-lede">Not three designs: one set of parts, arranged by how much room there is.</p>
${frames()}</section>
<section class="nv-sec" aria-labelledby="nv-layers"><h2 id="nv-layers">Four layers every platform shares</h2>
<div class="nv-layers">${LAYERS.map((l, i) => `<a class="nv-layer" href="${esc(l.href)}"><span class="nv-n">${i + 1}</span><b>${esc(l.name)}</b><span>${esc(l.what)}</span></a>`).join('')}</div></section>
<section class="nv-sec" aria-labelledby="nv-classes"><h2 id="nv-classes">Size classes</h2>
<p class="ds-lede">The platforms’ own window classes. The web’s bar folds at 760 px today; apps follow these.</p>
<div class="nv-table" role="table" aria-label="Size classes">
<div class="nv-tr nv-th" role="row"><span role="columnheader">Class</span><span role="columnheader">Width</span><span role="columnheader">Places</span><span role="columnheader">Adding</span><span role="columnheader">An open item</span></div>
${CLASSES.map((c) => `<div class="nv-tr" role="row"><span role="cell"><b>${esc(c.name)}</b></span><span role="cell" data-label="Width">${esc(c.width)}</span><span role="cell" data-label="Places">${esc(c.nav)}</span><span role="cell" data-label="Adding">${esc(c.add)}</span><span role="cell" data-label="An open item">${esc(c.detail)}</span></div>`).join('')}
</div></section>
<section class="nv-sec" aria-labelledby="nv-platform"><h2 id="nv-platform">What each platform does its own way</h2>
<dl class="nv-dl">${PLATFORM.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>
<section class="nv-sec" aria-labelledby="nv-road"><h2 id="nv-road">The road from here</h2>
<ol class="nv-road">${ROAD.map((r) => `<li data-state="${esc(r.state)}"><span class="nv-state">${esc(r.state === 'now' ? 'Now' : r.state === 'next' ? 'Next' : 'Planned')}</span><b>${esc(r.step)}</b><p>${esc(r.text)}</p></li>`).join('')}</ol></section>
<section class="nv-sec" aria-labelledby="nv-screens"><h2 id="nv-screens">A screen as data</h2>
<p class="ds-lede">A screen can travel as a tree of kit components. The web draws it with the kit; an app draws the same tree with Compose or SwiftUI, so a new screen reaches every platform without a release.</p>
<pre class="nv-code"><code>{ "type": "rail", "title": "Trending",
  "children": [
    { "type": "card", "title": "A rainy night walk", "meta": "23 views this week", "href": "https://openvibe.video/v/6119" }
  ] }</code></pre></section>
<section class="nv-sec" aria-labelledby="nv-check"><h2 id="nv-check">Ready to become an app screen?</h2>
<ul class="nv-check">${CHECKLIST.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
<p class="nv-more"><a href="/components?p=android">Components for Android</a> · <a href="/components?p=ios">Components for iOS</a> · <a href="/tokens">Tokens</a> · <a href="/patterns">Patterns</a></p></section>`;
    return layout({
        title: 'Apps for Android and iOS: the OpenVibe design system, natively',
        description: 'How an OpenVibe page becomes a real Android or iOS screen: one set of tokens, components, patterns and icons, three size classes, what each platform does its own way, and the road from the web to apps.',
        path: '/native',
        active: '/native',
        styles: ['css/native.css'],
        body: `<div class="ds-wrap nv">${body}</div>`,
    });
}

module.exports = { nativePage, LAYERS, CLASSES, PLATFORM, ROAD, CHECKLIST };
