'use strict';
/**
 * How exact a glyph's geometry is (2026-11-16; the owner, on the settings gear: "looks completely scuffed and weird …
 * the icon generation system even more improved … regenerate icons that look fucked up like this, even if it's slight").
 *
 * A glyph that is meant to be regular and is not looks wrong at once, even when the error is a tenth of a unit: a gear
 * whose teeth differ, a heart whose sides do not match, a ring 0.3 off the middle. This module measures that and fixes
 * what it can.
 *
 *   check(markup, { expect })  → { scores, centre, offset, flags }
 *       The drawing is rasterised at 240 px (strokes 2 units, round, as the set draws). For each symmetry (mirror ↔,
 *       mirror ↕, a half turn, a quarter turn, 5- to 12-fold turns) the score is the share of ink that lands within one
 *       pixel (0.1 unit) of ink when the drawing is mapped onto itself, both ways, about the best axis or centre near
 *       the ink's own. An exact drawing scores 1.000. `flags` names each symmetry the drawing is meant to have and
 *       misses: one in `expect`, mirror ↔ when it scores 0.9 or more (most icons are drawn mirror-exact), any other
 *       at 0.95 or more. An ink centre more than 0.6 unit off (12, 12) is flagged too.
 *   snapMirror(markup)         → { svg, moved }
 *       Points that nearly mirror each other about x = 12 (within 0.35) are made to mirror exactly, and a point within
 *       0.15 of the middle goes onto it: the heart whose right side bulged 0.1 further than its left comes back even.
 *   absolute(d) / serialise(segments)   path data with every command absolute (the snap works on points).
 */
const SIZE = 240;
const KINDS = ['mirror ↔', 'mirror ↕', 'half turn', 'quarter turn', '5-fold', '6-fold', '7-fold', '8-fold', '9-fold', '10-fold', '12-fold'];
const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
const round = (n) => { const v = Math.round(n * 100) / 100; return Object.is(v, -0) ? 0 : v; };

let Resvg = null;
function renderer() {
    if (!Resvg) Resvg = require('@resvg/resvg-js').Resvg;
    return Resvg;
}

function maskOf(markup) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${SIZE}" height="${SIZE}" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${markup}</svg>`;
    const px = new (renderer())(svg, { fitTo: { mode: 'width', value: SIZE } }).render().pixels;
    const m = new Uint8Array(SIZE * SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) m[i] = px[i * 4 + 3] > 127 ? 1 : 0;
    return m;
}
function dilate(m) {
    const d = new Uint8Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        if (!m[y * SIZE + x]) continue;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
            const u = x + i, v = y + j;
            if (u >= 0 && v >= 0 && u < SIZE && v < SIZE) d[v * SIZE + u] = 1;
        }
    }
    return d;
}
const rotate = (deg, cx, cy) => { const r = (deg * Math.PI) / 180, co = Math.cos(r), si = Math.sin(r); return (x, y) => [cx + (x - cx) * co - (y - cy) * si, cy + (x - cx) * si + (y - cy) * co]; };
const turnOf = (k) => (k === 'half turn' ? 180 : k === 'quarter turn' ? 90 : 360 / Number(k.split('-')[0]));
function maps(k, cx, cy) {
    if (k === 'mirror ↔') { const f = (x, y) => [2 * cx - x, y]; return [f, f]; }
    if (k === 'mirror ↕') { const f = (x, y) => [x, 2 * cy - y]; return [f, f]; }
    return [rotate(turnOf(k), cx, cy), rotate(-turnOf(k), cx, cy)];
}
function share(ink, d, f) {
    let n = 0;
    for (let i = 0; i < ink.length; i += 2) {
        const [u, v] = f(ink[i], ink[i + 1]); const x = Math.floor(u), y = Math.floor(v);
        if (x >= 0 && y >= 0 && x < SIZE && y < SIZE && d[y * SIZE + x]) n++;
    }
    return ink.length ? n / (ink.length / 2) : 0;
}
function bestScore(ink, d, k, c) {
    let top = 0, at = c;
    // The wide searches look at every fourth ink pixel; the last one at all of it.
    const sparse = ink.filter((_, i) => (i >> 1) % 4 === 0);
    const search = (x0, y0, span, step, pts) => {
        top = 0;
        const from = at;
        for (let dx = -span; dx <= span + 1e-9; dx += step) for (let dy = -span; dy <= span + 1e-9; dy += step) {
            if ((k === 'mirror ↔' && dy) || (k === 'mirror ↕' && dx)) continue;
            const [f, g] = maps(k, x0 + dx, y0 + dy);
            const s = Math.min(share(pts, d, f), share(pts, d, g));
            if (s > top) { top = s; at = [x0 + dx, y0 + dy]; }
        }
        if (!top) at = from;
    };
    // A turn's centre is the shape's own (a five-point star's sits about a unit below its box's middle): look 1.4 units
    // around the box's centre, then closer.
    search(c[0], c[1], 14, 2, sparse);
    search(at[0], at[1], 2, 0.5, sparse);
    search(at[0], at[1], 0.5, 0.25, ink);
    return top;
}

