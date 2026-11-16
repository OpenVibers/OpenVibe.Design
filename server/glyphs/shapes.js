'use strict';
/**
 * Exact shapes on the 24-unit grid (2026-11-16): every point computed, so a regular shape is regular. A gear drawn by
 * hand and rounded to a tenth had teeth of different widths and a hole 0.1 off the middle (the owner: "completely
 * scuffed"). Strokes are the set's: 2 units, round caps and joins, which round the corners.
 *
 *   gear({ teeth, tip, root, tipShare, rootShare, hole })   teeth with straight flanks, arcs at tip and root, a round hole
 *   star({ points, outer, inner })                         a regular star whose box sits on the middle
 *   polygon({ sides, radius })                             a regular polygon, a vertex up, its box on the middle
 *   heart({ width, top, bottom, lobe })                    the house heart, mirror-exact, its box on the middle
 *   SHAPES                                                  the names, for the API (GET /api/v1/glyphs/shapes/:name)
 * Numbers have two decimals. Each returns the inside of the 24-unit SVG, like every glyph.
 */
const f = (n) => { const v = Math.round(n * 100) / 100; return String(Object.is(v, -0) ? 0 : v); };
const at = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
const num = (v, lo, hi, dflt) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };

function gear(o = {}) {
    const teeth = Math.round(num(o.teeth, 5, 16, 8));
    const tip = num(o.tip, 6, 10.5, 10), root = num(o.root, 4, tip - 1, 7.6);
    const tipShare = num(o.tipShare, 0.15, 0.7, 0.4), rootShare = num(o.rootShare, tipShare, 0.85, 0.62);
    const hole = num(o.hole, 0, root - 2, 2.8);
    const pitch = (2 * Math.PI) / teeth, ht = (tipShare * pitch) / 2, hb = (rootShare * pitch) / 2;
    const d = [];
    for (let i = 0; i < teeth; i++) {
        const a = -Math.PI / 2 + i * pitch;
        const bL = at(12, 12, root, a - hb), tL = at(12, 12, tip, a - ht), tR = at(12, 12, tip, a + ht), bR = at(12, 12, root, a + hb), nL = at(12, 12, root, a + pitch - hb);
        if (!i) d.push(`M${f(bL[0])} ${f(bL[1])}`);
        d.push(`L${f(tL[0])} ${f(tL[1])}A${f(tip)} ${f(tip)} 0 0 1 ${f(tR[0])} ${f(tR[1])}L${f(bR[0])} ${f(bR[1])}A${f(root)} ${f(root)} 0 0 1 ${f(nL[0])} ${f(nL[1])}`);
    }
    return `<path d="${d.join('')}Z"/>${hole ? `<circle cx="12" cy="12" r="${f(hole)}"/>` : ''}`;
}

function star(o = {}) {
    const n = Math.round(num(o.points, 3, 12, 5));
    const r1 = num(o.outer, 5, 10.5, 9.8), r2 = r1 * num(o.inner, 0.2, 0.9, 0.48);
    const angle = (i) => -Math.PI / 2 + (i * Math.PI) / n;
    const ys = Array.from({ length: 2 * n }, (_, i) => Math.sin(angle(i)) * (i % 2 ? r2 : r1));
    const cy = 12 - (Math.min(...ys) + Math.max(...ys)) / 2;
    const d = Array.from({ length: 2 * n }, (_, i) => { const [x, y] = at(12, cy, i % 2 ? r2 : r1, angle(i)); return `${i ? 'L' : 'M'}${f(x)} ${f(y)}`; });
    return `<path d="${d.join('')}Z"/>`;
}

function polygon(o = {}) {
    const n = Math.round(num(o.sides, 3, 12, 6)), r = num(o.radius, 4, 10.5, 9.5);
    const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const ys = Array.from({ length: n }, (_, i) => Math.sin(angle(i)) * r);
    const cy = 12 - (Math.min(...ys) + Math.max(...ys)) / 2;
    return `<path d="${Array.from({ length: n }, (_, i) => { const [x, y] = at(12, cy, r, angle(i)); return `${i ? 'L' : 'M'}${f(x)} ${f(y)}`; }).join('')}Z"/>`;
}

/**
 * The house heart (openvibe-shared's), made exact: two lobes of radius `lobe` meeting at the middle, sides that curve
 * down to the point, the left and right the same curve mirrored, and its box centred on the grid.
 */
function heart(o = {}) {
    const half = num(o.width, 6, 10, 9.3), lobe = num(o.lobe, 3, 7, 5.3);
    // In the drawing's own frame: the sides at y = 0, the dip 3.6 above them, the point `drop` below.
    const dip = num(o.dip, 1.5, 6, 3.6), drop = num(o.drop, 8, 15, 13), pull = num(o.pull, 0.3, 0.8, 0.565);
    // The lobe's top: the circle through (12 - half, 0) and (12, -dip), radius `lobe`, centre below the chord.
    const ax = -half, ay = 0, bx = 0, by = -dip;
    const mx = (ax + bx) / 2, my = (ay + by) / 2, cl = Math.hypot(bx - ax, by - ay);
    const h = Math.sqrt(Math.max(0, lobe * lobe - (cl / 2) ** 2));
    const nx = -(by - ay) / cl, ny = (bx - ax) / cl;   // the chord's normal, pointing down-right
    const ccy = my + h * Math.abs(ny);
    const top = ccy - lobe;
    const shift = 12 - (top + drop) / 2;   // centre the box: top of the lobes to the point
    const Y = (y) => f(y + shift), L = (x) => f(12 + x), R = (x) => f(12 - x);
    const c = drop * pull;   // the side's control, below the side point
    void nx;
    return `<path d="M12 ${Y(drop)}C12 ${Y(drop)} ${L(-half)} ${Y(c)} ${L(-half)} ${Y(0)}A${f(lobe)} ${f(lobe)} 0 0 1 12 ${Y(-dip)}`
        + `A${f(lobe)} ${f(lobe)} 0 0 1 ${R(-half)} ${Y(0)}C${R(-half)} ${Y(c)} 12 ${Y(drop)} 12 ${Y(drop)}Z"/>`;
}

const SHAPES = { gear, star, polygon, heart };
module.exports = { gear, star, polygon, heart, SHAPES };
