'use strict';
/**
 * The compilers: the token set as the file one tool reads. Each takes the token document and writes the source text
 * for one format — no network, no disk, no state.
 *
 *   tokensJson(doc)     the DTCG document (JSON)
 *   css(doc)            :root { … } with every variable
 *   tailwind(doc)       a Tailwind preset (module.exports = { theme: { extend: { … } } })
 *   styleDictionary(doc) the Style Dictionary source
 *   swift(doc)          a Swift enum OVTokens (SwiftUI)
 *   kotlin(doc)         a Kotlin object OVTokens (Jetpack Compose)
 *   androidXml(doc)     an Android colors.xml
 */
const tokens = require('openvibe-shared/tokens');
const { MOTION, BRAND, colourList } = require('./kit');

const metaOf = (doc) => (doc && doc.$extensions && doc.$extensions['network.openvibe']) || { name: 'Theme', slug: 'theme', mode: 'dark' };
const camel = (path) => String(path).split('.').map((p, i) => (i ? p[0].toUpperCase() + p.slice(1) : p)).join('').replace(/[^A-Za-z0-9]/g, '');
// Android resource names: letters, digits and underscores only.
const snake = (path) => String(path).split('.').map((p) => p.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^A-Za-z0-9]+/g, '_').toLowerCase()).join('_');
const hex2 = (n) => n.toString(16).padStart(2, '0').toUpperCase();

/** A colour as 0xAARRGGBB and as #RRGGBB (opaque) or #AARRGGBB (not): null when it cannot be read. */
function argb(value) {
    const c = tokens.parseColor(value);
    if (!c) return null;
    const a = Math.round(c.a * 255);
    return { opaque: c.a >= 1, argb: `${hex2(a)}${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`, rgb: `${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}` };
}

