'use strict';
/**
 * A glyph as a file (plan L32 I5): a standalone SVG with the person's choices, a PNG drawn from it, every glyph as a
 * ZIP of SVGs, and the font files openvibe-shared builds. The choices are the PNG maker's on /icons/<name>: size,
 * density, colour (or the mark's two), stroke weight, padding, a ground (none, a circle, a square or a squircle)
 * in its own colour, a finish (L44: flat; depth, light to deep in its own colour as the mark is drawn; a glow
 * behind it; or both), and a style (L50: the line drawing, the solid one, or auto: solid at 18 px and under when the
 * glyph has one, as the sites show it). Every value is clamped; anything unknown falls back to the default, so a URL
 * never fails.
 *
 *   options(query)  → { size, scale, color, stroke, pad, ground, bg, fx, style }, and isDefault(opts)
 *   drawnAs(name, opts) → 'line' or 'solid': what svg() draws for those choices
 *   query(opts)     → the query string that rebuilds the same file (only what differs from the default)
 *   svg(name, opts) → standalone SVG text, or null for an unknown glyph
 *   png(name, opts) → a PNG Buffer (resvg), or null
 *   zip()           → every glyph as <name>.svg plus LICENSE.txt, deflated
 *   PACK            → the downloads openvibe-shared ships: { file: { path, type, label, about } }
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const glyphs = require('openvibe-shared/glyphs');

const SHARED = path.dirname(require.resolve('openvibe-shared/glyphs'));
const MARK = ['#4f7cff', '#8b5cf6'];
const GROUNDS = ['none', 'circle', 'square', 'squircle'];
const FINISHES = ['flat', 'depth', 'glow', 'depth-glow'];
const STYLES = ['auto', 'line', 'solid'];
// The size at and under which "auto" draws the solid drawing: openvibe-shared's ov-glyphs.js switches at the same one.
const SOLID_BELOW = 18;
const DEFAULT = Object.freeze({ size: 256, scale: 1, color: '0f172a', stroke: 2, pad: 0, ground: 'none', bg: 'ffffff', fx: 'flat', style: 'auto' });
const SIZES = [16, 24, 32, 48, 64, 96, 128, 192, 256, 512, 1024];

/** A hex colour (no #) mixed toward `to` by t, as #rrggbb. */
function mix(c, to, t) {
    const full = (h) => (h.length === 3 ? h.split('').map((x) => x + x).join('') : h);
    const a = parseInt(full(c.replace(/^#/, '')), 16), b = parseInt(full(to), 16);
    return `#${[16, 8, 0].map((sh) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t).toString(16).padStart(2, '0')).join('')}`;
}
const hex = (v, d) => (/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || '').replace(/^#/, '')) ? String(v).replace(/^#/, '').toLowerCase() : d);
const num = (v, lo, hi, d, step = 1) => {
    const n = Number(v);
    return Number.isFinite(n) && v !== '' && v != null ? Math.min(hi, Math.max(lo, Math.round(n / step) * step)) : d;
};

function options(q = {}) {
    return {
        size: num(q.size, 16, 1024, DEFAULT.size),
        scale: num(q.scale, 1, 3, DEFAULT.scale),
        color: String(q.color || '').toLowerCase() === 'mark' ? 'mark' : hex(q.color, DEFAULT.color),
        stroke: num(q.stroke, 1, 3, DEFAULT.stroke, 0.25),
        pad: num(q.pad, 0, 40, DEFAULT.pad),
        ground: GROUNDS.includes(String(q.ground)) ? String(q.ground) : DEFAULT.ground,
        bg: hex(q.bg, DEFAULT.bg),
        fx: FINISHES.includes(String(q.fx)) ? String(q.fx) : DEFAULT.fx,
        style: STYLES.includes(String(q.style)) ? String(q.style) : DEFAULT.style,
    };
}
/** What a file with these choices shows: the solid drawing when asked (or small, on auto) and the glyph has one. */
function drawnAs(name, o = options()) {
    if (!glyphs.solid(name)) return 'line';
    return o.style === 'solid' || (o.style === 'auto' && o.size <= SOLID_BELOW) ? 'solid' : 'line';
}
/**
 * The solid drawing as plain SVG: what a page styles through the class "ln" (the parts that stay lines) written out as
 * attributes, so the file looks the same in an <img>, a design tool or a PNG.
 */
function solidMarkup(name, paint, width) {
    const line = `fill="none" stroke="${paint}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
    return glyphs.solid(name).replace(/class="ln"/g, line);
}
const isDefault = (o) => Object.keys(DEFAULT).every((k) => o[k] === DEFAULT[k]);
function query(o) {
    const p = new URLSearchParams();
    for (const k of Object.keys(DEFAULT)) if (o[k] !== DEFAULT[k] && !(k === 'bg' && o.ground === 'none')) p.set(k, String(o[k]));
    const s = p.toString();
    return s ? `?${s}` : '';
}

/** The glyph inside a larger box: padding is a share of the whole, the ground fills the box behind it. */
function svg(name, o = options()) {
    const inner = glyphs.path(name);
    if (!inner) return null;
    const box = +(24 / (1 - (2 * o.pad) / 100)).toFixed(3);
    const off = +((box - 24) / 2).toFixed(3);
    const px = o.size;
    const ground = o.ground === 'circle' ? `<circle cx="${box / 2}" cy="${box / 2}" r="${box / 2}" fill="#${o.bg}"/>`
        : o.ground === 'square' ? `<rect width="${box}" height="${box}" fill="#${o.bg}"/>`
            : o.ground === 'squircle' ? `<rect width="${box}" height="${box}" rx="${+(box * 0.225).toFixed(3)}" fill="#${o.bg}"/>` : '';
    const depth = o.fx === 'depth' || o.fx === 'depth-glow', glow = o.fx === 'glow' || o.fx === 'depth-glow';
    let stroke = o.color === 'mark' ? 'url(#ovg-mark)' : `#${o.color}`;
    let extra = o.color === 'mark' ? `<linearGradient id="ovg-mark" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24"><stop offset="0" stop-color="${depth ? mix(MARK[0], 'ffffff', 0.32) : MARK[0]}"/><stop offset="1" stop-color="${depth ? mix(MARK[1], '000000', 0.14) : MARK[1]}"/></linearGradient>` : '';
    if (depth && o.color !== 'mark') {
        // Light to deep in its own colour, the mixes the mark uses (as openvibe-shared mark.tones, a touch less light: a glyph is thinner), across the 24-unit grid.
        extra += `<linearGradient id="ovg-depth" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="24" y2="24"><stop offset="0" stop-color="${mix(o.color, 'ffffff', 0.22)}"/><stop offset="1" stop-color="${mix(o.color, '000000', 0.18)}"/></linearGradient>`;
        stroke = 'url(#ovg-depth)';
    }
    // The glow: the same lines, wider and blurred, behind the glyph (resvg draws feGaussianBlur).
    if (glow) extra += `<filter id="ovg-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${+(0.7 * o.stroke).toFixed(2)}"/></filter>`;
    const defs = extra ? `<defs>${extra}</defs>` : '';
    const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}" width="${px}" height="${px}">`
        + `<title>${name}</title>${defs}${ground}`;
    if (drawnAs(name, o) === 'solid') {
        // Filled in the line's paint; the parts that stay lines get the solid set's heavier line (2.6 at weight 2).
        const solid = solidMarkup(name, stroke, +(1.3 * o.stroke).toFixed(2));
        return head
            + (glow ? `<g transform="translate(${off} ${off})" fill="${stroke}" stroke="${stroke}" stroke-width="${+(o.stroke * 0.8).toFixed(2)}" stroke-linejoin="round" filter="url(#ovg-glow)" opacity=".6">${solid}</g>` : '')
            + `<g transform="translate(${off} ${off})" fill="${stroke}" stroke="none">${solid}</g></svg>`;
    }
    const drawn = name === 'busy' ? inner.replace(/stroke-width="[^"]*"/, `stroke-width="${+(3.4 * o.stroke / 2).toFixed(2)}"`) : inner;
    return head
        + (glow ? `<g transform="translate(${off} ${off})" fill="none" stroke="${stroke}" stroke-width="${+(o.stroke * 1.7).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" filter="url(#ovg-glow)" opacity=".7">${drawn}</g>` : '')
        + `<g transform="translate(${off} ${off})" fill="none" stroke="${stroke}" stroke-width="${o.stroke}" stroke-linecap="round" stroke-linejoin="round">${drawn}</g></svg>`;
}

// PNGs are drawn once per set of choices and kept for a while (a page shows a few, people tweak one).
const pngCache = new Map();
let Resvg = null;
function png(name, o = options()) {
    const key = `${name}${query(o)}`;
    if (pngCache.has(key)) return pngCache.get(key);
    const src = svg(name, o);
    if (!src) return null;
    if (!Resvg) ({ Resvg } = require('@resvg/resvg-js'));
    const out = new Resvg(src, { fitTo: { mode: 'width', value: o.size * o.scale }, font: { loadSystemFonts: false } }).render().asPng();
    pngCache.set(key, out);
    if (pngCache.size > 300) pngCache.delete(pngCache.keys().next().value);
    return out;
}

// ── A small ZIP writer (deflate, one central directory): enough for a folder of SVGs. ──
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipOf(entries) {
    const DOS_TIME = 0, DOS_DATE = ((2026 - 1980) << 9) | (10 << 5) | 31;   // a fixed date: the same glyphs give the same bytes
    const locals = [], central = [];
    let offset = 0;
    for (const { name, data } of entries) {
        const raw = Buffer.from(data);
        const packed = zlib.deflateRawSync(raw, { level: 9 });
        const nameBuf = Buffer.from(name, 'utf8');
        const crc = crc32(raw);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
        local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12); local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
        locals.push(local, nameBuf, packed);
        const dir = Buffer.alloc(46);
        dir.writeUInt32LE(0x02014b50, 0); dir.writeUInt16LE(20, 4); dir.writeUInt16LE(20, 6); dir.writeUInt16LE(0x0800, 8); dir.writeUInt16LE(8, 10);
        dir.writeUInt16LE(DOS_TIME, 12); dir.writeUInt16LE(DOS_DATE, 14); dir.writeUInt32LE(crc, 16); dir.writeUInt32LE(packed.length, 20);
        dir.writeUInt32LE(raw.length, 24); dir.writeUInt16LE(nameBuf.length, 28); dir.writeUInt32LE(offset, 42);
        central.push(dir, nameBuf);
        offset += 30 + nameBuf.length + packed.length;
    }
    const dirSize = central.reduce((a, b) => a + b.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(dirSize, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...locals, ...central, end]);
}

const LICENSE = `The OpenVibe glyphs — MIT License

Copyright (c) 2026 OpenVibe

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

https://openvibe.design/icons
`;
let zipped = null;
function zip() {
    if (!zipped) zipped = zipOf([...glyphs.NAMES.map((n) => ({ name: `ov-glyphs/${n}.svg`, data: glyphs.svg(n, { size: 24 }) })), { name: 'ov-glyphs/LICENSE.txt', data: LICENSE }]);
    return zipped;
}

/** What openvibe-shared ships beside the glyphs, offered as downloads (/icons/pack/<file>). */
const PACK = Object.freeze({
    'ov-glyphs.woff2': { path: path.join(SHARED, 'ov-glyphs.woff2'), type: 'font/woff2', label: 'WOFF2', about: 'the web font' },
    'ov-glyphs.ttf': { path: path.join(SHARED, 'glyph-fonts', 'ov-glyphs.ttf'), type: 'font/ttf', label: 'TTF', about: 'TrueType, for desktop apps' },
    'ov-glyphs.otf': { path: path.join(SHARED, 'glyph-fonts', 'ov-glyphs.otf'), type: 'font/otf', label: 'OTF', about: 'OpenType, for design tools' },
    'ov-glyphs.svg': { path: path.join(SHARED, 'ov-glyphs.svg'), type: 'image/svg+xml', label: 'SVG sprite', about: 'every glyph as a <symbol>' },
    'ov-glyphs-font.css': { path: path.join(SHARED, 'ov-glyphs-font.css'), type: 'text/css', label: 'Font CSS', about: 'class="ovi ovi-eye"' },
    'ov-glyphs-fa.css': { path: path.join(SHARED, 'ov-glyphs-fa.css'), type: 'text/css', label: 'Font Awesome names', about: 'class="fa-solid fa-eye" on the font' },
    'glyph-codepoints.json': { path: path.join(SHARED, 'glyph-codepoints.json'), type: 'application/json', label: 'Code points', about: 'each glyph\'s character' },
});
let codepoints = null;
function codepointOf(name) {
    if (!codepoints) { try { codepoints = JSON.parse(fs.readFileSync(PACK['glyph-codepoints.json'].path, 'utf8')).glyphs; } catch { codepoints = {}; } }
    return codepoints[name] || null;
}

module.exports = { options, isDefault, query, drawnAs, svg, png, zip, zipOf, crc32, PACK, codepointOf, DEFAULT, SIZES, GROUNDS, STYLES, SOLID_BELOW, MARK };