/** The symmetry scores of a drawing, its ink centre, and what it was meant to keep and did not. */
function check(markup, { expect = [] } = {}) {
    const m = maskOf(markup);
    const ink = [];
    let x0 = SIZE, x1 = -1, y0 = SIZE, y1 = -1;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        if (!m[y * SIZE + x]) continue;
        ink.push(x + 0.5, y + 0.5);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    if (!ink.length) return { scores: {}, centre: null, offset: null, flags: ['no ink'] };
    const c = [(x0 + x1 + 1) / 2, (y0 + y1 + 1) / 2];
    const d = dilate(m);
    const scores = {};
    for (const k of KINDS) scores[k] = Math.round(bestScore(ink, d, k, c) * 1000) / 1000;
    const centre = { x: round(c[0] / 10), y: round(c[1] / 10) };
    const size = { w: round((x1 - x0 + 1) / 10), h: round((y1 - y0 + 1) / 10) };
    const offset = round(Math.hypot(centre.x - 12, centre.y - 12));
    const flags = [];
    for (const k of KINDS) {
        const s = scores[k];
        const meant = expect.includes(k) || (k === 'mirror ↔' && s >= 0.9) || s >= 0.95;
        if (meant && s < 0.995) flags.push(`${k} ${s.toFixed(3)}`);
    }
    if (expect.includes('n-fold')) {
        const best = Math.max(...KINDS.filter((x) => /-fold$/.test(x)).map((x) => scores[x]));
        if (best < 0.995) flags.push(`n-fold ${best.toFixed(3)}`);
        // A meant turn that is exact leaves the other turns' near-misses alone (a 6-tooth gear is not 12-fold).
        else for (let i = flags.length - 1; i >= 0; i--) if (/^(\d+-fold|half turn|quarter turn) /.test(flags[i])) flags.splice(i, 1);
    }
    if (offset > 0.6) flags.push(`centre ${offset} off (12, 12)`);
    return { scores, centre, offset, size, flags };
}

// ── Path data, absolute ─────────────────────────────────────────────
function absolute(d) {
    const tokens = String(d).match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) || [];
    const out = [];
    let i = 0, cmd = null, x = 0, y = 0, sx = 0, sy = 0;
    while (i < tokens.length) {
        if (/^[a-z]$/i.test(tokens[i])) { cmd = tokens[i++]; if (cmd.toUpperCase() === 'Z') { out.push({ c: 'Z', a: [] }); x = sx; y = sy; cmd = null; continue; } }
        if (!cmd) throw new Error('path data without a command');
        const u = cmd.toUpperCase(), rel = cmd !== u, n = ARGS[u];
        const a = tokens.slice(i, i + n).map(Number); i += n;
        if (a.length !== n || a.some((v) => !Number.isFinite(v))) throw new Error('path data with a missing number');
        if (u === 'H') { x = rel ? x + a[0] : a[0]; out.push({ c: 'L', a: [x, y] }); }
        else if (u === 'V') { y = rel ? y + a[0] : a[0]; out.push({ c: 'L', a: [x, y] }); }
        else if (u === 'A') { const ex = rel ? x + a[5] : a[5], ey = rel ? y + a[6] : a[6]; out.push({ c: 'A', a: [a[0], a[1], a[2], a[3], a[4], ex, ey] }); x = ex; y = ey; }
        else {
            const pts = [];
            for (let j = 0; j < n; j += 2) pts.push(rel ? x + a[j] : a[j], rel ? y + a[j + 1] : a[j + 1]);
            out.push({ c: u, a: pts });
            x = pts[pts.length - 2]; y = pts[pts.length - 1];
            if (u === 'M') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
        }
    }
    return out;
}
function serialise(segs) {
    return segs.map((s) => s.c + s.a.map((v, j) => (s.c === 'A' && j >= 2 && j <= 4 ? String(v) : String(round(v)))).join(' ')).join('');
}

/**
 * Snap a drawing's near-mirror points about x = 12. Points (endpoints and control points of every path, the centres of
 * circles and ellipses, line ends) that mirror each other within 0.35 unit are made to mirror exactly; a point within
 * 0.15 of x = 12 goes onto it. Radii that are paired keep their own value. → { svg, moved }
 */
