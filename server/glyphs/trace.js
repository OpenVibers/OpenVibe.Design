'use strict';
/**
 * A picture traced to a filled drawing (2026-11-16, the "Picture, then trace" way to draw an icon): an image model
 * paints the icon, and this turns its ink into the solid twin's shapes on the 24-unit grid.
 *
 *   decodePng(buffer)              → { width, height, rgba }   8-bit greyscale, RGB, palette, grey+alpha or RGBA,
 *                                   not interlaced (what image models answer with)
 *   trace(rgba, width, height)    → { ok: true, svg } with one <path fill-rule="evenodd"> | { ok: false, why }
 *   tracePng(buffer)              → the two together
 *
 * The picture is read at 96 × 96 (each cell the average of its pixels), its ink is what differs from the background
 * (read from the corners, so light ink on a dark picture works too), the outlines are found by marching squares at
 * half ink, simplified (Ramer–Douglas–Peucker, a third of a cell), and specks smaller than four cells are dropped.
 */
const zlib = require('zlib');

const GRID = 96;

function decodePng(buf) {
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    if (b.length < 33 || b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a) throw new Error('not a PNG');
    let at = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0, palette = null, trns = null;
    const idat = [];
    while (at + 8 <= b.length) {
        const len = b.readUInt32BE(at), kind = b.toString('ascii', at + 4, at + 8), data = b.subarray(at + 8, at + 8 + len);
        if (kind === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12]; }
        else if (kind === 'PLTE') palette = data;
        else if (kind === 'tRNS') trns = data;
        else if (kind === 'IDAT') idat.push(data);
        else if (kind === 'IEND') break;
        at += 12 + len;
    }
    if (!width || !height || width > 4096 || height > 4096) throw new Error('the picture is not a usable size');
    if (depth !== 8 || interlace !== 0) throw new Error('only 8-bit, non-interlaced pictures are read');
    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
    if (!channels) throw new Error('an unknown PNG colour type');
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = width * channels;
    const px = Buffer.alloc(stride * height);
    for (let y = 0; y < height; y++) {
        const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
        const out = px.subarray(y * stride, (y + 1) * stride), up = y ? px.subarray((y - 1) * stride, y * stride) : null;
        for (let i = 0; i < stride; i++) {
            const a = i >= channels ? out[i - channels] : 0, u = up ? up[i] : 0, c = up && i >= channels ? up[i - channels] : 0;
            let v = line[i];
            if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1;
            else if (f === 4) { const p = a + u - c, pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
            out[i] = v & 255;
        }
    }
    const rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        let r, g, bl, al = 255;
        if (type === 0) { r = g = bl = px[i]; }
        else if (type === 2) { r = px[i * 3]; g = px[i * 3 + 1]; bl = px[i * 3 + 2]; }
        else if (type === 3) { const k = px[i]; r = palette ? palette[k * 3] : 0; g = palette ? palette[k * 3 + 1] : 0; bl = palette ? palette[k * 3 + 2] : 0; if (trns && k < trns.length) al = trns[k]; }
        else if (type === 4) { r = g = bl = px[i * 2]; al = px[i * 2 + 1]; }
        else { r = px[i * 4]; g = px[i * 4 + 1]; bl = px[i * 4 + 2]; al = px[i * 4 + 3]; }
        rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = bl; rgba[i * 4 + 3] = al;
    }
    return { width, height, rgba };
}

/** The ink of each cell (0 to 1): how far its average differs from the background's, the corners' colour. */
function inkGrid(rgba, width, height) {
    const lum = (i) => { const a = rgba[i * 4 + 3] / 255; return a * (0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2]) / 255 + (1 - a); };
    const corners = [0, width - 1, (height - 1) * width, height * width - 1].map(lum);
    const bg = corners.reduce((s, v) => s + v, 0) / 4;
    const g = new Float32Array(GRID * GRID);
    for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
        const x0 = Math.floor((gx * width) / GRID), x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * width) / GRID));
        const y0 = Math.floor((gy * height) / GRID), y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * height) / GRID));
        let s = 0, n = 0;
        for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { s += Math.abs(lum(y * width + x) - bg); n++; }
        g[gy * GRID + gx] = n ? Math.min(1, s / n / 0.6) : 0;
    }
    return g;
}

