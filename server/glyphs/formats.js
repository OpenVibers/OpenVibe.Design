'use strict';
/**
 * A glyph in every form people paste (plan L50 step 3: "easy to copy paste"): inline SVG for HTML, Vue, Svelte and
 * Solid; JSX for React; a data URI and a CSS mask; an Android VectorDrawable; an ES module; and a favicon set. All of
 * them are the same drawing as /icons/<name>.svg, built from openvibe-shared/glyphs, so nothing here can drift.
 *
 *   shapes(markup)          → [{ tag, attrs }] the drawing's shapes (path, circle, rect, ellipse, line, polyline)
 *   toPath(shape)           → SVG path data for any of those shapes (Android draws paths only)
 *   inlineSvg(name, o)      → <svg …> with currentColor, for HTML, Vue, Svelte and Solid
 *   jsx(name, o)            → the same as React JSX (camelCase attributes, className)
 *   dataUri(name, o)        → data:image/svg+xml,… in a fixed colour (an <img> or a CSS url() has no currentColor)
 *   cssMask(name, o)        → a CSS class that paints the glyph in currentColor through a mask
 *   vectorDrawable(name, o) → Android's res/drawable XML
 *   esModule(name)          → export default { name, line, solid }
 *   faviconZip(name, o)     → favicon.svg, PNGs at 32, 180, 192 and 512, a web manifest and the <head> lines
 *
 * o is export.js's options(); `style` picks the line or the solid drawing as it does for the SVG and PNG.
 */
const glyphs = require('openvibe-shared/glyphs');
const ex = require('./export');

const SHAPE = /<(path|circle|rect|ellipse|line|polyline)\b([^>]*?)\/?>/g;
const ATTR = /([a-zA-Z][\w:-]*)="([^"]*)"/g;

function shapes(markup) {
    return [...String(markup || '').matchAll(SHAPE)].map((m) => ({ tag: m[1], attrs: Object.fromEntries([...m[2].matchAll(ATTR)].map((a) => [a[1], a[2]])) }));
}

const n = (v) => +(+v || 0).toFixed(3);
function toPath({ tag, attrs: a }) {
    if (tag === 'path') return a.d || '';
    if (tag === 'circle' || tag === 'ellipse') {
        const cx = n(a.cx), cy = n(a.cy), rx = n(tag === 'circle' ? a.r : a.rx), ry = n(tag === 'circle' ? a.r : a.ry);
        return `M${n(cx - rx)} ${cy}a${rx} ${ry} 0 1 0 ${n(2 * rx)} 0a${rx} ${ry} 0 1 0 ${n(-2 * rx)} 0Z`;
    }
    if (tag === 'rect') {
        const x = n(a.x), y = n(a.y), w = n(a.width), h = n(a.height);
        const rx = Math.min(n(a.rx != null ? a.rx : a.ry), w / 2), ry = Math.min(n(a.ry != null ? a.ry : a.rx), h / 2);
        if (!rx) return `M${x} ${y}h${w}v${h}h${n(-w)}Z`;
        return `M${n(x + rx)} ${y}h${n(w - 2 * rx)}a${rx} ${ry} 0 0 1 ${rx} ${ry}v${n(h - 2 * ry)}a${rx} ${ry} 0 0 1 ${n(-rx)} ${ry}`
            + `h${n(-(w - 2 * rx))}a${rx} ${ry} 0 0 1 ${n(-rx)} ${n(-ry)}v${n(-(h - 2 * ry))}a${rx} ${ry} 0 0 1 ${rx} ${n(-ry)}Z`;
    }
    if (tag === 'line') return `M${n(a.x1)} ${n(a.y1)}L${n(a.x2)} ${n(a.y2)}`;
    if (tag === 'polyline') {
        const pts = String(a.points || '').trim().split(/[\s,]+/).map(Number);
        const pairs = [];
        for (let i = 0; i + 1 < pts.length; i += 2) pairs.push(`${n(pts[i])} ${n(pts[i + 1])}`);
        return pairs.length ? `M${pairs.join('L')}` : '';
    }
    return '';
}

/** Which drawing these choices show, and its markup. */
function drawing(name, o) {
    const solid = ex.drawnAs(name, o) === 'solid';
    return { solid, markup: solid ? glyphs.solid(name) : glyphs.path(name) };
}
const colourOf = (o) => (o.color === 'mark' ? ex.MARK[0] : `#${o.color}`);

