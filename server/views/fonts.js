'use strict';

const { layout, esc } = require('../render/layout');

const previewFile = f => f.files['400-normal'] || Object.values(f.files)[0];
const face = (f, weight = 400, style = 'normal') => {
    const url = f.files[`${weight}-${style}`];
    return url ? `@font-face{font-family:${JSON.stringify(f.family)};src:url(${JSON.stringify(url)}) format("woff2");font-weight:${weight};font-style:${style};font-display:swap}` : '';
};

function index(fonts, filters) {
    const categories = ['sans-serif', 'serif', 'display', 'handwriting', 'monospace'];
    const scripts = [...new Set(fonts.flatMap(f => f.subsets))].sort();
    const shown = fonts.filter(f => (!filters.q || `${f.family} ${f.designer}`.toLowerCase().includes(filters.q.toLowerCase()))
        && (!filters.category || f.category === filters.category)
        && (!filters.script || f.subsets.includes(filters.script))
        && (!filters.weight || f.weights.includes(Number(filters.weight))));
    const option = (values, selected, label) => `<label>${label}<select name="${label.toLowerCase()}"><option value="">All ${label.toLowerCase()}s</option>${values.map(v => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(String(v))}</option>`).join('')}</select></label>`;
    const cards = shown.map(f => `<article class="fo-card"><div class="fo-card-top"><span>${esc(f.category)}</span><span>${esc(f.license)}</span></div>
<h2><a href="/fonts/${encodeURIComponent(f.id)}">${esc(f.family)}</a></h2>
<p class="fo-sample" contenteditable="false" style="font-family:${esc(JSON.stringify(f.family))}">${esc('The quick brown fox jumps over the lazy dog.')}</p>
<p class="fo-meta">${esc(f.designer)} · ${f.weights.length} weights · ${f.subsets.length} scripts</p></article>`).join('');
    return layout({ title: 'Open font library', description: 'Browse open licence typefaces by category, script and weight.',
        path: '/fonts', active: '/fonts', styles: ['css/fonts.css'], scripts: ['js/fonts.js'],
        inlineStyles: [shown.map(f => face(f, f.files['400-normal'] ? 400 : f.weights[0], 'normal')).join('\n')],
        body: `<div class="fo"><header class="fo-hero"><p class="fo-eyebrow">The font library</p><h1>Find a face for your idea.</h1><p>Open licence typefaces with their source and licence beside them.</p></header>
<form class="fo-filters" method="get" action="/fonts"><label>Search<input type="search" name="q" value="${esc(filters.q || '')}" placeholder="Family or designer"></label>
${option(categories, filters.category, 'Category')}${option(scripts, filters.script, 'Script')}${option([100,200,300,400,500,600,700,800,900], Number(filters.weight) || '', 'Weight')}
<button type="submit">Filter</button></form>
<label class="fo-try">Try your own words<input type="text" data-font-sample maxlength="140" placeholder="The quick brown fox jumps over the lazy dog."></label>
<p class="fo-count">${shown.length} of ${fonts.length} families</p><div class="fo-grid">${cards || '<p>No families match these filters.</p>'}</div></div>` });
}

function detail(f) {
    const styles = Object.entries(f.files).map(([key, url]) => {
        const [weight, style] = key.split('-');
        return `<div class="fo-style"><div><b>${esc(weight)} ${esc(style)}</b><a href="${esc(url)}" download>Download WOFF2</a></div><p style="font-family:${esc(JSON.stringify(f.family))};font-weight:${weight};font-style:${style}">The quick brown fox jumps over the lazy dog.</p></div>`;
    }).join('');
    const url = previewFile(f);
    const css = `@font-face {\n  font-family: ${JSON.stringify(f.family)};\n  src: url("${url}") format("woff2");\n  font-weight: 400;\n  font-style: normal;\n  font-display: swap;\n}`;
    return layout({ title: f.family, description: `${f.family} by ${f.designer}: ${f.license} font, styles, CSS and download.`,
        path: `/fonts/${f.id}`, active: '/fonts', styles: ['css/fonts.css'], scripts: ['js/fonts.js'],
        preloads: f.sri ? [{ url, sri: f.sri }] : [],
        inlineStyles: [Object.keys(f.files).map(key => { const [w, s] = key.split('-'); return face(f, Number(w), s); }).join('\n')],
        body: `<div class="fo fo-detail"><a class="fo-back" href="/fonts">← All fonts</a><header class="fo-hero"><p class="fo-eyebrow">${esc(f.category)} · ${esc(f.version || '')}</p><h1 style="font-family:${esc(JSON.stringify(f.family))}">${esc(f.family)}</h1><p>Designed by ${esc(f.designer)}</p></header>
<label class="fo-try">Try your own words<input type="text" data-font-sample maxlength="140" placeholder="The quick brown fox jumps over the lazy dog."></label>
<section><h2>Every style</h2><div class="fo-styles">${styles}</div></section>
<section class="fo-details"><div><h2>Use this font</h2><pre><code>${esc(css)}</code></pre><p><a href="${esc(url)}" download>Download the regular WOFF2</a>${f.sri ? `<span class="fo-integrity">SHA-384 integrity: <code>${esc(f.sri)}</code></span>` : ''}</p></div>
<div><h2>Licence and source</h2><p>${esc(f.license)} · <a href="${esc(f.license_url)}" rel="noopener">Licence and source files</a></p><p><a href="${esc(f.source)}" rel="noopener">${esc(f.source)}</a></p><p>Scripts: ${f.subsets.map(esc).join(', ')}</p><p>Weights: ${f.weights.join(', ')} · Styles: ${f.styles.map(esc).join(', ')}</p></div></section>
<section><h2>Suggested pairings</h2><p>These suggestions use category, estimated x-height and era rules.</p><div class="fo-pairings">${f.pairings.map(p => `<article><h3><a href="/fonts/${p.id}">${esc(p.family)}</a></h3><p>${esc(p.reason)}</p></article>`).join('')}</div></section></div>` });
}

module.exports = { index, detail };
