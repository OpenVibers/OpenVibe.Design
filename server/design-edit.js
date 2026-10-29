'use strict';

/**
 * Click edits: turn a clicked element path into one safe change, server-side.
 *
 * The iframe reports `body > section:nth-of-type(1) > h1:nth-of-type(1)`; nothing else about the document is
 * trusted. This module finds that element in the saved HTML, accepts only the four changes the panel offers
 * (text, a theme token colour, a spacing preset and an alignment), and writes an escaped text node and a rebuilt
 * inline `style` attribute. It never takes an attribute name, a CSS property or a CSS value from the client, so a
 * path can select an element but cannot add a tag, an event handler, a URL or a fetch.
 */

const PATH_MAX = 400;
const DEPTH_MAX = 12;
const TEXT_MAX = 1000;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW_TEXT = new Set(['style', 'textarea', 'title', 'xmp']);
// Tags a click edit may never target: they are document plumbing or active content, and the sanitizer has
// already removed most of them. `button` and `a` stay allowed: rewriting their label is a normal design edit.
const UNSAFE_TAGS = new Set(['script', 'style', 'html', 'head', 'title', 'meta', 'link', 'base', 'iframe', 'object',
    'embed', 'applet', 'template', 'noscript', 'svg', 'math', 'form', 'input', 'textarea', 'select']);
const TOKEN_ALIASES = Object.freeze(['--bg-card', '--bg-secondary', '--text-muted', '--accent', '--on-accent', '--border']);
const SPACING = Object.freeze({ none: '0', sm: '8px', md: '16px', lg: '24px' });
const ALIGN = Object.freeze(['left', 'center', 'right']);
const CHANGED_PROPERTIES = Object.freeze(['color', 'padding', 'text-align']);

class EditError extends Error {
    constructor(status, code, detail) {
        super(detail);
        this.name = 'EditError';
        this.status = status;
        this.code = code;
        this.detail = detail;
    }
}

const bad = (detail, code = 'design.invalid_change') => new EditError(422, code, detail);

function tagEnd(s, start) {
    let quote = null;
    for (let i = start + 1; i < s.length; i++) {
        const c = s[i];
        if (quote) { if (c === quote) quote = null; }
        else if (c === '"' || c === "'") quote = c;
        else if (c === '>') return i;
    }
    return -1;
}

const pathRegex = /^body(?: > [a-z][a-z0-9-]*:nth-of-type\(\d{1,4}\))*$/;

/** The requested path, or 422. */
function readPath(raw) {
    if (typeof raw !== 'string' || !raw || raw.length > PATH_MAX) throw bad('Send the clicked element path.');
    if (!pathRegex.test(raw)) throw bad('That element path is not allowed.');
    const segments = raw.split(' > ');
    if (segments.length - 1 > DEPTH_MAX) throw bad('That element is nested too deeply.');
    const tail = segments.slice(1).map((seg) => {
        const m = /^([a-z][a-z0-9-]*):nth-of-type\((\d{1,4})\)$/.exec(seg);
        if (!m) throw bad('That element path is not allowed.');
        const tag = m[1];
        const index = Number(m[2]);
        if (UNSAFE_TAGS.has(tag)) throw bad(`A ${tag} element cannot be edited.`, 'design.unsafe_element');
        if (index < 1 || index > 500) throw bad('That element path is not allowed.');
        return { tag, index };
    });
    return { raw, tail };
}