/** Marching squares at half ink → closed loops of points in cell units (the grid padded with empty cells). */
function contours(g) {
    const N = GRID + 2;
    const v = (x, y) => (x <= 0 || y <= 0 || x >= N - 1 || y >= N - 1 ? 0 : g[(y - 1) * GRID + (x - 1)]);
    const lerp = (a, b) => (0.5 - a) / ((b - a) || 1e-9);
    // Each contour point joins exactly two edges: link them undirected, then walk each loop.
    const adj = new Map();
    const key = (p) => `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)}`;
    const pts = new Map();
    const add = (a, b) => {
        const ka = key(a), kb = key(b); if (ka === kb) return;
        pts.set(ka, a); pts.set(kb, b);
        if (!adj.has(ka)) adj.set(ka, []); if (!adj.has(kb)) adj.set(kb, []);
        adj.get(ka).push(kb); adj.get(kb).push(ka);
    };
    for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) {
        const tl = v(x, y), tr = v(x + 1, y), br = v(x + 1, y + 1), bl = v(x, y + 1);
        const c = (tl >= 0.5 ? 8 : 0) | (tr >= 0.5 ? 4 : 0) | (br >= 0.5 ? 2 : 0) | (bl >= 0.5 ? 1 : 0);
        if (c === 0 || c === 15) continue;
        const top = [x + lerp(tl, tr), y], right = [x + 1, y + lerp(tr, br)], bottom = [x + lerp(bl, br), y + 1], left = [x, y + lerp(tl, bl)];
        const E = { 1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[right, top]], 5: [[left, top], [right, bottom]], 6: [[bottom, top]], 7: [[left, top]],
            8: [[top, left]], 9: [[top, bottom]], 10: [[top, right], [bottom, left]], 11: [[top, right]], 12: [[right, left]], 13: [[right, bottom]], 14: [[bottom, left]] }[c];
        for (const [a, b] of E) add(a, b);
    }
    const loops = [];
    const used = new Set();
    for (const [start] of adj) {
        if (used.has(start)) continue;
        const loop = [];
        let prev = null, k = start;
        for (let guard = 0; guard < 200000 && k && !used.has(k); guard++) {
            used.add(k); loop.push(pts.get(k).map((n) => n - 1));
            const next = (adj.get(k) || []).find((n) => n !== prev && !used.has(n));
            prev = k; k = next;
        }
        if (loop.length >= 3) loops.push(loop);
    }
    return loops;
}

function simplify(points, eps) {
    if (points.length < 4) return points;
    const dist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-9; return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / L; };
    const rdp = (pts) => {
        let max = 0, at = 0;
        for (let i = 1; i < pts.length - 1; i++) { const d = dist(pts[i], pts[0], pts[pts.length - 1]); if (d > max) { max = d; at = i; } }
        return max > eps ? rdp(pts.slice(0, at + 1)).slice(0, -1).concat(rdp(pts.slice(at))) : [pts[0], pts[pts.length - 1]];
    };
    // A closed loop: split it at the point farthest from its start, and simplify the two halves.
    let far = 0, best = -1;
    points.forEach((q, i) => { const d = Math.hypot(q[0] - points[0][0], q[1] - points[0][1]); if (d > best) { best = d; far = i; } });
    const first = rdp(points.slice(0, far + 1));
    const second = rdp(points.slice(far).concat([points[0]]));
    return first.slice(0, -1).concat(second.slice(0, -1));
}
const area = (pts) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

function trace(rgba, width, height) {
    const g = inkGrid(rgba, width, height);
    const inked = g.reduce((s, v) => s + (v >= 0.5 ? 1 : 0), 0);
    if (inked < 12) return { ok: false, why: 'the picture has no ink to trace' };
    if (inked > GRID * GRID * 0.7) return { ok: false, why: 'the picture is mostly ink: no icon to trace' };
    const loops = contours(g).map((l) => simplify(l, 0.33)).filter((l) => l.length >= 3 && area(l) >= 4).slice(0, 24);
    if (!loops.length) return { ok: false, why: 'nothing large enough to trace' };
    const k = 24 / GRID;
    const f = (n) => String(Math.round(n * k * 100) / 100);
    const d = loops.map((l) => `M${l.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}Z`).join('');
    return { ok: true, svg: `<path fill-rule="evenodd" d="${d}"/>`, loops: loops.length };
}

function tracePng(buffer) {
    const { width, height, rgba } = decodePng(buffer);
    return trace(rgba, width, height);
}

module.exports = { decodePng, trace, tracePng, GRID };
