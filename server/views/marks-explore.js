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
 *   L01–L72  the Loop: a ring opened at the top with the V folded into it
 *   P01–P60  the Pair: a ring O and a V side by side, the ground showing where they cross
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
    if (s.special) return specialArt(s, id);
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


// ── Outside the box (the owner, 2026-11-01: "the single combined thing… variations that are different fundamentally…
// the O a full circle and the V just part of it… be creative"). One mark each, built its own way, still centred on
// (50, 50) and level. s.special names the construction; s.paint its treatment, as for every Loop.
function specialArt(s, id) {
    const p = paint(s.paint, id);
    const st = { defs: p.defs };
    const mask = masker(st);
    const S = (d, color, w, part, extra = '') => `<path class="mx-s mx-${part}" d="${d}" pathLength="100" fill="none" stroke="${color}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
    const F = (d, color, part, extra = '') => `<path class="mx-f mx-${part}" d="${d}" fill="${color}"${extra}/>`;
    const circle = (cx, cy, r) => `M${f(cx)} ${f(cy - r)}A${f(r)} ${f(r)} 0 1 1 ${f(cx)} ${f(cy + r)}A${f(r)} ${f(r)} 0 1 1 ${f(cx)} ${f(cy - r)}Z`;
    const cut = (d, w, extra = '') => `<path d="${d}" fill="none" stroke="#000" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
    let body = '';
    switch (s.special) {
        case 'circled':   // a full O with the V inside it, touching nothing
            body = S(circle(50, 50, 36), p.a, 9, 'a') + S('M34 36L50 64L66 36', p.b, 11, 'b');
            break;
        case 'notch': {   // a solid disc with a V bitten out of its top
            const m = mask(`${id}m`, '<path d="M24 -2L50 56L76 -2Z" fill="#000"/>');
            body = F(circle(50, 52, 39), p.a, 'a', ` mask="${m}"`);
            break;
        }
        case 'roundv':    // the V's arms are an O cut in half: round, meeting in a point
            body = S('M18 24C18 60 34 78 50 84C66 78 82 60 82 24', p.a, 13, 'a');
            break;
        case 'woven': {   // the V over the ring on the left, under it on the right
            st.defs += `<clipPath id="${id}l"><rect x="-10" y="-10" width="60" height="120"/></clipPath><clipPath id="${id}r"><rect x="50" y="-10" width="60" height="120"/></clipPath>`;
            const V = 'M22 16L50 82L78 16';
            const ring = circle(50, 52, 30);
            const ringMask = mask(`${id}m`, `<g clip-path="url(#${id}l)">${cut(V, 21)}</g>`);
            const vMask = mask(`${id}n`, `<g clip-path="url(#${id}r)">${cut(ring, 20)}</g>`);
            body = `<g mask="${ringMask}">${S(ring, p.a, 11, 'a')}</g><g mask="${vMask}">${S(V, p.b, 11, 'b')}</g>`;
            break;
        }
        case 'split': {   // a disc whose top wedge, a V, wears the second colour
            st.defs += `<clipPath id="${id}c"><path d="${circle(50, 50, 40)}"/></clipPath>`;
            body = F(circle(50, 50, 40), p.a, 'a') + `<g clip-path="url(#${id}c)">${F('M20 0L50 60L80 0Z', p.b, 'b')}</g>` + S('M20 0L50 60L80 0', '#ffffff', 3, 'b', ' opacity=".55" clip-path="url(#' + id + 'c)"');
            break;
        }
        case 'drop':      // the O sits on the V's point: a drop, a pin, a balloon
            body = S(circle(50, 36, 19), p.a, 10, 'a') + S('M33 46L50 86L67 46', p.b, 10, 'b');
            break;
        case 'ovs': {     // an O made of small Vs, all pointing to the middle
            const n = 9;
            for (let i = 0; i < n; i++) {
                const a = (-90 + (360 / n) * i) * Math.PI / 180;
                const cx = 50 + 31 * Math.cos(a), cy = 50 + 31 * Math.sin(a);
                const tip = [cx - 7 * Math.cos(a), cy - 7 * Math.sin(a)];
                const side = (k) => [cx + 3 * Math.cos(a) + 7 * k * -Math.sin(a), cy + 3 * Math.sin(a) + 7 * k * Math.cos(a)];
                const l = side(1), r = side(-1);
                body += S(`M${f(l[0])} ${f(l[1])}L${f(tip[0])} ${f(tip[1])}L${f(r[0])} ${f(r[1])}`, i === 0 ? p.b : p.a, 5.5, i === 0 ? 'b' : 'a');
            }
            break;
        }
        case 'target':    // a dot in a ring, the V cut across both
            {
                const V = 'M30 18L50 62L70 18';
                const m = mask(`${id}m`, cut(V, 18));
                body = `<g mask="${m}">${S(circle(50, 52, 33), p.a, 9, 'a')}<circle class="mx-f mx-a" cx="50" cy="66" r="7" fill="${p.a}"/></g>` + S(V, p.b, 9, 'b');
            }
            break;
        case 'cup':       // a bowl holding the V
            body = S('M16 46A34 34 0 0 0 84 46', p.a, 11, 'a') + S('M30 20L50 58L70 20', p.b, 11, 'b');
            break;
        case 'pick': {    // a guitar pick (a rounded V) with an O cut through it
            const pick = 'M50 88C41 80 15 52 15 34C15 20 30 13 50 13C70 13 85 20 85 34C85 52 59 80 50 88Z';
            const m = mask(`${id}m`, `<path d="${circle(50, 38, 13)}" fill="#000"/>`);
            body = F(pick, p.a, 'a', ` mask="${m}"`);
            break;
        }
        case 'echo':      // the Loop, and an outer arc echoing it, like sound
            {
                const arc = (r, open) => { const a1 = (270 - open) * Math.PI / 180, a2 = (-90 + open) * Math.PI / 180; return `M${f(50 + r * Math.cos(a1))} ${f(54 + r * Math.sin(a1))}A${r} ${r} 0 1 0 ${f(50 + r * Math.cos(a2))} ${f(54 + r * Math.sin(a2))}`; };
                const l = [50 + 23 * Math.cos((270 - 34) * Math.PI / 180), 54 + 23 * Math.sin((270 - 34) * Math.PI / 180)];
                const r = [50 + 23 * Math.cos((-90 + 34) * Math.PI / 180), 54 + 23 * Math.sin((-90 + 34) * Math.PI / 180)];
                body = S(`${arc(23, 34)}L50 56Z`.replace(/^M/, 'M'), p.a, 10, 'a') + S(arc(39, 42), p.b, 6, 'b', ' opacity=".8"');
                void l; void r;
            }
            break;
        case 'weighted': { // a ring heavy at the bottom and light at the top, cradling a V
            body = F(`${circle(50, 52, 39)}${circle(50, 45, 31)}`, p.a, 'a', ' fill-rule="evenodd"') + S('M36 24L50 54L64 24', p.b, 10, 'b');
            break;
        }
        default:
            body = S(circle(50, 50, 34), p.a, 10, 'a');
    }
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
        ['The Loop', 'the baseline: one ring, one V, nothing added', { r: 31, sw: 13, open: 32, tip: 2, paint: 'sweep' }],
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
    { title: 'Ten more takes', line: 'more of the main idea, in other shapes and constructions', items: [
        ['Squircle, apart', 'a soft-square ring and a free V', { shape: 'squircle', r: 32, sw: 12, open: 30, tip: 4, mode: 'apart', paint: 'duo' }],
        ['Oval outline', 'a tall, hollow Loop', { shape: 'oval', r: 34, sw: 14, open: 34, tip: 8, mode: 'outline', paint: 'vertical' }],
        ['Square coin', 'an app-shaped coin with the V cut through', { shape: 'rsquare', r: 31, sw: 10, open: 28, tip: 3, vsw: 11, mode: 'coin', paint: 'duo-rev' }],
        ['Octagon, tip dot', 'a badge whose V ends in a dot', { shape: 'oct', r: 33, sw: 12, open: 26, tip: 6, mode: 'tipdot', paint: 'sweep' }],
        ['Hex, crossing', 'six sides, the arms run past', { shape: 'hex', r: 33, sw: 11, open: 30, tip: 4, mode: 'cross', paint: 'aurora' }],
        ['Squircle in arcs', 'a soft square in three pieces', { shape: 'squircle', r: 32, sw: 12, open: 28, tip: 2, mode: 'segments', paint: 'duo' }],
        ['Oval of dots', 'a tall dotted ring and a solid V', { shape: 'oval', r: 34, sw: 9, open: 32, tip: 8, vsw: 12, mode: 'dashed', paint: 'vertical' }],
        ['Small V, square ring', 'a small V inside an app-shaped ring', { shape: 'rsquare', r: 31, sw: 11, open: 28, tip: 3, vsw: 9, mode: 'float', paint: 'duo' }],
        ['Coin ring, aurora', 'a filled centre and a thin ring, three colours', { r: 31, sw: 12, open: 32, tip: 3, mode: 'coin-ring', paint: 'aurora' }],
        ['Deep and wide', 'a wide opening and a deep V', { r: 32, sw: 13, open: 44, tip: 16, paint: 'ember' }],
    ] },
    { title: 'Outside the box', line: 'the O and the V as one mark, built a different way each time', items: [
        ['Circled V', 'a full O with the V inside it', { special: 'circled', paint: 'duo' }],
        ['Notch', 'a solid disc with a V bitten from its top', { special: 'notch', paint: 'sweep' }],
        ['Round V', 'the V\'s arms curve, an O cut in half', { special: 'roundv', paint: 'vertical' }],
        ['Woven', 'the V over the ring on one side, under it on the other', { special: 'woven', paint: 'duo' }],
        ['Split disc', 'a disc with a V-shaped wedge in the second colour', { special: 'split', paint: 'duo' }],
        ['Drop', 'the O sitting on the V\'s point', { special: 'drop', paint: 'duo-rev' }],
        ['O of Vs', 'a ring made of small Vs, all pointing in', { special: 'ovs', paint: 'sweep' }],
        ['Target', 'a dot and a ring, the V cut through both', { special: 'target', paint: 'duo' }],
        ['Cup', 'a bowl holding the V', { special: 'cup', paint: 'aurora' }],
        ['Pick', 'a guitar pick, a rounded V, with an O through it', { special: 'pick', paint: 'ember' }],
        ['Echo', 'the Loop and an arc echoing it, like sound', { special: 'echo', paint: 'duo' }],
        ['Weighted ring', 'heavy at the bottom, light at the top, cradling the V', { special: 'weighted', paint: 'depth' }],
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
    { title: 'Ten more takes', line: 'more of the main idea, in other shapes and constructions', items: [
        ['Squircle, solid V', 'a soft-square O and a filled V', { shape: 'squircle', mode: 'solid-v', paint: 'duo-rev' }],
        ['Hex, double', 'a six-sided O as two thin rings', { shape: 'hex', mode: 'double', g: { r: 21, sw: 13, vsw: 12 }, paint: 'duo' }],
        ['Tall eye', 'an oval solid O with a small opening', { shape: 'oval', mode: 'eye', g: { r: 21, sw: 12, vsw: 12, a: 0.78, t: 1.38, b: 1.98 }, paint: 'vertical' }],
        ['Square outline', 'an app-shaped O, both hollow', { shape: 'rsquare', mode: 'outline', g: { r: 19, sw: 15, vsw: 15 }, paint: 'sweep' }],
        ['Octagon, centre dot', 'a badge O with a dot in it', { shape: 'oct', mode: 'dot', g: { r: 21, sw: 11 }, paint: 'duo' }],
        ['Heavy, no gap', 'thick strokes laid straight over', { mode: 'over', g: { r: 18, sw: 18, vsw: 17 }, paint: 'vertical' }],
        ['Squircle, behind', 'a soft-square O in front of the V', { shape: 'squircle', mode: 'behind', paint: 'depth' }],
        ['Hex inline', 'six sides with a hairline in each stroke', { shape: 'hex', mode: 'inline', g: { r: 21, sw: 15, vsw: 15 }, paint: 'vertical' }],
        ['Tall, dotted', 'an oval O in dots and a solid V', { shape: 'oval', mode: 'dashed', g: { r: 21, sw: 10, vsw: 13, a: 0.78, t: 1.38, b: 1.98 }, paint: 'duo' }],
        ['Light, side by side', 'thin lines, the V beside the O', { g: { r: 21, sw: 8, vsw: 8, a: 1.12, t: 1.72, b: 2.32 }, halo: 6, paint: 'aurora' }],
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
// Every one of them is a menu button (the owner, 11-01: "this is supposed to be a menu button… they're voting on just
// the menu button: variations of the menu button, that's it"): the diamond it is today, dot grids, launcher tiles, menu
// lines, three dots and framed ones. A dot grid of any size, centred on (12, 12): cols × rows at `gap`, dot radius r.
const gridDots = (cols, rows, gap, r, lit = -1, extra = '') => {
    let out = '', k = 0;
    const x0 = 12 - ((cols - 1) * gap) / 2, y0 = 12 - ((rows - 1) * gap) / 2;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++, k++) out += dot(x0 + x * gap, y0 + y * gap, r, `${k === lit ? ' mb-a' : ''}${extra}`, Math.round(Math.hypot(x - (cols - 1) / 2, y - (rows - 1) / 2)));
    return out;
};
const tiles = (n, size, gap, rx, lit = -1, kind = 'box') => {
    let out = '', k = 0;
    const x0 = 12 - (n * size + (n - 1) * gap) / 2;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++, k++) {
        const px = x0 + x * (size + gap), py = x0 + y * (size + gap);
        out += kind === 'frame' ? frame(f(px), f(py), size, size, rx, k === lit ? ' mb-sa' : '', k, 1.8)
            : kind === 'circle' ? dot(px + size / 2, py + size / 2, size / 2, k === lit ? ' mb-a' : '', k)
                : box(f(px), f(py), size, size, rx, k === lit ? ' mb-a' : '', k);
    }
    return out;
};
const rot = (deg, inner, sc = 1) => `<g transform="translate(12 12) rotate(${deg}) scale(${sc}) translate(-12 -12)">${inner}</g>`;
const LINES = (ys, x1, x2, k = '', w = 2.4) => ys.map((y, i) => line(`M${x1} ${y}H${x2}`, typeof k === 'function' ? k(i) : k, i, w)).join('');

const MENU_ROWS = [
    { title: 'The diamond', line: 'the button as it is today, and its close relatives', items: [
        ['Today', 'nine dots as a diamond; open, an ×', 'ripple', 'diamond', `<g class="mb-g">${grid9(2.5, 2.15, 2.15)}</g>`],
        ['Five-dot diamond', 'four points and a lit centre; open, an ×', 'ripple', 'plus', `<g class="mb-g">${dot(12, 12, 2.5, ' mb-a', 0)}${[[12, 5], [19, 12], [12, 19], [5, 12]].map(([x, y]) => dot(x, y, 2.2, '', 1)).join('')}</g>`],
        ['Big diamond', 'sixteen small dots, set on their corner', 'ripple', '', rot(45, gridDots(4, 4, 4.4, 1.45, 5), 0.92)],
        ['Lit centre', 'the diamond with a bigger, lit middle', 'ripple', 'diamond', `<g class="mb-g">${grid9(3.1, 1.8, 1.8)}</g>`],
        ['Diamond of squares', 'nine small squares on their corner', 'ripple', '', rot(45, [5, 12, 19].map((y) => [5, 12, 19].map((x) => box(x - 2, y - 2, 4, 4, 1.2, x === 12 && y === 12 ? ' mb-a' : '', Math.abs(x - 12) / 7 + Math.abs(y - 12) / 7)).join('')).join(''), 0.8)],
        ['Diamond outline', 'a diamond drawn round a lit dot', 'pop', '', line('M12 3.5 20.5 12 12 20.5 3.5 12Z', '', 0, 2.1) + dot(12, 12, 2.4, ' mb-a', 1)],
        ['Four points', 'four dots on their corner, no middle', 'ripple', '', [[12, 5.5], [18.5, 12], [12, 18.5], [5.5, 12]].map(([x, y], k) => dot(x, y, 2.5, k === 0 ? ' mb-a' : '', k)).join('')],
        ['Lit corners', 'the diamond with its four tips lit', 'ripple', 'diamond', `<g class="mb-g">${[[12, 12, 0], [12, 5, 1], [19, 12, 1], [12, 19, 1], [5, 12, 1], [5, 5, 2], [19, 5, 2], [19, 19, 2], [5, 19, 2]].map(([x, y, n]) => dot(x, y, 2.1, ` mb-r${n}${n === 2 ? ' mb-a' : ''}`, n)).join('')}</g>`],
        ['Diamond in a ring', 'the nine dots inside a circle', 'ripple', '', ring(12, 12, 10, ' mb-faint', 0, 1.6) + rot(45, gridDots(3, 3, 5, 1.55, 4), 0.95)],
        ['Wide diamond', 'nine dots with more air', 'ripple', 'diamond', `<g class="mb-g">${grid9(2.2, 1.9, 1.9)}</g>`],
    ] },
    { title: 'Dot grids', line: 'the app launcher, in dots', items: [
        ['Launcher grid', 'nine dots square; open, an ×', 'ripple', 'grid', `<g class="mb-g">${grid9(2.2, 2, 2)}</g>`],
        ['Four dots', 'two by two', 'wave', '', gridDots(2, 2, 8, 2.7, 1)],
        ['Six dots', 'two across, three down', 'wave', '', gridDots(2, 3, 6.6, 2.2, 3)],
        ['Small grid, lit centre', 'nine small dots, the middle one lit', 'ripple', '', gridDots(3, 3, 6.4, 1.7, 4)],
        ['Lit corner', 'nine dots, the top right one lit', 'ripple', '', gridDots(3, 3, 7, 2.1, 2)],
        ['Honeycomb', 'seven dots packed close', 'bloom', '', dot(12, 12, 2.5, ' mb-a', 0) + [0, 1, 2, 3, 4, 5].map((k) => { const [x, y] = polar(6.4, -90 + k * 60); return dot(x, y, 2.5, '', k + 1); }).join('')],
        ['Dots by size', 'nine dots, biggest in the middle', 'ripple', 'grid', `<g class="mb-g">${grid9(3, 2, 1.3)}</g>`],
        ['Wide grid', 'three across, two down', 'wave', '', gridDots(3, 2, 7, 2.2, 1)],
        ['Grid of rings', 'nine small rings', 'ripple', '', [0, 1, 2].map((y) => [0, 1, 2].map((x) => ring(5 + x * 7, 5 + y * 7, 1.9, x === 1 && y === 1 ? ' mb-sa' : '', Math.abs(x - 1) + Math.abs(y - 1), 1.6)).join('')).join('')],
        ['Dense grid', 'sixteen tiny dots', 'ripple', '', gridDots(4, 4, 5, 1.35, 5)],
    ] },
    { title: 'Launcher tiles', line: 'every site as a tile', items: [
        ['Four tiles', 'two by two rounded squares, one lit', 'bloom', '', tiles(2, 7, 2, 2, 1)],
        ['Four circles', 'two by two discs', 'bloom', '', tiles(2, 7, 2, 0, 1, 'circle')],
        ['Nine tiles', 'three by three small squares', 'bloom', '', tiles(3, 4.6, 1.8, 1.2, 4)],
        ['Soft tiles', 'two by two very round squares', 'bloom', '', tiles(2, 7.4, 1.8, 3.2, 0)],
        ['Bento', 'one tall tile and two small', 'bloom', '', box(4, 4, 7, 16, 2.2, ' mb-a', 0) + box(13, 4, 7, 7, 2.2, '', 1) + box(13, 13, 7, 7, 2.2, '', 2)],
        ['One open tile', 'three tiles and one outline', 'bloom', '', box(4, 4, 7, 7, 2, '', 0) + frame(13.4, 4.4, 6.2, 6.2, 1.8, ' mb-sa', 1, 1.8) + box(4, 13, 7, 7, 2, '', 2) + box(13, 13, 7, 7, 2, '', 3)],
        ['Tiles on their corner', 'four squares as a diamond', 'bloom', '', rot(45, tiles(2, 6.2, 2.2, 1.6, 0), 0.95)],
        ['Four outlines', 'two by two square outlines', 'bloom', '', tiles(2, 6.4, 2.6, 1.8, 1, 'frame')],
        ['Tile and dots', 'one tile and three dots', 'bloom', '', box(4, 4, 7, 7, 2, ' mb-a', 0) + dot(16.5, 7.5, 3, '', 1) + dot(7.5, 16.5, 3, '', 2) + dot(16.5, 16.5, 3, '', 3)],
        ['Circles and squares', 'two discs, two tiles', 'bloom', '', dot(7.5, 7.5, 3.5, '', 0) + box(13, 4, 7, 7, 2, ' mb-a', 1) + box(4, 13, 7, 7, 2, '', 2) + dot(16.5, 16.5, 3.5, '', 3)],
    ] },
    { title: 'Menu lines', line: 'the classic menu, in many cuts', items: [
        ['Three lines', 'the classic; open, the lines cross', 'slide', 'burger', [6.5, 12, 17.5].map((y, i) => line(`M4.5 ${y}H19.5`, `${i === 1 ? ' mb-sa' : ''} mb-l${i}`, i, 2.4)).join('')],
        ['Two lines', 'a quieter menu; open, an ×', 'slide', 'burger2', [9, 15].map((y, i) => line(`M5 ${y}H19`, ` mb-l${i * 2}`, i, 2.4)).join('')],
        ['Stepped lines', 'long, middle, short', 'slide', '', line('M4.5 6.5H19.5', '', 0, 2.4) + line('M4.5 12H15', ' mb-sa', 1, 2.4) + line('M4.5 17.5H10.5', '', 2, 2.4)],
        ['Centred lines', 'long, short, long', 'slide', '', line('M4.5 6.5H19.5', '', 0, 2.4) + line('M8 12H16', ' mb-sa', 1, 2.4) + line('M4.5 17.5H19.5', '', 2, 2.4)],
        ['Bullet list', 'three dots and three lines', 'slide', '', [6.5, 12, 17.5].map((y, i) => dot(5, y, 1.6, ' mb-a', i) + line(`M9 ${y}H19.5`, '', i, 2.2)).join('')],
        ['Heavy bars', 'three thick bars', 'slide', '', LINES([6.5, 12, 17.5], 5, 19, (i) => (i === 1 ? ' mb-sa' : ''), 3.2)],
        ['Right-aligned', 'lines that end on the right', 'slide', '', line('M4.5 6.5H19.5', '', 0, 2.4) + line('M9 12H19.5', '', 1, 2.4) + line('M13.5 17.5H19.5', ' mb-sa', 2, 2.4)],
        ['Lit middle', 'three lines, the middle one lit', 'slide', '', LINES([6.5, 12, 17.5], 4.5, 19.5, (i) => (i === 1 ? ' mb-sa' : ''), 2.4)],
        ['Short lines', 'three short lines, centred', 'slide', '', LINES([7.5, 12, 16.5], 8, 16, (i) => (i === 0 ? ' mb-sa' : ''), 2.4)],
        ['Lines in a pill', 'three lines in a rounded frame', 'slide', '', frame(3, 4.5, 18, 15, 5, ' mb-faint', 0, 1.6) + LINES([9, 12, 15], 8, 16, (i) => (i === 1 ? ' mb-sa' : ''), 2)],
    ] },
    { title: 'Three dots', line: 'the "more" button', items: [
        ['Three, stacked', 'three dots in a column', 'wave', '', [5, 12, 19].map((y, i) => dot(12, y, 2.3, i === 1 ? ' mb-a' : '', i)).join('')],
        ['Three in a row', 'three dots across', 'wave', '', [5, 12, 19].map((x, i) => dot(x, 12, 2.3, i === 1 ? ' mb-a' : '', i)).join('')],
        ['Big three', 'three bigger dots across', 'wave', '', [4.8, 12, 19.2].map((x, i) => dot(x, 12, 3, i === 2 ? ' mb-a' : '', i)).join('')],
        ['Three in a pill', 'three dots in a rounded frame', 'wave', '', frame(2.5, 7, 19, 10, 5, ' mb-faint', 0, 1.6) + [7.5, 12, 16.5].map((x, i) => dot(x, 12, 1.7, i === 1 ? ' mb-a' : '', i)).join('')],
        ['Triangle of three', 'three dots, the top one lit', 'pop', '', dot(12, 5.5, 2.7, ' mb-a', 0) + dot(18.6, 17, 2.7, '', 1) + dot(5.4, 17, 2.7, '', 2)],
    ] },
    { title: 'Framed', line: 'a menu inside a shape', items: [
        ['Grid in a square', 'nine dots in a rounded square', 'ripple', '', frame(3, 3, 18, 18, 5.5, ' mb-faint', 0, 1.6) + gridDots(3, 3, 4.6, 1.3, 4)],
        ['Lines in a circle', 'three lines in a ring', 'slide', '', ring(12, 12, 9.5, ' mb-faint', 0, 1.6) + LINES([8.5, 12, 15.5], 8, 16, (i) => (i === 1 ? ' mb-sa' : ''), 2)],
        ['Diamond in a squircle', 'the nine dots in a soft square', 'ripple', '', frame(2.5, 2.5, 19, 19, 7, ' mb-faint', 0, 1.6) + rot(45, gridDots(3, 3, 4.6, 1.3, 4), 1)],
        ['Tiles in a circle', 'four tiles in a ring', 'bloom', '', ring(12, 12, 10, ' mb-faint', 0, 1.6) + tiles(2, 4.4, 1.6, 1.2, 1)],
        ['Chevron in a circle', 'a V pointing down; open, it flips', 'nod', 'flip', ring(12, 12, 8.8, ' mb-faint', 0, 1.8) + `<g class="mb-g">${line('M8.2 10.4 12 14.2 15.8 10.4', ' mb-sa', 1, 2.4)}</g>`],
    ] },
];

// ── The page ─────────────────────────────────────────────────────────────────────────────────────────────────────

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
// One real name as the example (the owner, 11-01: "see what it looks like with the full domain spelled out").
const word = () => '<span class="mx-word"><b>OpenVibe</b><span class="mx-sep">.</span><span class="mx-site">Chat</span></span>';
const useOf = (ref, size) => `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><use href="#${ref}"/></svg>`;
const delay = (i) => `--d:${f((i % 4) * 0.07)}s`;

function markCard(code, kind, [name, line_, spec], i) {
    const art = kind === 'L' ? loopArt(spec, `m${++seq}`) : pairArt(spec, `m${++seq}`);
    const ref = `art-${code}`;
    return `<li class="mx-card" id="${code}" data-code="${code}" style="${delay(i)}">
<button type="button" class="mx-pick" data-pick="${code}" aria-pressed="false" aria-label="Pick ${code}"></button>
<div class="mx-stage"><svg viewBox="0 0 100 100" width="132" height="132" role="img" aria-label="${code} ${esc(name)}" data-idle="${idleOf(kind, spec, i)}"><defs>${art.defs}</defs><g id="${ref}">${art.body}</g></svg></div>
<div class="mx-lock">${useOf(ref, 26)}${word()}</div>
<div class="mx-sizes" aria-label="At 16 and 32 pixels"><span class="mx-dark">${useOf(ref, 16)}${useOf(ref, 32)}</span><span class="mx-light">${useOf(ref, 16)}${useOf(ref, 32)}</span></div>
<p class="mx-name"><b>${code}</b> ${esc(name)}</p>
<p class="mx-line">${esc(line_)}</p>
</li>`;
}

const menuSvg = (anim, own, parts, size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" data-anim="${anim}"${own ? ` data-own="${own}"` : ''}><g class="mb-i">${parts}</g>${own ? '' : '<g class="mb-x"><path d="M7 7L17 17M17 7L7 17"/></g>'}</svg>`;
function menuCard(code, [name, line_, anim, own, parts], i) {
    const bar = (tone) => `<div class="mb-nav mb-${tone}">${useOf('art-pair-today', 22)}${word()}<button type="button" class="mb-btn" data-mb aria-pressed="false" aria-label="${code} at its real size: press to open">${menuSvg(anim, own, parts, 22)}</button></div>`;
    return `<li class="mx-card mb-card" id="${code}" data-code="${code}" style="${delay(i)}">
<button type="button" class="mx-pick" data-pick="${code}" aria-pressed="false" aria-label="Pick ${code}"></button>
<div class="mx-stage"><button type="button" class="mb-btn mb-big" data-mb aria-pressed="false" aria-label="${code} ${esc(name)}: press to open it">${menuSvg(anim, own, parts, 84)}</button></div>
<div class="mb-bars">${bar('dark')}${bar('light')}</div>
<p class="mx-name"><b>${code}</b> ${esc(name)}</p>
<p class="mx-line">${esc(line_)}</p>
</li>`;
}


// ── Step 3: the name's font (the owner, 2026-11-01: "re-add the font choice… saved… show what people chose… guide them
// through each step"). Twelve faces in three families, each setting "OpenVibe" beside the mark this person picked.
const FONT_ROWS = [
    { title: 'Rounded and friendly', line: 'soft corners, like the mark', items: [
        ['Nunito', 'the brand face today', "'OV Brand',Nunito,sans-serif", 800],
        ['Fredoka', 'round and playful', 'Fredoka,sans-serif', 700],
        ['Quicksand', 'light, round, airy', 'Quicksand,sans-serif', 700],
        ['Rubik', 'slightly rounded, sturdy', 'Rubik,sans-serif', 800],
    ] },
    { title: 'Geometric', line: 'circles and straight lines, clean', items: [
        ['Outfit', 'geometric and wide', 'Outfit,sans-serif', 800],
        ['Sora', 'tech, open shapes', 'Sora,sans-serif', 800],
        ['Lexend', 'made for easy reading', 'Lexend,sans-serif', 800],
        ['Poppins', 'the classic geometric', 'Poppins,sans-serif', 800],
    ] },
    { title: 'Sharp and modern', line: 'crisper corners, more character', items: [
        ['Manrope', 'modern grotesque', 'Manrope,sans-serif', 800],
        ['Plus Jakarta Sans', 'friendly grotesque', "'Plus Jakarta Sans',sans-serif", 800],
        ['Space Grotesk', 'quirky and technical', "'Space Grotesk',sans-serif", 700],
        ['Unbounded', 'wide display face', 'Unbounded,sans-serif', 800],
    ] },
];
const FONTS = FONT_ROWS.flatMap((r) => r.items);
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;700&family=Quicksand:wght@500;700&family=Rubik:wght@500;800&family=Outfit:wght@500;800&family=Sora:wght@500;800&family=Lexend:wght@500;800&family=Poppins:wght@500;800&family=Manrope:wght@500;800&family=Plus+Jakarta+Sans:wght@500;800&family=Space+Grotesk:wght@500;700&family=Unbounded:wght@500;800&display=swap';
function fontCard(code, [name, line_, stack, weight], i) {
    const face = esc(stack);
    return `<li class="mx-card fx-card" id="${code}" data-code="${code}" style="${delay(i)}">
<button type="button" class="mx-pick" data-pick="${code}" aria-pressed="false" aria-label="Pick ${code}"></button>
<div class="mx-stage fx-stage"><span class="fx-lock"><svg class="fx-mark" viewBox="0 0 100 100" width="44" height="44" aria-hidden="true"><use href="#art-pair-today"/></svg><span class="fx-word" style="font-family:${face};font-weight:${weight}">OpenVibe</span></span></div>
<div class="fx-light"><svg class="fx-mark" viewBox="0 0 100 100" width="26" height="26" aria-hidden="true"><use href="#art-pair-today"/></svg><span style="font-family:${face};font-weight:${weight}">OpenVibe<span class="fx-site">.Chat</span></span></div>
<p class="fx-sample" style="font-family:${face};font-weight:${weight}">OpenVibe.Live · OpenVibe.Video · OpenVibe.Pics</p>
<p class="mx-name"><b>${code}</b> ${esc(name)}</p>
<p class="mx-line">${esc(line_)}</p>
</li>`;
}

const pad = (n) => String(n).padStart(2, '0');
function panel(id, kind, rows, label, hidden) {
    let n = 0;
    const body = rows.map((row) => {
        const first = n + 1;
        const cards = row.items.map((item) => { n += 1; const code = `${kind}${pad(n)}`; return kind === 'M' ? menuCard(code, item, n - 1) : kind === 'F' ? fontCard(code, item, n - 1) : markCard(code, kind, item, n - 1); }).join('');
        return `<section class="mx-row"><h3>${esc(row.title)} <small>${kind}${pad(first)}–${kind}${pad(n)} · ${row.items.length}</small><span class="mx-swipe" aria-hidden="true">swipe →</span></h3><p class="mx-row-line">${esc(row.line)}</p><ul class="mx-grid">${cards}</ul></section>`;
    }).join('');
    const NEXT = {
        loop: [['pair', 'See the Pair', 'the other logo'], ['menu', 'Next: menu button', 'step 2']],
        pair: [['loop', 'See the Loop', 'the other logo'], ['menu', 'Next: menu button', 'step 2']],
        menu: [['loop', 'Back', 'step 1, the logo'], ['font', 'Next: font', 'step 3']],
        font: [['menu', 'Back', 'step 2, the menu button'], ['share', 'Done: share', 'your votes are in']],
    }[id];
    const next = `<nav class="mx-next" aria-label="Where next">${NEXT.map(([to, title, line_]) => to === 'share'
        ? `<button type="button" class="mx-next-share" data-mx-share><b>${title} <span aria-hidden="true">✓</span></b><small>${line_}</small></button>`
        : `<a href="#${to}" data-mx-go="${to}"><b>${title} <span aria-hidden="true">${/^Back/.test(title) ? '←' : '→'}</span></b><small>${line_}</small></a>`).join('')}</nav>`;
    const STEP = {
        loop: [1, 'Pick a logo: the Loop', 'Tap the ones you like. Look at the Pair too.'],
        pair: [1, 'Pick a logo: the Pair', 'Tap the ones you like. Look at the Loop too.'],
        menu: [2, 'Pick a menu button', 'Tap one to see it open.'],
        font: [3, 'Pick a font', 'Tap the one that looks right.'],
    }[id];
    const head = `<div class="mx-stephead"><span class="mx-stepn mx-stepn-lg" aria-hidden="true">${STEP[0]}</span><div><b>Step ${STEP[0]} of 3 · ${esc(STEP[1])}</b><small>${esc(STEP[2])}</small></div></div>`;
    const with_ = id === 'menu' || id === 'font' ? '<p class="mb-with" data-mb-with>Next to today&rsquo;s logo. Pick a logo first to see yours here.</p>' : '';
    return `<section class="mx-panel" id="${id}" role="tabpanel" aria-labelledby="mx-tab-${id}" aria-label="${esc(label)}"${hidden ? ' hidden' : ''}>${head}${with_}${body}${next}</section>`;
}

/** One small mark for the tally, drawn on its own (its own ids), so it shows whichever tab is open. */
function miniArt(code, size = 26, tag = '') {
    const i = Number(code.slice(1)) - 1;
    if (code[0] === 'M') { const m = MENUS[i]; return m ? `<span class="mb-btn mx-mini-m">${menuSvg(m[2], m[3], m[4], size - 4)}</span>` : ''; }
    if (code[0] === 'F') { const fo = FONTS[i]; return fo ? `<span class="fx-mini" style="font-family:${esc(fo[2])};font-weight:${fo[3]}">Aa</span>` : ''; }
    const item = (code[0] === 'L' ? LOOPS : PAIRS)[i];
    if (!item) return '';
    const art = code[0] === 'L' ? loopArt(item[2], `t${tag}${code}`) : pairArt(item[2], `t${tag}${code}`);
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${art.defs ? `<defs>${art.defs}</defs>` : ''}${art.body}</svg>`;
}
const chipOf = ({ code, n }) => `<span class="mx-top" data-code="${code}">${miniArt(code)}<b>${code}</b><i>${n}</i></span>`;
/** What people picked so far (server/brand-picks.js tally), at the top; marks.js redraws it after each save. */
function tallyBlock(t) {
    const people = (t && t.people) || 0;
    const loop = (t && t.lean && t.lean.loop) || 0, pair = (t && t.lean && t.lean.pair) || 0;
    const loopPct = loop + pair ? Math.round((loop / (loop + pair)) * 100) : 50;
    const marks = t ? [...(t.top.L || []), ...(t.top.P || [])].sort((a, b) => b.n - a.n || (a.code < b.code ? -1 : 1)).slice(0, 6) : [];
    const menus = t ? (t.top.M || []).slice(0, 4) : [];
    const fonts = t ? (t.top.F || []).slice(0, 4) : [];
    const lead = loop + pair ? (loop === pair ? 'Level so far' : loop > pair ? 'The Loop leads' : 'The Pair leads') : 'No picks yet';
    return `<section class="mx-tally${people ? '' : ' is-empty'}" data-mx-tally aria-label="What people picked so far">
<div class="mx-tally-h"><b>Votes so far</b><span data-mx-people>${people ? `${people} ${people === 1 ? 'person' : 'people'}` : 'No votes yet. Be the first.'}</span><span class="mx-tally-lead" data-mx-lead>${lead}</span></div>
<div class="mx-lean" style="--l:${loopPct}%"><span class="mx-lean-end">${miniArt('L01', 24, 'e')}<span>Loop</span><b data-mx-loop>${loop + pair ? `${loopPct}%` : '–'}</b></span><span class="mx-lean-bar" aria-hidden="true"><i></i></span><span class="mx-lean-end mx-lean-r"><b data-mx-pair>${loop + pair ? `${100 - loopPct}%` : '–'}</b><span>Pair</span>${miniArt('P01', 24, 'e')}</span></div>
<div class="mx-tops"><span class="mx-tops-k">Top logos</span><span class="mx-tops-list" data-mx-tops>${marks.map(chipOf).join('') || '<em>none yet</em>'}</span></div>
<div class="mx-mine" data-mx-mine hidden><span class="mx-tops-k">Your votes</span><b data-mx-picks></b><button type="button" class="mx-btn" data-mx-link>Copy link</button><button type="button" class="mx-btn mx-btn-quiet" data-mx-clear>Clear</button><em class="mx-saved" data-mx-saved>saved</em></div>
<div class="mx-tops"><span class="mx-tops-k">Menu button</span><span class="mx-tops-list" data-mx-tops-m>${menus.map(chipOf).join('') || '<em>none yet</em>'}</span></div>
<div class="mx-tops"><span class="mx-tops-k">Font</span><span class="mx-tops-list" data-mx-tops-f>${fonts.map(chipOf).join('') || '<em>none yet</em>'}</span></div>
</section>`;
}

function explorePage({ tally = null } = {}) {
    seq = 0;
    const today = pairArt(PAIR_ROWS[0].items[0][2], 'xpair');
    const loopEx = loopArt(LOOP_ROWS[0].items[0][2], 'xloop');
    const pairEx = pairArt(PAIR_ROWS[0].items[0][2], 'xpairtab');
    const m1 = MENU_ROWS[0].items[0];
    const tab = (id, title, line_, art, range, on, side) => `<a class="mx-tab${side ? ' mx-tab-side' : ''}" role="tab" id="mx-tab-${id}" href="#${id}" aria-controls="${id}" aria-selected="${on ? 'true' : 'false'}" data-mx-tab="${id}"><span class="mx-tab-art" data-mx-cycle="${id}"><span class="mx-ta">${art}</span><em class="mx-tab-code" aria-hidden="true"></em></span><span class="mx-tab-t"><b>${title}</b><small>${line_}</small><em>${range}</em></span></a>`;
    const chip = (attr, value, label, extra = '') => `<button type="button" class="mx-chip" ${attr}="${esc(value)}" aria-pressed="false"${extra}>${label}</button>`;
    const body = `<div class="mx-wrap" data-mx data-mx-fontcss="${esc(FONT_CSS)}">
<svg class="mx-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>${today.defs}</defs><g id="art-pair-today">${today.body}</g></svg>
<noscript><style>.mx-panel[hidden]{display:block!important}</style></noscript>
<header class="mx-hero">
<p class="mx-eye">OpenVibe logo vote</p>
<h1>Which logo should OpenVibe use?</h1>
<p class="mx-lede">Tap the ones you like. Then pick a menu button and a font. Votes count right away.</p>
</header>
${tallyBlock(tally)}
<nav class="mx-choose" role="tablist" aria-label="What to choose">
<p class="mx-q" role="presentation"><span class="mx-qn">1</span> <b>Pick a logo</b></p>
<div class="mx-vs" role="presentation">
${tab('loop', 'The Loop', 'A V inside a ring', `<svg viewBox="0 0 100 100" width="58" height="58" aria-hidden="true"><defs>${loopEx.defs}</defs>${loopEx.body}</svg>`, `L01–L${LOOPS.length} · ${LOOPS.length} takes`, true)}
<span class="mx-or" aria-hidden="true">or</span>
${tab('pair', 'The Pair', 'An O next to a V', `<svg viewBox="0 0 100 100" width="58" height="58" aria-hidden="true"><defs>${pairEx.defs}</defs>${pairEx.body}</svg>`, `P01–P${PAIRS.length} · ${PAIRS.length} takes`)}
</div>
<p class="mx-q" role="presentation"><span class="mx-qn">2</span> <b>Pick a menu button</b> <small>it sits next to the logo</small></p>
${tab('menu', 'The menu button', 'The button next to the logo', `<span class="mb-btn mb-tabbtn">${menuSvg(m1[2], m1[3], m1[4], 30)}</span>`, 'M01–M50', false, true)}
<p class="mx-q" role="presentation"><span class="mx-qn">3</span> <b>Pick a font</b> <small>for the name</small></p>
${tab('font', 'The font', 'The letters of the name', '<span class="fx-tabart" aria-hidden="true">Aa</span>', `F01–F${pad(FONTS.length)}`, false, true)}
</nav>
<nav class="mx-steps" data-mx-steps aria-label="Jump between the choices" hidden>
<span class="mx-stepn" aria-hidden="true">1</span><span class="mx-steps-k">The mark</span>
<a href="#loop" data-mx-go="loop" class="mx-step">${miniArt('L01', 20, 's')}<span>Loop</span><i data-mx-count="L"></i></a>
<a href="#pair" data-mx-go="pair" class="mx-step">${miniArt('P01', 20, 's')}<span>Pair</span><i data-mx-count="P"></i></a>
<span class="mx-steps-sep" aria-hidden="true">→</span><span class="mx-stepn" aria-hidden="true">2</span>
<a href="#menu" data-mx-go="menu" class="mx-step mx-step-2">${miniArt('M01', 22, 's')}<span>Menu button</span><i data-mx-count="M"></i></a>
<span class="mx-steps-sep" aria-hidden="true">→</span><span class="mx-stepn" aria-hidden="true">3</span>
<a href="#font" data-mx-go="font" class="mx-step mx-step-3"><span class="fx-mini" aria-hidden="true">Aa</span><span>Font</span><i data-mx-count="F"></i></a>
<button type="button" class="mx-step mx-sheet" data-mx-density="sheet" aria-pressed="false" aria-label="Sheet: show all at once"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/></svg></button>
<button type="button" class="mx-step mx-share" data-mx-share aria-label="Copy your picks and a link to them"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/></svg><span>Share</span></button>
</nav>
${panel('loop', 'L', LOOP_ROWS, `The Loop: ${LOOPS.length} takes`, false)}
${panel('pair', 'P', PAIR_ROWS, `The Pair: ${PAIRS.length} takes`, true)}
${panel('menu', 'M', MENU_ROWS, 'The menu button: fifty ideas', true)}
${panel('font', 'F', FONT_ROWS, 'The font: twelve faces', true)}
<div class="mx-nudge" data-mx-nudge role="status" hidden><span data-mx-nudge-text></span><a href="#menu" data-mx-go="menu" class="mx-btn" data-mx-nudge-go>Go to step 2 →</a><button type="button" class="mx-btn mx-btn-quiet" data-mx-nudge-close aria-label="Close">✕</button></div>
<p class="mx-fine">Nothing changes on the sites until a logo wins. <a href="/brand">Today&rsquo;s logo</a>.</p>
</div>`;
    return layout({
        title: 'Help choose the OpenVibe mark',
        description: 'Help choose the OpenVibe mark in three quick steps: the Loop or the Pair, the menu button beside it, and the font of the name.',
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
module.exports = { explorePage, tallyBlock, FONTS, LOOPS, PAIRS, MENUS, LOOP_ROWS, PAIR_ROWS, MENU_ROWS, loopArt, pairArt };
