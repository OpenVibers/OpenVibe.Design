'use strict';
/**
 * A typeface, compiled from the glyphs the model drew (plan R1 item 8: AI typefaces).
 *
 * The glyphs arrive as outlines in a 0..1000 em box with the baseline at y = 0 and y growing up: font
 * coordinates already. The compiler normalises the metrics (one ascender, one descender, one set of side
 * bearings, one advance width per glyph), builds the font with opentype.js and writes it out.
 *
 *   compile({ familyName, styleName, glyphs, license }) -> { ok: true, font, woff2, otf } | { ok: false, why }
 *
 * The glyph list is a list of { char, d, advance }. The .notdef glyph is always there, so a font that is
 * missing a letter shows a box rather than nothing.
 *
 * The two files are the same font: the WOFF2 for the web (compressed with Google's woff2 encoder, the same one
 * browsers use) and the OTF for anything that wants the outlines. The licence the person chose goes into the
 * font's name table, and the model that drew it goes in too, so a font says where it came from.
 */
const opentype = require('opentype.js');
const wawoff2 = require('wawoff2');
const glyph = require('./glyph');
const path = require('./path');

/** The characters a face carries: Latin letters, digits and the punctuation a text needs. */
const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;!?'\"()-/&@#%+=*";

/** A name a font file may carry: no path separators, nothing a filesystem would mind. */
const FAMILY = /^[A-Za-z0-9][A-Za-z0-9 .'-]{0,60}$/;

function fail(why) { return { ok: false, why }; }

/**
 * Normalise the metrics of a set of glyphs. One ascender and one descender for the whole face; the advance width
 * of each glyph is its ink plus the same side bearing on each side, so the letters sit on one rhythm.
 */
function metrics(glyphs) {
    const side = 60;                       // the side bearing, in font units
    let top = 0, bottom = 0;
    for (const g of glyphs) {
        top = Math.max(top, g.bounds.y2);
        bottom = Math.min(bottom, g.bounds.y1);
    }
    // The ascender and the descender are the face's own, rounded to a tidy step.
    const ascender = Math.min(glyph.ASCENDER, Math.max(Math.round(top / 50) * 50, 400));
    const descender = Math.max(glyph.DESCENDER, Math.min(Math.round(bottom / 50) * 50, -100));
    const out = [];
    for (const g of glyphs) {
        const ink = g.bounds.x2 - g.bounds.x1;
        const advance = Math.max(Math.round(ink) + side * 2, 120);
        out.push({
            char: g.char,
            d: g.d,
            advance,
            // The ink is centred in the advance width, so every letter has the same breathing room.
            left: Math.round((advance - ink) / 2) - g.bounds.x1,
        });
    }
    return { ascender, descender, glyphs: out };
}

/**
 * Compile the face. The outlines are checked once more here (the server never trusts a stored glyph), then the
 * font is built and written as a WOFF2 and an OTF.
 */
async function compile({ familyName, styleName = 'Regular', glyphs, license = 'OFL-1.1', model = null, designer = null } = {}) {
    const name = String(familyName || '').trim();
    if (!FAMILY.test(name)) return fail('a font needs a name of letters, digits, spaces or dashes');
    if (!Array.isArray(glyphs) || !glyphs.length) return fail('the face has no glyphs to compile');

    // Every glyph is read again: a stored outline is data, and data is read before it is used.
    const checked = [];
    const seen = new Set();
    for (const g of glyphs) {
        const char = String(g.char == null ? '' : g.char);
        if (!char || seen.has(char)) continue;
        const r = glyph.clean(g.d);
        if (!r.ok) continue;
        seen.add(char);
        checked.push({ char, ...r.glyph });
    }
    if (!checked.length) return fail('none of the glyphs could be read');

    const m = metrics(checked);
    const opentypeGlyphs = [];
    // .notdef: a box, so a missing letter shows an empty one.
    const box = new opentype.Path();
    box.moveTo(80, 0); box.lineTo(420, 0); box.lineTo(420, 700); box.lineTo(80, 700); box.close();
    opentypeGlyphs.push(new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 500, path: box }));
    // The space, always.
    opentypeGlyphs.push(new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: 260, path: new opentype.Path() }));

    for (const g of m.glyphs) {
        const segments = path.parse(g.d);
        if (!segments.ok) continue;
        const p = path.pathOf(segments.segments);
        // The outline is moved so the ink sits where the advance width says it does.
        const moved = new opentype.Path();
        for (const c of p.commands) {
            const cmd = { ...c };
            if (cmd.x !== undefined) cmd.x += g.left;
            if (cmd.x1 !== undefined) cmd.x1 += g.left;
            if (cmd.x2 !== undefined) cmd.x2 += g.left;
            moved.commands.push(cmd);
        }
        const cp = g.char.codePointAt(0);
        opentypeGlyphs.push(new opentype.Glyph({
            name: 'uni' + cp.toString(16).toUpperCase().padStart(4, '0'),
            unicode: cp,
            advanceWidth: g.advance,
            path: moved,
        }));
    }

    // The name table says who made it and under what licence: a font that travels says where it came from.
    // opentype.js writes one table per platform, so these go in as options rather than as edits afterwards.
    const maker = String(designer || 'Made with OpenVibe.Design').slice(0, 60);
    const font = new opentype.Font({
        familyName: name,
        styleName,
        unitsPerEm: glyph.UPEM,
        ascender: m.ascender,
        descender: m.descender,
        glyphs: opentypeGlyphs,
        designer: maker,
        license: String(license || 'OFL-1.1').slice(0, 60),
        copyright: maker,
        description: model ? 'Drawn by ' + String(model).slice(0, 60) + ' on OpenVibe.Design' : 'Made on OpenVibe.Design',
    });
    font.outlinesFormat = 'cff';

    const otf = Buffer.from(font.toArrayBuffer());
    const woff2 = Buffer.from(await wawoff2.compress(otf));
    return {
        ok: true,
        font,
        otf,
        woff2,
        metrics: { ascender: m.ascender, descender: m.descender, unitsPerEm: glyph.UPEM, glyphs: checked.length },
        glyphs: m.glyphs,
    };
}

module.exports = { compile, metrics, CHARSET, FAMILY };
