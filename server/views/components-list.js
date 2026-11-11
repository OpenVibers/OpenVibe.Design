'use strict';

/**
 * The component registry pages, organized and designed by Opus (11-09; the owner: "design and style and organizing
 * remain with Opus"). /components groups every imported design.component@1 entry by what it is for, with a chip row to
 * jump between groups and one card per component (its summary, how many props and states, where it lives).
 * /components/<name> is one entry: what it is, its anatomy and props beside its behaviour and accessibility, its
 * states and tokens as chips, Android and iOS notes, and the example markup (as code: stored markup is never rendered).
 * Every value is data from design_components, escaped.
 */
const kit = require('openvibe-shared/kit');
const { layout, esc } = require('../render/layout');
const { RULES } = require('../rules/register');
const FLOAT_RULE = RULES.find((r) => r.id === 'pip-goes-anywhere');

/** What each component is for. A name not listed here lands in Other, so a new kit part is never dropped. */
const GROUPS = [
    ['actions', 'Actions', 'Buttons and the things a tap does.', ['button', 'icon-button', 'action', 'more', 'share', 'ask-agent']],
    ['marks', 'Marks and status', 'Small signs that say what something is or how it is.', ['badge', 'dot', 'mark', 'labels', 'notice']],
    ['layout', 'Page and layout', 'The frame of a page: heads, sections, sidebars, rails and tabs.', ['page', 'page-head', 'head', 'section', 'fold', 'sidebar', 'rail', 'tabs', 'steps']],
    ['content', 'Lists and content', 'Rows, cards and what shows while there is nothing yet.', ['list', 'row', 'card', 'empty', 'snippet', 'skeleton']],
    ['choosing', 'Choosing and settings', 'Switches, ranges, selects, segmented controls, chips and saving.', ['switch-row', 'range-row', 'select-row', 'seg', 'segmented', 'chips', 'find', 'save-bar', 'drop']],
    ['surfaces', 'Surfaces', 'What opens over the page.', ['sheet', 'dock', 'float']],
    ['data', 'Numbers and data', 'Stats, tables, charts and receipts.', ['stats', 'num', 'table', 'chart', 'rank', 'meter', 'receipt']],
    ['tools', 'Tools', 'The parts of an OpenVibe tool page.', ['tool', 'tool-head', 'tool-input', 'answer', 'family', 'tries']],
    ['home', 'Home', 'The menu\'s Home screen.', ['home-grid', 'home-edit']],
];
const GROUP_OF = new Map(GROUPS.flatMap(([id, , , names]) => names.map((n) => [n, id])));
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const chips = (items, cls = '') => (items.length ? `<ul class="crl-chips${cls}">${items.map((x) => `<li>${x}</li>`).join('')}</ul>` : '<p class="crl-none">None.</p>');

function groupsOf(entries) {
    const by = new Map(GROUPS.map(([id]) => [id, []]));
    const other = [];
    for (const e of entries) (by.get(GROUP_OF.get(e.name)) || other).push(e);
    const out = GROUPS.map(([id, title, note]) => ({ id, title, note, entries: by.get(id) })).filter((g) => g.entries.length);
    if (other.length) out.push({ id: 'other', title: 'Other', note: 'New parts not yet placed in a group.', entries: other });
    return out;
}

