'use strict';
/**
 * /tokens: a theme as code. Pick any public theme (its other half comes along), choose a platform, copy or download
 * the file. Server-rendered and whole without JavaScript: the theme picker is a GET form, the platforms are tab links
 * (?format=), and kit-web.js adds the copy button. The code is openvibe-shared/tokens' output (server/tokens.js), the
 * same token document a native OpenVibe app reads.
 *
 *   tokensPage({ themes, found, format, both })
 */
const kit = require('openvibe-shared/kit');
const { layout, esc } = require('../render/layout');
const themeTokens = require('../tokens');

const SHORT = { css: 'CSS', tailwind: 'Tailwind', compose: 'Android', swiftui: 'iOS', flutter: 'Flutter', figma: 'Figma', json: 'JSON' };

/** How to use one target's file, in a sentence or two. name: the theme's identifier (VibeTokens…). */
function howTo(id, name, pair) {
    const n = name;
    const lower = n[0].toLowerCase() + n.slice(1);
    switch (id) {
        case 'css': return `Paste it into your stylesheet: <code>--ov-color-bg-base</code> and the rest, with the network's own names (<code>--bg-primary</code>…) pointing at them.${pair ? ' The light half switches on <code>data-theme-mode="light"</code>.' : ''}`;
        case 'tailwind': return 'Save it as <code>tailwind.config.js</code> beside the CSS file. Classes like <code>bg-bg-raised</code> and <code>text-accent-base</code> read the variables, so light and dark need no rebuild.';
        case 'compose': return `Add it to your app module and wrap your UI in <code>MaterialTheme(colorScheme = ${pair ? `if (isSystemInDarkTheme()) ${n}DarkColorScheme else ${n}LightColorScheme` : `${n}${'DarkColorScheme'}`}) { … }</code>. Every colour is on <code>${n}${pair ? 'Dark' : ''}Tokens</code> too, and the spacing, radii, type and motion are on <code>OvScale</code>, the same in every theme.`;
        case 'swiftui': return `Add it to your target and use <code>${n}${pair ? 'Dark' : ''}Tokens.colorAccentBase</code> and the rest for colours, and <code>OvScale.radiusMd</code>, <code>OvScale.spaceLg</code>… for sizes; <code>colorScheme</code> says which half each one is.`;
        case 'flutter': return pair
            ? `<code>MaterialApp(theme: ThemeData(colorScheme: ${lower}LightScheme), darkTheme: ThemeData(colorScheme: ${lower}DarkScheme))</code>. The raw values are on <code>${n}DarkTokens</code> and <code>${n}LightTokens</code>.`
            : `<code>MaterialApp(theme: ThemeData(colorScheme: ${lower}DarkScheme))</code>. The raw values are on <code>${n}Tokens</code>.`;
        case 'figma': return `Import it with a variables-import plugin: one collection${pair ? ', a mode for each half' : ''}, named the way the tokens are.`;
        default: return 'The W3C Design Tokens (DTCG) document itself, for Style Dictionary, Tokens Studio or your own build.';
    }
}

const cssColor = (v) => { const c = themeTokens.parseColor(v); return c ? (c.a < 1 ? `rgba(${c.r},${c.g},${c.b},${c.a})` : `#${[c.r, c.g, c.b].map((x) => x.toString(16).padStart(2, '0')).join('')}`) : null; };
const dot = (v) => { const c = cssColor(v); return c ? `<i class="tk-dot" style="background:${esc(c)}"></i>` : ''; };

function picker(themes, current, both, format) {
    const opt = (t) => `<option value="${esc(t.slug || t.id)}"${t === current ? ' selected' : ''}>${esc(t.name)}</option>`;
    const dark = themes.filter((t) => t.mode !== 'light');
    const light = themes.filter((t) => t.mode === 'light');
    return `<form class="tk-pick" method="get" action="/tokens"><label class="tk-pick-l"><span>Theme</span><select name="theme">${dark.length ? `<optgroup label="Dark">${dark.map(opt).join('')}</optgroup>` : ''}${light.length ? `<optgroup label="Light">${light.map(opt).join('')}</optgroup>` : ''}</select></label>
<input type="hidden" name="format" value="${esc(format)}"><label class="tk-both"><input type="checkbox" name="both" value="1"${both ? ' checked' : ''}><span>With its other half</span></label><input type="hidden" name="both" value="0">
${kit.button({ type: 'submit', label: 'Show', kind: 'quiet', small: true })}</form>`;
}

function themeCard(found) {
    const half = (doc) => {
        const m = (doc.$extensions && doc.$extensions['network.openvibe']) || {};
        const pick = (p) => p.split('.').reduce((o, k) => (o ? o[k] : null), doc);
        const dots = ['color.bg.base', 'color.bg.raised', 'color.text.primary', 'color.accent.strong', 'color.status.ok.base'].map((p) => dot(pick(p) && pick(p).$value)).join('');
        return `<li class="tk-half"><span class="tk-dots" aria-hidden="true">${dots}</span><span><b>${esc(m.name)}</b><small>${m.mode === 'light' ? 'Light' : 'Dark'}</small></span></li>`;
    };
    return `<ul class="tk-halves">${found.docs.map(half).join('')}</ul>`;
}

