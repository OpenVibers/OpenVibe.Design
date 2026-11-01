'use strict';
/**
 * openvibe.design/kit (plan L54 K3): the OpenVibe Kit, part by part. The index shows every part drawn small, by group,
 * with what its CSS weighs; a part's page draws it for real, with the line that made it, the same thing for a page
 * that draws itself (the CDN), the HTML it returns, its weight against the whole kit, and where it is also native.
 *
 *   kitIndex()        /kit
 *   kitPart(id)       /kit/:id   (null when there is no such part)
 */
const kit = require('openvibe-shared/kit');
const components = require('openvibe-shared/components');
const { layout, esc } = require('../render/layout');
const { PARTS, GROUPS, HELPERS, byId, render } = require('../kit/parts');
const weight = require('../kit/weight');

const CDN = 'https://openvibe.network/shared';
const VERSION = (() => { try { return require('openvibe-shared/package.json').version; } catch { return ''; } })();
const NATIVE = new Set((() => { const s = components && components.SPECS; return Array.isArray(s) ? s.map((c) => c && c.id) : Object.keys(s || {}); })().filter(Boolean));

/** A sample drawn in a small box: never interactive, and its ids renamed so nothing on the page collides. */
// (aria-current too: kit-web.js keeps an open tab in view, and a thumbnail's tab is never the reader's.)
const still = (html) => String(html).replace(/\s(id|for|aria-controls|aria-labelledby|aria-describedby|aria-current|form|list)="/g, ' data-k$1="').replace(/<(\/?)main\b/g, '<$1div');
/** The sample on its own page: a <main> inside the page's main would be two. */
const staged = (part, html) => (part.id === 'page' ? String(html).replace(/<(\/?)main\b/g, '<$1div') : html);

/** The code line, broken where a reader would: between parts that are added, and between a long call's options. */
function pretty(code) {
    const pieces = [];
    let depth = 0, quote = null, start = 0;
    for (let i = 0; i < code.length; i++) {
        const ch = code[i];
        if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = null; continue; }
        if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
        if ('([{'.includes(ch)) depth++;
        else if (')]}'.includes(ch)) depth--;
        else if (depth === 0 && code.startsWith(' + ', i)) { pieces.push(code.slice(start, i)); start = i + 3; i += 2; }
    }
    pieces.push(code.slice(start));
    const split = (line) => {
        if (line.length <= 96) return line;
        let d = 0, q = null, out = '';
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            out += ch;
            if (q) { if (ch === '\\') { out += line[++i]; } else if (ch === q) q = null; continue; }
            if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue; }
            if ('([{'.includes(ch)) { d++; if (d === 2 && ch === '{') out += '\n   '; }
            else if (')]}'.includes(ch)) d--;
            else if (ch === ',' && d === 2) { out += '\n   '; if (line[i + 1] === ' ') i++; }
        }
        return out.replace(/\{\n {3}\s*/g, '{\n    ').replace(/\n {3}(?=\S)/g, '\n    ').replace(/ \}\)$/, '\n})')
            // An option that is a long list of objects: one object a line.
            .split('\n').map((l) => (l.length > 100 && /: \[\{/.test(l) ? l.replace(/: \[\{ /, ': [\n        { ').replace(/\}, \{ /g, '},\n        { ').replace(/ \}\](,?)$/, ' },\n    ]$1')
                : l.length > 100 && /: \[kit\./.test(l) ? l.replace(/: \[kit\./, ': [\n        kit.').replace(/\), kit\./g, '),\n        kit.').replace(/\)\](,?)$/, '),\n    ]$1') : l)).join('\n');
    };
    // A space put between two parts only to draw them apart is not part of the lesson.
    return pieces.map((p) => p.trim()).filter((p) => p !== "' '").map(split).join('\n  + ');
}

const fileChip = (f) => `<li class="kt-file"><code>${esc(f.file)}</code><span>${weight.kb(f.brotli)}</span></li>`;