/** A flat tree walk that mirrors the browser's element order closely enough for stable nth-of-type paths. */
function tree(html) {
    const root = { tag: '#root', children: [], parent: null, start: 0, openEnd: 0, closeStart: null, closeEnd: null, index: 0 };
    const stack = [root];
    const closeImplicit = (tag, at) => {
        const top = stack[stack.length - 1];
        const closes = (tag === 'p' && top.tag === 'p') || (tag === 'li' && top.tag === 'li')
            || ((tag === 'tr') && top.tag === 'tr')
            || ((tag === 'td' || tag === 'th') && (top.tag === 'td' || top.tag === 'th'))
            || (tag === 'option' && top.tag === 'option')
            || ((tag === 'thead' || tag === 'tbody' || tag === 'tfoot') && ['thead', 'tbody', 'tfoot'].includes(top.tag));
        if (!closes) return;
        stack.pop();
        if (top.closeStart == null) { top.closeStart = at; top.closeEnd = at; }
    };
    let i = 0;
    while (i < html.length) {
        const lt = html.indexOf('<', i);
        if (lt === -1) break;
        const next = html[lt + 1] || '';
        if (next === '!' || next === '?') {
            const end = html.indexOf('>', lt);
            i = end === -1 ? html.length : end + 1;
            continue;
        }
        if (next === '/') {
            const m = /^<\/\s*([a-z][a-z0-9-]*)/i.exec(html.slice(lt, lt + 80));
            if (!m) { i = lt + 1; continue; }
            const tag = m[1].toLowerCase();
            const end = tagEnd(html, lt);
            if (end === -1) break;
            let k = stack.length - 1;
            while (k > 0 && stack[k].tag !== tag) k--;
            if (k > 0) {
                for (let j = stack.length - 1; j > k; j--) {
                    const el = stack[j];
                    if (el.closeStart == null) { el.closeStart = lt; el.closeEnd = lt; }
                }
                const el = stack[k];
                if (el.closeStart == null) { el.closeStart = lt; el.closeEnd = end + 1; }
                stack.length = k;
            }
            i = end + 1;
            continue;
        }
        if (!/[a-z]/i.test(next)) { i = lt + 1; continue; }
        const end = tagEnd(html, lt);
        if (end === -1) break;
        const raw = html.slice(lt, end + 1);
        const m = /^<\s*([a-z][a-z0-9-]*)/i.exec(raw);
        if (!m) { i = end + 1; continue; }
        const tag = m[1].toLowerCase();
        closeImplicit(tag, lt);
        const parent = stack[stack.length - 1];
        const index = parent.children.filter((c) => c.tag === tag).length + 1;
        const el = { tag, start: lt, openEnd: end + 1, closeStart: null, closeEnd: null, parent, children: [], index };
        parent.children.push(el);
        if (!VOID.has(tag) && !/\/\s*>$/.test(raw)) {
            if (RAW_TEXT.has(tag)) {
                const close = new RegExp(`</\\s*${tag}\\s*>`, 'i');
                const rest = html.slice(end + 1);
                const found = close.exec(rest);
                if (found) {
                    el.closeStart = end + 1 + found.index;
                    el.closeEnd = el.closeStart + found[0].length;
                    i = el.closeEnd;
                    continue;
                }
            }
            stack.push(el);
        }
        i = end + 1;
    }
    // Mark every unclosed element at the end of the document as implicitly closed at the end.
    for (let j = stack.length - 1; j > 0; j--) {
        const el = stack[j];
        if (el.closeStart == null) { el.closeStart = html.length; el.closeEnd = html.length; }
    }
    return root;
}

function pathOf(el) {
    const parts = [];
    let cur = el;
    while (cur && cur.tag !== '#root') {
        if (cur.tag === 'body') { parts.unshift('body'); break; }
        if (cur.tag === 'html' || cur.tag === 'head') return null;
        parts.unshift(`${cur.tag}:nth-of-type(${cur.index})`);
        cur = cur.parent;
    }
    return parts[0] === 'body' ? parts.join(' > ') : null;
}

function findBody(node) {
    for (const child of node.children) {
        if (child.tag === 'body') return child;
        const found = findBody(child);
        if (found) return found;
    }
    return null;
}

function findElement(html, rawPath) {
    const path = readPath(rawPath);
    const root = tree(html);
    const body = findBody(root);
    if (!body) throw bad('That element is not in the saved document.', 'design.path_not_found');
    let current = body;
    for (let i = 0; i < path.tail.length; i++) {
        const segment = path.tail[i];
        const found = current.children.find((el) => el.tag === segment.tag && el.index === segment.index);
        if (!found) {
            // A browser inserts tbody when the saved table has a tr directly under it; the overlay path includes
            // the virtual wrapper, so skip it while there is a real element after it.
            if (segment.tag === 'tbody' && current.tag === 'table' && i < path.tail.length - 1) continue;
            throw bad('That element is not in the saved document.', 'design.path_not_found');
        }
        current = found;
    }
    if (!pathOf(current)) throw bad('That element cannot be edited.', 'design.unsafe_element');
    return { path, element: current, body };
}

/** A style attribute rebuilt from safe declarations only; target properties are replaced, the rest are kept. */
function safeDeclaration(property, value) {
    return /^-?[a-z][a-z0-9-]*$/.test(property)
        && typeof value === 'string' && value.length <= 200
        && !/[<>\\{}]/.test(value)
        && !/url\s*\(|expression|javascript\s*:|@import|behavior\s*:|-moz-binding/i.test(value);
}

function parseStyle(style) {
    return String(style || '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
        const colon = part.indexOf(':');
        if (colon < 1) return null;
        const property = part.slice(0, colon).trim().toLowerCase();
        const value = part.slice(colon + 1).trim();
        return safeDeclaration(property, value) ? { property, value } : null;
    }).filter(Boolean);
}

