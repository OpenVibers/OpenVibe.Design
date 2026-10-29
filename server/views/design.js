'use strict';

const { layout, esc } = require('../render/layout');
const { attrEscape } = require('../arena/sanitize');
const { themeCss } = require('../designs');

const examples = ['Landing page for a coffee roaster', 'Dashboard for a fitness app', 'Pricing section', 'Mobile onboarding'];

function create({ recent = [] } = {}) {
    const body = `<section class="dv-create"><h1>What will you design?</h1>
<form method="post" action="/create"><label class="dv-visually-hidden" for="dv-prompt">Describe your design</label>
<textarea id="dv-prompt" name="prompt" required maxlength="4000" placeholder="Describe a page, an app screen or a component…"></textarea>
<button type="submit">Create designs</button></form>
<div class="dv-examples" aria-label="Try an example">${examples.map(x => `<button type="button" data-example="${esc(x)}">${esc(x)}</button>`).join('')}</div>
${recent.length ? `<section class="dv-recent"><h2>Your recent designs</h2><ul>${recent.map(d => `<li><a href="${esc(d.url)}">${esc(d.prompt)}</a></li>`).join('')}</ul></section>` : ''}</section>`;
    return layout({ title: 'Create a design', path: '/create', body, active: '/create', scripts: ['js/design.js'] });
}

const themeListener = `<script>(function(){addEventListener('message',function(event){if(event.source!==parent||!event.data||event.data.type!=='design-theme')return;var style=document.getElementById('design-tokens');if(style&&typeof event.data.css==='string')style.textContent=event.data.css;});})();</script>`;
const framePolicy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">`;

function frame(html, title) {
    const document = html.replace(/<head\b[^>]*>/i, `$&${framePolicy}`)
        .replace(/<\/body>/i, `${themeListener}</body>`);
    return `<iframe title="${esc(title)}" sandbox="allow-scripts" referrerpolicy="no-referrer" loading="lazy" srcdoc="${attrEscape(document)}"></iframe>`;
}

function canvas({ data, themes = [], editKey = '' }) {
    const { design, variants } = data;
    const cards = variants.map(v => `<article class="dv-card" data-status="${esc(v.status)}">
<div class="dv-frame">${v.status === 'done' ? frame(v.html, `${v.model || 'Design'} frame`) :
        `<div class="dv-skeleton" role="status"><span>${esc(v.model || 'Designer')}</span><small>${esc(v.status === 'failed' ? 'Could not generate' : 'Creating…')}</small></div>`}</div>
<div class="dv-label"><span>${esc(v.model || 'Designer')}</span>${v.status === 'done' ?
        `<span>${(Number(v.ms || 0) / 1000).toFixed(1)} s · $${Number(v.costUsd || 0).toFixed(4)}</span>` : ''}</div></article>`).join('');
    const themeOptions = themes.map(t => `<option value="${esc(t.id)}"${t.id === design.themeId ? ' selected' : ''}>${esc(t.name)}</option>`).join('');
    const cssByTheme = Object.fromEntries(themes.map(t => [t.id, themeCss(t.variables || {})]));
    const cssJson = JSON.stringify(cssByTheme).replace(/</g, '\\u003c');
    const body = `<section class="dv-canvas" data-id="${esc(design.id)}" data-key="${esc(editKey)}">
<header class="dv-heading"><a href="/create">← New design</a><h1>${esc(design.prompt)}</h1>
<p id="dv-status" role="status">${esc(design.status === 'done' ? 'Three designs ready.' : design.status === 'failed' ? 'Generation failed.' : 'Designers are working…')}</p></header>
<div class="dv-rail" id="dv-rail">${cards}</div>
<nav class="dv-toolbar" aria-label="Canvas tools"><label>Device <select id="dv-device"><option value="390">Phone · 390</option><option value="834">Tablet · 834</option><option value="1280">Desktop · 1280</option></select></label>
<form method="post" action="/d/${encodeURIComponent(design.id)}/theme" id="dv-theme-form"><input type="hidden" name="key" value="${esc(editKey)}"><label>Theme <select id="dv-theme" name="themeId">${themeOptions}</select></label><button type="submit">Apply</button></form></nav>
</section><script type="application/json" id="dv-theme-css">${cssJson}</script>`;
    return layout({ title: 'Design canvas', path: `/d/${encodeURIComponent(design.id)}`, robots: 'noindex, nofollow',
        body, scripts: ['js/design.js'] });
}

module.exports = { create, canvas, frame };
