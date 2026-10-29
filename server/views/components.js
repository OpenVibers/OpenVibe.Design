'use strict';
/**
 * /components: the OpenVibe design system's components, drawn natively everywhere (openvibe-shared/components 4.42.0).
 * One component at a time (?c=card): what it is for, the real thing (a sample kit document rendered through kit.js),
 * its parts and the tokens each wears (swatches in the default theme), props, states, accessibility, how it behaves on a
 * phone and a computer, and its code for the web (the kit document and kit.js), Android (Compose) and iOS (SwiftUI)
 * (?p=web|android|ios). Server-rendered and whole without JavaScript; kit-web.js adds the copy buttons.
 *
 *   componentsPage({ id, platform, themes })
 */
const kit = require('openvibe-shared/kit');
const components = require('openvibe-shared/components');
const tokens = require('openvibe-shared/tokens');
const { BUILTIN_THEMES } = require('openvibe-shared/builtin-themes');
const { layout, esc } = require('../render/layout');

// A sample kit document for each component: what the page shows rendered, and what the Web tab prints.
const card = (n, title, extra = {}) => ({ type: 'card', props: { href: `/components?c=card#${n}`, title, type: 'stream', ...extra } });
const SAMPLES = {
    button: { type: 'section', props: { title: 'Buttons' }, children: [{ type: 'button', props: { label: 'Go live', href: '/components?c=button', icon: 'live' } }, { type: 'button', props: { label: 'Not now', kind: 'quiet' } }, { type: 'button', props: { label: 'Delete the room', kind: 'danger', small: true } }] },
    card: card(1, 'Seattle at night, chat picks the route', { live: true, who: 'goosely', count: [1204, 'watching'], sub: 'IRL · Capitol Hill' }),
    rail: { type: 'rail', props: { id: 'sample-rail', title: 'Live now', more: { href: '/components?c=rail', label: 'See all' } }, children: [card(1, 'Seattle at night', { live: true, who: 'goosely' }), card(2, 'Surf race on Utopia', { who: 'kiwi', corner: '3 laps' }), card(3, 'Building a robot arm', { who: 'maru', badge: 'NEW' })] },
    row: { type: 'list', props: {}, children: [{ type: 'row', props: { href: '/components?c=row', title: 'night-owls', sub: 'ana: anyone up for the surf race?', meta: '17:29', mark: 'Night owls', unread: 2 } }] },
    list: { type: 'list', props: { title: 'Your rooms', more: { href: '/components?c=list', label: 'All' } }, children: [{ type: 'row', props: { href: '/components?c=list', title: 'night-owls', sub: '38 here', mark: 'Night owls' } }, { type: 'row', props: { href: '/components?c=list', title: 'surf-crew', sub: 'jules: in five', mark: 'Surf crew', meta: '17:12' } }, { type: 'row', props: { href: '/components?c=list', title: 'builders', sub: 'a new world went up', mark: 'Builders', meta: 'Tue' } }] },
    section: { type: 'section', props: { title: 'Notifications', note: 'Saved to your account' }, children: [{ type: 'notice', props: { kind: 'info', text: 'You will hear when someone you follow goes live.' } }] },
    fold: { type: 'fold', props: { title: 'Put this room on your site', meta: 'two ways' }, children: [{ type: 'notice', props: { kind: 'info', text: 'Copy the embed code, or link to the room.' } }] },
    tabs: { type: 'tabs', props: { base: '/components?c=tabs', param: 'tab', active: 'live', items: [{ key: 'live', label: 'Live', count: 12 }, { key: 'clips', label: 'Clips' }, { key: 'about', label: 'About' }] } },
    stats: { type: 'stats', props: { items: [[1204, 'watching now'], [48, 'people chatting'], [12, 'streams live', '/components?c=stats']] } },
    notice: { type: 'section', props: { title: 'Notices' }, children: [{ type: 'notice', props: { kind: 'ok', text: 'Saved. Every OpenVibe site follows.' } }, { type: 'notice', props: { kind: 'error', text: 'That name is taken. Try another.' } }] },
    empty: { type: 'empty', props: { title: 'No public rooms yet', text: 'Start the first one: public, or private to the people you invite.', icon: 'chat', action: { href: '/components?c=empty', label: 'Start a room' } } },
};

const vibe = tokens.fromTheme(BUILTIN_THEMES.find((t) => t.slug === 'vibe'));
const tokenValue = (path) => path.split('.').reduce((o, k) => (o ? o[k] : null), vibe);
const swatch = (path) => {
    const t = tokenValue(path);
    if (!t || t.$type !== 'color') return '';
    const c = tokens.parseColor(t.$value);
    return c ? `<i class="tk-dot" style="background:${esc(t.$value)}"></i>` : '';
};

