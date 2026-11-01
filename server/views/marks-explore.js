'use strict';
/**
 * openvibe.design/brand/explore — a hundred takes on the two OpenVibe marks, for feedback (the owner, 2026-11-01:
 * "the V and the OV versions… a hundred different variations… 50 of each… put it on OpenVibe somewhere so that I can
 * link it to other people to get their feedback").
 *
 *   L01–L50  the Loop: a ring opened at the top, with the V folded into it (the mark of 31 October morning)
 *   P01–P50  the Pair: a ring O and a round V, the ground showing where they cross (the mark since 31 October)
 *
 * Each family is ten structures × five colour treatments, drawn from the same geometry as openvibe-shared/mark.js
 * (the Pair) and Shared 4.58.0's ov-mark.js (the Loop), in a 100-unit box centred on (50, 50). The rules that hold
 * for any OpenVibe mark hold here: centred, level, no liquid fusions, no pac-man shapes. Every card is numbered, so
 * feedback is a list like "P17, L04"; a card can be picked, and the picks travel in the page's link.
 */
const { layout, esc } = require('../render/layout');

const BLUE = '#4f7cff';
const VIOLET = '#8b5cf6';
const INK = '#e8edf3';
const f = (v) => +Number(v).toFixed(2);
const rad = (d) => (d * Math.PI) / 180;
function mix(hex, to, t) {
    const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
    return `#${[16, 8, 0].map((sh) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t).toString(16).padStart(2, '0')).join('')}`;
}
const light = (h, t = 0.3) => mix(h, '#ffffff', t);
const deep = (h, t = 0.16) => mix(h, '#000000', t);