/** <svg> with currentColor: what HTML, Vue, Svelte, Solid and Angular take as it is. */
function inlineSvg(name, o = ex.options({ size: 24 })) {
    const { solid, markup } = drawing(name, o);
    if (!markup) return '';
    const size = o.size;
    if (solid) {
        const body = markup.replace(/class="ln"/g, 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"');
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${body}</svg>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${o.stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${markup}</svg>`;
}

/** The inline SVG as React JSX: camelCase attributes, className, numbers in braces where React expects them. */
function jsx(name, o = ex.options({ size: 24 })) {
    const svg = inlineSvg(name, o);
    if (!svg) return '';
    // aria-* and data-* keep their dashes in React; every other dashed SVG attribute is camelCase.
    const camel = (k) => (k === 'class' ? 'className' : /^(xmlns|aria-|data-)/.test(k) ? k : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
    // React takes these attributes as strings ("2" for strokeWidth), so only the names change.
    const body = svg.replace(/([a-zA-Z][\w-]*)="([^"]*)"/g, (_, k, v) => `${camel(k)}="${v}"`);
    const fn = name.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
    return `export function ${fn}Icon(props) {\n    return (\n        ${body.replace('aria-hidden="true">', 'aria-hidden="true" {...props}>')}\n    );\n}`;
}

/** An SVG for places with no currentColor (an <img>, a CSS url()): the drawing in a fixed colour. */
function fixedSvg(name, o, colour) {
    return inlineSvg(name, o).replace(/currentColor/g, colour).replace(' aria-hidden="true"', '');
}
const enc = (svg) => `data:image/svg+xml,${svg.replace(/"/g, "'").replace(/[<>#%{}\n]/g, (c) => encodeURIComponent(c))}`;
function dataUri(name, o = ex.options({ size: 24 })) {
    return inlineSvg(name, o) ? enc(fixedSvg(name, o, colourOf(o))) : '';
}

/** A class that paints the glyph in the text's colour (currentColor) through a mask: no markup, any element. */
function cssMask(name, o = ex.options({ size: 24 })) {
    if (!inlineSvg(name, o)) return '';
    const url = enc(fixedSvg(name, o, '#000'));
    return `.icon-${name} {\n    display: inline-block;\n    width: 1em;\n    height: 1em;\n    vertical-align: -0.125em;\n    background-color: currentColor;\n`
        + `    -webkit-mask: url("${url}") center / contain no-repeat;\n    mask: url("${url}") center / contain no-repeat;\n}`;
}

/** Android's VectorDrawable (res/drawable/ic_<name>.xml): paths only, so every shape becomes path data. */
function vectorDrawable(name, o = ex.options({ size: 24 })) {
    const { solid, markup } = drawing(name, o);
    if (!markup) return '';
    const argb = (hex) => `#FF${hex.replace('#', '').toUpperCase()}`;
    const colour = argb(colourOf(o).length === 4 ? colourOf(o).replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') : colourOf(o));
    const stroke = (w) => `android:fillColor="#00000000" android:strokeColor="${colour}" android:strokeWidth="${w}" android:strokeLineCap="round" android:strokeLineJoin="round"`;
    const paths = shapes(markup).map((s) => {
        const d = toPath(s);
        if (!d) return '';
        if (!solid) return `    <path android:pathData="${d}" ${stroke(s.attrs['stroke-width'] || o.stroke)}/>`;
        if (s.attrs.class === 'ln') return `    <path android:pathData="${d}" ${stroke(2.6)}/>`;
        return `    <path android:pathData="${d}" android:fillColor="${colour}"${s.attrs['fill-rule'] === 'evenodd' ? ' android:fillType="evenOdd"' : ''}/>`;
    }).filter(Boolean);
    return `<?xml version="1.0" encoding="utf-8"?>\n<!-- ${name}: the OpenVibe glyphs, MIT. https://openvibe.design/icons/${name} -->\n`
        + `<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="24dp"\n    android:height="24dp"\n    android:viewportWidth="24"\n    android:viewportHeight="24">\n${paths.join('\n')}\n</vector>\n`;
}

/** An ES module: the drawings as strings, for a build step or a framework component of your own. */
function esModule(name) {
    const line = glyphs.path(name);
    if (!line) return '';
    return `// ${name}: the OpenVibe glyphs, MIT. https://openvibe.design/icons/${name}\n`
        + `// 24-unit grid. line: strokes (fill none, stroke currentColor, width 2, round). solid: fills; class "ln" stays a line.\n`
        + `export const name = ${JSON.stringify(name)};\nexport const line = ${JSON.stringify(line)};\nexport const solid = ${JSON.stringify(glyphs.solid(name) || '')};\n`
        + 'export default { name, line, solid };\n';
}

/** A favicon set from the PNG maker's choices: the files and the lines for <head>. */
function faviconZip(name, o) {
    if (!glyphs.path(name)) return null;
    // A favicon reads best with room and a ground; the maker's choices win when given.
    const base = { ...o, scale: 1, style: o.style };
    const png = (size) => ex.png(name, { ...base, size: Math.min(1024, Math.max(16, size)) });
    const head = '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">\n'
        + '<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<link rel="manifest" href="/site.webmanifest">\n';
    const manifest = JSON.stringify({ icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2) + '\n';
    return ex.zipOf([
        { name: 'favicon.svg', data: ex.svg(name, { ...base, size: 32 }) },
        { name: 'favicon-32.png', data: png(32) },
        { name: 'apple-touch-icon.png', data: png(180) },
        { name: 'icon-192.png', data: png(192) },
        { name: 'icon-512.png', data: png(512) },
        { name: 'site.webmanifest', data: manifest },
        { name: 'head.html', data: head },
    ]);
}

module.exports = { shapes, toPath, inlineSvg, jsx, dataUri, cssMask, vectorDrawable, esModule, faviconZip };
