'use strict';
/**
 * Any theme in the catalog as OpenVibe Tokens (openvibe-shared/tokens): the semantic design-token document, and its
 * code for the web, Android, iOS, Flutter and Figma. The catalog (OpenVibe.Network) carries a theme's own colours;
 * deriveTokens adds the readable text, status and on-accent colours every site derives, so the export is exactly the
 * theme the network paints. A theme with a light or dark half (builtin-themes PAIRS) exports both by default.
 *
 *   resolve(list, idOrSlug, { both })  → { theme, other, docs: [dark, light?] } | null
 *   TARGETS                             → openvibe-shared/tokens' targets, with the response type of each
 */
const tokens = require('openvibe-shared/tokens');
const { deriveTokens, PAIRS } = require('openvibe-shared/builtin-themes');

const TYPES = { json: 'application/json', figma: 'application/json' };
const TARGETS = tokens.TARGETS.map((t) => ({ ...t, type: TYPES[t.id] || 'text/plain' }));

const modeOf = (doc) => ((doc.$extensions && doc.$extensions['network.openvibe']) || {}).mode;

function resolve(list, idOrSlug, { both = true } = {}) {
    const themes = Array.isArray(list) ? list : [];
    const key = String(idOrSlug || '').toLowerCase();
    const find = (k) => themes.find((t) => t && (String(t.slug).toLowerCase() === k || String(t.id).toLowerCase() === k));
    const theme = find(key);
    if (!theme) return null;
    const pairSlug = ((PAIRS || []).find((p) => p.includes(theme.slug) || p.includes(theme.id)) || []).find((s) => s !== theme.slug && s !== theme.id);
    const other = both && pairSlug ? find(pairSlug) || null : null;
    const full = (t) => ({ ...t, variables: deriveTokens({ ...(t.variables || {}) }, t.mode === 'light' ? 'light' : 'dark') });
    const docs = [tokens.fromTheme(full(theme))].concat(other ? [tokens.fromTheme(full(other))] : []);
    docs.sort((a, b) => (modeOf(a) === 'dark' ? 0 : 1) - (modeOf(b) === 'dark' ? 0 : 1));
    return { theme, other, docs };
}

module.exports = { resolve, TARGETS, compile: tokens.compile, fileName: tokens.fileName, flatten: tokens.flatten, parseColor: tokens.parseColor, ident: tokens.ident, modeOf };