function useCards() {
    const files = weight.files();
    const server = `// npm i https://codeload.github.com/OpenVibers/OpenVibe.Shared/tar.gz/refs/tags/v${VERSION}
const kit = require('openvibe-shared/kit');

res.send(kit.head({ title: 'Rooms' })
  + kit.list(rooms.map((r) => kit.row({ href: \`/r/\${r.slug}\`, title: r.name, sub: r.topic }))));`;
    const page = `<link rel="stylesheet" href="${CDN}/kit.css">
<script src="${CDN}/kit.js"></script>
<script src="${CDN}/kit-web.js" defer></script>

<script>
  const box = document.querySelector('#rooms');
  box.innerHTML = OpenVibeKit.list(rooms.map((r) => OpenVibeKit.row({ title: r.name, sub: r.topic })));
  OpenVibeKit.enhance(box);
</script>`;
    return `<section class="kt-use" aria-labelledby="kt-use-h"><h2 id="kt-use-h">Use it</h2>
<div class="kt-use-grid">
<div class="kt-use-card"><h3>On your server</h3><p>Every builder returns a string of HTML with its text escaped. The page is whole before any script runs.</p>${kit.snippet({ id: 'kt-use-server', code: server })}</div>
<div class="kt-use-card"><h3>In a page that draws itself</h3><p>The same builders on <code>window.OpenVibeKit</code>, from the CDN with open CORS. Call <code>enhance</code> after adding markup.</p>${kit.snippet({ id: 'kt-use-page', code: page })}</div>
<div class="kt-use-card"><h3>Copy the HTML</h3><p>Each part's page prints the HTML its call returns. Keep <code>kit.css</code> and it looks the same; without OpenVibe's theme, set <code>--bg-*</code>, <code>--text-*</code> and <code>--accent</code> yourself.</p>
<ul class="kt-files" aria-label="The files, brotli as served">${files.map(fileChip).join('')}</ul></div>
</div></section>`;
}

function kitIndex() {
    const tile = (p) => {
        const html = render(p);
        const w = weight.ofPart(html);
        return `<li class="kt-tile${p.wide ? ' kt-tile--wide' : ''}" id="kt-${esc(p.id)}">
<div class="kt-thumb" aria-hidden="true" inert>${still(html)}</div>
<div class="kt-tile-t"><a class="kt-tile-a" href="/kit/${esc(p.id)}">${esc(p.name)}</a><code>kit.${esc(p.fn)}()</code></div>
<p class="kt-tile-l">${esc(p.line)}</p>
<p class="kt-tile-w">${w.bytes ? `${weight.kb(w.brotli)} of CSS` : 'No CSS of its own'}${p.web ? ' · uses kit-web.js' : ''}</p></li>`;
    };
    const groups = GROUPS.map(([id, name, line]) => {
        const parts = PARTS.filter((p) => p.group === id);
        return `<section class="kt-group" id="kt-g-${esc(id)}" aria-labelledby="kt-g-${esc(id)}-h"><div class="kt-group-h"><h2 id="kt-g-${esc(id)}-h">${esc(name)}</h2><span>${parts.length}</span></div><p class="kt-group-l">${esc(line)}</p>
<ul class="kt-grid">${parts.map(tile).join('')}</ul></section>`;
    }).join('');
    const nav = `<nav class="kt-gnav" aria-label="Groups">${GROUPS.map(([id, name]) => `<a href="#kt-g-${esc(id)}">${esc(name)} <span>${PARTS.filter((p) => p.group === id).length}</span></a>`).join('')}</nav>`;
    const helpers = `<section class="kt-group kt-helpers" id="kt-g-helpers" aria-labelledby="kt-helpers-h"><div class="kt-group-h"><h2 id="kt-helpers-h">Helpers</h2><span>${HELPERS.length}</span></div><p class="kt-group-l">Small functions with nothing to draw.</p>
<dl class="kt-helper-list">${HELPERS.map(([call, what]) => `<div><dt><code>${esc(call)}</code></dt><dd>${esc(what)}</dd></div>`).join('')}</dl></section>`;
    const css = weight.files().filter((f) => /\.css$/.test(f.file)).reduce((a, f) => a + f.brotli, 0);
    const body = `<div class="kt" id="kt-index">
<header class="kt-hero"><p class="kt-kicker">The OpenVibe Kit${VERSION ? ` · v${esc(VERSION)}` : ''} · MIT</p>
<h1>Every piece an OpenVibe page is made of</h1>
<p class="kt-lede">${PARTS.length} parts, each one function call that returns plain HTML: escaped, phone first, on the site's own theme. Pages work without JavaScript; one small file adds the menus, copy buttons and sheets. All of it is ${weight.kb(css)} of CSS.</p></header>
${nav}
${useCards()}
${groups}
${helpers}
<p class="kt-more">Eleven parts are also drawn natively, in Jetpack Compose and SwiftUI: see <a href="/components">Components</a>. The icons are at <a href="/icons">Icons</a>.</p>
</div>`;
    return layout({
        title: 'The OpenVibe Kit',
        description: `${PARTS.length} UI parts as one function call each: plain, escaped HTML on any theme, phone first, with what each weighs. MIT, from npm or the CDN.`,
        path: '/kit', active: '/kit', body: `<div class="ds-wrap">${body}</div>`,
        styles: ['css/kit-pages.css'], sharedStyles: ['kit-data.css'], shared: ['kit-data-web.js'],
    });
}

