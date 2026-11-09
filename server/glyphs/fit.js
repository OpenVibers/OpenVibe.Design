'use strict';

const COMMANDS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
const fmt = (n) => String(Math.round((n + 1e-8) * 100) / 100);
const nums = (s) => (String(s).match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) || []).map(Number);

function pathPoints(d) {
    const tokens = String(d).match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) || [];
    const points = []; let i = 0, cmd = null, x = 0, y = 0, sx = 0, sy = 0;
    const point = (a, b, rel) => { const px = rel ? x + a : a, py = rel ? y + b : b; points.push([px, py]); return [px, py]; };
    while (i < tokens.length) {
        if (/^[a-z]$/i.test(tokens[i])) { cmd = tokens[i++]; if (cmd.toUpperCase() === 'Z') { x = sx; y = sy; continue; } }
        if (!cmd) return null;
        const u = cmd.toUpperCase(), rel = cmd === cmd.toLowerCase(), n = COMMANDS[u];
        if (n == null || !n) continue;
        const a = tokens.slice(i, i + n).map(Number); if (a.length !== n || a.some((v) => !Number.isFinite(v))) return null; i += n;
        if (u === 'H') { x = rel ? x + a[0] : a[0]; points.push([x, y]); }
        else if (u === 'V') { y = rel ? y + a[0] : a[0]; points.push([x, y]); }
        else if (u === 'A') { points.push([x - a[0], y - a[1]], [x + a[0], y + a[1]]); [x, y] = point(a[5], a[6], rel); }
        else {
            const ox = x, oy = y;
            for (let j = 0; j < n; j += 2) {
                const p = [rel ? ox + a[j] : a[j], rel ? oy + a[j + 1] : a[j + 1]];
                points.push(p); if (u === 'M' && j === 0) [sx, sy] = p;
            }
            x = points[points.length - 1][0]; y = points[points.length - 1][1];
        }
        if (u === 'M') cmd = rel ? 'l' : 'L';
    }
    return points;
}

function measure(markup) {
    const pts = [];
    for (const m of String(markup).matchAll(/<(path|circle|ellipse|rect|line|polyline)\b([^>]*)\/>/g)) {
        const tag = m[1], a = Object.fromEntries([...m[2].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]));
        const add = (x, y) => { if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y]); };
        if (tag === 'path') pts.push(...(pathPoints(a.d) || []));
        else if (tag === 'circle') { const x = +a.cx, y = +a.cy, r = +a.r; add(x - r, y - r); add(x + r, y + r); }
        else if (tag === 'ellipse') { const x = +a.cx, y = +a.cy, rx = +a.rx, ry = +a.ry; add(x - rx, y - ry); add(x + rx, y + ry); }
        else if (tag === 'rect') { const x = +a.x, y = +a.y; add(x, y); add(x + +a.width, y + +a.height); }
        else if (tag === 'line') { add(+a.x1, +a.y1); add(+a.x2, +a.y2); }
        else if (tag === 'polyline') { const n = nums(a.points); for (let i = 0; i < n.length; i += 2) add(n[i], n[i + 1]); }
    }
    if (!pts.length) return null;
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, width: x1 - x0, height: y1 - y0 };
}

function fittedPath(d, t) {
    const tokens = String(d).match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) || [];
    let i = 0, cmd = null, out = '', first = true;
    const absolute = (v, c) => 12 + (v - c) * t.scale;
    while (i < tokens.length) {
        if (/^[a-z]$/i.test(tokens[i])) { cmd = tokens[i++]; out += cmd; if (cmd.toUpperCase() === 'Z') cmd = null; continue; }
        if (!cmd) throw new Error('missing path command');
        const u = cmd.toUpperCase(), rel = cmd === cmd.toLowerCase(), n = COMMANDS[u], a = tokens.slice(i, i + n).map(Number); i += n;
        if (u === 'H') a[0] = rel ? a[0] * t.scale : absolute(a[0], t.cx);
        else if (u === 'V') a[0] = rel ? a[0] * t.scale : absolute(a[0], t.cy);
        else if (u === 'A') { a[0] *= t.scale; a[1] *= t.scale; a[5] = rel ? (first ? absolute(a[5], t.cx) : a[5] * t.scale) : absolute(a[5], t.cx); a[6] = rel ? (first ? absolute(a[6], t.cy) : a[6] * t.scale) : absolute(a[6], t.cy); }
        else for (let j = 0; j < n; j += 2) {
            if (rel && first) { a[j] = absolute(a[j], t.cx); a[j + 1] = absolute(a[j + 1], t.cy); }
            else { a[j] = rel ? a[j] * t.scale : absolute(a[j], t.cx); a[j + 1] = rel ? a[j + 1] * t.scale : absolute(a[j + 1], t.cy); }
        }
        out += a.map(fmt).join(' '); first = false; if (u === 'M') cmd = rel ? 'l' : 'L'; if (i < tokens.length && !/^[a-z]$/i.test(tokens[i])) out += ' ';
    }
    return out;
}

function transform(markup, t) {
    return String(markup).replace(/<(path|circle|ellipse|rect|line|polyline)\b([^>]*)\/>/g, (_, tag, attrs) => `<${tag}${attrs.replace(/([\w-]+)="([^"]*)"/g, (_, k, v) => {
        let z = v;
        if (tag === 'path' && k === 'd') z = fittedPath(v, t);
        else if (tag === 'polyline' && k === 'points') z = nums(v).map((n, i) => fmt(12 + (n - (i % 2 ? t.cy : t.cx)) * t.scale)).join(' ');
        else if (['cx', 'x', 'x1', 'x2'].includes(k)) z = fmt(12 + (+v - t.cx) * t.scale);
        else if (['cy', 'y', 'y1', 'y2'].includes(k)) z = fmt(12 + (+v - t.cy) * t.scale);
        else if (['r', 'rx', 'ry', 'width', 'height'].includes(k)) z = fmt(+v * t.scale);
        return `${k}="${z}"`;
    })}/>`);
}

function fitDrawing(markup, transformSpec = null) {
    const before = measure(markup);
    if (!before || !Math.max(before.width, before.height)) return { ok: false, why: 'the drawing has no measurable ink' };
    const t = transformSpec || { cx: before.cx, cy: before.cy, scale: 19 / Math.max(before.width, before.height) };
    const svg = transform(markup, t), after = measure(svg);
    const long = after && Math.max(after.width, after.height);
    if (!after || Math.abs(after.cx - 12) > 0.75 || Math.abs(after.cy - 12) > 0.75 || long < 18 || long > 20) return { ok: false, why: 'the fitted drawing must be centred within 0.75 units and 18–20 units on its long side' };
    return { ok: true, svg, transform: t, metrics: after };
}

module.exports = { measure, fitDrawing };
