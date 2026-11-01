'use strict';
/**
 * The OpenVibe token set: a theme's colours, the kit's motion and the mark's two colours — one set, whatever the tool
 * that reads it. The same colours, the same durations and the same curves come out of the JSON, the CSS, the Tailwind
 * preset, the Style Dictionary source, the Swift, the Kotlin and the Android XML.
 *
 * The motion is the kit's (openvibe-shared/ov-fx.js): --ov-dur-1…4 and the three curves, the same on every theme.
 * The colours come from the theme and are read through openvibe-shared/tokens' parser, so a value it cannot read is
 * left out rather than carried into code someone will paste.
 *
 *   colours(theme)        the theme's colours: [{ path, css, value, description }]
 *   tokenDocument(theme)  the W3C Design Tokens document (DTCG): color, motion.duration, motion.easing, brand
 *   colourList(doc)       the colours of a document, with the CSS name each one answers to
 */
const tokens = require('openvibe-shared/tokens');

// The kit's motion — openvibe-shared/ov-fx.js: :root{--ov-dur-1:.12s;--ov-dur-2:.2s;--ov-dur-3:.32s;--ov-dur-4:.52s}
const MOTION = {
    durations: [
        { id: '1', name: 'duration1', ms: 120, css: '--ov-dur-1', description: 'A quick answer' },
        { id: '2', name: 'duration2', ms: 200, css: '--ov-dur-2', description: 'A change of state' },
        { id: '3', name: 'duration3', ms: 320, css: '--ov-dur-3', description: 'A lift or a glow' },
        { id: '4', name: 'duration4', ms: 520, css: '--ov-dur-4', description: 'The slow way back' },
    ],
    easings: [
        { id: 'out', name: 'easeOut', value: [0.2, 0.8, 0.2, 1], css: '--ov-ease-out', description: 'Leaves fast, settles slow' },
        { id: 'spring', name: 'easeSpring', value: [0.34, 1.56, 0.64, 1], css: '--ov-ease-spring', description: 'Overshoots, then comes back' },
        { id: 'in-out', name: 'easeInOut', value: [0.65, 0, 0.35, 1], css: '--ov-ease-in-out', description: 'Even on both sides' },
    ],
};

// The kit's shape (openvibe-shared 4.81.0, kit.css --ov-radius-1…3): three corner radii, set by the look's personality.
// The quiet looks are square, Neon Tokyo and Vapor round, every other look the kit's own corners.
const SQUARE = new Set(['paper', 'solarized-light', 'nord', 'nord-light', 'matrix', 'hacker', 'high-contrast']);
const ROUND = new Set(['neon-tokyo', 'vapor']);
const RADII = { default: [10, 14, 20], square: [4, 6, 10], round: [14, 20, 28] };
const RADIUS = [
    { id: '1', name: 'radius1', css: '--ov-radius-1', description: 'Small things: chips, inputs, rows' },
    { id: '2', name: 'radius2', css: '--ov-radius-2', description: 'Cards, sections, panels' },
    { id: '3', name: 'radius3', css: '--ov-radius-3', description: 'Sheets, dialogs, big surfaces' },
];
/** The look's shape: 'square', 'round' or 'default', by its id (the same lists as kit.css). */
const shapeOf = (theme) => { const id = String((theme || {}).slug || (theme || {}).id || ''); return SQUARE.has(id) ? 'square' : ROUND.has(id) ? 'round' : 'default'; };
/** The look's three corner radii: [{ id, name, css, px, description }]. */
const radii = (theme) => RADIUS.map((r, i) => ({ ...r, px: RADII[shapeOf(theme)][i] }));

// The mark's own two colours (openvibe-shared/ov-fx.js names them as the mark's O and V).
const BRAND = [
    { id: 'o', name: 'brandO', value: '#4f7cff', css: '--ov-brand-o', description: "The mark's O" },
    { id: 'v', name: 'brandV', value: '#8b5cf6', css: '--ov-brand-v', description: "The mark's V" },
];