function snapMirror(markup) {
    const shapes = [];
    const pts = [];   // { get, set } over every point
    const src = String(markup);
    const re = /<(path|circle|ellipse|line)\b([^>]*)\/>/g;
    let m;
    while ((m = re.exec(src))) {
        const tag = m[1];
        const attrs = Object.fromEntries([...m[2].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
        const shape = { start: m.index, end: m.index + m[0].length, tag, attrs, raw: m[2] };
        if (tag === 'path') {
            let segs; try { segs = absolute(attrs.d); } catch { continue; }
            shape.segs = segs;
            for (const s of segs) {
                if (s.c === 'A') pts.push({ get: () => [s.a[5], s.a[6]], set: (x, y) => { s.a[5] = x; s.a[6] = y; } });
                else for (let j = 0; j < s.a.length; j += 2) pts.push({ get: () => [s.a[j], s.a[j + 1]], set: (x, y) => { s.a[j] = x; s.a[j + 1] = y; } });
            }
        } else if (tag === 'circle' || tag === 'ellipse') {
            pts.push({ get: () => [+attrs.cx, +attrs.cy], set: (x, y) => { attrs.cx = String(round(x)); attrs.cy = String(round(y)); } });
        } else if (tag === 'line') {
            pts.push({ get: () => [+attrs.x1, +attrs.y1], set: (x, y) => { attrs.x1 = String(round(x)); attrs.y1 = String(round(y)); } });
            pts.push({ get: () => [+attrs.x2, +attrs.y2], set: (x, y) => { attrs.x2 = String(round(x)); attrs.y2 = String(round(y)); } });
        }
        shapes.push(shape);
    }
    let moved = 0;
    const used = new Set();
    pts.forEach((p, i) => {
        if (used.has(i)) return;
        const [x, y] = p.get();
        if (Math.abs(x - 12) <= 0.15) { if (x !== 12) { p.set(12, y); moved++; } used.add(i); return; }
        let best = -1, err = Infinity;
        pts.forEach((q, j) => {
            if (j === i || used.has(j)) return;
            const [u, v] = q.get();
            const e = Math.abs(x + u - 24) + Math.abs(y - v);
            if ((x - 12) * (u - 12) < 0 && Math.abs(x + u - 24) <= 0.35 && Math.abs(y - v) <= 0.35 && e < err) { err = e; best = j; }
        });
        if (best < 0) return;
        const q = pts[best]; const [u, v] = q.get();
        if (err > 0) {
            const half = (Math.abs(x - 12) + Math.abs(u - 12)) / 2, my = (y + v) / 2;
            p.set(x < 12 ? 12 - half : 12 + half, my); q.set(u < 12 ? 12 - half : 12 + half, my); moved++;
        }
        used.add(i); used.add(best);
    });
    if (!moved) return { svg: src, moved: 0 };
    let out = '', last = 0;
    for (const s of shapes) {
        out += src.slice(last, s.start);
        const attrs = s.tag === 'path' ? { ...s.attrs, d: serialise(s.segs) } : s.attrs;
        out += `<${s.tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`;
        last = s.end;
    }
    out += src.slice(last);
    return { svg: out, moved };
}

// Shapes that are regular by meaning: a draft or a glyph with one of these names must keep these symmetries exactly.
const EXPECTED = {
    // 'n-fold': some turn of 5 to 12 parts is exact (a gear has as many as it has teeth).
    gear: ['n-fold'], cog: ['n-fold'], settings: ['n-fold'], sun: ['n-fold'], star: ['mirror ↔', 'n-fold'], snowflake: ['6-fold'], hexagon: ['6-fold'],
    plus: ['quarter turn'], close: ['quarter turn'], 'x-circle': ['quarter turn'], 'plus-circle': ['quarter turn'],
    heart: ['mirror ↔'], shield: ['mirror ↔'], bell: ['mirror ↔'], lock: ['mirror ↔'], home: ['mirror ↔'],
    user: ['mirror ↔'], trophy: ['mirror ↔'], crown: ['mirror ↔'], gem: ['mirror ↔'], skull: ['mirror ↔'],
};
const expectFor = (name) => EXPECTED[String(name || '').toLowerCase()] || [];
/** A report's score for an expected symmetry; 'n-fold' is the best of the 5- to 12-fold turns. */
const scoreOf = (report, k) => (k === 'n-fold' ? Math.max(...KINDS.filter((x) => /-fold$/.test(x)).map((x) => report.scores[x] || 0)) : report.scores[k]);

/** A draft's quality for ordering: fewer flags first, then the meant symmetries' scores. */
function rank(report) {
    if (!report || !report.scores) return -1;
    return -10 * (report.flags || []).length + Math.max(report.scores['mirror ↔'] || 0, report.scores['quarter turn'] || 0) - (report.offset || 0) / 10;
}

module.exports = { check, snapMirror, absolute, serialise, KINDS, EXPECTED, expectFor, scoreOf, rank };