function kitPart(id) {
    const part = byId.get(String(id || ''));
    if (!part) return null;
    const html = render(part);
    const w = weight.ofPart(html);
    const total = weight.files().filter((f) => /\.css$/.test(f.file)).reduce((a, f) => a + f.brotli, 0);
    const i = PARTS.indexOf(part);
    const prev = PARTS[(i - 1 + PARTS.length) % PARTS.length];
    const next = PARTS[(i + 1) % PARTS.length];
    const group = GROUPS.find(([g]) => g === part.group) || [part.group, part.group];
    const needsData = w.files.includes('kit-data.css');
    const cdn = [`<link rel="stylesheet" href="${CDN}/kit.css">`, needsData ? `<link rel="stylesheet" href="${CDN}/kit-data.css">` : null,
        `<script src="${CDN}/kit.js"></script>`, part.web || needsData ? `<script src="${CDN}/kit-web.js" defer></script>` : null,
        needsData && /chart|drop/.test(part.id) ? `<script src="${CDN}/kit-data-web.js" defer></script>` : null].filter(Boolean).join('\n');
    const inPage = `${cdn}\n\n<script>\n  const box = document.querySelector('#here');\n  box.innerHTML = ${pretty(part.code).replace(/\bkit\./g, 'OpenVibeKit.').split('\n').join('\n    ')};\n  OpenVibeKit.enhance(box);\n</script>`;
    const onServer = `const kit = require('openvibe-shared/kit');\n\nconst html = ${pretty(part.code).split('\n').join('\n  ')};`;
    const share = total ? Math.max(1, Math.round((w.brotli / total) * 100)) : 0;
    const native = NATIVE.has(part.id) || NATIVE.has(part.fn);
    const body = `<div class="kt kt-part" id="kt-part" data-part="${esc(part.id)}">
<nav class="kt-crumb" aria-label="Breadcrumb"><a href="/kit">The Kit</a><span aria-hidden="true">/</span><a href="/kit#kt-g-${esc(group[0])}">${esc(group[1])}</a></nav>
<header class="kt-part-h"><h1>${esc(part.name)}</h1><p class="kt-lede">${esc(part.line)}</p>
<ul class="kt-facts"><li><code>kit.${esc(part.fn)}()</code></li><li>${w.bytes ? `${weight.kb(w.brotli)} of CSS · ${w.rules} rule${w.rules === 1 ? '' : 's'}` : 'No CSS of its own'}</li>${w.files.map((f) => `<li>${esc(f)}</li>`).join('')}${part.web ? '<li>kit-web.js for its behaviour</li>' : '<li>No script needed</li>'}</ul></header>
<section class="kt-stage${part.wide ? ' kt-stage--wide' : ''}" aria-label="${esc(part.name)}, drawn by this release">${part.error ? `<p class="kt-err">This release cannot draw the sample: ${esc(part.error)}</p>` : staged(part, html)}</section>
<section class="kt-code" aria-labelledby="kt-code-h"><h2 id="kt-code-h">Use it</h2>
<h3>On your server</h3>${kit.snippet({ id: 'kt-server', code: onServer })}
<h3>In a page that draws itself</h3>${kit.snippet({ id: 'kt-page', code: inPage })}
${kit.fold({ id: 'kt-html', title: 'The HTML it returns', meta: weight.kb(Buffer.byteLength(html)), body: kit.snippet({ id: 'kt-html-code', code: html }) })}
</section>
<section class="kt-weight" aria-labelledby="kt-weight-h"><h2 id="kt-weight-h">What it weighs</h2>
<p>${w.bytes ? `Its own rules are ${weight.kb(w.bytes)}, ${weight.kb(w.brotli)} as sent: ${share}% of the kit's CSS. A page that draws it pays for the whole stylesheet once, and every other part comes free.` : 'Nothing of its own: it is text, styled by whatever holds it.'}</p>
${w.bytes ? `<div class="kt-bar" role="img" aria-label="${share} percent of the kit's CSS"><i style="width:${Math.min(100, share)}%"></i></div>` : ''}
${native ? `<p>It is also drawn natively: <a href="/components?c=${esc(part.id)}&amp;p=android">Jetpack Compose</a> and <a href="/components?c=${esc(part.id)}&amp;p=ios">SwiftUI</a>.</p>` : ''}</section>
<nav class="kt-pn" aria-label="More parts"><a href="/kit/${esc(prev.id)}" rel="prev"><small>Before</small>${esc(prev.name)}</a><a href="/kit" class="kt-pn-all">All ${PARTS.length}</a><a href="/kit/${esc(next.id)}" rel="next"><small>Next</small>${esc(next.name)}</a></nav>
</div>`;
    return layout({
        title: `${part.name} · The OpenVibe Kit`,
        description: `${part.line} kit.${part.fn}() in openvibe-shared, ${w.bytes ? `${weight.kb(w.brotli)} of CSS` : 'no CSS of its own'}.`,
        path: `/kit/${part.id}`, active: '/kit', body: `<div class="ds-wrap">${body}</div>`,
        styles: ['css/kit-pages.css'], sharedStyles: ['kit-data.css'], shared: ['kit-data-web.js'],
    });
}

module.exports = { kitIndex, kitPart, pretty, still };
