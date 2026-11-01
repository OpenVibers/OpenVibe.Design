'use strict';
/**
 * A glyph drawing, checked and normalised before anyone sees it (plan L32 I3). A drawing is the inside of a 24-unit
 * SVG in the OpenVibe hand: strokes only (the page draws them in the text's colour, 2 units, round), a handful of
 * shapes, nothing outside the grid. Whatever a model returns is parsed shape by shape and rebuilt from the attributes
 * that are allowed, with numbers only; anything else (a fill, a style, a script, a link, a transform) is refused.
 *
 *   clean(markup)      → { ok: true, svg } with the rebuilt drawing, or { ok: false, why } in words
 *   cleanSolid(markup) → the same for a glyph's solid twin (L50, the small-size drawing openvibe-shared shows at 18 px
 *                        and under): filled shapes, a hole cut with fill-rule="evenodd" on a path, a part that has to
 *                        stay a line marked class="ln". Nothing else: no colour, no style, no stroke attributes.
 */
const SHAPES = {
    path: ['d'],
    circle: ['cx', 'cy', 'r'],
    ellipse: ['cx', 'cy', 'rx', 'ry'],
    rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
    line: ['x1', 'y1', 'x2', 'y2'],
    polyline: ['points'],
};
const MAX_SHAPES = 8;
const MAX_D = 700;
const NUM = /^-?\d*\.?\d+$/;
// Path data: commands and numbers only.
const PATH_D = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/;

function numbersOf(s) { return (String(s).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number); }
const onGrid = (n) => Number.isFinite(n) && n >= -1 && n <= 25;

function clean(markup) { return rebuild(markup, false); }
function cleanSolid(markup) {
    const r = rebuild(markup, true);
    if (r.ok && !/<(?:path|circle|ellipse|rect)(?![^>]*class="ln")[^>]*\/>/.test(r.svg)) return { ok: false, why: 'a solid drawing fills at least one shape' };
    return r;
}

function rebuild(markup, solid) {
    const src = String(markup || '').trim()
        .replace(/^<svg\b[^>]*>/i, '').replace(/<\/svg>\s*$/i, '')     // a whole <svg> is accepted for its inside
        .replace(/<!--[\s\S]*?-->/g, '').trim();
    if (!src) return { ok: false, why: 'the drawing is empty' };
    if (src.length > 3000) return { ok: false, why: 'the drawing is too long' };
    const out = [];
    let rest = src;
    const tag = /^<\s*(\w+)((?:\s+[\w:-]+\s*=\s*"[^"]*")*)\s*\/?>\s*(?:<\/\s*\1\s*>)?\s*/;
    while (rest.length) {
        const m = tag.exec(rest);
        if (!m) return { ok: false, why: 'only shapes, one after another (path, circle, ellipse, rect, line, polyline)' };
        const name = m[1].toLowerCase();
        if (!SHAPES[name]) return { ok: false, why: `a ${name} is not a shape a glyph may use` };
        const attrs = {};
        for (const a of m[2].matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) attrs[a[1].toLowerCase()] = a[2];
        for (const k of Object.keys(attrs)) {
            if (SHAPES[name].includes(k)) continue;
            if (solid) {
                if (k === 'fill-rule' && name === 'path' && attrs[k] === 'evenodd') continue;   // a hole
                if (k === 'class' && attrs[k] === 'ln') continue;                               // a part that stays a line
                return { ok: false, why: `${name} ${k}="…" is not allowed in a solid drawing: shapes, evenodd holes and class="ln" lines only` };
            }
            if (k === 'stroke-width' && NUM.test(attrs[k]) && Number(attrs[k]) >= 1 && Number(attrs[k]) <= 4) continue;   // dots may be heavier
            if (['fill', 'stroke', 'stroke-linecap', 'stroke-linejoin'].includes(k) && /^(none|currentColor|round)$/i.test(attrs[k])) continue;   // the page's own
            return { ok: false, why: `${name} ${k}="…" is not allowed: strokes only, in the page's colour` };
        }
        const keep = [];
        for (const k of SHAPES[name]) {
            if (attrs[k] == null) continue;
            const v = attrs[k].trim();
            if (k === 'd') {
                if (!PATH_D.test(v) || v.length > MAX_D) return { ok: false, why: 'a path is commands and numbers only, and short' };
                const nums = numbersOf(v);
                // Absolute coordinates stay on the grid (relative steps and arc flags are small or 0/1 anyway).
                if (/^[Mm]/.test(v) === false) return { ok: false, why: 'a path starts with a move (M)' };
                if (nums.some((n) => !(n >= -25 && n <= 25))) return { ok: false, why: 'a path goes far off the 24-unit grid' };
            } else if (k === 'points') {
                const nums = numbersOf(v);
                if (!nums.length || nums.length % 2 || nums.some((n) => !onGrid(n))) return { ok: false, why: 'polyline points sit on the grid' };
            } else if (!NUM.test(v) || !onGrid(Number(v))) {
                return { ok: false, why: `${name} ${k} is a number on the 24-unit grid` };
            }
            keep.push(`${k}="${v.replace(/\s+/g, ' ')}"`);
        }
        if (!keep.length) return { ok: false, why: `a ${name} with nothing to draw` };
        if (solid && attrs['fill-rule'] === 'evenodd' && name === 'path') keep.push('fill-rule="evenodd"');
        if (solid && attrs.class === 'ln') keep.push('class="ln"');
        out.push(`<${name} ${keep.join(' ')}/>`);
        if (out.length > MAX_SHAPES) return { ok: false, why: `at most ${MAX_SHAPES} shapes: a glyph is simple` };
        rest = rest.slice(m[0].length);
    }
    return { ok: true, svg: out.join('') };
}

module.exports = { clean, cleanSolid, SHAPES, MAX_SHAPES };
