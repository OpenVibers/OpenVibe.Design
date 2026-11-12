'use strict';

/**
 * The self-hosted fonts under /fonts: vendored from the Fontsource packages by scripts/fetch-fonts.js. One source
 * of truth (public/fonts/fonts.json) feeds the page, GET /api/v1/fonts and GET /fonts/css2.
 *
 * css2 takes the same query Google's CSS API does for the part we use: repeated `family=Name+With+Spaces`,
 * an optional `:wght@400;700` and `display=swap`. A family we do not have is a CSS comment, never an error.
 */

const FONTS = require('../../public/fonts/fonts.json');

const ORIGIN = 'https://openvibe.design';
// Google's latin range: the faces we vendor are the latin subset, so a browser downloads one only when it needs it.
const LATIN_RANGE = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

const bySlug = new Map(FONTS.map((f) => [f.slug, f]));
const byFamily = new Map(FONTS.map((f) => [f.family.toLowerCase(), f]));

const fontFor = (name) => bySlug.get(String(name || '').toLowerCase()) || byFamily.get(String(name || '').trim().toLowerCase()) || null;

function fileUrl(font, weight) {
    return `${ORIGIN}/fonts/${font.slug}/${font.slug}-latin-${weight}-normal.woff2`;
}

function fontFiles(font) {
    const files = {};
    for (const weight of font.weights) files[`${weight}-normal`] = fileUrl(font, weight);
    return files;
}

/** A https origin under an OpenVibe domain: openvibe.design, pdf.openvibe.tools, openvibe.network, any openvibe.*. */
function openVibeOrigin(origin) {
    let url;
    try { url = new URL(String(origin || '')); } catch { return null; }
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (!/(^|\.)openvibe\.[a-z]{2,}$/i.test(url.hostname)) return null;
    return url.origin;
}

/** CORS on the CSS and the woff2 files: a font is cross-origin by nature, but only to OpenVibe's own sites. */
function allowFontCors(req, res) {
    res.set('Vary', 'Origin');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    const origin = openVibeOrigin(req.get && req.get('origin'));
    if (origin) res.set('Access-Control-Allow-Origin', origin);
}

function requestedFamilies(query) {
    const raw = query && query.family;
    const values = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    return values.map((value) => {
        const text = String(value);
        const at = text.indexOf(':');
        const name = (at === -1 ? text : text.slice(0, at)).trim().slice(0, 100);
        const spec = at === -1 ? '' : text.slice(at + 1);
        const match = /(?:^|[&,])wght@([0-9;]+)/.exec(spec);
        const weights = match ? match[1].split(';').map(Number).filter((n) => Number.isInteger(n) && n >= 100 && n <= 900) : null;
        return { name, weights };
    }).filter((x) => x.name);
}

function cssFor(query) {
    const display = /^(auto|block|swap|fallback|optional)$/.test(String((query && query.display) || '')) ? String(query.display) : 'swap';
    const out = [];
    for (const { name, weights } of requestedFamilies(query)) {
        const font = fontFor(name);
        if (!font) {
            out.push(`/* ${name.replace(/\*\//g, '* /')}: no self-hosted family by that name */`);
            continue;
        }
        const chosen = weights ? font.weights.filter((w) => weights.includes(w)) : font.weights;
        for (const weight of chosen) {
            out.push(`@font-face {
  font-family: "${font.family}";
  font-style: normal;
  font-weight: ${weight};
  font-display: ${display};
  src: url("${fileUrl(font, weight)}") format("woff2");
  unicode-range: ${LATIN_RANGE};
}`);
        }
    }
    return `${out.join('\n')}\n`;
}

module.exports = { FONTS, ORIGIN, LATIN_RANGE, fontFor, fontFiles, fileUrl, openVibeOrigin, allowFontCors, cssFor };
