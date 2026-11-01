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
<p class="kt-lede">${PARTS.length} parts, each one function call that returns plain HTML: escaped, phone first, on the site's own theme. Pages work without JavaScript; one small file adds the menus, copy buttons and sheets. All of it is ${weight.kb(css)} of CSS. How closely each OpenVibe site follows it, read from its code: <a href="https://openvibe.report/design">design health</a>.</p></header>
${nav}
<a class="kt-layout-card" href="/kit/layout"><span class="kt-kicker">New in 4.78</span><b>Layout without breakpoints</b><span>A fluid type and space scale, eight primitives that lay out by their own width, and a classless base. ${weight.kb(require('zlib').brotliCompressSync(Buffer.from(LAYOUT_FILE || ' ')).length)}.</span></a>
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

// ── /kit/layout: kit-layout.css (Shared 4.78.0, plan L54 K1/K2) ──
const LAYOUT_FILE = (() => { try { return require('fs').readFileSync(require('path').join(require('path').dirname(require.resolve('openvibe-shared/kit')), 'kit-layout.css'), 'utf8'); } catch { return ''; } })();
/** A token's clamp() read from the release's own file: its smallest and largest size in px. */
function clampOf(name) {
    const m = new RegExp(`${name.replace(/[-]/g, '\\-')}:\\s*clamp\\(([\\d.]+)rem,[^,]+,\\s*([\\d.]+)rem\\)`).exec(LAYOUT_FILE);
    return m ? [Math.round(Number(m[1]) * 160) / 10, Math.round(Number(m[2]) * 160) / 10] : null;
}
const box = (text, extra = '') => `<div class="kt-db"${extra}>${esc(text)}</div>`;
const PRIMITIVES = [
    ['stack', 'Stack', 'One under another, --gap apart. The rhythm of a column.', `<div class="ov-stack" style="--gap: var(--space-xs)">\n  ${['Title', 'One line about it', 'The action'].map((t) => `<div>${t}</div>`).join('\n  ')}\n</div>`],
    ['cluster', 'Cluster', 'A wrapping row: tags, buttons, a toolbar. It never overflows; it wraps.', `<div class="ov-cluster">\n  ${['IRL', 'Seattle', 'Night', 'Music', 'Chat picks', 'Walking'].map((t) => `<span>${t}</span>`).join('\n  ')}\n</div>`],
    ['sidebar', 'Sidebar', 'A side part --side wide beside the rest; it goes under once the rest would be narrower than --min.', `<div class="ov-sidebar" style="--side: 12rem; --min: 60%">\n  <aside>The side, 12rem</aside>\n  <div>The rest of the page</div>\n</div>`],
    ['switcher', 'Switcher', 'All side by side, or all stacked once the box is narrower than --min: never two and one.', `<div class="ov-switcher" style="--min: 36rem">\n  <div>Free</div>\n  <div>Creator</div>\n  <div>Studio</div>\n</div>`],
    ['grid', 'Grid', 'As many columns of at least --min as fit, and one on a phone.', `<div class="ov-grid" style="--min: 9rem">\n  ${[1, 2, 3, 4, 5, 6].map((n) => `<div>Card ${n}</div>`).join('\n  ')}\n</div>`],
    ['rail', 'Rail', 'One row that scrolls sideways and snaps: a long list that never makes a long page.', `<div class="ov-rail" style="--item: 10rem">\n  ${[1, 2, 3, 4, 5, 6, 7].map((n) => `<div>Clip ${n}</div>`).join('\n  ')}\n</div>`],
    ['cover', 'Cover', 'A box at least --min tall, its .is-centre child in the middle: a hero, an empty page.', `<section class="ov-cover" style="--min: 15rem">\n  <p>Above</p>\n  <h2 class="is-centre">In the middle</h2>\n  <p>Below</p>\n</section>`],
    ['frame', 'Frame', 'A box of --ratio that crops a picture or a video to fill it.', `<div class="ov-frame" style="--ratio: 21 / 9">\n  <img src="/brand/openvibe-mark-wide.svg" alt="">\n</div>`],
];

