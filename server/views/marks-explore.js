'use strict';
/**
 * openvibe.design/brand/explore: help choose the OpenVibe mark, and the menu button beside it, with fifty takes on each.
 *
 * The owner, 2026-11-01: "the V and the OV versions… 50 of each… so that I can link it to other people to get their
 * feedback"; then "two tabs, one for each type… show an example in the tab… explain at the top… add more variety";
 * "animations and effects as you scroll… idle animation… the labels too: OpenVibe and whatever site it is… get the
 * font right… nice across all devices"; fifty ideas for the menu button (the nine-dot diamond beside the name); and
 * "the page is really long… on mobile a pain".
 *
 *   L01–L50  the Loop: a ring opened at the top with the V folded into it
 *   P01–P50  the Pair: a ring O and a V side by side, the ground showing where they cross
 *   M01–M50  the menu button: search and every OpenVibe site, beside the name on every site
 *
 * Each tab is sorted into rows by idea (proportion, shape, construction, colour, app icon…), so a row shows what
 * changes. Every mark is drawn large, beside a site's name (OpenVibe.Live, .Video, .Pics…, in a font the reader picks),
 * and at 16 and 32 px on dark and light. On a phone each row is a sideways rail; "Sheet" shows all fifty at once.
 * Marks draw themselves in as they scroll into view, then idle (breathe, nod, drift, rock); nothing spins, and nothing
 * moves for a reader who asks for less motion. The rules for any OpenVibe mark hold: centred, level, no liquid
 * fusions, no pac-man shapes. Picks travel in the link (#picks=L04,P17,M09).
 */
const { layout, esc } = require('../render/layout');

const BLUE = '#4f7cff', VIOLET = '#8b5cf6', CYAN = '#22d3ee', PINK = '#ec4899', NIGHT = '#0d1322', PAPER = '#f4f6fb';
const f = (v) => +Number(v).toFixed(2);
const rad = (d) => (d * Math.PI) / 180;
function mix(hex, to, t) {
    const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
    return `#${[16, 8, 0].map((sh) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t).toString(16).padStart(2, '0')).join('')}`;
}

// ── Paint ────────────────────────────────────────────────────────────────────────────────────────────────────────
// A treatment gives the two parts their paint (a: the ring or the O, b: the V), its gradients and filters, and an
// optional tile behind the mark (an app icon's square).
function paint(kind, id) {
    const lin = (gid, stops, x1 = 18, y1 = 18, x2 = 82, y2 = 82) => `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${f(i / (stops.length - 1))}" stop-color="${c}"/>`).join('')}</linearGradient>`;
    const one = (c) => ({ a: c, b: c, defs: '' });
    switch (kind) {
        case 'sweep': return { a: `url(#${id}g)`, b: `url(#${id}g)`, defs: lin(`${id}g`, [BLUE, VIOLET]) };
        case 'vertical': return { a: `url(#${id}g)`, b: `url(#${id}g)`, defs: lin(`${id}g`, [VIOLET, BLUE], 50, 14, 50, 86) };
        case 'duo': return { a: BLUE, b: VIOLET, defs: '' };
        case 'duo-rev': return { a: VIOLET, b: BLUE, defs: '' };
        case 'depth': return {
            a: `url(#${id}a)`, b: `url(#${id}b)`,
            defs: lin(`${id}a`, [mix(BLUE, '#ffffff', 0.32), mix(BLUE, '#000000', 0.18)], 50, 14, 50, 86) + lin(`${id}b`, [mix(VIOLET, '#ffffff', 0.3), mix(VIOLET, '#000000', 0.16)], 50, 14, 50, 86),
        };
        case 'aurora': return { a: `url(#${id}g)`, b: `url(#${id}g)`, defs: lin(`${id}g`, [CYAN, BLUE, VIOLET]) };
        case 'ember': return { a: `url(#${id}g)`, b: `url(#${id}g)`, defs: lin(`${id}g`, [VIOLET, PINK]) };
        case 'blue': return one(BLUE);
        case 'violet': return one(VIOLET);
        case 'ink': return one('currentColor');
        case 'glow': return { a: `url(#${id}g)`, b: `url(#${id}g)`, defs: lin(`${id}g`, [BLUE, VIOLET]) + `<filter id="${id}f" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="4.5"/></filter>`, glow: `${id}f` };
        case 'tile': return { a: '#ffffff', b: '#ffffff', defs: lin(`${id}t`, [BLUE, VIOLET], 0, 0, 100, 100), tile: `url(#${id}t)`, white: true };
        case 'tile-night': return { a: `url(#${id}g)`, b: `url(#${id}g)`, defs: lin(`${id}g`, [BLUE, VIOLET]), tile: NIGHT, tileLine: true };
        case 'tile-paper': return { a: BLUE, b: VIOLET, defs: '', tile: PAPER };
        case 'extrude': return { a: `url(#${id}g)`, b: `url(#${id}g)`, defs: lin(`${id}g`, [BLUE, VIOLET]), extrude: mix(VIOLET, '#000000', 0.55) };
        default: return one(BLUE);
    }
}
/** The mark's parts in their treatment: the tile under it, the glow or the solid edge behind it. */
function treat(p, body) {
    const out = [];
    if (p.tile) out.push(`<rect x="2" y="2" width="96" height="96" rx="24" fill="${p.tile}"${p.tileLine ? ' stroke="#ffffff22" stroke-width="1"' : ''}/>`);
    if (p.glow) out.push(`<g class="mx-glow" filter="url(#${p.glow})" opacity=".75">${body}</g>`);
    // The edge: the same parts in one dark colour, a little down and right (masks stay; only the paint changes).
    if (p.extrude) out.push(`<g transform="translate(2.4 3.2)" opacity=".9">${body.replace(/(fill|stroke)="url\(#[^)]+\)"/g, `$1="${p.extrude}"`)}</g>`);
    out.push(body);
    const all = out.join('');
    return p.white ? all.replace(/currentColor/g, '#ffffff') : all;
}

// ── Shapes ───────────────────────────────────────────────────────────────────────────────────────────────────────
// A closed shape's boundary point at angle θ (degrees, 0 = right, 90 = down), centred on (cx, cy) with "radius" r.
function boundary(shape, cx, cy, r, deg) {
    const t = rad(deg), c = Math.cos(t), s = Math.sin(t);
    const sp = (n) => [cx + r * Math.sign(c) * Math.abs(c) ** (2 / n), cy + r * Math.sign(s) * Math.abs(s) ** (2 / n)];
    if (shape === 'squircle') return sp(4);
    if (shape === 'rsquare') return sp(7);
    if (shape === 'oval') return [cx + r * 0.84 * c, cy + r * s];
    if (shape === 'hex' || shape === 'oct') {
        const k = shape === 'hex' ? 6 : 8, seg = (2 * Math.PI) / k, th0 = rad(-90);
        const local = ((((t - th0) % seg) + seg) % seg) - seg / 2;
        const rr = (r * Math.cos(Math.PI / k)) / Math.cos(local);
        return [cx + rr * c, cy + rr * s];
    }
    return [cx + r * c, cy + r * s];
}
const pts = (list) => list.map((p) => `${f(p[0])} ${f(p[1])}`);
/** An open stretch of the boundary from angle a to angle b (degrees). */
function arcPts(shape, cx, cy, r, a, b, steps = 96) {
    const out = [];
    for (let i = 0; i <= steps; i++) out.push(boundary(shape, cx, cy, r, a + ((b - a) * i) / steps));
    return out;
}
/** The whole closed boundary as a path (a circle as two arcs). */
function closedPath(shape, cx, cy, r) {
    if (shape === 'circle') return `M${f(cx)} ${f(cy - r)}A${f(r)} ${f(r)} 0 1 1 ${f(cx)} ${f(cy + r)}A${f(r)} ${f(r)} 0 1 1 ${f(cx)} ${f(cy - r)}Z`;
    const p = pts(arcPts(shape, cx, cy, r, -90, 270, 144));
    return `M${p[0]}L${p.slice(1).join('L')}Z`;
}
/** A mask that keeps everything but what `inner` paints black; its definition goes into state.defs. */
function masker(state) {
    return (mid, inner) => { state.defs += `<mask id="${mid}" maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120"><rect x="-10" y="-10" width="120" height="120" fill="#fff"/>${inner}</mask>`; return `url(#${mid})`; };
}

