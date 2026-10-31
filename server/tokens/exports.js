'use strict';
/**
 * The token files a tool can fetch: GET /tokens/<theme>.<ext>. One theme — a built-in or a community one — as the file
 * each tool reads: the DTCG JSON, the CSS variables, the Tailwind preset, the Style Dictionary source, the Swift, the
 * Kotlin and the Android XML.
 *
 * The list of formats is here so a page can name them all (the format, its file name and what it is).
 *
 *   FORMATS              [{ id, ext, label, type }]
 *   parse(file)          a file name → { format, themeId } (null when the format is not one of ours)
 *   findTheme(list, id)  a built-in theme, or a community one from the catalogue; null when there is none
 *   render(format, theme) the file's source text
 */
const { BUILTIN_THEMES, deriveTokens } = require('openvibe-shared/builtin-themes');
const kit = require('./kit');
const formats = require('./formats');

// The formats, the file name each one answers to, and what it is. The order is the order a page lists them in.
const FORMATS = [
    { id: 'tokens', ext: 'tokens.json', label: 'Design tokens (JSON)', type: 'application/json' },
    { id: 'css', ext: 'css', label: 'CSS variables', type: 'text/css' },
    { id: 'tailwind', ext: 'tailwind.js', label: 'Tailwind preset', type: 'text/javascript' },
    { id: 'style-dictionary', ext: 'style-dictionary.json', label: 'Style Dictionary', type: 'application/json' },
    { id: 'swift', ext: 'swift', label: 'iOS (Swift)', type: 'text/plain' },
    { id: 'kotlin', ext: 'kt', label: 'Android (Kotlin)', type: 'text/plain' },
    { id: 'android', ext: 'xml', label: 'Android (colors.xml)', type: 'application/xml' },
];

const BUILDERS = {
    tokens: formats.tokensJson,
    css: formats.css,
    tailwind: formats.tailwind,
    'style-dictionary': formats.styleDictionary,
    swift: formats.swift,
    kotlin: formats.kotlin,
    android: formats.androidXml,
};

// The longest file name first, so "style-dictionary.json" is not read as "json".
const BY_EXT = FORMATS.slice().sort((a, b) => b.ext.length - a.ext.length);

/** A file name → the format it is and the theme it is for. Null when the format is not one of ours. */
function parse(file) {
    const name = String(file || '').trim();
    if (!name) return null;
    for (const f of BY_EXT) {
        const suffix = `.${f.ext}`;
        if (name.length > suffix.length && name.toLowerCase().endsWith(suffix.toLowerCase())) {
            return { format: f, themeId: name.slice(0, name.length - suffix.length) };
        }
    }
    return null;
}

/**
 * A theme by its id or slug: a built-in one first (the network's own list, unchanged), then a community one from the
 * catalogue with the readable text and status colours the kit derives. "default" is Vibe.
 */
function findTheme(list, idOrSlug) {
    const key = String(idOrSlug || '').trim().toLowerCase();
    if (!key) return null;
    const wanted = key === 'default' ? 'vibe' : key;
    const builtin = BUILTIN_THEMES.find((t) => t && (String(t.id).toLowerCase() === wanted || String(t.slug || '').toLowerCase() === wanted));
    if (builtin) return { theme: builtin, builtin: true };
    const community = (Array.isArray(list) ? list : []).find((t) => t && (
        String(t.slug || '').toLowerCase() === wanted || String(t.id || '').toLowerCase() === wanted));
    if (!community) return null;
    const mode = community.mode === 'light' ? 'light' : 'dark';
    return {
        theme: { ...community, slug: community.slug || String(community.id || ''), mode, variables: deriveTokens({ ...(community.variables || {}) }, mode) },
        builtin: false,
    };
}

/** The file's source text for a theme. Null when the format is not one of ours. */
function render(formatId, theme) {
    const build = BUILDERS[formatId];
    if (!build || !theme) return null;
    return build(kit.tokenDocument(theme));
}

/** The format a page can list, with the file name each one is fetched by. */
function list() {
    return FORMATS.map(({ id, ext, label, type }) => ({ id, ext, label, type }));
}

module.exports = { FORMATS, list, parse, findTheme, render, MOTION: kit.MOTION, BRAND: kit.BRAND };
