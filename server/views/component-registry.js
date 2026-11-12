'use strict';

const kit = require('openvibe-shared/kit');
const thread = require('openvibe-shared/thread');
const { COMPONENTS, get } = require('../components/registry');
const { layout, esc } = require('../render/layout');
const { shippedSection, specimen, list: noteList } = require('./component-notes');

const link = (name) => `/components/${name}`;
// A live demo built from openvibe-shared's own files loads them, as a site does.
const PAGE_EXTRA = {
    'thread-composer': { shared: ['ov-thread.js'], sharedStyles: ['thread.css'] },
    'search-field': { shared: ['ov-searchbox.js'] },
    'form-controls': { sharedStyles: ['ov-forms.css'] },
    chat: { shared: ['messages.js', 'ov-composer.js'], sharedStyles: ['messages.css'], scripts: ['js/component-chat.js'] },
};
const demo = {
    navbar: () => `<nav class="cr-mini-nav" aria-label="Demo navigation"><a href="/">${kit.icon('home')} OpenVibe</a><a href="/themes">Themes</a><details><summary>More</summary><a href="/look">Your look</a><a href="/components">Components</a></details></nav>`,
    menu: () => specimen('menu'),
    'you-home': () => kit.section({ title: 'You', note: 'Your places in one menu', body: kit.list([kit.row({ href: '/look', title: 'Your look', sub: 'Theme and comfort settings', mark: kit.mark({ name: 'You' }) }), kit.row({ href: '/themes', title: 'Theme studio', sub: 'Make it yours', mark: kit.mark({ name: 'Studio' }) })]) }),
    dock: () => kit.dock({ action: '#', id: 'cr-dock', label: 'Message', placeholder: 'Write a message' }),
    'dock-tabs': () => `<nav class="cr-dock-tabs" aria-label="Demo app tabs"><a href="/">${kit.icon('home')} Home</a><a href="/themes" aria-current="page">${kit.icon('palette')} Studio</a><a href="/look">${kit.icon('user')} You</a></nav>`,
    // Every control as the sites draw it (openvibe-shared/ov-forms.css): press, hover and tab through them.
    'form-controls': () => `<div class="cr-controls" style="display:grid;gap:14px;max-width:560px">
<div style="display:flex;flex-wrap:wrap;gap:16px"><label style="display:flex;gap:10px;align-items:center"><input type="checkbox" checked> Checked</label><label style="display:flex;gap:10px;align-items:center"><input type="checkbox"> Off</label><label style="display:flex;gap:10px;align-items:center"><input type="checkbox" disabled checked> Disabled</label></div>
<div style="display:flex;flex-wrap:wrap;gap:16px" role="radiogroup" aria-label="A choice"><label style="display:flex;gap:10px;align-items:center"><input type="radio" name="cr-r" checked> One</label><label style="display:flex;gap:10px;align-items:center"><input type="radio" name="cr-r"> Two</label><label style="display:flex;gap:10px;align-items:center"><input type="radio" name="cr-r" disabled> Three</label></div>
<div style="display:flex;flex-wrap:wrap;gap:16px"><label style="display:flex;gap:10px;align-items:center"><input type="checkbox" role="switch" checked> A switch, on</label><label style="display:flex;gap:10px;align-items:center"><input type="checkbox" role="switch"> Off</label></div>
<label class="ov-field"><span>A field</span><input class="ov-input" placeholder="Type, and see the focus glow"></label>
<div style="display:flex;flex-wrap:wrap;gap:10px"><button type="button" class="ovk-btn">A button</button><button type="button" class="ovk-btn ovk-btn--primary">Primary</button></div></div>`,
    // The real field, searching this site's own components, rules and themes (GET /api/v1/suggest).
    'search-field': () => `<form class="cr-search" action="/components" role="search" style="max-width:560px"><input name="q" placeholder="Search" aria-label="Search OpenVibe.Design" data-ov-searchbox="/api/v1/suggest" data-ov-examples="components|rules|themes"></form><p class="cr-note">Type “me”, then Tab. Press / from anywhere on the page.</p>`,
    'thread-composer': () => thread.composer({ action: '#', method: 'get', placeholder: 'Ask anything', tools: kit.sheetButton({ sheet: 'cr-options', label: 'Options', icon: 'more', iconOnly: false }), attach: { name: 'files' }, id: 'cr-composer' }) + kit.sheet({ id: 'cr-options', title: 'Options', body: kit.seg({ name: 'cr-model', label: 'Model', options: [['auto', 'Auto'], ['fast', 'Fast']], value: 'auto' }) }),
    chat: () => `<div class="cr-chat"><div class="cr-chat-views" role="group" aria-label="How messages look"><button type="button" class="ovk-btn ovk-btn--quiet" data-cr-chat-view="room" aria-pressed="true">Room lines</button><button type="button" class="ovk-btn ovk-btn--quiet" data-cr-chat-view="bubbles" aria-pressed="false">Bubbles</button></div><ol class="ovm-messages" id="cr-chat-list" aria-label="Demo conversation"></ol><div id="cr-chat-box"></div><p class="ds-fine">Hover a message (on a phone, tap it): reply, edit, translate and copy are one cluster at its corner. Edit puts the words in the box; Enter saves, Esc puts back what was there. The demo keeps its messages on this page.</p></div>`,
    sheet: () => kit.sheetButton({ sheet: 'cr-sheet', label: 'Open sheet', icon: 'plus', iconOnly: false }) + kit.sheet({ id: 'cr-sheet', title: 'Add a site', body: `<p>Pick a site and theme.</p>${kit.seg({ name: 'cr-theme', label: 'Look', options: [['vibe', 'Vibe'], ['daylight', 'Daylight']], value: 'vibe' })}` }),
    popover: () => kit.more({ label: 'More choices', items: [{ href: '/themes', label: 'Themes', icon: 'palette' }, { href: '/look', label: 'Your look', icon: 'user' }] }),
    keyboard: () => `<label class="cr-field">A keyboard-aware field <input type="text" placeholder="Focus this field"></label><p class="ds-fine">Tab moves forward; Escape closes a menu or sheet and returns focus.</p>`,
    'kit-row': () => kit.list([kit.row({ href: '/themes', title: 'OpenVibe.Design', sub: 'Make it yours', mark: kit.mark({ name: 'Design', square: true }), meta: 'Now' })]),
    'kit-card': () => kit.card({ href: '/themes', title: 'Make it yours', type: 'post', sub: 'Your theme everywhere', badge: 'DESIGN' }),
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
    ['Writing and choosing', ['chat', 'thread-composer', 'search-field', 'form-controls', 'sheet', 'popover', 'keyboard']],
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
    const notes = noteList();
    const shipped = notes.length ? `<section class="cr-group cr-group--shipped" id="crl-shipped"><h2>Changed lately: what shipped</h2><p class="crl-group-l">The bar's brand, the search pill, the quest card, the avatar, the player, soft pages, icon ink and the footer: one specimen and the release behind each.</p><ul class="cr-cards">${notes.map((n) => `<li class="cr-card crl-card"><a class="crl-note-link" href="/components/${esc(n.name)}"><b>${esc(n.title)}</b><span>${esc(n.summary)}</span></a><div class="cr-card-meta"><span class="crl-counts">Shared release</span><a href="/changes">Changes</a></div></li>`).join('')}</ul></section>` : '';
    const body = `<header class="ds-page-h"><p class="ds-kicker">Component registry</p><h1>One vocabulary, three platforms</h1><p class="ds-lede">Every shared OpenVibe interface as one definition: its anatomy, props, states, tokens, keyboard and dismissal rules, accessibility, and how it is built on the web, in Jetpack Compose and in SwiftUI. The same definitions are the vocabulary Design and Space give their AI generators.</p>
<p class="cr-links"><a href="/api/v1/components">All definitions as JSON</a> · <a href="/llms.txt">llms.txt</a> · <a href="/api/v1/components/sheet">Example: sheet</a></p></header>
${sections}
${shipped}
<p class="ds-fine">A definition is a promise about behaviour, not a screenshot: the live demo on each page is the web implementation, and the Android and iOS sections name the container role and the interaction each platform owns.</p>
<footer class="cn-foot"><p><a href="/changes">Every Shared release, and the component it changed</a> · <a href="/rules">How OpenVibe decides</a></p></footer>`;
    return layout({ title: 'Component registry: OpenVibe design system', description: 'Platform-neutral definitions of the OpenVibe navbar, menu, You home, Dock and tabs, thread composer, sheets, pop-overs, keyboard behaviour, kit rows, cards, sections, empty states, switches, segmented controls, uploads, the model chip and motion: web, Android and iOS.', path: '/components/registry', body: `<div class="ds-wrap tk cr">${body}</div>`, active: '/components', styles: ['css/component-registry.css', 'css/specimens.css'] });
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
${shippedSection(c.name)}
<div class="cr-layout"><section><h2>Live web demo</h2><div class="cr-demo cr-demo--${esc(c.name)}" data-ov-component="${esc(c.name)}" data-specimen>${demo[c.name]()}</div><p class="ds-fine">Web source: <code>${esc(c.platforms.web.module)}</code> · ${esc(c.platforms.web.markup)}</p></section>
<section><h2>Anatomy</h2><ul class="cr-anatomy">${anatomy}</ul><h2>Props</h2><dl class="cr-props">${Object.entries(c.props).map(([key, type]) => `<div><dt><code>${esc(key)}</code></dt><dd>${esc(type)}</dd></div>`).join('')}</dl></section></div>
<section><h2>Behavior and accessibility</h2>${details}</section>
<div class="cr-layout">${native('android')}${native('ios')}</div>
<section><h2>Example definition</h2>${kit.snippet({ code: JSON.stringify({ schema: c.schema, name: c.name, props: c.examples[0].props }, null, 2), id: 'cr-example' })}</section>
<h2>Other components</h2>${registryLinks()}
<footer class="cn-foot"><p><a href="/changes">Every Shared release, and the component it changed</a> · <a href="/rules">How OpenVibe decides</a></p></footer>`;
    return layout({ title: `${c.title}: OpenVibe component`, description: c.summary, path: link(c.name), body: `<div class="ds-wrap tk cr">${body}</div>`, active: '/components', styles: ['css/component-registry.css', 'css/specimens.css'], scripts: ['js/component-registry.js', ...(PAGE_EXTRA[c.name] || {}).scripts || []], sharedStyles: (PAGE_EXTRA[c.name] || {}).sharedStyles || [], shared: (PAGE_EXTRA[c.name] || {}).shared || [] });
}

module.exports = { componentPage, registryPage, registryLinks };