// Text for a comment: one line, no comment terminators, nothing XML would refuse.
const safe = (s) => String(s == null ? '' : s)
    .replace(/[\r\n\u2028\u2029]+/g, ' ')
    .replace(/\*\//g, '* /')
    .replace(/--/g, '- -')
    .replace(/[^\x20-\x7e\u00a0-\uffff]/g, '')
    .trim()
    .slice(0, 160);

const header = (doc, kind) => {
    const m = metaOf(doc);
    const line = `${safe(m.name)} (${m.mode === 'light' ? 'light' : 'dark'}) — OpenVibe design tokens, from openvibe.design. Regenerate instead of editing.`;
    return kind === 'xml' ? `<!-- ${line} -->` : `// ${line}`;
};

/** The DTCG document, as JSON. */
function tokensJson(doc) {
    return `${JSON.stringify(doc, null, 2)}\n`;
}

/** :root { … } — the theme's colours by the network's own names, the kit's motion, the mark's colours. */
function css(doc) {
    const m = metaOf(doc);
    const lines = [];
    lines.push(`    /* the theme's colours */`);
    for (const c of colourList(doc)) lines.push(`    ${c.css}: ${c.value};`);
    lines.push(`    /* the kit's motion (openvibe-shared/ov-fx) */`);
    for (const d of MOTION.durations) lines.push(`    ${d.css}: ${d.ms}ms;`);
    for (const e of MOTION.easings) lines.push(`    ${e.css}: cubic-bezier(${e.value.join(', ')});`);
    lines.push(`    /* the mark */`);
    for (const b of BRAND) lines.push(`    ${b.css}: ${b.value};`);
    lines.push(`    color-scheme: ${m.mode === 'light' ? 'light' : 'dark'};`);
    return `/* ${m.name} (${m.mode}) — OpenVibe design tokens, from openvibe.design. Regenerate instead of editing. */\n:root {\n${lines.join('\n')}\n}\n`;
}

/** A Tailwind preset: the colours, the durations and the curves, under theme.extend. */
function tailwind(doc) {
    const colors = {};
    for (const c of colourList(doc)) {
        const parts = c.path.replace(/^color\./, '').split('.');
        let o = colors;
        for (const p of parts.slice(0, -1)) o = o[p] || (o[p] = {});
        o[parts[parts.length - 1]] = c.value;
    }
    for (const b of BRAND) {
        colors.brand = colors.brand || {};
        colors.brand[b.id] = b.value;
    }
    const transitionDuration = {};
    for (const d of MOTION.durations) transitionDuration[d.id] = `${d.ms}ms`;
    const transitionTimingFunction = {};
    for (const e of MOTION.easings) transitionTimingFunction[e.id] = `cubic-bezier(${e.value.join(', ')})`;
    const config = { theme: { extend: { colors, transitionDuration, transitionTimingFunction } } };
    return `${header(doc, 'js')}\nmodule.exports = ${JSON.stringify(config, null, 4)};\n`;
}

/** The Style Dictionary source: value and type for every token, under its path. */
function styleDictionary(doc) {
    const out = {};
    const put = (obj, path, leaf) => {
        const parts = String(path).split('.');
        let o = obj;
        for (const p of parts.slice(0, -1)) o = o[p] || (o[p] = {});
        o[parts[parts.length - 1]] = leaf;
    };
    for (const c of colourList(doc)) put(out, c.path, { value: c.value, type: 'color', description: c.description });
    for (const d of MOTION.durations) put(out, `motion.duration.${d.id}`, { value: `${d.ms}ms`, type: 'duration', description: d.description });
    for (const e of MOTION.easings) put(out, `motion.easing.${e.id}`, { value: e.value.slice(), type: 'cubicBezier', description: e.description });
    for (const b of BRAND) put(out, `brand.${b.id}`, { value: b.value, type: 'color', description: b.description });
    return `${JSON.stringify(out, null, 2)}\n`;
}

/** SwiftUI: an enum OVTokens of colours (from hex) and the kit's motion (TimeInterval, in seconds). */
function swift(doc) {
    const m = metaOf(doc);
    const lines = [];
    lines.push(header(doc, 'swift'));
    lines.push('import SwiftUI');
    lines.push('');
    lines.push('extension Color {');
    lines.push('    /// A colour from a 0xAARRGGBB literal (opaque when the alpha byte is FF).');
    lines.push('    init(hex: UInt32) {');
    lines.push('        self.init(.sRGB,');
    lines.push('                  red: Double((hex >> 16) & 0xFF) / 255,');
    lines.push('                  green: Double((hex >> 8) & 0xFF) / 255,');
    lines.push('                  blue: Double(hex & 0xFF) / 255,');
    lines.push('                  opacity: Double((hex >> 24) & 0xFF) / 255)');
    lines.push('    }');
    lines.push('}');
    lines.push('');
    lines.push(`/// OpenVibe's tokens for ${safe(m.name)} (${m.mode === 'light' ? 'light' : 'dark'}).`);
    lines.push('public enum OVTokens {');
    for (const c of colourList(doc)) {
        const a = argb(c.value);
        if (!a) continue;
        lines.push(`    /// ${safe(c.description)}`);
        lines.push(`    public static let ${camel(c.path.replace(/^color\./, ''))} = Color(hex: 0x${a.argb})`);
    }
    for (const d of MOTION.durations) {
        lines.push(`    /// The kit's motion: ${d.css} (${d.ms} ms).`);
        lines.push(`    public static let ${d.name}: TimeInterval = ${d.ms / 1000}`);
    }
    for (const e of MOTION.easings) {
        lines.push(`    /// The kit's motion: ${e.css}.`);
        lines.push(`    public static let ${e.name} = Animation.timingCurve(${e.value.join(', ')})`);
    }
    for (const b of BRAND) {
        lines.push(`    /// ${safe(b.description)}`);
        lines.push(`    public static let ${b.name} = Color(hex: 0x${argb(b.value).argb})`);
    }
    lines.push('}');
    return `${lines.join('\n')}\n`;
}

/** Jetpack Compose: an object OVTokens of colours (Color(0xFF…)) and the kit's motion (milliseconds). */
function kotlin(doc) {
    const m = metaOf(doc);
    const lines = [];
    lines.push(header(doc, 'kotlin'));
    lines.push('package network.openvibe.tokens');
    lines.push('');
    lines.push('import androidx.compose.animation.core.CubicBezierEasing');
    lines.push('import androidx.compose.ui.graphics.Color');
    lines.push('');
    lines.push(`/** OpenVibe's tokens for ${safe(m.name)} (${m.mode === 'light' ? 'light' : 'dark'}). */`);
    lines.push('object OVTokens {');
    for (const c of colourList(doc)) {
        const a = argb(c.value);
        if (!a) continue;
        lines.push(`    /** ${safe(c.description)} */`);
        lines.push(`    val ${camel(c.path.replace(/^color\./, ''))} = Color(0x${a.argb})`);
    }
    for (const d of MOTION.durations) {
        lines.push(`    /** The kit's motion: ${d.css} (${d.ms} ms). */`);
        lines.push(`    const val ${d.name} = ${d.ms}L`);
    }
    for (const e of MOTION.easings) {
        lines.push(`    /** The kit's motion: ${e.css}. */`);
        lines.push(`    val ${e.name} = CubicBezierEasing(${e.value.map((n) => `${n}f`).join(', ')})`);
    }
    for (const b of BRAND) {
        lines.push(`    /** ${safe(b.description)} */`);
        lines.push(`    val ${b.name} = Color(0x${argb(b.value).argb})`);
    }
    lines.push('}');
    return `${lines.join('\n')}\n`;
}

/** Android: a colors.xml. */
function androidXml(doc) {
    const m = metaOf(doc);
    const lines = [];
    lines.push('<?xml version="1.0" encoding="utf-8"?>');
    lines.push(header(doc, 'xml'));
    lines.push('<resources>');
    for (const c of colourList(doc)) {
        const a = argb(c.value);
        if (!a) continue;
        lines.push(`    <!-- ${safe(c.description)} -->`);
        lines.push(`    <color name="ov_${snake(c.path.replace(/^color\./, ''))}">#${a.opaque ? a.rgb : a.argb}</color>`);
    }
    for (const b of BRAND) {
        lines.push(`    <!-- ${safe(b.description)} -->`);
        lines.push(`    <color name="ov_brand_${b.id}">#${argb(b.value).rgb}</color>`);
    }
    lines.push('</resources>');
    return `${lines.join('\n')}\n`;
}

module.exports = { tokensJson, css, tailwind, styleDictionary, swift, kotlin, androidXml, argb };