function changedStyle(existing, changes) {
    const replacing = new Set(CHANGED_PROPERTIES.filter((p) => changes[p] != null));
    const kept = parseStyle(existing).filter((decl) => !replacing.has(decl.property));
    return kept.concat(CHANGED_PROPERTIES.filter((p) => changes[p] != null).map((property) => ({ property, value: changes[property] })))
        .map((decl) => `${decl.property}:${decl.value}`).join(';');
}

function rewriteOpeningTag(raw, changes) {
    const existing = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(raw);
    if (Object.keys(changes).length === 0) return raw;
    const style = changedStyle(existing ? (existing[1] != null ? existing[1] : existing[2]) : '', changes);
    const value = style.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const attribute = ` style="${value}"`;
    if (existing) {
        return raw.replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*')/i, attribute);
    }
    return /\/\s*>$/.test(raw) ? raw.replace(/\/\s*>$/, `${attribute}/>`) : raw.replace(/\s*>$/, `${attribute}>`);
}

const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Validate one change against the theme; returns only known properties with server-owned values. */
function validateChange({ path, text, color, spacing, align }, variables) {
    const requested = readPath(path);
    const changes = {};
    let any = false;
    if (text !== undefined && text !== null) {
        if (typeof text !== 'string' || text.length > TEXT_MAX) throw bad(`The text must be at most ${TEXT_MAX} characters.`);
        if (/[\u0000]/.test(text)) throw bad('That text is not allowed.');
        changes.text = text;
        any = true;
    }
    if (color !== undefined && color !== null && color !== '') {
        if (typeof color !== 'string' || !/^--[a-z][a-z0-9-]{1,40}$/.test(color)) throw bad('Pick a theme colour token.', 'design.unsafe_css');
        const value = variables && Object.prototype.hasOwnProperty.call(variables, color) ? String(variables[color]) : null;
        const colourValue = value != null && /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(value);
        if (!colourValue && !TOKEN_ALIASES.includes(color)) throw bad('That colour token is not part of this theme.', 'design.unsafe_css');
        changes.color = `var(${color})`;
        any = true;
    }
    if (spacing !== undefined && spacing !== null && spacing !== '') {
        if (typeof spacing !== 'string' || !Object.prototype.hasOwnProperty.call(SPACING, spacing)) throw bad('Pick a spacing preset.', 'design.unsafe_css');
        changes.padding = Object.prototype.hasOwnProperty.call(SPACING, spacing) ? SPACING[spacing] : null;
        any = true;
    }
    if (align !== undefined && align !== null && align !== '') {
        if (typeof align !== 'string' || !ALIGN.includes(align)) throw bad('Pick left, centre or right.', 'design.unsafe_css');
        changes['text-align'] = align;
        any = true;
    }
    if (!any) throw bad('Choose at least one change.');
    return { ...requested, path: requested.raw, changes, spacing: spacing || null };
}

function applyChange(html, change) {
    const found = findElement(html, change.path);
    const { element } = found;
    if (change.changes.text !== undefined && element.children.length > 0)
        throw bad('This element contains other elements, so its text cannot be replaced. Pick the text element inside it.', 'design.not_leaf');
    let out = String(html);
    if (change.changes.text !== undefined) {
        if (element.closeStart == null) throw bad('That element is not closed, so it cannot be edited.', 'design.invalid_change');
        out = `${out.slice(0, element.openEnd)}${escapeText(change.changes.text)}${out.slice(element.closeStart)}`;
    }
    const styleChanges = {};
    for (const property of CHANGED_PROPERTIES) if (change.changes[property] !== undefined) styleChanges[property] = change.changes[property];
    if (Object.keys(styleChanges).length) {
        const open = out.slice(element.start, element.openEnd);
        const rewritten = rewriteOpeningTag(open, styleChanges);
        out = `${out.slice(0, element.start)}${rewritten}${out.slice(element.openEnd)}`;
    }
    return out;
}

module.exports = { EditError, readPath, findElement, tree, pathOf, validateChange, applyChange, changedStyle,
    escapeText, TOKEN_ALIASES, SPACING, ALIGN, UNSAFE_TAGS, CHANGED_PROPERTIES, TEXT_MAX };
