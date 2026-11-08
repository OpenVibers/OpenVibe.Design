'use strict';
/**
 * A glyph outline, checked before it may become part of a font (plan R1 item 8: AI typefaces).
 *
 * The model writes outlines as SVG path data. Whatever comes back is hostile input until it has been read: the
 * checks here are the ones a font needs, and nothing else is allowed through.
 *
 *   clean(data) → { ok: true, glyph } | { ok: false, why }
 *
 * A glyph must be:
 *   - ONE path. A letter may have several contours (the hole in an "o"), but they all live in one path element.
 *   - CLOSED. Every contour ends with Z, so the outline has no open end to leak fill or show a seam.
 *   - INSIDE the em box. The outline may not leave the 0..upem box the font works in, with a small margin for
 *     the overshoot a curve needs.
 *   - PLAIN. Numbers and path commands only: no script, no style, no url(), no external reference of any kind.
 *
 * The result is the same outline, normalised: absolute commands, two decimals, and the metrics a font needs
 * (the advance width and the bounds).
 */
const path = require('./path');

/** The em box every outline lives in. The font's own units per em. */
const UPEM = 1000;
/** The baseline sits at 0; the ascenders reach 800 and the descenders fall to -200. */
const ASCENDER = 800;
const DESCENDER = -200;
/** A curve may overshoot the em box by this much, or it would look cut off. */
const OVERSHOOT = 20;

/** What a model may send for one glyph: path data, or a whole <path> element. */
const MAX_BYTES = 8000;

/** Path data is commands and numbers only. Nothing else may appear in it. */
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+\-eE]*$/;

/**
 * The markup a model may wrap the path in, and what may be inside it. A <path> element with a d attribute, and
 * nothing else: no script, no style, no image, no use, no event handler, no external reference.
 */
const ELEMENT = /<\s*([a-zA-Z][a-zA-Z0-9:-]*)\b([^>]*)>/;
const ATTR = /([a-zA-Z_:][a-zA-Z0-9:._-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
const DANGEROUS = /^(?:on|xmlns:xlink|xlink|href|src|formaction|style|srcset)$/i;

/** Read one path element out of the model's answer. */
function extract(data) {
    const raw = String(data == null ? '' : data).trim();
    if (!raw) return { ok: false, why: 'the glyph is empty' };
    if (raw.length > MAX_BYTES) return { ok: false, why: 'the glyph is too long' };
    // A code fence or a sentence around the path is stripped, so an answer that says "here it is" still works.
    const fenced = /\x60\x60\x60[a-z]*\s*([\s\S]*?)\x60\x60\x60/i.exec(raw);
    const body = (fenced ? fenced[1] : raw).trim();
    if (!body) return { ok: false, why: 'the glyph is empty' };

    // Refuse anything that is not a path element before looking for one: a script or a style is never acceptable.
    if (/<\s*(script|style|foreignObject|iframe|object|embed|image|use|a)\b/i.test(body))
        return { ok: false, why: 'a glyph is a path, not a script or a reference' };
    if (/javascript:|data:text\/html|<!\[CDATA\[|&#[x]?[0-9a-f]/i.test(body))
        return { ok: false, why: 'the glyph carries something a font must not carry' };

    // Bare path data (no element) is fine: that is what most models answer with.
    if (!body.includes('<')) return { ok: true, d: body };

    const match = ELEMENT.exec(body);
    if (!match) return { ok: false, why: 'the glyph is not a path element' };
    const name = match[1].toLowerCase();
    if (name !== 'path') return { ok: false, why: 'a glyph is one <path> element, not a <' + name + '>' };
    // Nothing may follow the path element.
    const rest = body.slice(match.index + match[0].length).replace(/<\s*\/\s*path\s*>/gi, '').trim();
    if (rest) return { ok: false, why: 'a glyph is one path and nothing else' };

    let d = null;
    for (const a of match[2].matchAll(ATTR)) {
        const key = a[1].toLowerCase();
        const value = a[3] !== undefined ? a[3] : (a[4] !== undefined ? a[4] : a[5]);
        if (DANGEROUS.test(key)) return { ok: false, why: 'a glyph path carries no ' + key + ' attribute' };
        if (key === 'd') { d = value; continue; }
        // fill, fill-rule and transform are the only harmless extras; a font sets its own colour anyway.
        if (key === 'fill' || key === 'fill-rule' || key === 'transform') continue;
        return { ok: false, why: 'a glyph path carries no ' + key + ' attribute' };
    }
    if (!d) return { ok: false, why: 'the path has no d attribute' };
    return { ok: true, d };
}

/**
 * Check one glyph. Returns the normalised outline and the metrics a font needs, or a plain reason in words.
 */
function clean(data) {
    const found = extract(data);
    if (!found.ok) return found;
    const d = String(found.d || '').trim();
    if (!d) return { ok: false, why: 'the path has no d attribute' };
    if (d.length > MAX_BYTES) return { ok: false, why: 'the glyph is too long' };
    if (!PATH_DATA.test(d)) return { ok: false, why: 'the path data has something a path cannot hold' };

    const parsed = path.parse(d);
    if (!parsed.ok) return { ok: false, why: parsed.why };
    const segments = parsed.segments;

    // One path, several contours allowed (the hole in an "o"), but every contour closed.
    const contours = path.subpaths(segments);
    if (!contours.length) return { ok: false, why: 'the path draws nothing' };
    if (contours.length > 4) return { ok: false, why: 'a letter is not that many separate shapes' };
    if (!path.closed(segments)) return { ok: false, why: 'the outline is not closed' };

    const box = path.bbox(segments);
    if (!box) return { ok: false, why: 'the path draws nothing' };
    if (box.x1 < -OVERSHOOT || box.y1 < DESCENDER - OVERSHOOT || box.x2 > UPEM + OVERSHOOT || box.y2 > ASCENDER + OVERSHOOT)
        return { ok: false, why: 'the outline leaves the em box' };
    // A letter has some size: a mark smaller than a fiftieth of the em reads as a speck, not a letter.
    if (box.x2 - box.x1 < 20 || box.y2 - box.y1 < 20) return { ok: false, why: 'the outline is too small to read' };

    // The outline is placed as the model drew it: the baseline is y = 0, y grows up.
    return {
        ok: true,
        glyph: {
            d: path.toData(segments),
            advance: Math.round(box.x2 - box.x1) + 120,   // the ink plus a side bearing on each side
            bounds: { x1: Math.round(box.x1), y1: Math.round(box.y1), x2: Math.round(box.x2), y2: Math.round(box.y2) },
        },
    };
}

module.exports = { clean, extract, UPEM, ASCENDER, DESCENDER, OVERSHOOT, MAX_BYTES };