// ── Colour treatments ────────────────────────────────────────────────────────────────────────────────────────────
// Each returns paint for the two parts of a mark (a = the ring, b = the V) and the gradients it needs.
const TONES = [
    { id: 'grad', name: 'Blue to violet', line: 'the network\'s two colours as one sweep' },
    { id: 'depth', name: 'Two colours, depth', line: 'each part in its own colour, lit from above' },
    { id: 'flat', name: 'Flat', line: 'solid colours, nothing blended: the small-size test' },
    { id: 'rev', name: 'Reversed', line: 'violet first, blue second' },
    { id: 'ink', name: 'One ink', line: 'one colour, for print, stamps and a busy photo' },
];
function paint(tone, id) {
    const lin = (gid, c1, c2, x1 = 0, y1 = 0, x2 = 1, y2 = 1) => `<linearGradient id="${gid}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
    if (tone === 'grad') return { defs: lin(`${id}g`, BLUE, VIOLET), a: `url(#${id}g)`, b: `url(#${id}g)` };
    if (tone === 'depth') return { defs: lin(`${id}a`, light(BLUE), deep(BLUE), 0, 0, 0, 1) + lin(`${id}b`, light(VIOLET), deep(VIOLET), 0, 0, 0, 1), a: `url(#${id}a)`, b: `url(#${id}b)` };
    if (tone === 'flat') return { defs: '', a: BLUE, b: VIOLET };
    if (tone === 'rev') return { defs: lin(`${id}r`, VIOLET, BLUE), a: VIOLET, b: BLUE, sweep: `url(#${id}r)` };
    return { defs: '', a: 'currentColor', b: 'currentColor' };
}

// ── The Loop ─────────────────────────────────────────────────────────────────────────────────────────────────────
// A ring of radius r opened `open`° each side of the top; the V runs from the two ends of the opening to a tip `tip`
// units below the centre. Every variant is centred on (50, 50) with its dot, if it has one.
function loopGeo({ r = 33, sw = 13, open = 33, tip = 2, dot = null }) {
    const a = rad(open);
    const extra = dot === 'above' ? 4 : 0;
    const cy = 50 + extra;
    const L = [f(50 - r * Math.sin(a)), f(cy - r * Math.cos(a))];
    const R = [f(50 + r * Math.sin(a)), f(cy - r * Math.cos(a))];
    const T = [50, f(cy + tip)];
    return { r, sw, cy, L, R, T, a };
}
const loopPath = (g) => `M${g.L[0]} ${g.L[1]}A${g.r} ${g.r} 0 1 0 ${g.R[0]} ${g.R[1]}L${g.T[0]} ${g.T[1]}Z`;
const arcPath = (g) => `M${g.L[0]} ${g.L[1]}A${g.r} ${g.r} 0 1 0 ${g.R[0]} ${g.R[1]}`;
const veePath = (g, inset = 0) => {
    const k = inset / g.r;
    const L = [f(g.L[0] + (50 - g.L[0]) * k), f(g.L[1] + (g.cy - g.L[1]) * k)];
    const R = [f(g.R[0] - (g.R[0] - 50) * k), f(g.R[1] + (g.cy - g.R[1]) * k)];
    return `M${L[0]} ${L[1]}L${g.T[0]} ${g.T[1]}L${R[0]} ${R[1]}`;
};
/** A rounded square through the same opening (superellipse, n = 4), as points. */
function squirclePath(g) {
    const pts = [];
    const n = 4, steps = 90;
    const start = -90 + (g.open || 33), end = 270 - (g.open || 33);
    for (let i = 0; i <= steps; i++) {
        const t = rad(start + ((end - start) * i) / steps);
        const c = Math.cos(t), s = Math.sin(t);
        const x = 50 + g.r * Math.sign(c) * Math.abs(c) ** (2 / n);
        const y = g.cy + g.r * Math.sign(s) * Math.abs(s) ** (2 / n);
        pts.push(`${f(x)} ${f(y)}`);
    }
    // From the right end of the opening, down to the tip and back up to the left end.
    return `M${pts[pts.length - 1]}L${g.T[0]} ${g.T[1]}L${pts[0]}${pts.map((p) => `L${p}`).join('')}`;
}

const LOOPS = [
    { id: 'today', name: 'Today', line: 'the Loop as the sites drew it: dot above the opening', g: { r: 31, sw: 12, open: 33, tip: 2, dot: 'above' } },
    { id: 'refined', name: 'Refined', line: 'a heavier stroke, the V dipping to the middle', g: { r: 32, sw: 15, open: 30, tip: 0 } },
    { id: 'dot', name: 'Refined, dot', line: 'the site\'s dot riding in the opening', g: { r: 32, sw: 15, open: 30, tip: 0, dot: 'in' } },
    { id: 'bold', name: 'Bold', line: 'the strongest at 16 px: thick, a shorter V', g: { r: 30, sw: 19, open: 30, tip: -6 } },
    { id: 'wide', name: 'Wide open', line: 'a generous opening, a shallow V', g: { r: 32, sw: 14, open: 45, tip: 4 } },
    { id: 'narrow', name: 'Narrow', line: 'a tight opening, the V almost a notch', g: { r: 32, sw: 14, open: 22, tip: 0 } },
    { id: 'deep', name: 'Deep V', line: 'the V reaching most of the way down', g: { r: 32, sw: 13, open: 32, tip: 17 } },
    { id: 'apart', name: 'Apart', line: 'the ring and the V drawn as two strokes with the ground between', g: { r: 32, sw: 12, open: 34, tip: 4 }, apart: true },
    { id: 'coin', name: 'Coin', line: 'a solid disc with the V cut through it', g: { r: 33, sw: 12, open: 33, tip: 4 }, coin: true },
    { id: 'square', name: 'Rounded square', line: 'the Loop as an app tile shape', g: { r: 32, sw: 13, open: 30, tip: 2 }, square: true },
];

function loopArt(v, tone, id) {
    const g = { ...loopGeo(v.g), open: v.g.open };
    const p = paint(tone, id);
    const body = [];
    const stroke = (d, color, w = g.sw, extra = '') => `<path class="mx-s" d="${d}" pathLength="100" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
    const sweep = tone === 'rev' ? p.sweep : p.a;
    let defs = p.defs;
    if (v.coin) {
        defs += `<mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="#fff"/><path d="${veePath(g)}" fill="none" stroke="#000" stroke-width="${g.sw}" stroke-linecap="round" stroke-linejoin="round"/></mask>`;
        body.push(`<circle class="mx-f" cx="50" cy="${g.cy}" r="${f(g.r + g.sw / 2)}" fill="${sweep}" mask="url(#${id}m)"/>`);
    } else if (v.apart) {
        defs += `<mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="#fff"/><path d="${veePath(g, 6)}" fill="none" stroke="#000" stroke-width="${g.sw + 7}" stroke-linecap="round" stroke-linejoin="round"/></mask>`;
        body.push(`<g mask="url(#${id}m)">${stroke(arcPath(g), p.a)}</g>`, stroke(veePath(g, 6), tone === 'grad' || tone === 'ink' ? p.b : p.b));
    } else if (v.square) {
        body.push(stroke(squirclePath(g), sweep));
    } else if (tone === 'depth' || tone === 'flat') {
        // Two colours: the ring in one, the V in the other, the ground between them where the V meets the ring.
        defs += `<mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><rect width="100" height="100" fill="#fff"/><path d="${veePath(g)}" fill="none" stroke="#000" stroke-width="${g.sw + 5}" stroke-linecap="round" stroke-linejoin="round"/></mask>`;
        body.push(`<g mask="url(#${id}m)">${stroke(arcPath(g), p.a)}</g>`, stroke(veePath(g), p.b));
    } else {
        body.push(stroke(loopPath(g), sweep));
    }
    if (v.g.dot === 'above') body.push(`<circle class="mx-f" cx="50" cy="${f(g.L[1] - 6)}" r="4.6" fill="${tone === 'ink' ? 'currentColor' : INK}"/>`);
    if (v.g.dot === 'in') body.push(`<circle class="mx-f" cx="50" cy="${f(g.L[1] - 3)}" r="4.8" fill="${tone === 'ink' ? 'currentColor' : VIOLET}"/>`);
    return { defs, body: body.join('') };
}

// ── The Pair ─────────────────────────────────────────────────────────────────────────────────────────────────────
// openvibe-shared/mark.js's pair(): ring radius r and stroke sw, the V's stroke vsw; the V's left cap a, tip t and
// right cap b as multiples of the ring's outer radius from its centre; the whole centred on (50, 50).
function pairGeo({ r = 20, sw = 13, vsw = 13, a = 0.86, t = 1.5, b = 2.16, halo = 7 }) {
    const R = r + sw / 2, right = b * R + vsw / 2, cx = 50 - (right - R) / 2, cy = 50;
    return {
        r, sw, vsw, R, cx: f(cx), cy, halo,
        A: [f(cx + a * R), f(cy - R + vsw / 2)], T: [f(cx + t * R), f(cy + R - vsw / 2)], B: [f(cx + b * R), f(cy - R + vsw / 2)],
    };
}
const ring = (g) => `M${g.cx} ${f(g.cy - g.r)}A${g.r} ${g.r} 0 1 1 ${g.cx} ${f(g.cy + g.r)}A${g.r} ${g.r} 0 1 1 ${g.cx} ${f(g.cy - g.r)}`;
const vee = (g) => `M${g.A[0]} ${g.A[1]}L${g.T[0]} ${g.T[1]}L${g.B[0]} ${g.B[1]}`;
function squircleRing(g) {
    const pts = [];
    for (let i = 0; i <= 96; i++) {
        const t = rad(-90 + (360 * i) / 96), c = Math.cos(t), s = Math.sin(t);
        pts.push(`${f(g.cx + g.r * Math.sign(c) * Math.abs(c) ** 0.5)} ${f(g.cy + g.r * Math.sign(s) * Math.abs(s) ** 0.5)}`);
    }
    return `M${pts.join('L')}Z`;
}

const PAIRS = [
    { id: 'pair', name: 'Pair', line: 'the mark today: ring 20 + 13, the V 13', g: {} },
    { id: 'heavy', name: 'Heavy', line: 'the favicon form: thick strokes that hold at 16 px', g: { r: 18, sw: 18, vsw: 17 } },
    { id: 'light', name: 'Light', line: 'a thinner line, more air inside the O', g: { r: 21, sw: 9, vsw: 9 } },
    { id: 'gap', name: 'Wide gap', line: 'more ground around the V where it crosses', g: { halo: 13 } },
    { id: 'touch', name: 'No gap', line: 'the V laid straight over the ring', g: { halo: 0 } },
    { id: 'deep', name: 'Deep overlap', line: 'the V crossing further into the O', g: { a: 0.6, t: 1.3, b: 2.0 } },
    { id: 'apart', name: 'Side by side', line: 'the V beside the O, just touching', g: { a: 1.12, t: 1.72, b: 2.32, halo: 6 } },
    { id: 'behind', name: 'V behind', line: 'the O in front; the gap cut around the ring instead', g: {}, behind: true },
    { id: 'outline', name: 'Outline', line: 'drawn as contours, hollow strokes', g: { r: 20, sw: 13, vsw: 13 }, outline: true },
    { id: 'squircle', name: 'Squircle O', line: 'the O as a rounded square, like an app tile', g: {}, square: true },
];

function pairArt(v, tone, id) {
    const g = pairGeo(v.g);
    const p = paint(tone, id);
    const O = v.square ? squircleRing(g) : ring(g);
    const S = (d, color, w, extra = '') => `<path class="mx-s" d="${d}" pathLength="100" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
    const oPaint = tone === 'rev' ? VIOLET : p.a, vPaint = tone === 'rev' ? BLUE : p.b;
    let defs = p.defs;
    const body = [];
    if (v.outline) {
        // Contours: a wide stroke in colour, the same path again narrower in the ground's colour.
        defs += `<mask id="${id}m" maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120"><rect x="-10" y="-10" width="120" height="120" fill="#fff"/><path d="${vee(g)}" fill="none" stroke="#000" stroke-width="${g.vsw + g.halo}" stroke-linecap="round" stroke-linejoin="round"/><path d="${O}" fill="none" stroke="#000" stroke-width="${g.sw - 6}"/></mask>`;
        defs += `<mask id="${id}n" maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120"><rect x="-10" y="-10" width="120" height="120" fill="#fff"/><path d="${vee(g)}" fill="none" stroke="#000" stroke-width="${g.vsw - 6}" stroke-linecap="round" stroke-linejoin="round"/></mask>`;
        body.push(`<g mask="url(#${id}m)">${S(O, oPaint, g.sw)}</g>`, `<g mask="url(#${id}n)">${S(vee(g), vPaint, g.vsw)}</g>`);
        return { defs, body: body.join('') };
    }
    if (g.halo > 0) {
        const cut = v.behind ? O : vee(g);
        const w = v.behind ? g.sw + g.halo : g.vsw + g.halo;
        defs += `<mask id="${id}m" maskUnits="userSpaceOnUse" x="-10" y="-10" width="120" height="120"><rect x="-10" y="-10" width="120" height="120" fill="#fff"/><path d="${cut}" fill="none" stroke="#000" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/></mask>`;
    }
    if (v.behind) {
        body.push(`<g${g.halo > 0 ? ` mask="url(#${id}m)"` : ''}>${S(vee(g), vPaint, g.vsw)}</g>`, S(O, oPaint, g.sw));
    } else {
        body.push(`<g${g.halo > 0 ? ` mask="url(#${id}m)"` : ''}>${S(O, oPaint, g.sw)}</g>`, S(vee(g), vPaint, g.vsw));
    }
    return { defs, body: body.join('') };
}

// ── Cards ────────────────────────────────────────────────────────────────────────────────────────────────────────
let seq = 0;
const svg = (art, size, label) => `<svg viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${esc(label)}">${art.defs ? `<defs>${art.defs}</defs>` : ''}${art.body}</svg>`;
function card(code, family, v, tone) {
    const draw = (sz) => { const id = `m${++seq}`; return svg(family === 'L' ? loopArt(v, tone.id, id) : pairArt(v, tone.id, id), sz, `${code} ${v.name}, ${tone.name}`); };
    return `<li class="mx-card" id="${code}" data-code="${code}">
<div class="mx-stage">${draw(132)}</div>
<div class="mx-sizes" aria-label="At small sizes"><span class="mx-dark">${draw(16)}${draw(32)}</span><span class="mx-light">${draw(16)}${draw(32)}</span></div>
<p class="mx-name"><b>${code}</b> ${esc(v.name)} <small>${esc(tone.name)}</small></p>
<p class="mx-line">${esc(v.line)}; ${esc(tone.line)}.</p>
<button type="button" class="mx-pick" data-pick="${code}" aria-pressed="false">Pick ${code}</button>
</li>`;
}
function family(letter, list) {
    let n = 0;
    return list.map((v) => `<section class="mx-row" aria-labelledby="mx-${letter}-${v.id}"><h3 id="mx-${letter}-${v.id}">${esc(v.name)} <small>${esc(v.line)}</small></h3>
<ul class="mx-grid">${TONES.map((t) => card(`${letter}${String(++n).padStart(2, '0')}`, letter, v, t)).join('')}</ul></section>`).join('');
}

function explorePage() {
    seq = 0;
    const body = `<div class="mx-wrap">
<header class="mx-hero">
<p class="mx-eye">The OpenVibe mark · for feedback</p>
<h1>A hundred marks. Which ones feel like OpenVibe?</h1>
<p class="mx-lede">Fifty takes on the <b>Loop</b> (the V folded into an open ring) and fifty on the <b>Pair</b> (a ring O and a round V). Each is shown large, then at 16 and 32 pixels on dark and on light, because a logo lives small. Pick the ones you like and send the numbers, or the link: it opens this page with your picks marked.</p>
<nav class="mx-jump" aria-label="Jump to"><a href="#loop">The Loop · L01–L50</a><a href="#pair">The Pair · P01–P50</a></nav>
</header>
<section class="mx-fam" id="loop" aria-labelledby="mx-loop-h"><h2 id="mx-loop-h">The Loop <small>L01–L50 · ten shapes, five colourings each</small></h2>${family('L', LOOPS)}</section>
<section class="mx-fam" id="pair" aria-labelledby="mx-pair-h"><h2 id="mx-pair-h">The Pair <small>P01–P50 · ten shapes, five colourings each</small></h2>${family('P', PAIRS)}</section>
<p class="mx-fine">Every mark here is centred on its own middle, level, and drawn from the same geometry as the mark the sites use (openvibe-shared/mark). None of these replaces it until it is chosen: <a href="/brand">the mark today</a>.</p>
</div>
<div class="mx-bar" data-mx-bar hidden><span>Your picks: <b data-mx-picks></b></span><button type="button" class="mx-btn" data-mx-copy>Copy</button><button type="button" class="mx-btn" data-mx-link>Copy link</button><button type="button" class="mx-btn mx-btn-quiet" data-mx-clear>Clear</button></div>`;
    return layout({
        title: 'A hundred OpenVibe marks',
        description: 'Fifty takes on the Loop and fifty on the Pair, the two OpenVibe marks, at every size: pick the ones that feel like OpenVibe.',
        path: '/brand/explore',
        active: '/brand',
        robots: 'noindex, follow',
        styles: ['css/marks.css'],
        scripts: ['js/marks.js'],
        body,
    });
}

module.exports = { explorePage, LOOPS, PAIRS, TONES, loopArt, pairArt };
