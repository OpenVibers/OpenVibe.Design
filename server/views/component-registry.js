'use strict';

const kit = require('openvibe-shared/kit');
const thread = require('openvibe-shared/thread');
const { COMPONENTS, get } = require('../components/registry');
const { layout, esc } = require('../render/layout');

const link = (name) => `/components/${name}`;
const demo = {
    navbar: () => `<nav class="cr-mini-nav" aria-label="Demo navigation"><a href="/">${kit.icon('home')} OpenVibe</a><a href="/studio">Studio</a><details><summary>More</summary><a href="/look">Your look</a><a href="/components">Components</a></details></nav>`,
    menu: () => `<details class="cr-menu"><summary class="ovk-btn ovk-btn--quiet">${kit.icon('menu')} Open menu</summary>${kit.row({ href: '/look', title: 'You', sub: 'Your look and settings', mark: kit.mark({ name: 'You' }) })}${kit.row({ href: '/studio', title: 'Studio', sub: 'Choose a theme', mark: kit.mark({ name: 'Studio' }) })}</details>`,
    'you-home': () => kit.section({ title: 'You', note: 'Your places in one menu', body: kit.list([kit.row({ href: '/look', title: 'Your look', sub: 'Theme and comfort settings', mark: kit.mark({ name: 'You' }) }), kit.row({ href: '/studio', title: 'Theme studio', sub: 'Make it yours', mark: kit.mark({ name: 'Studio' }) })]) }),
    dock: () => kit.dock({ action: '#', id: 'cr-dock', label: 'Message', placeholder: 'Write a message' }),
    'dock-tabs': () => `<nav class="cr-dock-tabs" aria-label="Demo app tabs"><a href="/">${kit.icon('home')} Home</a><a href="/studio" aria-current="page">${kit.icon('palette')} Studio</a><a href="/look">${kit.icon('user')} You</a></nav>`,
    'thread-composer': () => thread.composer({ action: '#', method: 'get', placeholder: 'Ask anything', tools: kit.sheetButton({ sheet: 'cr-options', label: 'Options', icon: 'more', iconOnly: false }), attach: { name: 'files' }, id: 'cr-composer' }) + kit.sheet({ id: 'cr-options', title: 'Options', body: kit.seg({ name: 'cr-model', label: 'Model', options: [['auto', 'Auto'], ['fast', 'Fast']], value: 'auto' }) }),
    sheet: () => kit.sheetButton({ sheet: 'cr-sheet', label: 'Open sheet', icon: 'plus', iconOnly: false }) + kit.sheet({ id: 'cr-sheet', title: 'Add a site', body: `<p>Pick a site and theme.</p>${kit.seg({ name: 'cr-theme', label: 'Look', options: [['vibe', 'Vibe'], ['daylight', 'Daylight']], value: 'vibe' })}` }),
    popover: () => kit.more({ label: 'More choices', items: [{ href: '/studio', label: 'Open Studio', icon: 'palette' }, { href: '/look', label: 'Your look', icon: 'user' }] }),
    keyboard: () => `<label class="cr-field">A keyboard-aware field <input type="text" placeholder="Focus this field"></label><p class="ds-fine">Tab moves forward; Escape closes a menu or sheet and returns focus.</p>`,
    'kit-row': () => kit.list([kit.row({ href: '/studio', title: 'OpenVibe.Design', sub: 'Make it yours', mark: kit.mark({ name: 'Design', square: true }), meta: 'Now' })]),
    'kit-card': () => kit.card({ href: '/studio', title: 'Make it yours', type: 'post', sub: 'Your theme everywhere', badge: 'DESIGN' }),
    'kit-section': () => kit.section({ title: 'Your places', note: 'A named group of related actions.', body: kit.row({ href: '/look', title: 'Your look', sub: 'Theme and comfort settings' }) }),
    'empty-state': () => kit.empty({ title: 'No sites yet', text: 'Add a site to give it a look of its own.', action: { href: '/look', label: 'Add a site' }, icon: 'plus' }),
    'switch-row': () => kit.switchRow({ name: 'cr-contrast', label: 'More contrast', hint: 'Text and borders stand out more.', on: false }),
    'segmented-control': () => kit.seg({ name: 'cr-scheme', label: 'Light or dark', options: [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']], value: 'auto' }),
    'upload-progress': () => `<div class="cr-upload"><span>${kit.icon('file')}<b>photo.jpg</b><small id="cr-upload-state">45% uploaded</small></span><progress value="45" max="100" aria-label="photo.jpg upload progress">45%</progress><button type="button" class="ovk-btn ovk-btn--quiet" id="cr-upload-cancel">Cancel</button></div>`,
    'ai-choice': () => `<button type="button" class="ov-ai-choice" data-ovk-sheet="#cr-model-sheet">${kit.icon('spark')}<span>Auto</span>${kit.icon('chevron')}</button>` + kit.sheet({ id: 'cr-model-sheet', title: 'Choose a model', body: kit.seg({ name: 'cr-model-choice', label: 'Model', options: [['auto', 'Auto'], ['fast', 'Fast']], value: 'auto' }) }),
    'motion-tokens': () => `<button type="button" class="ovk-btn ovk-btn--quiet" data-cr-play="tokens">${kit.icon('play')} Play the four timings</button><div class="cr-motion-samples" aria-hidden="true"><i data-cr-bar="1"></i><i data-cr-bar="2"></i><i data-cr-bar="3"></i><i data-cr-bar="4"></i></div>`,
    'pop-motion': () => `<button type="button" class="ovk-btn ovk-btn--quiet" data-cr-play="pop">${kit.icon('play')} Play pop</button><span class="cr-animated cr-pop">${kit.icon('star')}</span>`,
    'sheet-motion': () => `<button type="button" class="ovk-btn ovk-btn--quiet" data-cr-play="sheet">${kit.icon('play')} Play sheet</button><span class="cr-animated cr-slide">Sheet</span>`,
    'menu-motion': () => `<button type="button" class="ovk-btn ovk-btn--quiet" data-cr-play="menu">${kit.icon('play')} Play menu</button><span class="cr-animated cr-reveal">Menu</span>`,
};

function registryLinks() {
    return `<nav class="cr-index" aria-label="Component definitions">${COMPONENTS.map((c) => `<a href="${link(c.name)}">${esc(c.title)}</a>`).join('')}</nav>`;
}

const GROUPS = [
    ['Navigation', ['navbar', 'menu', 'you-home', 'dock', 'dock-tabs']],
    ['Writing and choosing', ['thread-composer', 'sheet', 'popover', 'keyboard']],
    ['Content', ['kit-row', 'kit-card', 'kit-section', 'empty-state']],
    ['Settings', ['switch-row', 'segmented-control']],
    ['Files and AI', ['upload-progress', 'ai-choice']],
    ['Motion', ['motion-tokens', 'pop-motion', 'sheet-motion', 'menu-motion']],
];

/** /components/registry: the whole vocabulary in one crawlable page, with each definition's own page and JSON. */
function registryPage() {
    const cards = (names) => names.map((name) => {
        const c = get(name);
        const platforms = ['web', 'android', 'ios'].map((p) => `<span>${p === 'web' ? 'Web' : p === 'android' ? 'Android' : 'iOS'}</span>`).join('');
        return `<li class="cr-card"><a class="cr-card-link" href="${link(name)}"><b>${esc(c.title)}</b><span>${esc(c.summary)}</span></a><div class="cr-card-meta"><span class="cr-card-platforms">${platforms}</span><a href="/api/v1/components/${esc(name)}" aria-label="${esc(c.title)} as JSON">JSON</a></div></li>`;
    }).join('');
    const sections = GROUPS.map(([title, names]) => `<section class="cr-group"><h2>${esc(title)}</h2><ul class="cr-cards">${cards(names)}</ul></section>`).join('');
    const body = `<header class="ds-page-h"><p class="ds-kicker">Component registry</p><h1>One vocabulary, three platforms</h1><p class="ds-lede">Every shared OpenVibe interface as one definition: its anatomy, props, states, tokens, keyboard and dismissal rules, accessibility, and how it is built on the web, in Jetpack Compose and in SwiftUI. The same definitions are the vocabulary Design and Space give their AI generators.</p>
<p class="cr-links"><a href="/api/v1/components">All definitions as JSON</a> · <a href="/llms.txt">llms.txt</a> · <a href="/api/v1/components/sheet">Example: sheet</a></p></header>
${sections}
<p class="ds-fine">A definition is a promise about behaviour, not a screenshot: the live demo on each page is the web implementation, and the Android and iOS sections name the container role and the interaction each platform owns.</p>`;
    return layout({ title: 'Component registry: OpenVibe design system', description: 'Platform-neutral definitions of the OpenVibe navbar, menu, You home, Dock and tabs, thread composer, sheets, pop-overs, keyboard behaviour, kit rows, cards, sections, empty states, switches, segmented controls, uploads, the model chip and motion: web, Android and iOS.', path: '/components/registry', body: `<div class="ds-wrap tk cr">${body}</div>`, active: '/components', styles: ['css/component-registry.css'] });
}

function componentPage(name) {
    const c = get(name);
    if (!c) return null;
    const anatomy = c.anatomy.map((part) => `<li><b>${esc(part.part)}</b><span>${esc(part.role)}</span></li>`).join('');
    const facts = [
        ['States', c.states.join(' · ')],
        ['Tokens', c.tokens.join(' · ')],
        ['Keyboard', c.behaviors.keyboardAware ? 'Keeps the focused control in view' : 'Standard focus order'],
        ['Outside tap', c.behaviors.outsideTapCloses ? 'Closes the surface' : 'No dismissal'],
        ['Scroll lock', c.behaviors.scrollLock ? 'Locks the page while open' : 'Page remains scrollable'],
        ['Reduced motion', c.behaviors.reducedMotion],
        ['Accessibility', `${c.accessibility.name}. ${c.accessibility.focus}. ${c.accessibility.target}.`],
    ];
    const details = `<dl class="cr-facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
    const native = (platform) => `<section class="cr-native"><h3>${platform === 'android' ? 'Android · Jetpack Compose' : 'iOS · SwiftUI'}</h3><p>${esc(platform === 'android' ? c.platforms.android.specification : c.platforms.ios.specification)}</p>${platform === 'android' ? `<p>Material 3 container: <code>${esc(c.platforms.android.material3)}</code></p>` : ''}</section>`;
    const body = `<header class="ds-page-h"><p class="ds-kicker">Component registry</p><h1>${esc(c.title)}</h1><p class="ds-lede">${esc(c.summary)}</p><p><a href="/components/registry">All components</a> · <a href="/components">Kit documents</a> · <a href="/api/v1/components/${esc(c.name)}">Definition as JSON</a></p></header>
<div class="cr-layout"><section><h2>Live web demo</h2><div class="cr-demo cr-demo--${esc(c.name)}" data-ov-component="${esc(c.name)}">${demo[c.name]()}</div><p class="ds-fine">Web source: <code>${esc(c.platforms.web.module)}</code> · ${esc(c.platforms.web.markup)}</p></section>
<section><h2>Anatomy</h2><ul class="cr-anatomy">${anatomy}</ul><h2>Props</h2><dl class="cr-props">${Object.entries(c.props).map(([key, type]) => `<div><dt><code>${esc(key)}</code></dt><dd>${esc(type)}</dd></div>`).join('')}</dl></section></div>
<section><h2>Behavior and accessibility</h2>${details}</section>
<div class="cr-layout">${native('android')}${native('ios')}</div>
<section><h2>Example definition</h2>${kit.snippet({ code: JSON.stringify({ schema: c.schema, name: c.name, props: c.examples[0].props }, null, 2), id: 'cr-example' })}</section>
<h2>Other components</h2>${registryLinks()}`;
    return layout({ title: `${c.title}: OpenVibe component`, description: c.summary, path: link(c.name), body: `<div class="ds-wrap tk cr">${body}</div>`, active: '/components', styles: ['css/component-registry.css'], scripts: ['js/component-registry.js'], sharedStyles: c.name === 'thread-composer' ? ['thread.css'] : [], shared: c.name === 'thread-composer' ? ['ov-thread.js'] : [] });
}

module.exports = { componentPage, registryPage, registryLinks };