function anatomy(spec) {
    return `<ul class="cp-parts">${spec.anatomy.map((p) => `<li><b>${esc(p.part)}</b>${p.optional ? ' <span class="cp-opt">optional</span>' : ''}`
        + `${Object.keys(p.tokens || {}).length ? `<span class="cp-tokens">${Object.entries(p.tokens).map(([k, v]) => `<span class="cp-tok">${swatch(v)}<small>${esc(k)}</small><code>${esc(v)}</code></span>`).join('')}</span>` : ''}`
        + `${p.note ? `<small class="cp-note">${esc(p.note)}</small>` : ''}</li>`).join('')}</ul>`;
}
function facts(spec) {
    const props = Object.entries(spec.props).map(([k, p]) => `<code>${esc(k)}</code>${p.required ? '*' : ''}`).join(' ');
    const rows = [
        ['Role', esc(spec.role)],
        ['Props', `${props} <small class="cp-note">* required</small>`],
        ['States', esc((spec.states || []).join(' · '))],
        ['Name', esc(spec.a11y.name)],
        ['Keys', esc(spec.a11y.keys)],
        spec.a11y.minTarget ? ['Target', esc(spec.a11y.minTarget)] : null,
        ['Phone', esc(spec.layout.phone || '')],
        ['Computer', esc(spec.layout.computer || spec.layout.tablet || '')],
    ].filter(Boolean);
    const variants = spec.variants ? Object.entries(spec.variants).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${Object.entries(v).map(([n, d]) => `<code>${esc(n)}</code> ${esc(d)}`).join('<br>')}</dd></div>`).join('') : '';
    return `<dl class="cp-facts">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}${variants}</dl>`;
}

const PLATFORMS = [{ key: 'web', label: 'Web' }, { key: 'android', label: 'Android' }, { key: 'ios', label: 'iOS' }];

function componentsPage({ id = '', platform = 'web' } = {}) {
    const specs = components.SPECS;
    const spec = components.get(id) || specs[0];
    const sample = SAMPLES[spec.id];
    const rendered = sample && components.validate(sample).ok ? components.render(sample, kit) : '';
    const p = PLATFORMS.some((x) => x.key === platform) ? platform : 'web';
    const code = p === 'android' ? `${components.PREAMBLE.compose}\n\n${spec.native.compose}`
        : p === 'ios' ? `${components.PREAMBLE.swiftui}\n\n${spec.native.swiftui}`
            : `// A kit document (JSON). The web renders it with openvibe-shared/components:\n//   components.render(doc, kit)  →  ${spec.web}(…)\n${JSON.stringify(sample, null, 2)}`;
    const how = p === 'android' ? 'Jetpack Compose, on the theme file from Tokens (Android): Material 3 roles for colour, OvScale for sizes.'
        : p === 'ios' ? 'SwiftUI, on the theme file from Tokens (iOS): OvTokens (the theme you wear) for colour, OvScale for sizes.'
            : `The same component as data: a server sends this, the web renders it with ${spec.web}, and a native app with its own view.`;
    const base = `/components?c=${encodeURIComponent(spec.id)}`;
    const body = `<header class="ds-page-h"><p class="ds-kicker">Components</p><h1>One design system, drawn natively everywhere</h1>
<p class="ds-lede">Every OpenVibe component is described by what it is: its parts, the tokens they wear, its states, and how it reads to a screen reader. The web draws it with the kit; an Android or iOS app draws the same component with its own views, so an app is never a web page in a frame.</p></header>
${kit.tabs({ base: '/components', param: 'c', active: spec.id, label: 'Components', items: specs.map((s) => ({ key: s.id, label: s.name })) })}
<section class="cp" aria-labelledby="cp-h"><div class="cp-head"><h2 id="cp-h">${esc(spec.name)}</h2><p class="ds-lede">${esc(spec.summary)}</p></div>
<div class="cp-stage" aria-label="${esc(spec.name)}, drawn by the kit">${rendered}</div>
<div class="cp-grid"><div><h3>Parts and their tokens</h3>${anatomy(spec)}</div><div><h3>How it behaves</h3>${facts(spec)}</div></div>
<h3 id="cp-code">Code</h3>
${kit.tabs({ base: `${base}`, param: 'p', active: p, label: 'Platform', items: PLATFORMS.map((x) => ({ ...x, href: `${base}&p=${x.key}#cp-code` })) })}
<p class="tk-how">${esc(how)}</p>
${kit.snippet({ code, id: 'cp-code-snip', label: 'Copy the code' })}</section>
${kit.fold({ id: 'cp-docs', title: 'Kit documents: screens as data', body: `<p>A screen can be sent as a tree of these components, for example <code>{ "type": "rail", "children": [{ "type": "card", … }] }</code>. Every OpenVibe client renders the same document with its own views, so a screen can change without an app release (the server-driven UI pattern of Airbnb and DivKit). Documents are checked strictly: known components and props only, typed values, which children each takes, a size limit, and https or same-site links.</p><p>${kit.button({ href: '/api/v1/components', label: 'The specs as JSON', kind: 'quiet', small: true })} ${kit.button({ href: '/tokens', label: 'The tokens they wear', kind: 'quiet', small: true })}</p>` })}`;
    return layout({
        title: `${spec.name}: an OpenVibe component for web, Android and iOS`,
        description: `${spec.summary} Its parts, tokens, states and accessibility, with code for the web, Jetpack Compose and SwiftUI.`,
        path: `/components?c=${encodeURIComponent(spec.id)}`,
        body: `<div class="ds-wrap tk">${body}</div>`,
        active: '/components',
    });
}

module.exports = { componentsPage, SAMPLES };