function tokenTable(found) {
    const [a, b] = found.docs;
    const get = (doc, path) => path.reduce((o, k) => (o ? o[k] : null), doc);
    const rows = themeTokens.flatten(a).filter((t) => t.type === 'color').map((t) => {
        const other = b ? get(b, t.path) : null;
        return `<li class="tk-row"><code>${esc(t.path.join('.'))}</code><span class="tk-vals">${dot(t.value)}<code>${esc(String(t.value))}</code>${other ? `${dot(other.$value)}<code>${esc(String(other.$value))}</code>` : ''}</span><small>${esc(t.description)}</small></li>`;
    }).join('');
    return `<ul class="tk-table" aria-label="Colour tokens">${rows}</ul>
<p class="ds-fine">Every theme also carries the kit's scales: <code>radius.*</code>, <code>space.*</code> (4 to 32), <code>size.tap</code> (44), <code>type.size.*</code>, <code>type.weight.*</code> and <code>motion.*</code>.</p>`;
}

function tokensPage({ themes = [], found = null, format = 'css', both = true } = {}) {
    const list = (themes || []).filter((t) => t && (t.slug || t.id));
    const target = themeTokens.TARGETS.find((t) => t.id === format) || themeTokens.TARGETS[0];
    let main;
    if (!found) {
        main = list.length
            ? kit.empty({ icon: 'palette', title: 'No theme by that name', text: 'Pick one from the list above.' })
            : kit.empty({ icon: 'palette', title: 'The theme catalog is not answering', text: 'OpenVibe.Network did not answer. Try again in a minute.' });
    } else {
        const slug = found.theme.slug || found.theme.id;
        const pair = found.docs.length > 1;
        const name = themeTokens.ident(found.theme.name);
        const code = themeTokens.compile(pair ? found.docs : found.docs[0], target.id);
        const base = `/tokens?theme=${encodeURIComponent(slug)}${both ? '' : '&both=0'}`;
        const dl = `/api/v1/tokens/${encodeURIComponent(slug)}?format=${encodeURIComponent(target.id)}${pair ? '' : '&both=0'}&download=1`;
        main = `${themeCard(found)}
${kit.tabs({ base, param: 'format', active: target.id, label: 'Platform', items: themeTokens.TARGETS.map((t) => ({ key: t.id, label: SHORT[t.id] || t.label })) })}
<section class="tk-out" aria-labelledby="tk-out-h"><div class="tk-out-head"><h2 id="tk-out-h">${esc(target.label)}</h2>${kit.button({ href: dl, label: `Download ${themeTokens.fileName(found.docs[0], target.id)}`, kind: 'quiet', small: true, icon: 'download' })}</div>
<p class="tk-how">${howTo(target.id, name, pair)}</p>
${kit.snippet({ code, id: 'tk-code', label: 'Copy the code' })}</section>
${kit.fold({ id: 'tk-all', title: 'Every colour token', meta: `${themeTokens.flatten(found.docs[0]).filter((t) => t.type === 'color').length} of them`, body: tokenTable(found) })}
${kit.fold({ id: 'tk-why', title: 'Why tokens, and what is next', body: `<p>A theme on OpenVibe is one set of design tokens: semantic names such as <code>color.accent.strong</code> and <code>space.lg</code>, kept apart from any one platform. The web reads them as CSS variables today. An Android or iOS app reads the same values in Compose or SwiftUI, so a native app wears your theme without being a web page in a frame.</p><p>The format is the W3C Design Tokens one, so the same file works in Style Dictionary, Tokens Studio and Figma. Next: the kit's components described the same way (anatomy, states, roles), so a page made on OpenVibe.Design can be drawn natively too.</p><p>${kit.button({ href: `/studio?theme=${encodeURIComponent(found.theme.id || slug)}`, label: 'Change this theme in the studio', kind: 'quiet', small: true })} ${kit.button({ href: '/developers#tokens', label: 'The tokens API', kind: 'quiet', small: true })}</p>` })}`;
    }
    const body = `<header class="ds-page-h"><p class="ds-kicker">OpenVibe Tokens</p><h1>Your theme, as code</h1>
<p class="ds-lede">Take any OpenVibe theme into your own app, its light and dark halves together: the web, Android, iOS, Flutter or Figma. The colours are the ones the network paints.</p></header>
${list.length ? picker(list, found ? found.theme : null, both, target.id) : ''}
${main}`;
    const title = found ? `${found.theme.name} as code: CSS, Compose, SwiftUI, Flutter, Figma` : 'Your theme, as code';
    return layout({
        title,
        description: found ? `The ${found.theme.name} theme as design tokens: CSS variables, Tailwind, Jetpack Compose, SwiftUI, Flutter, Figma variables and W3C DTCG JSON, light and dark.` : 'Every OpenVibe theme as design tokens for the web, Android, iOS, Flutter and Figma.',
        path: found ? `/tokens?theme=${encodeURIComponent(found.theme.slug || found.theme.id)}` : '/tokens',
        canonical: undefined,
        body: `<div class="ds-wrap tk">${body}</div>`,
        active: '/tokens',
    });
}

module.exports = { tokensPage, howTo };
