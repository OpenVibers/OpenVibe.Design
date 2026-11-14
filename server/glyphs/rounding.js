'use strict';
/**
 * One corner scale for every OpenVibe icon (plan AB.29, 2026-11-14).
 *
 * A mark on a tile, an app icon and the PNG maker all draw the same tile: the shape comes from the ground (none, a
 * circle or a square) and the corner from the rounding (none, soft, round or squircle). The numbers live here, so
 * every drawing agrees; "round" is the app icon's own corner, and the squircle is the superellipse behind it.
 *
 *   ROUNDINGS         ['none', 'soft', 'round', 'squircle'] — the four names a URL may use
 *   CORNERS           { none: 0, soft: 0.12, round: 0.225 } — a share of the tile's side
 *   SQUIRCLE_N        5 — the superellipse's exponent: the squircle's own curve, square at the corner and round
 *                     at the middle of the side
 *   DEFAULT_ROUNDING  the corner each ground has always drawn, so a file with no rounding given stays the same
 *   nameOf(query)     → the rounding a query asks for (a name), or null when it is not one of the four
 *   ground(o)         → the tile's SVG markup for a ground, a rounding and a box
 *
 * The squircle is a path, not a rounded rectangle: a rounded rectangle's corner is one circle, while a superellipse
 * keeps a curve all the way along the side, which is what an app icon's own shape does.
 */
const ROUNDINGS = ['none', 'soft', 'round', 'squircle'];
// A share of the tile's side. "round" is the app icon's corner (22.5 % of the side), the one the icons have always
// drawn; "soft" is a gentler one (12 %).
const CORNERS = Object.freeze({ none: 0, soft: 0.12, round: 0.225 });
const SQUIRCLE_N = 5;
// What each ground draws when no rounding is asked for: a plain square has square corners, the old "squircle" ground
// has always been a rounded square, and a circle and nothing have no corner at all.
const DEFAULT_ROUNDING = Object.freeze({ none: 'none', circle: 'none', square: 'none', squircle: 'round' });

/**
 * The rounding a query asks for: one of the four names, or null when it asks for something else. The names are exact
 * (none, soft, round, squircle): a URL that asks for anything else is a mistake, and the API says so rather than
 * quietly drawing something else.
 */
function nameOf(q) {
    const v = String((q || {}).rounding == null ? '' : q.rounding);
    return ROUNDINGS.includes(v) ? v : null;
}
/** Was a rounding asked for at all? An empty value is not a choice. */
const isGiven = (q) => q != null && q.rounding != null && String(q.rounding).trim() !== '';
/** The rounding to draw with: the one asked for, or the ground's own. */
const forGround = (ground, rounding) => (ROUNDINGS.includes(String(rounding)) ? String(rounding) : (DEFAULT_ROUNDING[ground] || 'none'));

/** A rounded corner's radius, in the tile's own units. */
const radius = (rounding, box) => +(box * (CORNERS[rounding] == null ? 0 : CORNERS[rounding])).toFixed(3);

/**
 * The squircle as a path: a superellipse of exponent n (|x/a|^n + |y/a|^n = 1), drawn with enough points to look
 * smooth at any size the icon is used at.
 */
function squirclePath(box, n = SQUIRCLE_N, steps = 72) {
    const a = box / 2, c = box / 2, e = 2 / n;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const ct = Math.cos(t), st = Math.sin(t);
        const x = c + a * Math.sign(ct) * Math.abs(ct) ** e;
        const y = c + a * Math.sign(st) * Math.abs(st) ** e;
        pts.push(`${+x.toFixed(3)} ${+y.toFixed(3)}`);
    }
    return `M${pts.join('L')}Z`;
}

/**
 * The tile behind a mark: nothing, a circle, or a square whose corner the rounding sets. A circle ignores the
 * rounding (it has no corner), and the old "squircle" ground is a square with the app icon's corner.
 */
function ground({ ground: g = 'none', rounding = 'none', box = 24, bg = 'ffffff' } = {}) {
    const fill = `#${bg}`;
    if (g === 'circle') return `<circle cx="${box / 2}" cy="${box / 2}" r="${box / 2}" fill="${fill}"/>`;
    if (g !== 'square' && g !== 'squircle') return '';
    const r = forGround(g, rounding);
    if (r === 'squircle') return `<path d="${squirclePath(box)}" fill="${fill}"/>`;
    const rx = radius(r, box);
    return `<rect width="${box}" height="${box}"${rx ? ` rx="${rx}"` : ''} fill="${fill}"/>`;
}

module.exports = { ROUNDINGS, CORNERS, SQUIRCLE_N, DEFAULT_ROUNDING, nameOf, isGiven, forGround, radius, squirclePath, ground };