function card(entry) {
    const c = entry.definition || {};
    const nProps = Object.keys(c.props || {}).length, nStates = (c.states || []).length;
    const module = c.platforms && c.platforms.web && c.platforms.web.module;
    return `<li class="cr-card crl-card"><a class="cr-card-link" href="/components/${encodeURIComponent(entry.name)}"><b>${esc(c.title || entry.name)}</b><span>${esc(c.summary || '')}</span></a>
<div class="cr-card-meta"><span class="crl-counts">${plural(nProps, 'prop')} · ${plural(nStates, 'state')}</span>${module ? `<code class="crl-module">${esc(String(module).replace(/^openvibe-shared\//, ''))}</code>` : ''}</div></li>`;
}

/** /components: the registry, grouped by purpose. */
function componentsListPage(entries) {
    const groups = groupsOf(entries);
    const nav = groups.length > 1 ? `<nav class="crl-jump" aria-label="Groups">${groups.map((g) => `<a href="#crl-${g.id}">${esc(g.title)}<span>${g.entries.length}</span></a>`).join('')}</nav>` : '';
    const body = `<div class="ds-wrap tk cr crl">
<header class="ds-page-h"><p class="ds-kicker">Component registry</p><h1>Every part of OpenVibe, defined once</h1>
<p class="ds-lede">${plural(entries.length, 'component')} from the shared kit, each with its props, states, tokens, behaviour, accessibility and how it is built on the web, Android and iOS.</p>
<p class="cr-links"><a href="/components/registry">The interface pages</a> · <a href="/changes">What shipped</a> · <a href="/api/v1/components">All of it as JSON</a> · <a href="/kit">The kit</a></p></header>
${nav}
${groups.length ? groups.map((g) => `<section class="cr-group crl-group" id="crl-${g.id}" aria-labelledby="crl-${g.id}-h"><header class="crl-group-h"><h2 id="crl-${g.id}-h">${esc(g.title)}</h2><p>${esc(g.note)}</p></header><ul class="cr-cards">${g.entries.map(card).join('')}</ul></section>`).join('')
        : kit.empty({ icon: 'grid', title: 'No components imported yet', text: 'The registry fills from the installed openvibe-shared when the service starts.' })}
</div>`;
    return layout({
        title: 'Component registry: every part of OpenVibe',
        description: 'Every Shared kit component, grouped by purpose: props, states, tokens, behaviour, accessibility, web markup and Android and iOS notes.',
        path: '/components',
        active: '/components',
        styles: ['css/component-registry.css'],
        body,
    });
}

function facts(c) {
    const b = c.behaviors || {}, a = c.accessibility || {};
    const rows = [
        ['Keyboard', b.keyboardAware ? 'Keeps the focused control in view' : 'Standard focus order'],
        ['Outside tap', b.outsideTapCloses ? 'Closes it' : 'Leaves it open'],
        ['Scroll', b.scrollLock ? 'Locks the page while open' : 'The page still scrolls'],
        ['Reduced motion', b.reducedMotion || 'No motion to reduce'],
        ['Name', a.name || ''], ['Target', a.target || ''], ['Focus', a.focus || ''],
    ].filter(([, v]) => v);
    return `<dl class="cr-facts">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
}

function examples(entry) {
    const list = entry.examples && entry.examples.length ? entry.examples : ((entry.definition && entry.definition.examples) || []);
    const withMarkup = list.filter((x) => x && x.markup);
    if (!withMarkup.length) return '';
    return `<section class="crl-sec" aria-labelledby="crl-ex-h"><h2 id="crl-ex-h">Markup</h2>${withMarkup.map((x, i) => `${x.title ? `<p class="crl-ex-t">${esc(x.title)}</p>` : ''}${kit.snippet({ code: String(x.markup), id: `crl-ex-${i}` })}`).join('')}</section>`;
}

/** The one component whose page needs a live demo: the move engine is behaviour, not markup. */
function floatDemo() {
    const href = '/rules#pip-goes-anywhere';
    const rule = FLOAT_RULE ? `Rule ${FLOAT_RULE.n}: ${esc(FLOAT_RULE.rule)}` : 'A picture-in-picture goes anywhere, tucks aside and waits with the mark';
    return `<section class="crl-sec crf" id="crf" aria-labelledby="crf-h">
<h2 id="crf-h">Live demo</h2>
<p>Drag the box by its body; let go over the frame and it docks, anywhere else it floats. Throw it past a side to tuck it, drag its corner to size it, or use the keys with it focused: arrows move, <kbd>+</kbd> and <kbd>−</kbd> size, <kbd>T</kbd> tucks, <kbd>F</kbd> docks or floats, <kbd>Home</kbd> puts it back.</p>
<div class="crf-stage" id="crf-frame" aria-label="A player frame; the box docks in it or floats over the page">
  <div class="crf-box" id="crf-box" tabindex="0" aria-label="A floating box: drag it anywhere">
    <span class="crf-tag">LIVE</span><b>Picture-in-picture</b><small>Drag me anywhere</small>
  </div>
</div>
<div class="crf-bar" role="group" aria-label="The floating panel's actions">
  <button type="button" class="ovk-btn ovk-btn--quiet" data-crf="tuck">Tuck</button>
  <button type="button" class="ovk-btn ovk-btn--quiet" data-crf="untuck">Bring it back</button>
  <button type="button" class="ovk-btn ovk-btn--quiet" data-crf="mode">Dock / float</button>
  <button type="button" class="ovk-btn ovk-btn--quiet" data-crf="size">Small / large</button>
  <button type="button" class="ovk-btn ovk-btn--quiet" data-crf="reset">Home</button>
  <output id="crf-state" class="crf-state" aria-live="polite">docked</output>
</div>
<dl class="crf-options">
  <div><dt><code>frame</code></dt><dd>The element it docks in and measures its fractions against. Without one it only floats over the page.</dd></div>
  <div><dt><code>key</code> and <code>defaults</code></dt><dd>The place kept in this browser, and the streamer's starting x, y and width as fractions of the frame.</dd></div>
  <div><dt><code>aspect</code> and <code>minPx</code></dt><dd>The source's own shape, and the smallest 16:9 width on a phone-sized frame (150 px for the PiP).</dd></div>
  <div><dt><code>onChange</code></dt><dd>Every saved place, with the geometry and the instance. <code>OVFloat.store</code> is the account plug; <code>OVFloat.layout()</code> and <code>ov:float</code> say where everything is.</dd></div>
</dl>
<p class="ds-fine"><a href="${href}">${rule.replace(/\.$/, '')}</a>. The same engine moves Live's picture-in-picture and a panel window; on a site with <code>GET/PATCH /api/me/layout</code> the place also follows the person to another device.</p>
</section>`;
}

/** /components/<name>: one entry, laid out like the designed interface pages. */
function componentEntryPage(entry) {
    const c = entry.definition || {};
    const group = GROUPS.find(([id]) => id === GROUP_OF.get(entry.name));
    const p = c.platforms || {}, web = p.web || {}, android = p.android || {}, ios = p.ios || {};
    const anatomy = (c.anatomy || []).map((part) => `<li><b>${esc(part.part)}</b><span>${esc(part.role)}</span></li>`).join('');
    const props = Object.entries(c.props || {});
    const body = `<div class="ds-wrap tk cr crl">
<header class="ds-page-h"><p class="ds-kicker"><a href="/components${group ? `#crl-${group[0]}` : ''}">${esc(group ? group[1] : 'Component registry')}</a></p><h1>${esc(c.title || entry.name)}</h1><p class="ds-lede">${esc(c.summary || '')}</p>
<p class="crl-where">${web.module ? `<code>${esc(web.module)}</code>` : ''}<a href="/api/v1/components/${encodeURIComponent(entry.name)}">JSON</a></p></header>
${entry.name === 'float' ? floatDemo() : ''}
${web.markup ? `<section class="crl-sec crl-build" aria-labelledby="crl-build-h"><h2 id="crl-build-h">Build it</h2>${kit.snippet({ code: String(web.markup), id: 'crl-build' })}</section>` : ''}
<div class="cr-layout">
<section class="crl-sec" aria-labelledby="crl-props-h"><h2 id="crl-props-h">Props</h2>${props.length ? `<dl class="cr-props">${props.map(([k, t]) => `<div><dt><code>${esc(k)}</code></dt><dd>${esc(t)}</dd></div>`).join('')}</dl>` : '<p class="crl-none">No props.</p>'}
${anatomy ? `<h2>Anatomy</h2><ul class="cr-anatomy">${anatomy}</ul>` : ''}</section>
<section class="crl-sec" aria-labelledby="crl-beh-h"><h2 id="crl-beh-h">Behaviour and access</h2>${facts(c)}
<h2>States</h2>${chips((c.states || []).map((s) => esc(s)))}
<h2>Tokens</h2>${chips((c.tokens || []).map((t) => `<code>${esc(t)}</code>`), ' crl-chips--code')}</section>
</div>
<div class="cr-layout">
<section class="cr-native"><h3>Android${android.toolkit ? ` · ${esc(android.toolkit)}` : ''}</h3>${android.material3 ? `<p class="crl-role">${esc(android.material3)}</p>` : ''}<p>${esc(android.specification || 'Not specified yet.')}</p></section>
<section class="cr-native"><h3>iOS${ios.toolkit ? ` · ${esc(ios.toolkit)}` : ''}</h3><p>${esc(ios.specification || 'Not specified yet.')}</p></section>
</div>
${examples(entry)}
<footer class="cn-foot"><p><a href="/changes">Every Shared release, and the component it changed</a> · <a href="/components/registry">The interface pages</a> · <a href="/rules">How OpenVibe decides</a></p></footer>
</div>`;
    return layout({
        title: `${c.title || entry.name}: OpenVibe component`,
        description: c.summary || 'One design.component@1 entry.',
        path: `/components/${entry.name}`,
        active: '/components',
        styles: ['css/component-registry.css'],
        shared: entry.name === 'float' ? ['ov-float.js'] : [],
        scripts: entry.name === 'float' ? ['js/ov-float-demo.js'] : [],
        body,
    });
}

module.exports = { componentsListPage, componentEntryPage, GROUPS };
