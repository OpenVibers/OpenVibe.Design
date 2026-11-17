'use strict';
/**
 * A name effect's CSS, checked and rebuilt before anyone sees it (the "make me an effect" maker, plan §AD.15). A model
 * writes it; nothing it writes reaches a page unless it is one effect in the house's own shape:
 *
 *   • rules only for the effect's own class: `.name-fx-<slug>`, its ::before and ::after, and the same under
 *     html[data-ov-motion=off|reduced] (Calm and Off) and html[data-theme-mode="light"] (light themes);
 *   • keyframes named nameFx<Slug>…;
 *   • properties from a short list (colour, backgrounds and their clip, text-shadow, filter, animation, transform,
 *     opacity, letter-spacing, font-weight, and content on the pseudo-elements);
 *   • no url(), no @import or other at-rule, no expression(), no backslash escapes, no positioning outside the name.
 *
 *   clean(css, slug) → { ok: true, css, rules, keyframes } | { ok: false, why }
 */
const MAX = 6000;
const MAX_RULES = 14;
const MAX_KEYFRAMES = 6;
const PROPS = new Set([
    'color', 'background', 'background-image', 'background-size', 'background-position', 'background-repeat', 'background-color',
    'background-clip', '-webkit-background-clip', '-webkit-text-fill-color', 'text-shadow', 'filter', 'opacity', 'transform',
    'transform-origin', 'letter-spacing', 'font-weight', 'font-style', 'animation', 'animation-name', 'animation-duration',
    'animation-timing-function', 'animation-delay', 'animation-iteration-count', 'animation-direction', 'animation-fill-mode',
    'animation-play-state', 'display', 'margin', 'margin-left', 'margin-right', 'content', 'mix-blend-mode', '-webkit-text-stroke',
    'text-decoration', 'text-decoration-color', 'text-underline-offset', 'will-change',
]);
const PSEUDO_ONLY = new Set(['content', 'margin', 'margin-left', 'margin-right', 'display']);
const BAD_VALUE = /url\s*\(|expression\s*\(|@|\\|javascript:|<|>|\{|\}|!important\s*!/i;
const DISPLAY = /^(inline|inline-block)$/;

const pascal = (slug) => slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');

/** The selectors an effect may style, for its slug. */
function selectorOk(sel, slug) {
    const s = sel.trim().replace(/\s+/g, ' ');
    const base = `\\.name-fx-${slug}(?:::(?:before|after))?`;
    const re = new RegExp(`^(?:html\\[data-ov-motion=(?:off|reduced)\\] |html\\[data-theme-mode="light"\\] )?${base}$`);
    return re.test(s) ? { s, pseudo: /::(?:before|after)$/.test(s) } : null;
}

function declarations(body, { pseudo, inKeyframes }) {
    const out = [];
    for (const raw of body.split(';')) {
        const d = raw.trim();
        if (!d) continue;
        const i = d.indexOf(':');
        if (i < 1) return { why: `"${d.slice(0, 40)}" is not a declaration` };
        const prop = d.slice(0, i).trim().toLowerCase();
        let value = d.slice(i + 1).trim();
        if (!PROPS.has(prop)) return { why: `${prop} is not a property an effect may set` };
        if (PSEUDO_ONLY.has(prop) && !pseudo && !(prop === 'display' && DISPLAY.test(value))) return { why: `${prop} belongs on ::before or ::after` };
        if (prop === 'display' && !DISPLAY.test(value)) return { why: 'display is inline or inline-block' };
        if (BAD_VALUE.test(value)) return { why: `${prop}: that value is not allowed (no url(), no escapes)` };
        if (prop === 'content' && !/^(?:"[^"\n]{0,8}"|'[^'\n]{0,8}'|none|"")$/.test(value)) return { why: 'content is a short quoted string' };
        if (inKeyframes && /^animation/.test(prop)) return { why: 'a keyframe does not start an animation' };
        value = value.replace(/\s+/g, ' ');
        out.push(`${prop}: ${value}`);
    }
    if (!out.length) return { why: 'an empty rule' };
    return { decls: out };
}

/** Split the top level of a stylesheet into { head, body } blocks; null when the braces do not balance. */
function blocks(src) {
    const out = [];
    let depth = 0, start = 0, head = '';
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (c === '{') { if (depth === 0) { head = src.slice(start, i).trim(); start = i + 1; } depth++; }
        else if (c === '}') { depth--; if (depth < 0) return null; if (depth === 0) { out.push({ head, body: src.slice(start, i) }); start = i + 1; } }
    }
    if (depth !== 0 || src.slice(start).trim()) return null;
    return out;
}

function clean(css, slug) {
    const no = (why) => ({ ok: false, why });
    if (!/^[a-z][a-z0-9-]{1,23}$/.test(String(slug || ''))) return no('the name is 2 to 24 lowercase letters, digits or hyphens');
    let src = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!src) return no('no CSS');
    if (src.length > MAX) return no(`the CSS is over ${MAX} characters`);
    const top = blocks(src);
    if (!top) return no('the braces do not balance');
    const prefix = `nameFx${pascal(slug)}`;
    const rules = [];
    const frames = [];
    let mainRule = false;
    for (const { head, body } of top) {
        if (head.startsWith('@')) {
            const m = head.match(/^@keyframes\s+([A-Za-z][A-Za-z0-9]*)$/);
            if (!m) return no(`${head.split(/\s/)[0]} is not allowed: keyframes only`);
            if (!m[1].startsWith(prefix)) return no(`keyframes are named ${prefix}…`);
            const stops = blocks(body);
            if (!stops || !stops.length) return no(`@keyframes ${m[1]} has no steps`);
            const parts = [];
            for (const st of stops) {
                if (!/^(?:from|to|\d{1,3}(?:\.\d+)?%)(?:\s*,\s*(?:from|to|\d{1,3}(?:\.\d+)?%))*$/.test(st.head)) return no(`"${st.head.slice(0, 20)}" is not a keyframe step`);
                const d = declarations(st.body, { pseudo: true, inKeyframes: true });
                if (d.why) return no(d.why);
                parts.push(`    ${st.head.replace(/\s+/g, ' ')} { ${d.decls.join('; ')}; }`);
            }
            frames.push(`@keyframes ${m[1]} {\n${parts.join('\n')}\n}`);
            continue;
        }
        const sels = head.split(',').map((x) => selectorOk(x, slug));
        if (!sels.length || sels.some((x) => !x)) return no(`"${head.slice(0, 60)}" styles something other than .name-fx-${slug}`);
        const pseudo = sels.every((x) => x.pseudo);
        const d = declarations(body, { pseudo, inKeyframes: false });
        if (d.why) return no(d.why);
        if (sels.some((x) => x.s === `.name-fx-${slug}`)) mainRule = true;
        rules.push(`${sels.map((x) => x.s).join(',\n')} {\n${d.decls.map((x) => `    ${x};`).join('\n')}\n}`);
    }
    if (!mainRule) return no(`there is no rule for .name-fx-${slug} itself`);
    if (rules.length > MAX_RULES) return no(`more than ${MAX_RULES} rules`);
    if (frames.length > MAX_KEYFRAMES) return no(`more than ${MAX_KEYFRAMES} keyframes`);
    // Motion off: if the effect moves and says nothing for Off, it holds still there (the house rule: Off stops motion).
    const moves = rules.some((r) => /animation/.test(r));
    if (moves && !rules.some((r) => r.startsWith('html[data-ov-motion=off]'))) {
        rules.push(`html[data-ov-motion=off] .name-fx-${slug},\nhtml[data-ov-motion=off] .name-fx-${slug}::before,\nhtml[data-ov-motion=off] .name-fx-${slug}::after {\n    animation: none;\n}`);
    }
    return { ok: true, css: `${rules.join('\n')}\n${frames.join('\n')}\n`.trim() + '\n', rules: rules.length, keyframes: frames.length };
}

module.exports = { clean, selectorOk, pascal, PROPS, MAX };
