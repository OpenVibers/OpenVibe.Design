'use strict';

/**
 * A small, deterministic card for a design in the recent list.
 *
 * The repository has no HTML→image renderer: designs are sanitized documents drawn in iframes and the only
 * raster path (server/glyphs/export.js, @resvg/resvg-js) renders SVG. So a thumbnail is a generated SVG card
 * in the design's own look, made at save time and served from `/api/create/designs/:id/thumb.svg`. A real
 * screenshot needs a headless browser or a rendering service; the API says `thumbnailRenderer: "card"` so the
 * screen can tell them apart.
 */

const COLOUR = /^(#[0-9a-f]{3,8}|rgba?\([0-9., %]+\)|hsla?\([0-9., %]+\))$/i;

function esc(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function colourOf(variables, names, fallback) {
    for (const name of names) {
        const value = variables && variables[name];
        if (typeof value === 'string' && COLOUR.test(value.trim())) return value.trim();
    }
    return fallback;
}

function lines(text, max, width) {
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const out = [];
    let line = '';
    for (const word of words) {
        if ((line + ' ' + word).trim().length > width) {
            if (line) out.push(line);
            line = word;
            if (out.length >= max - 1) break;
        } else {
            line = (line + ' ' + word).trim();
        }
    }
    if (line && out.length < max) out.push(line);
    return out;
}

/**
 * `look` is { kind, kindName, prompt, model, variables }. The card is 640×400, a theme-coloured ground, the
 * kind, the first lines of the prompt and the model that drew it.
 */
function makeThumbnail({ kind = 'page', kindName = 'Design', prompt = '', model = null, variables = {} } = {}) {
    const bg = colourOf(variables, ['--bg-primary', '--surface', '--bg-secondary'], '#0b0f1a');
    const text = colourOf(variables, ['--text-primary', '--on-bg', '--text'], '#e6edf7');
    const accent = colourOf(variables, ['--accent', '--text-link', '--text-primary'], '#7aa7ff');
    const muted = colourOf(variables, ['--text-muted', '--text-secondary', '--text'], text);
    const title = lines(prompt || kindName, 3, 26);
    const titleText = title.length
        ? title.map((line, i) => `<text x="48" y="${188 + i * 46}" font-size="34" font-weight="600" fill="${esc(text)}">${esc(line)}</text>`).join('')
        : '';
    const byline = model ? String(model).slice(0, 48) : 'OpenVibe.Design';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400" role="img" aria-label="${esc(String(prompt || kindName).slice(0, 120))}">
<rect width="640" height="400" fill="${esc(bg)}"/>
<rect x="0" y="0" width="640" height="6" fill="${esc(accent)}"/>
<g font-family="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
<text x="48" y="72" font-size="18" letter-spacing="1.5" fill="${esc(muted)}">${esc(kindName.toUpperCase())}</text>
${titleText}
<text x="48" y="352" font-size="16" fill="${esc(muted)}">${esc(byline)}</text>
<text x="592" y="352" text-anchor="end" font-size="16" fill="${esc(accent)}">OpenVibe.Design</text>
</g>
</svg>`;
}

module.exports = { makeThumbnail, COLOUR };
