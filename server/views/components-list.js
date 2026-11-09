'use strict';

/**
 * The registry's plain pages: no cards, categories, styles or navigation choices. /components is the whole registry as
 * one unstyled list (the owner, 11-09: design and organizing stay with Opus); /components/<name> is one entry, for a
 * definition that is not one of the designed interface pages. Every value on these pages is data from
 * design_components, escaped.
 */
const { layout, esc } = require('../render/layout');

const list = (items) => `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
const pair = (key, value) => `<dt>${esc(key)}</dt><dd>${value}</dd>`;

function props(definition) {
    const entries = Object.entries(definition.props || {});
    if (!entries.length) return '<p>No props.</p>';
    return `<dl>${entries.map(([key, type]) => pair(key, `<code>${esc(type)}</code>`)).join('')}</dl>`;
}

function anatomy(definition) {
    const parts = definition.anatomy || [];
    if (!parts.length) return '<p>No anatomy.</p>';
    return list(parts.map((part) => `<b>${esc(part.part)}</b>: ${esc(part.role)}`));
}

function platforms(definition) {
    const p = definition.platforms || {};
    const web = p.web || {};
    const android = p.android || {};
    const ios = p.ios || {};
    return `<dl>${[
        pair('Web module', `<code>${esc(web.module || '')}</code>`),
        pair('Web markup', `<code>${esc(web.markup || '')}</code>`),
        pair('Web demo', esc(web.demo || '')),
        pair('Android', esc(android.toolkit || '') + (android.material3 ? ` · ${esc(android.material3)}` : '')),
        pair('Android notes', esc(android.specification || '')),
        pair('iOS', esc(ios.toolkit || '')),
        pair('iOS notes', esc(ios.specification || '')),
    ].join('')}</dl>`;
}

function examples(entry) {
    const listOf = entry.examples && entry.examples.length ? entry.examples : (entry.definition.examples || []);
    if (!listOf.length) return '<p>No example.</p>';
    return listOf.map((example) => `<p><b>${esc(example.title || 'Example')}</b></p>`
        + (example.markup ? `<pre><code>${esc(example.markup)}</code></pre>` : '<p>No markup.</p>')).join('');
}

function entryBody(entry) {
    const c = entry.definition;
    return `<p>${esc(c.summary)}</p>
<h3>Anatomy</h3>${anatomy(c)}
<h3>Props</h3>${props(c)}
<h3>States</h3>${list((c.states || []).map((state) => esc(state)))}
<h3>Tokens</h3>${list((c.tokens || []).map((token) => `<code>${esc(token)}</code>`))}
<h3>Behavior</h3><dl>${pair('Keyboard aware', c.behaviors && c.behaviors.keyboardAware ? 'yes' : 'no')}${pair('Outside tap closes', c.behaviors && c.behaviors.outsideTapCloses ? 'yes' : 'no')}${pair('Scroll lock', c.behaviors && c.behaviors.scrollLock ? 'yes' : 'no')}${pair('Reduced motion', esc((c.behaviors && c.behaviors.reducedMotion) || ''))}</dl>
<h3>Accessibility</h3><dl>${pair('Name', esc((c.accessibility && c.accessibility.name) || ''))}${pair('Target', esc((c.accessibility && c.accessibility.target) || ''))}${pair('Focus', esc((c.accessibility && c.accessibility.focus) || ''))}</dl>
<h3>Platforms</h3>${platforms(c)}
<h3>Example</h3>${examples(entry)}`;
}

/** /components: the whole registry as one unstyled list, nothing organized. */
function componentsListPage(entries) {
    const body = `<h1>Component registry</h1>
<p>Every Shared kit component as a design.component@1 entry, imported from the installed openvibe-shared and stored in design_components. Read the same entries as JSON at <code>/api/v1/components</code>, or one at <code>/api/v1/components/&lt;name&gt;</code>. A browser-only component is listed too.</p>
${entries.length ? `<ul>${entries.map((entry) => `<li><h2>${esc(entry.definition.title || entry.name)}</h2><p><code>${esc(entry.name)}</code></p>${entryBody(entry)}</li>`).join('')}</ul>` : '<p>No components have been imported yet.</p>'}`;
    return layout({
        title: 'Component registry',
        description: 'Every Shared kit component as a plain design.component@1 list: props, states, tokens, behavior, accessibility, web markup and Android and iOS notes.',
        path: '/components',
        active: '/components',
        body,
    });
}

/** /components/<name>: one entry, plain data; the designed interface pages keep their own views. */
function componentEntryPage(entry) {
    return layout({
        title: `${entry.definition.title || entry.name}: component`,
        description: entry.definition.summary || 'One design.component@1 entry.',
        path: `/components/${entry.name}`,
        active: '/components',
        body: `<h1>${esc(entry.definition.title || entry.name)}</h1><p><code>${esc(entry.name)}</code></p>${entryBody(entry)}`,
    });
}

module.exports = { componentsListPage, componentEntryPage };