const at = (obj, path) => {
    let o = obj;
    for (const p of String(path || '').split('.')) {
        if (!o || typeof o !== 'object') return null;
        o = o[p];
    }
    return o && typeof o === 'object' ? o : null;
};

const put = (obj, path, leaf) => {
    const parts = String(path).split('.');
    let o = obj;
    for (const p of parts.slice(0, -1)) o = o[p] || (o[p] = {});
    o[parts[parts.length - 1]] = leaf;
};

/** The theme's colours, read through the shared parser: an unreadable value is left out, never passed through. */
function colours(theme) {
    const doc = tokens.fromTheme(theme || {});
    const out = [];
    for (const [css, path, description] of tokens.COLOR_MAP) {
        const token = at(doc, path);
        if (!token || !token.$value) continue;
        out.push({ path, css, value: token.$value, description, type: 'color' });
    }
    return out;
}

/** The token document (DTCG): the groups a tool reads — color, motion.duration, motion.easing, brand. */
function tokenDocument(theme) {
    const t = theme || {};
    const mode = t.mode === 'light' ? 'light' : 'dark';
    const doc = {
        $description: String(t.description || t.name || 'An OpenVibe theme'),
        $extensions: {
            'network.openvibe': {
                name: String(t.name || 'Theme'),
                slug: String(t.slug || t.id || 'theme'),
                mode,
                generator: 'openvibe.design',
            },
        },
        color: {},
        motion: { duration: {}, easing: {} },
        shape: { radius: {} },
        brand: {},
    };
    for (const r of radii(t)) {
        doc.shape.radius[r.id] = {
            $type: 'dimension',
            $value: `${r.px}px`,
            $description: r.description,
            $extensions: { 'network.openvibe': { css: r.css, shape: shapeOf(t) } },
        };
    }
    for (const c of colours(t)) {
        put(doc.color, c.path.replace(/^color\./, ''), {
            $type: 'color',
            $value: c.value,
            $description: c.description,
            $extensions: { 'network.openvibe': { css: c.css } },
        });
    }
    for (const d of MOTION.durations) {
        doc.motion.duration[d.id] = {
            $type: 'duration',
            $value: `${d.ms}ms`,
            $description: d.description,
            $extensions: { 'network.openvibe': { css: d.css } },
        };
    }
    for (const e of MOTION.easings) {
        doc.motion.easing[e.id] = {
            $type: 'cubicBezier',
            $value: e.value.slice(),
            $description: e.description,
            $extensions: { 'network.openvibe': { css: e.css } },
        };
    }
    for (const b of BRAND) {
        doc.brand[b.id] = {
            $type: 'color',
            $value: b.value,
            $description: b.description,
            $extensions: { 'network.openvibe': { css: b.css } },
        };
    }
    return doc;
}

/** The colours of a document, with the CSS name each one answers to. */
function colourList(doc) {
    const out = [];
    const walk = (o, path) => {
        for (const [k, v] of Object.entries(o || {})) {
            if (!v || typeof v !== 'object' || k.startsWith('$')) continue;
            if ('$value' in v) {
                const ext = (v.$extensions && v.$extensions['network.openvibe']) || {};
                out.push({ path: path.concat(k).join('.'), css: ext.css || '', value: v.$value, description: v.$description || '' });
            } else walk(v, path.concat(k));
        }
    };
    walk((doc && doc.color) || {}, ['color']);
    return out;
}

/** The corner radii of a document, in order, with their CSS names and pixels (the kit's own when the document has none). */
function radiusList(doc) {
    const own = (doc && doc.shape && doc.shape.radius) || {};
    return RADIUS.map((r, i) => {
        const px = parseInt(String((own[r.id] || {}).$value || ''), 10);
        return { ...r, px: Number.isFinite(px) && px >= 0 && px <= 64 ? px : RADII.default[i] };
    });
}

module.exports = { MOTION, BRAND, colours, tokenDocument, colourList, radiusList, shapeOf, radii };
