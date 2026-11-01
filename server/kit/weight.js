'use strict';
/**
 * What a kit part weighs (plan L54 K3), measured from the CSS this release serves, never typed by hand:
 *
 *   files()       [{ file, bytes, brotli }]  kit.css, kit-web.js, kit-data.css, kit-data-web.js, kit.js
 *   ofPart(html)  { classes, rules, bytes, brotli, files: ['kit.css' | 'kit-data.css'] }
 *                 the rules (in either stylesheet) whose selector names only ovk- classes the part's own markup uses
 *
 * The stylesheets are split into rules by a small brace walker (comments dropped; a rule inside @media counts once,
 * as itself). Brotli at quality 11, as the CDN sends them.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SHARED = path.dirname(require.resolve('openvibe-shared/kit'));
const FILES = ['kit.css', 'kit-web.js', 'kit-data.css', 'kit-data-web.js', 'kit.js'];
const br = (text) => zlib.brotliCompressSync(Buffer.from(String(text)), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length;

/** Every style rule of a stylesheet: { selector, text }. */
function rulesOf(css) {
    const src = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '');
    const out = [];
    let i = 0;
    const walk = (end) => {
        while (i < src.length) {
            if (src[i] === '}') { i++; return; }
            const open = src.indexOf('{', i);
            const close = src.indexOf('}', i);
            if (open < 0 || (close >= 0 && close < open)) { i = close < 0 ? src.length : close + 1; return; }
            const head = src.slice(i, open).trim();
            i = open + 1;
            if (head.startsWith('@')) {
                if (/^@(media|supports|container|layer)\b/.test(head)) { walk(); continue; }
                let depth = 1;                                   // @keyframes, @font-face: skip the block whole
                while (i < src.length && depth) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
                continue;
            }
            const stop = src.indexOf('}', i);
            const body = src.slice(i, stop < 0 ? src.length : stop);
            i = stop < 0 ? src.length : stop + 1;
            if (head) out.push({ selector: head, text: `${head}{${body.trim()}}` });
        }
        return end;
    };
    walk();
    return out;
}

let loaded = null;
function load() {
    if (loaded) return loaded;
    const read = (f) => { try { return fs.readFileSync(path.join(SHARED, f), 'utf8'); } catch { return ''; } };
    const text = Object.fromEntries(FILES.map((f) => [f, read(f)]));
    loaded = {
        files: FILES.filter((f) => text[f]).map((f) => ({ file: f, bytes: Buffer.byteLength(text[f]), brotli: br(text[f]) })),
        rules: ['kit.css', 'kit-data.css'].flatMap((f) => rulesOf(text[f]).map((r) => ({ ...r, file: f }))),
    };
    return loaded;
}

const files = () => load().files;
const partCache = new Map();

/** The CSS a part's markup reaches: the rules made for its own ovk- classes. */
function ofPart(html) {
    const key = String(html || '');
    if (partCache.has(key)) return partCache.get(key);
    const classes = [...new Set((key.match(/\bovk-[a-z0-9-]+/g) || []))];
    const named = new Set(classes);
    // A rule is the part's when one of its selectors names only classes the part itself uses: `.ovk-btn` is the
    // button's, `.ovk-tool .ovk-btn` is the tool frame's.
    const mine = (sel) => { const cs = sel.match(/\.ovk-[a-z0-9-]+/g) || []; return cs.length > 0 && cs.every((c) => named.has(c.slice(1))); };
    const rules = load().rules.filter((r) => r.selector.split(',').some(mine));
    const css = rules.map((r) => r.text).join('');
    const out = {
        classes: classes.length,
        rules: rules.length,
        bytes: Buffer.byteLength(css),
        brotli: css ? br(css) : 0,
        files: [...new Set(rules.map((r) => r.file))],
    };
    partCache.set(key, out);
    return out;
}

const kb = (n) => (n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);

module.exports = { files, ofPart, rulesOf, kb };