function kitLayout() {
    const kb = weight.kb;
    const zlib = require('zlib');
    const size = LAYOUT_FILE ? zlib.brotliCompressSync(Buffer.from(LAYOUT_FILE)).length : 0;
    const steps = [-2, -1, 0, 1, 2, 3, 4, 5].map((n) => [n, clampOf(`--step-${n < 0 ? `-${-n}` : n}`)]).filter(([, v]) => v);
    const spaces = ['3xs', '2xs', 'xs', 's', 'm', 'l', 'xl', '2xl', '3xl'].map((k) => [k, clampOf(`--space-${k}`)]).filter(([, v]) => v);
    const scale = `<div class="kt-steps">${steps.map(([n, [a, b]]) => `<div class="kt-step"><span class="kt-step-aa" style="font-size:var(--step-${n < 0 ? `-${-n}` : n})">Aa</span><code>--step-${n < 0 ? `-${-n}` : n}</code><small>${a}–${b} px</small></div>`).join('')}</div>
<div class="kt-spaces">${spaces.map(([k, [a, b]]) => `<div class="kt-space"><code>--space-${esc(k)}</code><i style="width:var(--space-${esc(k)})"></i><small>${a}–${b} px</small></div>`).join('')}</div>`;
    const demo = ([id, name, line, code]) => `<section class="kt-prim" id="kt-l-${esc(id)}" aria-labelledby="kt-l-${esc(id)}-h">
<div class="kt-prim-h"><h3 id="kt-l-${esc(id)}-h">${esc(name)} <code>.ov-${esc(id)}</code></h3><p>${esc(line)}</p></div>
<div class="kt-resize" data-prim="${esc(id)}">${code}</div>
${kit.fold({ title: 'The HTML', meta: `${code.split('\n').length} lines`, body: kit.snippet({ id: `kt-l-${id}-code`, code }) })}</section>`;
    const baseDemo = `<h2>A plain heading</h2>
<p>Plain text keeps to a readable measure, with <a href="/kit/layout">a link</a>, some <code>code</code> and <mark>a mark</mark>.</p>
<ul><li>A list, spaced to breathe</li><li>On the site's own theme</li></ul>
<blockquote>A quote stands apart.</blockquote>
<table><tr><th>Plan</th><th>Price</th></tr><tr><td>Creator</td><td>$6</td></tr></table>
<label for="kt-base-name">Your name</label><input id="kt-base-name" placeholder="Ana">
<button type="button">Save</button>`;
    const body = `<div class="kt kt-part kt-layout" id="kt-layout">
<nav class="kt-crumb" aria-label="Breadcrumb"><a href="/kit">The Kit</a><span aria-hidden="true">/</span><span>Layout</span></nav>
<header class="kt-part-h"><h1>Layout without breakpoints</h1>
<p class="kt-lede">A fluid scale for type and space, eight primitives that lay out by their own width (so they behave the same in a sidebar, a card or a whole page), and an opt-in base that finishes plain HTML.</p>
<ul class="kt-facts"><li><code>kit-layout.css</code></li><li>${size ? `${kb(size)} brotli` : 'not in this release'}</li><li>after kit.css</li><li>No script needed</li></ul></header>
<section class="kt-code" aria-labelledby="kt-l-use-h"><h2 id="kt-l-use-h">Use it</h2>${kit.snippet({ id: 'kt-l-use', code: `<link rel="stylesheet" href="${CDN}/kit.css">\n<link rel="stylesheet" href="${CDN}/kit-layout.css">` })}</section>
<section class="kt-scale" aria-labelledby="kt-l-scale-h"><h2 id="kt-l-scale-h">The fluid scale</h2>
<p class="kt-sub">Every step grows with the screen from 320 to 1240 px by <code>clamp()</code>: 16 px text on a phone, 18 px on a wide screen, and the headings more. Resize the window and watch it move.</p>${scale}</section>
<section class="kt-prims" aria-labelledby="kt-l-prims-h"><h2 id="kt-l-prims-h">Eight primitives</h2>
<p class="kt-sub">Each box below is the real thing. On a computer, drag its corner to make it narrower: the switcher stacks, the sidebar goes under, the grid drops a column.</p>
${PRIMITIVES.map(demo).join('')}</section>
<section class="kt-basesec" aria-labelledby="kt-l-base-h"><h2 id="kt-l-base-h">The classless base</h2>
<p class="kt-sub">Put <code>.ov-base</code> on <code>&lt;body&gt;</code> or <code>&lt;main&gt;</code>, and plain HTML looks finished. Every rule is inside <code>:where()</code>, so your own rules always win.</p>
<div class="ov-base kt-base-demo">${baseDemo}</div>
${kit.fold({ title: 'The HTML', meta: `${baseDemo.split('\n').length + 2} lines`, body: kit.snippet({ id: 'kt-l-base-code', code: `<main class="ov-base">\n  ${baseDemo.split('\n').join('\n  ')}\n</main>` }) })}</section>
<nav class="kt-pn" aria-label="More of the kit"><a href="/kit" class="kt-pn-all">All of the Kit</a></nav>
</div>`;
    return layout({
        title: 'Layout · The OpenVibe Kit',
        description: 'A fluid type and space scale, eight layout primitives that need no breakpoints, and an opt-in classless base: kit-layout.css, about 2.5 KB.',
        path: '/kit/layout', active: '/kit', body: `<div class="ds-wrap">${body}</div>`,
        styles: ['css/kit-pages.css'], sharedStyles: ['kit-layout.css'],
    });
}

module.exports = { kitIndex, kitPart, kitLayout, pretty, still, PRIMITIVES };