// ── The Loop ─────────────────────────────────────────────────────────────────────────────────────────────────────
// The ring opens `open`° each side of the top; the V runs from the opening's two ends to a tip `tip` below the centre.
// Constructions: joined (one stroke), split (two strokes, the ground between), apart, float (a small V inside), cross
// (the arms run past the ring), coin (a solid shape, the V cut through), coin-ring, outline, inline, dashed (dots),
// segments (the ring in three arcs), tipdot, half (the lower half filled). Part classes: mx-a the ring, mx-b the V,
// mx-dot a dot; mx-s strokes (drawn in), mx-f fills (faded in).
function loopArt(s, id) {
    const shape = s.shape || 'circle', r = s.r || 31, sw = s.sw || 13, open = s.open || 32, vsw = s.vsw || sw;
    const cx = 50, cy = 50 + (s.dot === 'above' ? 4 : 0);
    const left = boundary(shape, cx, cy, r, 270 - open), right = boundary(shape, cx, cy, r, -90 + open);
    const T = [50, cy + (s.tip == null ? 2 : s.tip)];
    const ringD = `M${pts(arcPts(shape, cx, cy, r, 270 - open, -90 + open)).join('L')}`;
    const joinedD = `${ringD}L${f(T[0])} ${f(T[1])}Z`;
    // A V whose arms start `ext` of the radius outside the ring's ends (negative: inside).
    const out = (q, ext) => [q[0] - (cx - q[0]) * ext, q[1] - (cy - q[1]) * ext];
    const vD = (ext = 0) => { const L = out(left, ext), R = out(right, ext); return `M${f(L[0])} ${f(L[1])}L${f(T[0])} ${f(T[1])}L${f(R[0])} ${f(R[1])}`; };
    const p = paint(s.paint, id);
    const st = { defs: p.defs };
    const mask = masker(st);
    const cap = s.cap || 'round', join = s.join || 'round';
    const S = (d, color, w, part, extra = '') => `<path class="mx-s mx-${part}" d="${d}" pathLength="100" fill="none" stroke="${color}" stroke-width="${f(w)}" stroke-linecap="${cap}" stroke-linejoin="${join}"${extra}/>`;
    const cut = (d, w, part) => `<path class="mx-${part}" d="${d}" fill="none" stroke="#000" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    let body;
    switch (s.mode) {
        case 'split': body = `<g mask="${mask(`${id}m`, cut(vD(), vsw + 5, 'b'))}">${S(ringD, p.a, sw, 'a')}</g>${S(vD(), p.b, vsw, 'b')}`; break;
        case 'apart': body = `<g mask="${mask(`${id}m`, cut(vD(-0.18), vsw + 7, 'b'))}">${S(ringD, p.a, sw, 'a')}</g>${S(vD(-0.18), p.b, vsw, 'b')}`; break;
        case 'float': body = `${S(ringD, p.a, sw, 'a')}${S(vD(-0.42), p.b, vsw, 'b')}`; break;
        case 'cross': body = `<g mask="${mask(`${id}m`, cut(vD(0.28), vsw + 6, 'b'))}">${S(closedPath(shape, cx, cy, r), p.a, sw, 'a')}</g>${S(vD(0.28), p.b, vsw, 'b')}`; break;
        case 'coin': body = `<path class="mx-f mx-a" d="${closedPath(shape, cx, cy, r + sw / 2)}" fill="${p.a}" mask="${mask(`${id}m`, cut(vD(0.4), vsw, 'b'))}"/>`; break;
        case 'coin-ring': {
            const m = mask(`${id}m`, cut(vD(0.2), vsw + 4, 'b'));
            body = `<g mask="${m}"><path class="mx-f mx-a" d="${closedPath(shape, cx, cy, r - sw * 0.9)}" fill="${p.a}"/>${S(closedPath(shape, cx, cy, r + sw * 0.15), p.a, sw * 0.45, 'a')}</g>${S(vD(0.2), p.b, vsw * 0.8, 'b')}`;
            break;
        }
        case 'outline': body = `<g mask="${mask(`${id}m`, cut(joinedD, sw - 5.5, 'a'))}">${S(joinedD, p.a, sw, 'a')}</g>`; break;
        case 'inline': body = `<g mask="${mask(`${id}m`, cut(joinedD, 2.2, 'a'))}">${S(joinedD, p.a, sw, 'a')}</g>`; break;
        case 'dashed': body = `${S(ringD, p.a, sw, 'a', ' stroke-dasharray="0.01 8.6"')}${S(vD(), p.b, vsw, 'b')}`; break;
        case 'segments': {
            const a1 = 270 - open, b1 = -90 + open, span = a1 - b1, gap = 14;
            const seg = (from, to) => `M${pts(arcPts(shape, cx, cy, r, from, to, 40)).join('L')}`;
            body = `${S(seg(a1, a1 - span / 3 + gap / 2), p.a, sw, 'a')}${S(seg(a1 - span / 3 - gap / 2, b1 + span / 3 + gap / 2), p.a, sw, 'a')}${S(seg(b1 + span / 3 - gap / 2, b1), p.a, sw, 'a')}${S(vD(), p.b, vsw, 'b')}`;
            break;
        }
        case 'tipdot': {
            const stop = (q) => [q[0] + (T[0] - q[0]) * 0.72, q[1] + (T[1] - q[1]) * 0.72];
            const l2 = stop(left), r2 = stop(right);
            body = `${S(ringD, p.a, sw, 'a')}${S(`M${f(left[0])} ${f(left[1])}L${f(l2[0])} ${f(l2[1])}`, p.b, vsw, 'b')}${S(`M${f(right[0])} ${f(right[1])}L${f(r2[0])} ${f(r2[1])}`, p.b, vsw, 'b')}<circle class="mx-f mx-dot" cx="${T[0]}" cy="${f(T[1] + 1)}" r="${f(vsw * 0.62)}" fill="${p.b}"/>`;
            break;
        }
        case 'half': {
            st.defs += `<clipPath id="${id}c"><rect x="0" y="${cy}" width="100" height="60"/></clipPath>`;
            body = `<path class="mx-f mx-a" d="${closedPath(shape, cx, cy, r)}" fill="${p.a}" opacity=".35" clip-path="url(#${id}c)" mask="${mask(`${id}m`, cut(vD(), vsw + 5, 'b'))}"/>${S(joinedD, p.a, sw, 'a')}`;
            break;
        }
        default: body = S(joinedD, p.a, sw, 'a');
    }
    if (s.dot === 'above') body += `<circle class="mx-f mx-dot" cx="50" cy="${f(left[1] - sw / 2 - 5)}" r="${f(Math.max(3.6, sw * 0.34))}" fill="${s.paint === 'ink' ? 'currentColor' : PINK}"/>`;
    if (s.dot === 'orbit') { const o = boundary(shape, cx, cy, r, 38); body += `<circle class="mx-f mx-dot" cx="${f(o[0])}" cy="${f(o[1])}" r="${f(sw * 0.72)}" fill="${p.tile ? '#ffffff' : CYAN}" stroke="${p.tile ? 'none' : NIGHT}" stroke-width="2.5"/>`; }
    if (s.dot === 'inner') body += `<circle class="mx-f mx-dot" cx="50" cy="${f(cy + r * 0.52)}" r="${f(sw * 0.38)}" fill="${p.b}"/>`;
    return { defs: st.defs, body: treat(p, body) };
}

// ── The Pair ─────────────────────────────────────────────────────────────────────────────────────────────────────
// openvibe-shared/mark.js's pair(): the O's radius r and stroke sw, the V's stroke vsw; the V's left cap a, tip t and
// right cap b as multiples of the O's outer radius from its centre; the whole centred on (50, 50). Constructions: gap
// (the ground around the V where it crosses, `halo` wide), over, behind (the O in front), solid-v, double, dashed,
// outline, inline, eye (a solid O with a small opening), dot (a dot in the O), sharp (mitred, square ends).
function pairGeo({ r = 20, sw = 13, vsw = 13, a = 0.86, t = 1.5, b = 2.16 }) {
    const R = r + sw / 2, right = b * R + vsw / 2, cx = 50 - (right - R) / 2, cy = 50;
    return { r, sw, vsw, R, cx: f(cx), cy, A: [f(cx + a * R), f(cy - R + vsw / 2)], T: [f(cx + t * R), f(cy + R - vsw / 2)], B: [f(cx + b * R), f(cy - R + vsw / 2)] };
}
function pairArt(s, id) {
    const g = pairGeo(s.g || {});
    const shape = s.shape || 'circle';
    const O = closedPath(shape, g.cx, g.cy, g.r);
    const V = `M${g.A[0]} ${g.A[1]}L${g.T[0]} ${g.T[1]}L${g.B[0]} ${g.B[1]}`;
    const p = paint(s.paint, id);
    const st = { defs: p.defs };
    const mask = masker(st);
    const cap = s.mode === 'sharp' ? 'square' : 'round', join = s.mode === 'sharp' ? 'miter' : 'round';
    const S = (d, color, w, part, extra = '') => `<path class="mx-s mx-${part}" d="${d}" pathLength="100" fill="none" stroke="${color}" stroke-width="${f(w)}" stroke-linecap="${cap}" stroke-linejoin="${join}"${extra}/>`;
    const cut = (d, w, part) => `<path class="mx-${part}" d="${d}" fill="none" stroke="#000" stroke-width="${f(w)}" stroke-linecap="${cap}" stroke-linejoin="${join}"/>`;
    const halo = s.halo == null ? 7 : s.halo;
    // The O with the ground cut around the V where it crosses (plus any other cut, `inner`).
    const gapO = (content = '', inner = '') => `<g mask="${mask(`${id}m`, cut(V, g.vsw + halo, 'b') + inner)}">${content || S(O, p.a, g.sw, 'a')}</g>`;
    let body;
    switch (s.mode) {
        case 'over': body = `${S(O, p.a, g.sw, 'a')}${S(V, p.b, g.vsw, 'b')}`; break;
        case 'behind': body = `<g mask="${mask(`${id}m`, cut(O, g.sw + halo, 'a'))}">${S(V, p.b, g.vsw, 'b')}</g>${S(O, p.a, g.sw, 'a')}`; break;
        case 'solid-v': {
            const tri = `M${g.A[0]} ${g.A[1]}L${g.T[0]} ${g.T[1]}L${g.B[0]} ${g.B[1]}Z`;
            const m = mask(`${id}m`, `<path class="mx-b" d="${tri}" fill="#000" stroke="#000" stroke-width="${f(g.vsw * 0.55 + halo)}" stroke-linejoin="round"/>`);
            body = `<g mask="${m}">${S(O, p.a, g.sw, 'a')}</g><path class="mx-f mx-b" d="${tri}" fill="${p.b}" stroke="${p.b}" stroke-width="${f(g.vsw * 0.55)}" stroke-linejoin="round"/>`;
            break;
        }
        case 'double': body = gapO(S(closedPath(shape, g.cx, g.cy, g.r - g.sw * 0.3), p.a, g.sw * 0.34, 'a') + S(closedPath(shape, g.cx, g.cy, g.r + g.sw * 0.3), p.a, g.sw * 0.34, 'a')) + S(V, p.b, g.vsw, 'b'); break;
        case 'dashed': body = gapO(S(O, p.a, g.sw, 'a', ' stroke-dasharray="0.01 11.1"')) + S(V, p.b, g.vsw, 'b'); break;
        case 'outline': body = gapO('', cut(O, g.sw - 5.5, 'a')) + `<g mask="${mask(`${id}n`, cut(V, g.vsw - 5.5, 'b'))}">${S(V, p.b, g.vsw, 'b')}</g>`; break;
        case 'inline': body = gapO('', cut(O, 2, 'a')) + `<g mask="${mask(`${id}n`, cut(V, 2, 'b'))}">${S(V, p.b, g.vsw, 'b')}</g>`; break;
        case 'eye': body = gapO(`<path class="mx-f mx-a" d="${closedPath(shape, g.cx, g.cy, g.R)}" fill="${p.a}"/>`, `<path d="${closedPath(shape, g.cx, g.cy, g.r * 0.42)}" fill="#000"/>`) + S(V, p.b, g.vsw, 'b'); break;
        case 'dot': body = gapO() + S(V, p.b, g.vsw, 'b') + `<circle class="mx-f mx-dot" cx="${g.cx}" cy="${g.cy}" r="${f(g.r * 0.34)}" fill="${p.b}"/>`; break;
        default: body = gapO() + S(V, p.b, g.vsw, 'b');
    }
    return { defs: st.defs, body: treat(p, body) };
}

// ── Fifty Loops and fifty Pairs, in rows by idea ─────────────────────────────────────────────────────────────────
// [name, one line, spec]. A row says what changes in it; no two marks share shape, construction and treatment.
const LOOP_ROWS = [
    { title: 'Weight and proportion', line: 'how heavy the line is, how wide it opens, how deep the V goes', items: [
        ['Today', 'the Loop as the sites drew it, dot above', { r: 30, sw: 12, open: 33, tip: 2, dot: 'above', paint: 'sweep' }],
        ['Refined', 'a heavier stroke, the V to the middle', { r: 32, sw: 15, open: 30, tip: 0, paint: 'sweep' }],
        ['Two colours', 'the ring blue, the V violet, the ground between', { r: 32, sw: 14, open: 31, tip: 1, mode: 'split', paint: 'duo' }],
        ['Bold', 'thick and short: the strongest at 16 px', { r: 30, sw: 19, open: 30, tip: -6, paint: 'vertical' }],
        ['Hairline', 'a thin, elegant line', { r: 33, sw: 6, open: 32, tip: 2, paint: 'sweep' }],
        ['Heavy, narrow', 'a thick ring, a small notch of a V', { r: 30, sw: 20, open: 20, tip: -10, paint: 'violet' }],
        ['Wide open', 'a generous opening, a shallow V', { r: 32, sw: 14, open: 46, tip: 6, paint: 'vertical' }],
        ['Deep V', 'the V reaches near the bottom', { r: 32, sw: 12, open: 32, tip: 18, paint: 'sweep' }],
        ['Sharp', 'mitred corners and square ends', { r: 32, sw: 13, open: 31, tip: 3, join: 'miter', cap: 'square', paint: 'blue' }],
        ['Thin V, heavy ring', 'the ring carries the weight, the V is a line', { r: 31, sw: 17, open: 30, tip: 2, vsw: 7, mode: 'split', paint: 'duo' }],
        ['Heavy V, thin ring', 'the V carries the weight, the ring is a line', { r: 33, sw: 6, open: 32, tip: 4, vsw: 16, mode: 'split', paint: 'duo-rev' }],
    ] },
    { title: 'The ring\'s shape', line: 'the same idea in other outlines', items: [
        ['Squircle', 'the ring as a soft square', { shape: 'squircle', r: 32, sw: 13, open: 30, tip: 2, paint: 'sweep' }],
        ['Hexagon', 'six sides, the V where the top point was', { shape: 'hex', r: 34, sw: 12, open: 30, tip: 3, paint: 'depth', mode: 'split' }],
        ['Octagon', 'eight sides, a badge', { shape: 'oct', r: 33, sw: 12, open: 24, tip: 2, paint: 'violet' }],
        ['Tall oval', 'a narrower ring, a taller V', { shape: 'oval', r: 34, sw: 12, open: 34, tip: 8, paint: 'vertical' }],
        ['Rounded square', 'an app-shaped ring with firm corners', { shape: 'rsquare', r: 31, sw: 12, open: 28, tip: 3, paint: 'depth', mode: 'split' }],
        ['Oval, apart', 'a tall ring and a separate V', { shape: 'oval', r: 34, sw: 11, open: 32, tip: 8, mode: 'apart', paint: 'duo-rev' }],
        ['Octagon, apart', 'a badge ring and a free V', { shape: 'oct', r: 33, sw: 11, open: 26, tip: 3, mode: 'apart', paint: 'duo' }],
    ] },
    { title: 'How the V meets the ring', line: 'joined, apart, floating, crossing, cut through, drawn in outline', items: [
        ['Apart', 'ring and V as two strokes with air between', { r: 32, sw: 11, open: 34, tip: 5, mode: 'apart', paint: 'duo' }],
        ['Floating V', 'a small V hangs in the open ring', { r: 33, sw: 11, open: 28, tip: 3, vsw: 9, mode: 'float', paint: 'duo-rev' }],
        ['Crossing', 'the V\'s arms run up past the ring', { r: 30, sw: 11, open: 32, tip: 4, mode: 'cross', paint: 'sweep' }],
        ['Outline', 'drawn as a contour, hollow', { r: 32, sw: 15, open: 30, tip: 1, mode: 'outline', paint: 'sweep' }],
        ['Inline', 'a hairline down the middle of the stroke', { r: 32, sw: 16, open: 30, tip: 1, mode: 'inline', paint: 'vertical' }],
        ['Dotted ring', 'the ring in dots, the V solid', { r: 32, sw: 9, open: 30, tip: 2, vsw: 12, mode: 'dashed', paint: 'duo' }],
        ['Three arcs', 'the ring in three pieces around a solid V', { r: 32, sw: 12, open: 28, tip: 2, mode: 'segments', paint: 'sweep' }],
        ['Tip dot', 'the V\'s arms stop short of a dot', { r: 32, sw: 12, open: 32, tip: 6, mode: 'tipdot', paint: 'duo' }],
        ['Half moon', 'the lower half softly filled', { r: 32, sw: 11, open: 31, tip: 2, mode: 'half', paint: 'blue' }],
        ['Orbit', 'a dot sits on the ring like a moon', { r: 31, sw: 12, open: 31, tip: 1, dot: 'orbit', paint: 'sweep' }],
        ['Inner dot', 'a dot in the ring under the V', { r: 32, sw: 12, open: 32, tip: 0, dot: 'inner', paint: 'duo' }],
        ['Coin', 'a solid disc with the V cut through', { r: 32, sw: 12, open: 33, tip: 4, vsw: 11, mode: 'coin', paint: 'sweep' }],
        ['Coin ring', 'a filled centre in a thin ring, the V across both', { r: 31, sw: 12, open: 32, tip: 3, mode: 'coin-ring', paint: 'duo' }],
        ['Squircle coin', 'a solid soft square, the V cut through', { shape: 'squircle', r: 32, sw: 10, open: 30, tip: 3, vsw: 11, mode: 'coin', paint: 'vertical' }],
    ] },
    { title: 'Mixed', line: 'a shape and a construction together', items: [
        ['Hex outline', 'a hollow six-sided Loop', { shape: 'hex', r: 34, sw: 14, open: 30, tip: 3, mode: 'outline', paint: 'aurora' }],
        ['Half moon hex', 'six sides, half filled', { shape: 'hex', r: 34, sw: 11, open: 30, tip: 3, mode: 'half', paint: 'violet' }],
        ['Inline hex', 'six sides with a hairline inside', { shape: 'hex', r: 34, sw: 15, open: 30, tip: 3, mode: 'inline', paint: 'sweep' }],
        ['Three arcs, one ink', 'the pieces in one colour', { r: 32, sw: 13, open: 28, tip: 2, mode: 'segments', paint: 'ink' }],
        ['Tip dot, warm', 'the dot at the tip, violet into pink', { r: 32, sw: 12, open: 32, tip: 6, mode: 'tipdot', paint: 'ember' }],
        ['Coin with an edge', 'a solid coin with a solid edge under it', { r: 31, sw: 12, open: 33, tip: 4, vsw: 11, mode: 'coin', paint: 'extrude' }],
        ['Dotted glow', 'a glowing ring of dots', { r: 32, sw: 9, open: 30, tip: 2, vsw: 12, mode: 'dashed', paint: 'glow' }],
    ] },
    { title: 'Colour and finish', line: 'one shape, five finishes', items: [
        ['Glow', 'the Loop lit from behind', { r: 31, sw: 13, open: 31, tip: 1, paint: 'glow' }],
        ['Solid edge', 'an edge under the stroke, like a key', { r: 31, sw: 13, open: 31, tip: 1, paint: 'extrude' }],
        ['Aurora', 'cyan into blue into violet', { r: 32, sw: 14, open: 30, tip: 1, paint: 'aurora' }],
        ['Ember', 'violet into pink, warmer', { r: 32, sw: 14, open: 30, tip: 1, paint: 'ember' }],
        ['One ink', 'a single colour, for print and stamps', { r: 32, sw: 15, open: 30, tip: 0, paint: 'ink' }],
    ] },
    { title: 'As an app icon', line: 'how it sits on a phone\'s home screen', items: [
        ['App tile', 'white on a gradient tile', { r: 25, sw: 11, open: 32, tip: 1, paint: 'tile' }],
        ['Night tile', 'the gradient Loop on a dark tile', { r: 25, sw: 11, open: 32, tip: 1, paint: 'tile-night' }],
        ['Paper tile', 'two colours on a light tile', { r: 25, sw: 11, open: 32, tip: 1, mode: 'split', paint: 'tile-paper' }],
        ['Crossing tile', 'arms past the ring, white on a tile', { r: 25, sw: 10, open: 32, tip: 4, mode: 'cross', paint: 'tile' }],
        ['Floating tile', 'a small V in the ring, on a night tile', { r: 25, sw: 9, open: 28, tip: 3, vsw: 8, mode: 'float', paint: 'tile-night' }],
        ['Orbit tile', 'the moon dot on a gradient tile', { r: 25, sw: 10, open: 31, tip: 1, dot: 'orbit', paint: 'tile' }],
    ] },
];
const PAIR_ROWS = [
    { title: 'Weight and spacing', line: 'how heavy, and how the V crosses the O', items: [
        ['Pair', 'the mark today: ring 20 + 13, the V 13', { paint: 'depth' }],
        ['Heavy', 'the favicon form, thick strokes', { g: { r: 18, sw: 18, vsw: 17 }, paint: 'sweep' }],
        ['Light', 'a thin line, more air in the O', { g: { r: 21, sw: 8, vsw: 8 }, paint: 'duo' }],
        ['Hairline', 'a thin, elegant pair', { g: { r: 22, sw: 5, vsw: 5 }, halo: 5, paint: 'sweep' }],
        ['Heavy V', 'a light O, a heavy V', { g: { r: 21, sw: 7, vsw: 17 }, paint: 'duo' }],
        ['Heavy O', 'a heavy O, a light V', { g: { r: 19, sw: 17, vsw: 7 }, paint: 'duo' }],
        ['Wide gap', 'more ground around the V where it crosses', { halo: 14, paint: 'duo' }],
        ['No gap', 'the V laid straight over the O', { mode: 'over', paint: 'duo' }],
        ['V behind', 'the O in front, cut around', { mode: 'behind', paint: 'depth' }],
        ['Behind, wide gap', 'the O in front with plenty of air', { mode: 'behind', halo: 13, paint: 'duo' }],
        ['Side by side', 'the V beside the O, just touching', { g: { a: 1.12, t: 1.72, b: 2.32 }, halo: 6, paint: 'sweep' }],
        ['Deep overlap', 'the V crosses far into the O', { g: { a: 0.58, t: 1.28, b: 1.98 }, paint: 'duo' }],
    ] },
    { title: 'The O\'s shape', line: 'the same pair with other outlines', items: [
        ['Squircle O', 'the O as a soft square', { shape: 'squircle', paint: 'duo' }],
        ['Hex O', 'a six-sided O', { shape: 'hex', g: { r: 21, sw: 12 }, paint: 'depth' }],
        ['Octagon O', 'an eight-sided badge O', { shape: 'oct', g: { r: 21, sw: 11 }, paint: 'sweep' }],
        ['Rounded square O', 'an app-shaped O with firm corners', { shape: 'rsquare', g: { r: 19, sw: 12 }, paint: 'depth' }],
        ['Tall O', 'an oval O, a taller pair', { shape: 'oval', g: { r: 21, sw: 12, vsw: 12, a: 0.78, t: 1.38, b: 1.98 }, paint: 'vertical' }],
        ['Tall, apart', 'an oval O and a free V', { shape: 'oval', g: { r: 21, sw: 11, vsw: 11, a: 1.1, t: 1.7, b: 2.3 }, halo: 6, paint: 'duo-rev' }],
    ] },
    { title: 'Construction', line: 'filled, doubled, dotted, hollow, sharp', items: [
        ['Solid V', 'the V as a filled, softened triangle', { mode: 'solid-v', paint: 'duo' }],
        ['Double O', 'the O as two thin rings', { mode: 'double', g: { r: 20, sw: 13, vsw: 12 }, paint: 'duo' }],
        ['Dotted O', 'the O in dots, the V solid', { mode: 'dashed', g: { r: 20, sw: 10, vsw: 13 }, paint: 'duo' }],
        ['Outline', 'both drawn as contours', { mode: 'outline', g: { r: 20, sw: 15, vsw: 15 }, paint: 'sweep' }],
        ['Inline', 'a hairline down each stroke', { mode: 'inline', g: { r: 20, sw: 15, vsw: 15 }, paint: 'vertical' }],
        ['Eye', 'a solid O with a small opening', { mode: 'eye', paint: 'duo' }],
        ['Centre dot', 'a dot in the O', { mode: 'dot', paint: 'duo' }],
        ['Sharp', 'mitred corners and square ends', { mode: 'sharp', paint: 'blue' }],
    ] },
    { title: 'Mixed', line: 'a construction and a finish together', items: [
        ['Hex outline', 'a six-sided O, hollow', { shape: 'hex', mode: 'outline', g: { r: 21, sw: 15, vsw: 15 }, paint: 'aurora' }],
        ['Eye glow', 'a solid O, lit', { mode: 'eye', paint: 'glow' }],
        ['Double, edged', 'two thin rings and an edged V', { mode: 'double', g: { r: 20, sw: 13, vsw: 12 }, paint: 'extrude' }],
        ['Sharp ember', 'mitred and warm', { mode: 'sharp', paint: 'ember' }],
        ['No gap, one ink', 'laid over, in one colour', { mode: 'over', g: { r: 19, sw: 15, vsw: 15 }, paint: 'ink' }],
        ['Dotted glow', 'a glowing O of dots', { mode: 'dashed', g: { r: 20, sw: 10, vsw: 13 }, paint: 'glow' }],
        ['Inline, one ink', 'hairlines in one colour', { mode: 'inline', g: { r: 20, sw: 15, vsw: 15 }, paint: 'ink' }],
        ['Deep, behind', 'a deep cross with the O in front', { mode: 'behind', g: { a: 0.58, t: 1.28, b: 1.98 }, paint: 'aurora' }],
        ['Solid V, warm', 'a filled V, violet into pink', { mode: 'solid-v', paint: 'ember' }],
        ['Eye, one ink', 'the solid O in one colour', { mode: 'eye', g: { r: 19, sw: 14, vsw: 14 }, paint: 'ink' }],
        ['Light glow', 'thin lines, lit', { g: { r: 21, sw: 7, vsw: 7 }, paint: 'glow' }],
    ] },
    { title: 'Colour and finish', line: 'one shape, six finishes', items: [
        ['Glow', 'lit from behind', { paint: 'glow' }],
        ['Solid edge', 'an edge under the strokes', { paint: 'extrude' }],
        ['Aurora', 'cyan into blue into violet across both', { paint: 'aurora' }],
        ['Ember', 'violet into pink', { paint: 'ember' }],
        ['One ink', 'a single colour, for print and stamps', { g: { r: 19, sw: 15, vsw: 15 }, paint: 'ink' }],
        ['Violet O', 'the colours swapped', { paint: 'duo-rev' }],
    ] },
    { title: 'As an app icon', line: 'how it sits on a phone\'s home screen', items: [
        ['App tile', 'white on a gradient tile', { g: { r: 15, sw: 10, vsw: 10 }, paint: 'tile' }],
        ['Night tile', 'the gradient Pair on a dark tile', { g: { r: 15, sw: 10, vsw: 10 }, paint: 'tile-night' }],
        ['Paper tile', 'two colours on a light tile', { g: { r: 15, sw: 10, vsw: 10 }, paint: 'tile-paper' }],
        ['Squircle tile', 'a soft-square O on a gradient tile', { shape: 'squircle', g: { r: 15, sw: 10, vsw: 10 }, paint: 'tile' }],
        ['Solid V tile', 'a filled V on a night tile', { mode: 'solid-v', g: { r: 15, sw: 10, vsw: 10 }, paint: 'tile-night' }],
        ['Centre dot tile', 'a dot in the O, white on a tile', { mode: 'dot', g: { r: 15, sw: 10, vsw: 10 }, paint: 'tile' }],
        ['Outline tile', 'contours in white on a tile', { mode: 'outline', g: { r: 15, sw: 11, vsw: 11 }, paint: 'tile' }],
    ] },
];

// ── Fifty menu buttons ───────────────────────────────────────────────────────────────────────────────────────────
// The button beside the site's name opens search and every OpenVibe site (openvibe-shared navbar.js orbHTML: today
// nine dots set as a diamond). Each idea is drawn in a 24-unit box: its parts (mb-p, numbered --i so a move runs
// through them in turn), the move it makes when hovered, tapped or scrolled into view (data-anim), and how it shows it
// is open: most turn into an ×; a few become one themselves (data-own: the diamond and the grid drop their edge dots,
// a plus turns an eighth, the lines cross, the chevron flips). Colour: currentColor and the accent (mb-a, mb-sa).
// `i` may carry more custom properties after the index ('2;--dx:-1.8px').
const dot = (x, y, r, k = '', i = 0) => `<circle class="mb-p${k}" cx="${f(x)}" cy="${f(y)}" r="${r}" style="--i:${i}"/>`;
const line = (d, k = '', i = 0, w = 2.2) => `<path class="mb-p mb-s${k}" d="${d}" pathLength="100" stroke-width="${w}" style="--i:${i}"/>`;
const fill = (d, k = '', i = 0) => `<path class="mb-p${k}" d="${d}" style="--i:${i}"/>`;
const box = (x, y, w, h, rx, k = '', i = 0) => `<rect class="mb-p${k}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" style="--i:${i}"/>`;
const frame = (x, y, w, h, rx, k = '', i = 0, sw = 2) => `<rect class="mb-p mb-s${k}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" stroke-width="${sw}" pathLength="100" style="--i:${i}"/>`;
const ring = (x, y, r, k = '', i = 0, sw = 2.2) => `<circle class="mb-p mb-s${k}" cx="${f(x)}" cy="${f(y)}" r="${r}" stroke-width="${sw}" pathLength="100" style="--i:${i}"/>`;
function spark(cx, cy, s) {
    const k = s * 0.16;
    return `M${f(cx)} ${f(cy - s)}C${f(cx + k)} ${f(cy - k)} ${f(cx + k)} ${f(cy - k)} ${f(cx + s)} ${f(cy)}C${f(cx + k)} ${f(cy + k)} ${f(cx + k)} ${f(cy + k)} ${f(cx)} ${f(cy + s)}C${f(cx - k)} ${f(cy + k)} ${f(cx - k)} ${f(cy + k)} ${f(cx - s)} ${f(cy)}C${f(cx - k)} ${f(cy - k)} ${f(cx - k)} ${f(cy - k)} ${f(cx)} ${f(cy - s)}Z`;
}
function star(cx, cy, ro, ri) {
    const p = [];
    for (let i = 0; i < 10; i++) { const r = i % 2 ? ri : ro, a = rad(-90 + i * 36); p.push(`${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`); }
    return `M${p.join('L')}Z`;
}
const polar = (r, deg) => [12 + r * Math.cos(rad(deg)), 12 + r * Math.sin(rad(deg))];
const seg2 = (r1, r2, deg, k, i, w) => { const [x1, y1] = polar(r1, deg), [x2, y2] = polar(r2, deg); return line(`M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`, k, i, w); };
// The nine dots: 0 the centre, 1 the edges, 2 the corners (the ripple runs out in that order).
const grid9 = (rc, re, rk) => [[12, 12, 0], [12, 5, 1], [19, 12, 1], [12, 19, 1], [5, 12, 1], [5, 5, 2], [19, 5, 2], [19, 19, 2], [5, 19, 2]]
    .map(([x, y, n]) => dot(x, y, n === 0 ? rc : n === 1 ? re : rk, ` mb-r${n}${n === 0 ? ' mb-a' : ''}`, n)).join('');
const LOOP_ICON = `M${f(12 + 7.4 * Math.cos(rad(237)))} ${f(12.6 + 7.4 * Math.sin(rad(237)))}A7.4 7.4 0 1 0 ${f(12 + 7.4 * Math.cos(rad(-57)))} ${f(12.6 + 7.4 * Math.sin(rad(-57)))}L12 14Z`;

// [name, one line, move, own open state, parts]
const MENU_ROWS = [
    { title: 'Dots', line: 'the family the button has today', items: [
        ['Today', 'nine dots as a diamond; open, an ×', 'ripple', 'diamond', `<g class="mb-g">${grid9(2.5, 2.15, 2.15)}</g>`],
        ['Launcher grid', 'nine dots square, like an app launcher', 'ripple', 'grid', `<g class="mb-g">${grid9(2.2, 2, 2)}</g>`],
        ['Four dots', 'two by two, one lit', 'wave', '', [[8, 8], [16, 8], [8, 16], [16, 16]].map(([x, y], i) => dot(x, y, 2.6, i === 1 ? ' mb-a' : '', i)).join('')],
        ['Three, stacked', 'three dots in a column', 'wave', '', [5, 12, 19].map((y, i) => dot(12, y, 2.3, i === 1 ? ' mb-a' : '', i)).join('')],
        ['Three in a row', 'three dots across', 'wave', '', [5, 12, 19].map((x, i) => dot(x, 12, 2.3, i === 1 ? ' mb-a' : '', i)).join('')],
        ['Plus of dots', 'five dots as a plus; open, it turns to an ×', 'ripple', 'plus', `<g class="mb-g">${dot(12, 12, 2.5, ' mb-a', 0)}${[[12, 5], [19, 12], [12, 19], [5, 12]].map(([x, y]) => dot(x, y, 2.15, '', 1)).join('')}</g>`],
        ['Ring of six', 'six dots round a lit centre', 'ripple', '', dot(12, 12, 2.4, ' mb-a', 0) + [0, 1, 2, 3, 4, 5].map((k) => { const [x, y] = polar(7.6, -90 + k * 60); return dot(x, y, 1.9, '', 1); }).join('')],
        ['Honeycomb', 'seven dots packed close', 'bloom', '', dot(12, 12, 2.5, ' mb-a', 0) + [0, 1, 2, 3, 4, 5].map((k) => { const [x, y] = polar(6.4, -90 + k * 60); return dot(x, y, 2.5, '', k + 1); }).join('')],
        ['Triangle of three', 'three dots, the top one lit', 'pop', '', dot(12, 5.5, 2.7, ' mb-a', 0) + dot(18.6, 17, 2.7, '', 1) + dot(5.4, 17, 2.7, '', 2)],
        ['V of dots', 'five dots making the V', 'wave', '', [[4.5, 7], [8.2, 12.2], [12, 17.5], [15.8, 12.2], [19.5, 7]].map(([x, y], i) => dot(x, y, 2, i === 2 ? ' mb-a' : '', i)).join('')],
        ['Dots by size', 'nine dots, biggest in the middle', 'ripple', 'grid', `<g class="mb-g">${grid9(3, 2, 1.3)}</g>`],
        ['Constellation', 'five stars joined by faint lines', 'twinkle', '', line('M5 8L10 5L14 11L19 7M14 11L16 18', ' mb-faint', 0, 1) + [[5, 8, 1.7], [10, 5, 1.9], [14, 11, 2.4], [19, 7, 1.7], [16, 18, 2]].map(([x, y, r], i) => dot(x, y, r, i === 2 ? ' mb-a' : '', i)).join('')],
    ] },
    { title: 'Tiles and shapes', line: 'squares, circles and petals', items: [
        ['Four tiles', 'two by two rounded squares, one lit', 'bloom', '', [[4, 4], [13, 4], [4, 13], [13, 13]].map(([x, y], i) => box(x, y, 7, 7, 2, i === 1 ? ' mb-a' : '', i)).join('')],
        ['O, V, square, dot', 'four little shapes, the V lit', 'bloom', '', ring(7.6, 7.6, 3.2, '', 0, 2.2) + line('M13.6 5.2L16.5 10L19.4 5.2', ' mb-sa', 1, 2.2) + box(4.4, 13.4, 6.4, 6.4, 1.6, '', 2) + dot(16.5, 16.6, 3.1, '', 3)],
        ['Bento', 'one tall tile and two small', 'bloom', '', box(4, 4, 7, 16, 2.2, ' mb-a', 0) + box(13, 4, 7, 7, 2.2, '', 1) + box(13, 13, 7, 7, 2.2, '', 2)],
        ['Stack of cards', 'three cards that fan out', 'fan', '', frame(8.5, 3.5, 12, 9, 2.4, ' mb-faint', 0) + frame(6.2, 6.8, 12, 9, 2.4, '', '1;--dx:-.8px;--dy:.8px') + box(3.5, 10.5, 12, 9.5, 2.4, ' mb-a', '2;--dx:-1.8px;--dy:1.8px')],
        ['Two circles', 'two rings overlapping', 'fan', '', ring(9, 12, 5.4, '', '0;--dx:-1.6px') + ring(15, 12, 5.4, ' mb-sa', '1;--dx:1.6px')],
        ['Clover', 'four round petals', 'bloom', '', [[12, 7.4], [16.6, 12], [12, 16.6], [7.4, 12]].map(([x, y], i) => dot(x, y, 4, i === 0 ? ' mb-a' : ' mb-soft', i)).join('')],
        ['Pinwheel', 'four quarter circles', 'tilt', '', fill('M11 11H4A7 7 0 0 1 11 4Z', ' mb-a', 0) + fill('M13 11V4A7 7 0 0 1 20 11Z', '', 1) + fill('M13 13H20A7 7 0 0 1 13 20Z', '', 2) + fill('M11 13V20A7 7 0 0 1 4 13Z', '', 3)],
        ['Diamond and dot', 'a diamond outline round a lit dot', 'pop', '', line('M12 3.5L20.5 12L12 20.5L3.5 12Z', '', 0, 2.1) + dot(12, 12, 2.5, ' mb-a', 1)],
        ['Framed dots', 'four dots in a rounded square', 'ripple', '', frame(3.5, 3.5, 17, 17, 5.5, '', 0) + [[9, 9], [15, 9], [9, 15], [15, 15]].map(([x, y], i) => dot(x, y, 1.75, i === 1 ? ' mb-a' : '', 1)).join('')],
        ['Framed plus', 'a plus in a soft square; open, an ×', 'pop', 'plus', frame(3.5, 3.5, 17, 17, 6, ' mb-faint', 0) + `<g class="mb-g">${line('M12 7.8V16.2M7.8 12H16.2', ' mb-sa', 1, 2.4)}</g>`],
    ] },
    { title: 'Search', line: 'it opens search first, so say so', items: [
        ['Magnifier', 'the plain search glass', 'tilt', '', ring(10.5, 10.5, 6, '', 0, 2.4) + line('M15 15L19.8 19.8', ' mb-sa', 1, 2.8)],
        ['Glass and spark', 'search, with a spark of AI', 'twinkle', '', ring(10, 11.2, 5.6, '', 0, 2.3) + line('M14.2 15.4L19 20.2', '', 1, 2.6) + fill(spark(18.4, 5.4, 3.6), ' mb-a', 2)],
        ['Glass with a dot', 'a lit dot in the lens', 'pop', '', ring(10.5, 10.5, 6.2, '', 0, 2.3) + dot(10.5, 10.5, 2.1, ' mb-a', 1) + line('M15.2 15.2L19.8 19.8', '', 2, 2.7)],
        ['Slash key', 'the / key that opens it', 'draw', '', frame(3.5, 3.5, 17, 17, 4.8, '', 0) + line('M14 7.6L10 16.4', ' mb-sa', 1, 2.5)],
        ['Slash in a ring', 'the / key, round', 'draw', '', ring(12, 12, 8.6, '', 0, 2.1) + line('M14.4 7.4L9.6 16.6', ' mb-sa', 1, 2.5)],
        ['Glass of dots', 'four dots seen through the lens', 'ripple', '', ring(10.4, 10.4, 6.4, '', 0, 2.2) + line('M15.1 15.1L19.8 19.8', '', 0, 2.7) + [[8.6, 8.6], [12.2, 8.6], [8.6, 12.2], [12.2, 12.2]].map(([x, y], i) => dot(x, y, 1.05, i === 0 ? ' mb-a' : '', 1)).join('')],
        ['Prompt', 'a > and a blinking line, like a terminal', 'blink', '', line('M5 7L10 12L5 17', '', 0, 2.5) + line('M12.8 17.2H19.2', ' mb-sa mb-k', 1, 2.5)],
        ['List and glass', 'lines of results with a small lens', 'slide', '', line('M4 6H14', '', 0, 2.2) + line('M4 11H10', '', 1, 2.2) + line('M4 16H9', '', 2, 2.2) + ring(16, 14, 3.3, ' mb-sa', 3, 2.1) + line('M18.4 16.4L20.4 18.4', ' mb-sa', 3, 2.2)],
    ] },
    { title: 'Sparks and stars', line: 'a bit of magic', items: [
        ['Sparkle', 'one four-point spark', 'twinkle', '', fill(spark(12, 12, 9), ' mb-a', 0)],
        ['Two sparkles', 'a big spark and a small one', 'twinkle', '', fill(spark(10, 13.5, 7.4), '', 0) + fill(spark(18.2, 5.6, 3.4), ' mb-a', 1)],
        ['Asterisk', 'three strokes through the middle', 'draw', '', line('M12 3.5V20.5', '', 0, 2.4) + line('M4.6 7.75L19.4 16.25', ' mb-sa', 1, 2.4) + line('M4.6 16.25L19.4 7.75', '', 2, 2.4)],
        ['Sun', 'a lit dot and eight short rays', 'ripple', '', dot(12, 12, 3.3, ' mb-a', 0) + [0, 1, 2, 3, 4, 5, 6, 7].map((k) => seg2(6.4, 9.2, k * 45, '', 1, 2)).join('')],
        ['Compass', 'a four-point compass star', 'tilt', '', fill('M12 2.5L14 10L21.5 12L14 14L12 21.5L10 14L2.5 12L10 10Z', '', 0) + dot(12, 12, 1.7, ' mb-a mb-hole', 1)],
        ['Star', 'a five-point star, drawn', 'draw', '', line(star(12, 12.6, 9.4, 4), '', 0, 2)],
        ['Burst', 'dots and ticks around a centre', 'ripple', '', dot(12, 12, 2.4, ' mb-a', 0) + [0, 90, 180, 270].map((a) => seg2(5, 9, a, '', 1, 2.2)).join('') + [45, 135, 225, 315].map((a) => { const [x, y] = polar(7.2, a); return dot(x, y, 1.6, '', 2); }).join('')],
        ['Orb', 'a lit ball, the button\'s own name', 'pulse', '', ring(12, 12, 10, ' mb-faint', 0, 1.2) + dot(12, 12, 7.6, ' mb-a', 1) + dot(9.4, 9.2, 2.3, ' mb-shine', 2)],
    ] },
    { title: 'From the mark', line: 'the logo\'s own shapes, small', items: [
        ['Pair', 'a tiny O and V', 'draw', '', ring(8, 12, 4.6, '', 0, 2.4) + line('M12.3 7.4L15.6 16.6L18.9 7.4', ' mb-sa', 1, 2.4)],
        ['Loop', 'a tiny Loop', 'draw', '', line(LOOP_ICON, ' mb-sa', 0, 2.4)],
        ['V in a ring', 'a chevron inside a circle', 'nod', '', ring(12, 12, 8.6, '', 0, 2.1) + line('M8.4 10.4L12 14L15.6 10.4', ' mb-sa', 1, 2.5)],
        ['Chevron', 'a V pointing down; open, it flips', 'nod', 'flip', `<g class="mb-g">${line('M6 9.2L12 15.2L18 9.2', ' mb-sa', 0, 2.8)}</g>`],
        ['Crescent', 'a moon with a lit star in its curve', 'tilt', '', fill('M10.46 3.64A8.5 8.5 0 1 0 20.36 13.54A7 7 0 0 1 10.46 3.64Z', '', 0) + fill(spark(17.6, 6.4, 2.9), ' mb-a', 1)],
        ['Half and half', 'a circle half lit', 'tilt', '', ring(12, 12, 8.6, '', 0, 2) + fill('M12 3.4A8.6 8.6 0 0 1 12 20.6Z', ' mb-a', 1)],
    ] },
    { title: 'Lines and waves', line: 'menus and sound', items: [
        ['Three lines', 'the classic menu; open, the lines cross', 'slide', 'burger', [6.5, 12, 17.5].map((y, i) => line(`M4.5 ${y}H19.5`, `${i === 1 ? ' mb-sa' : ''} mb-l${i}`, i, 2.4)).join('')],
        ['Two lines', 'a quieter menu; open, an ×', 'slide', 'burger2', [9, 15].map((y, i) => line(`M5 ${y}H19`, ` mb-l${i * 2}`, i, 2.4)).join('')],
        ['Bullet list', 'three dots and three lines', 'slide', '', [6.5, 12, 17.5].map((y, i) => dot(5, y, 1.6, ' mb-a', i) + line(`M9 ${y}H19.5`, '', i, 2.2)).join('')],
        ['Equaliser', 'four bars, like sound', 'bars', '', [[4.2, 8], [8.9, 14], [13.6, 10], [18.3, 16]].map(([x, h], i) => box(x, 20 - h, 2.6, h, 1.3, i === 3 ? ' mb-a' : '', i)).join('')],
        ['Wave', 'one smooth wave', 'draw', '', line('M3 12Q6 5.5 9 12T15 12T21 12', ' mb-sa', 0, 2.5)],
        ['Hub', 'a centre joined to four sites', 'ripple', '', [0, 90, 180, 270].map((a) => seg2(3.8, 5.7, a, ' mb-faint', 1, 1.5)).join('') + dot(12, 12, 2.6, ' mb-a', 0) + [0, 90, 180, 270].map((a) => { const [x, y] = polar(7.6, a); return dot(x, y, 1.9, '', 1); }).join('')],
    ] },
];

// ── The page ─────────────────────────────────────────────────────────────────────────────────────────────────────
// The site names a reader can try beside the mark, and the fonts for them (Nunito is the brand face today: 'OV Brand').
const SITES = ['Live', 'Video', 'Pics', 'Chat', 'Today', 'Codes', 'Design', 'Space'];
const FONTS = [
    ['nunito', 'Nunito', "'OV Brand',Nunito,sans-serif", 'today'],
    ['outfit', 'Outfit', 'Outfit,sans-serif'],
    ['sora', 'Sora', 'Sora,sans-serif'],
    ['manrope', 'Manrope', 'Manrope,sans-serif'],
    ['jakarta', 'Plus Jakarta', "'Plus Jakarta Sans',sans-serif"],
    ['fredoka', 'Fredoka', 'Fredoka,sans-serif'],
    ['lexend', 'Lexend', 'Lexend,sans-serif'],
    ['rubik', 'Rubik', 'Rubik,sans-serif'],
    ['grotesk', 'Space Grotesk', "'Space Grotesk',sans-serif"],
    ['unbounded', 'Unbounded', 'Unbounded,sans-serif'],
];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Outfit:wght@500;800&family=Sora:wght@500;800&family=Manrope:wght@500;800&family=Plus+Jakarta+Sans:wght@500;800&family=Fredoka:wght@500;700&family=Lexend:wght@500;800&family=Rubik:wght@500;800&family=Space+Grotesk:wght@500;700&family=Unbounded:wght@500;800&display=swap';
const STYLES = [['dot', 'OpenVibe.Live'], ['space', 'OpenVibe Live'], ['stack', 'Stacked']];

/** Which idle move a mark makes once it is drawn: one that suits it, varied along the row. */
const SEPARATE_V = ['split', 'apart', 'float', 'cross', 'tipdot', 'dashed', 'segments', 'coin-ring'];
function idleOf(kind, spec, i) {
    if (spec.paint === 'glow') return 'pulse';
    if (spec.dot) return 'dot';
    if (/^tile/.test(spec.paint || '')) return 'float';
    const cycle = kind === 'P' || SEPARATE_V.includes(spec.mode) ? ['nod', 'breathe', 'drift', 'rock'] : ['breathe', 'drift', 'rock'];
    return cycle[i % cycle.length];
}

let seq = 0;
const word = () => '<span class="mx-word"><b>OpenVibe</b><span class="mx-sep">.</span><span class="mx-site" data-mx-site>Live</span></span>';
const useOf = (ref, size) => `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><use href="#${ref}"/></svg>`;
const delay = (i) => `--d:${f((i % 4) * 0.07)}s`;

function markCard(code, kind, [name, line_, spec], i) {
    const art = kind === 'L' ? loopArt(spec, `m${++seq}`) : pairArt(spec, `m${++seq}`);
    const ref = `art-${code}`;
    return `<li class="mx-card" id="${code}" data-code="${code}" style="${delay(i)}">
<div class="mx-stage"><svg viewBox="0 0 100 100" width="132" height="132" role="img" aria-label="${code} ${esc(name)}" data-idle="${idleOf(kind, spec, i)}"><defs>${art.defs}</defs><g id="${ref}">${art.body}</g></svg></div>
<div class="mx-lock">${useOf(ref, 26)}${word()}</div>
<div class="mx-sizes" aria-label="At 16 and 32 pixels"><span class="mx-dark">${useOf(ref, 16)}${useOf(ref, 32)}</span><span class="mx-light">${useOf(ref, 16)}${useOf(ref, 32)}</span></div>
<p class="mx-name"><b>${code}</b> ${esc(name)}</p>
<p class="mx-line">${esc(line_)}</p>
<button type="button" class="mx-pick" data-pick="${code}" aria-pressed="false">Pick ${code}</button>
</li>`;
}

const menuSvg = (anim, own, parts, size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" data-anim="${anim}"${own ? ` data-own="${own}"` : ''}><g class="mb-i">${parts}</g>${own ? '' : '<g class="mb-x"><path d="M7 7L17 17M17 7L7 17"/></g>'}</svg>`;
function menuCard(code, [name, line_, anim, own, parts], i) {
    const bar = (tone) => `<div class="mb-nav mb-${tone}">${useOf('art-pair-today', 22)}${word()}<button type="button" class="mb-btn" data-mb aria-pressed="false" aria-label="${code} at its real size: press to open">${menuSvg(anim, own, parts, 22)}</button></div>`;
    return `<li class="mx-card mb-card" id="${code}" data-code="${code}" style="${delay(i)}">
<div class="mx-stage"><button type="button" class="mb-btn mb-big" data-mb aria-pressed="false" aria-label="${code} ${esc(name)}: press to open it">${menuSvg(anim, own, parts, 84)}</button></div>
<div class="mb-bars">${bar('dark')}${bar('light')}</div>
<p class="mx-name"><b>${code}</b> ${esc(name)}</p>
<p class="mx-line">${esc(line_)}</p>
<button type="button" class="mx-pick" data-pick="${code}" aria-pressed="false">Pick ${code}</button>
</li>`;
}

const pad = (n) => String(n).padStart(2, '0');
function panel(id, kind, rows, label, hidden) {
    let n = 0;
    const body = rows.map((row) => {
        const first = n + 1;
        const cards = row.items.map((item) => { n += 1; const code = `${kind}${pad(n)}`; return kind === 'M' ? menuCard(code, item, n - 1) : markCard(code, kind, item, n - 1); }).join('');
        return `<section class="mx-row"><h3>${esc(row.title)} <small>${kind}${pad(first)}–${kind}${pad(n)} · ${row.items.length}</small></h3><p class="mx-row-line">${esc(row.line)}</p><ul class="mx-grid">${cards}</ul></section>`;
    }).join('');
    return `<section class="mx-panel" id="${id}" role="tabpanel" aria-labelledby="mx-tab-${id}" aria-label="${esc(label)}"${hidden ? ' hidden' : ''}>${body}</section>`;
}

function explorePage() {
    seq = 0;
    const today = pairArt(PAIR_ROWS[0].items[0][2], 'xpair');
    const loopEx = loopArt(LOOP_ROWS[0].items[1][2], 'xloop');
    const pairEx = pairArt(PAIR_ROWS[0].items[0][2], 'xpairtab');
    const m1 = MENU_ROWS[0].items[0];
    const tab = (id, title, line_, art, range, on, side) => `<a class="mx-tab${side ? ' mx-tab-side' : ''}" role="tab" id="mx-tab-${id}" href="#${id}" aria-controls="${id}" aria-selected="${on ? 'true' : 'false'}" data-mx-tab="${id}"><span class="mx-tab-art">${art}</span><span class="mx-tab-t"><b>${title}</b><small>${line_}</small><em>${range}</em></span></a>`;
    const chip = (attr, value, label, extra = '') => `<button type="button" class="mx-chip" ${attr}="${esc(value)}" aria-pressed="false"${extra}>${label}</button>`;
    const body = `<div class="mx-wrap" data-mx data-lock="dot" data-mx-fontcss="${esc(FONT_CSS)}">
<svg class="mx-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>${today.defs}</defs><g id="art-pair-today">${today.body}</g></svg>
<noscript><style>.mx-panel[hidden]{display:block!important}</style></noscript>
<header class="mx-hero">
<p class="mx-eye">The OpenVibe mark · help us choose</p>
<h1>The Loop or the Pair?</h1>
<p class="mx-lede">We&rsquo;re choosing OpenVibe&rsquo;s mark, and it&rsquo;s between two: the <b>Loop</b>, a V folded into a ring, and the <b>Pair</b>, an O beside a V. Each has fifty takes: tell us which of the two you&rsquo;d pick, and the takes you like best. Tap <b>Pick</b> on anything you like, then send us your picks.</p>
</header>
<nav class="mx-choose" role="tablist" aria-label="What to choose">
<p class="mx-q" role="presentation"><span class="mx-qn">1</span> The mark: <b>the Loop or the Pair?</b></p>
<div class="mx-vs" role="presentation">
${tab('loop', 'The Loop', 'A V folded into a ring that opens at the top: one shape, like a badge.', `<svg viewBox="0 0 100 100" width="58" height="58" aria-hidden="true"><defs>${loopEx.defs}</defs>${loopEx.body}</svg>`, 'L01–L50 · fifty takes', true)}
<span class="mx-or" aria-hidden="true">or</span>
${tab('pair', 'The Pair', 'An O and a V side by side, reading as the letters O V.', `<svg viewBox="0 0 100 100" width="58" height="58" aria-hidden="true"><defs>${pairEx.defs}</defs>${pairEx.body}</svg>`, 'P01–P50 · fifty takes')}
</div>
<p class="mx-q" role="presentation"><span class="mx-qn">2</span> Separately: <b>the menu button&rsquo;s look</b> <small>it stays beside the name whichever mark wins</small></p>
${tab('menu', 'The menu button', 'Opens search and every site. Fifty looks for it, each one moves when you hover or tap it.', `<span class="mb-btn mb-tabbtn">${menuSvg(m1[2], m1[3], m1[4], 30)}</span>`, 'M01–M50', false, true)}
</nav>
<div class="mx-tools" data-mx-tools hidden>
<div class="mx-tool"><span class="mx-tool-k">Name</span><div class="mx-chips" role="group" aria-label="The site's name beside the mark">${SITES.map((s) => chip('data-mx-set-site', s, esc(s))).join('')}<input class="mx-own" type="text" maxlength="14" placeholder="Type one" aria-label="Type a site name" data-mx-own spellcheck="false" autocomplete="off"></div></div>
<div class="mx-tool"><span class="mx-tool-k">Font</span><div class="mx-chips" role="group" aria-label="The font of the name" data-mx-fonts>${FONTS.map(([k, label, stack, note]) => chip('data-mx-font', k, `${esc(label)}${note ? ` <small>${note}</small>` : ''}`, ` data-face="${esc(stack)}" style="font-family:${esc(stack)}"`)).join('')}</div></div>
<div class="mx-tool"><span class="mx-tool-k">Style</span><div class="mx-chips" role="group" aria-label="How the name is set">${STYLES.map(([k, label]) => chip('data-mx-lockstyle', k, esc(label))).join('')}</div></div>
<div class="mx-tool"><span class="mx-tool-k">View</span><div class="mx-chips" role="group" aria-label="View">${chip('data-mx-density', 'sheet', 'Sheet: all at once')}${chip('data-mx-still', '1', 'Still')}</div></div>
</div>
${panel('loop', 'L', LOOP_ROWS, 'The Loop: fifty takes', false)}
${panel('pair', 'P', PAIR_ROWS, 'The Pair: fifty takes', true)}
${panel('menu', 'M', MENU_ROWS, 'The menu button: fifty ideas', true)}
<p class="mx-fine">Every mark here is centred and level. None of them replaces the mark the sites use until one is chosen: <a href="/brand">the mark today</a>.</p>
</div>
<div class="mx-bar" data-mx-bar hidden><span class="mx-bar-thumbs" data-mx-thumbs aria-hidden="true"></span><span class="mx-bar-t">Your picks: <b data-mx-picks></b></span><button type="button" class="mx-btn" data-mx-copy>Copy</button><button type="button" class="mx-btn" data-mx-link>Copy link</button><button type="button" class="mx-btn mx-btn-quiet" data-mx-clear>Clear</button></div>`;
    return layout({
        title: 'The Loop or the Pair? Help choose the OpenVibe mark',
        description: 'The OpenVibe mark is between two: the Loop and the Pair, fifty takes on each. Plus fifty looks for the menu button beside the name.',
        path: '/brand/explore',
        active: '/brand',
        robots: 'noindex, follow',
        styles: ['css/marks.css'],
        scripts: ['js/marks.js'],
        body,
    });
}

const LOOPS = LOOP_ROWS.flatMap((r) => r.items);
const PAIRS = PAIR_ROWS.flatMap((r) => r.items);
const MENUS = MENU_ROWS.flatMap((r) => r.items);
module.exports = { explorePage, LOOPS, PAIRS, MENUS, LOOP_ROWS, PAIR_ROWS, MENU_ROWS, loopArt, pairArt };
