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
    const cards = shown.map(f => `<article class="fo-card"><a class="fo-card-link" href="/fonts/${encodeURIComponent(f.id)}">
<h2 style="font-family:${esc(JSON.stringify(f.family))}">${esc(f.family)}</h2>
<p class="fo-sample" style="font-family:${esc(JSON.stringify(f.family))}">${esc('The quick brown fox jumps over the lazy dog.')}</p>
<p class="fo-meta"><span>${esc(f.category)}</span> · ${f.weights.length} ${f.weights.length === 1 ? 'weight' : 'weights'} · ${esc(f.license)}</p></a></article>`).join('');
    return layout({ title: 'Open font library', description: 'Browse open licence typefaces by category, script and weight.',
        path: '/fonts', active: '/fonts', styles: ['css/fonts.css'], scripts: ['js/fonts.js'],
        inlineStyles: [shown.map(f => face(f, f.files['400-normal'] ? 400 : f.weights[0], 'normal')).join('\n')],
        body: `<div class="fo"><header class="fo-hero"><p class="fo-eyebrow">The font library</p><h1>Find a face for your idea.</h1><p>Open licence typefaces with their source and licence beside them.</p></header>
<nav class="fo-chips" aria-label="Category"><a href="/fonts${filters.q ? `?q=${encodeURIComponent(filters.q)}` : ''}"${!filters.category ? ' aria-current="page"' : ''}>All <span>${fonts.length}</span></a>${categories.filter(c => fonts.some(f => f.category === c)).map(c => `<a href="/fonts?category=${encodeURIComponent(c)}${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ''}"${filters.category === c ? ' aria-current="page"' : ''}>${esc(c)} <span>${fonts.filter(f => f.category === c).length}</span></a>`).join('')}</nav>
<form class="fo-filters" method="get" action="/fonts">${filters.category ? `<input type="hidden" name="category" value="${esc(filters.category)}">` : ''}<label class="fo-q">Search<input type="search" name="q" value="${esc(filters.q || '')}" placeholder="Family or designer"></label>
${option(scripts, filters.script, 'Script')}${option([100,200,300,400,500,600,700,800,900], Number(filters.weight) || '', 'Weight')}
<button type="submit">Filter</button></form>
<label class="fo-try">Try your own words<input type="text" data-font-sample maxlength="140" placeholder="The quick brown fox jumps over the lazy dog."></label>
<p class="fo-count">${shown.length} of ${fonts.length} families</p><div class="fo-grid">${cards || '<p>No families match these filters.</p>'}</div></div>` });
}

function detail(f) {
    const style = ([key, url]) => {
        const [weight, kind] = key.split('-');
        return `<div class="fo-style"><div><b>${esc(weight)}${kind === 'italic' ? ' italic' : ''}</b><a href="${esc(url)}" download aria-label="Download ${esc(f.family)} ${esc(weight)} ${esc(kind)} (WOFF2)">WOFF2</a></div><p style="font-family:${esc(JSON.stringify(f.family))};font-weight:${weight};font-style:${kind}">The quick brown fox jumps over the lazy dog.</p></div>`;
    };
    // Upright first, lightest to heaviest, then the italics: the order a person reads a family in.
    const entries = Object.entries(f.files).sort(([a], [b]) => { const [wa, sa] = a.split('-'), [wb, sb] = b.split('-'); return (sa === sb ? 0 : sa === 'normal' ? -1 : 1) || Number(wa) - Number(wb); });
    const firstStyles = entries.slice(0, 6), moreStyles = entries.slice(6);
    const styles = `${firstStyles.map(style).join('')}`;
    const stylesMore = moreStyles.length ? `<details class="fo-more"><summary>More styles <span>(${moreStyles.length})</span></summary><div class="fo-styles">${moreStyles.map(style).join('')}</div></details>` : '';
    const url = previewFile(f);
    const css = `@font-face {\n  font-family: ${JSON.stringify(f.family)};\n  src: url("${url}") format("woff2");\n  font-weight: 400;\n  font-style: normal;\n  font-display: swap;\n}`;
    return layout({ title: f.family, description: `${f.family} by ${f.designer}: ${f.license} font, styles, CSS and download.`,
        path: `/fonts/${f.id}`, active: '/fonts', styles: ['css/fonts.css'], scripts: ['js/fonts.js'],
        preloads: f.sri ? [{ url, sri: f.sri }] : [],
        inlineStyles: [Object.keys(f.files).map(key => { const [w, s] = key.split('-'); return face(f, Number(w), s); }).join('\n')
            + f.pairings.filter(p => p.file).map(p => `@font-face{font-family:${JSON.stringify(p.family)};src:url(${JSON.stringify(p.file)}) format("woff2");font-weight:${Number(p.weight) || 700};font-style:normal;font-display:swap}`).join('\n')],
        body: `<div class="fo fo-detail"><a class="fo-back" href="/fonts">← All fonts</a><header class="fo-hero"><p class="fo-eyebrow">${esc(f.category)} · ${esc(f.version || '')}</p><h1 style="font-family:${esc(JSON.stringify(f.family))}">${esc(f.family)}</h1><p>Designed by ${esc(f.designer)}</p></header>
<label class="fo-try">Try your own words<input type="text" data-font-sample maxlength="140" placeholder="The quick brown fox jumps over the lazy dog."></label>
<section><h2>Every style <span class="fo-n">${entries.length}</span></h2><div class="fo-styles">${styles}</div>${stylesMore}</section>
<section class="fo-details"><div><h2>Use this font</h2><pre><code>${esc(css)}</code></pre><p><a href="${esc(url)}" download>Download the regular WOFF2</a>${f.sri ? `<span class="fo-integrity">SHA-384 integrity: <code>${esc(f.sri)}</code></span>` : ''}</p></div>
<div><h2>Licence and source</h2><p>${esc(f.license)} · <a href="${esc(f.license_url)}" rel="noopener">Licence and source files</a></p><p><a href="${esc(f.source)}" rel="noopener">${esc(f.source)}</a></p><p>Scripts: ${f.subsets.map(esc).join(', ')}</p><p>Weights: ${f.weights.join(', ')} · Styles: ${f.styles.map(esc).join(', ')}</p></div></section>
<section><h2>Suggested pairings</h2><p class="fo-note">A heading in the other face over ${esc(f.family)} for the text, chosen by contrast of form, x-height and era. Suggestions, not rules.</p><div class="fo-pairings">${f.pairings.map(p => `<article><p class="fo-pair-h" style="font-family:${esc(JSON.stringify(p.family))};font-weight:${Number(p.weight) || 700}">A heading in ${esc(p.family)}</p><p class="fo-pair-b" style="font-family:${esc(JSON.stringify(f.family))}">And the text under it in ${esc(f.family)}, the way a reader meets them together on a page.</p><p class="fo-pair-why"><a href="/fonts/${encodeURIComponent(p.id)}">${esc(p.family)}</a> · ${esc(p.reason)}</p></article>`).join('')}</div></section></div>` });
}

module.exports = { index, detail };
