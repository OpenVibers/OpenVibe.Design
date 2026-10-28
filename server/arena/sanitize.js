'use strict';

/**
 * The Arena's output safety. A model writes a page; Design stores it as text and never puts it in its own
 * document. Two layers:
 *
 *   1. sanitizeHtml(): strip <script>, on* attributes, javascript: URLs and a few navigation tags before storing,
 *      and cap the text at 200 KB.
 *   2. iframeHtml(): the only place an output is rendered is `<iframe sandbox srcdoc="…">` with no allow-scripts
 *      and no allow-same-origin, and the srcdoc document starts with a CSP meta that blocks every network fetch:
 *      `default-src 'none'; style-src 'unsafe-inline'; img-src data:`.
 *
 * Nothing here trusts the model. The escaped srcdoc is built with attrEscape(), so the output can never close the
 * attribute or the iframe.
 */
const { esc } = require('openvibe-shared/kit');

const MAX_BYTES = 200 * 1024;
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";

/** An attribute value for a double-quoted srcdoc: apostrophes may stay literal (CSP's 'none' stays readable). */
const attrEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** What a browser would read from a URL attribute, enough to catch javascript: split by entities or whitespace. */
function urlLooksLikeScript(raw) {
    const decoded = String(raw)
        .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
        .replace(/&colon;?/gi, ':').replace(/&tab;?/gi, '\t').replace(/&newline;?/gi, '\n');
    return /javascript\s*:/i.test(decoded.replace(/[\s\u0000-\u001f]+/g, ''));
}


/** The end of a tag, skipping a `>` inside a quoted attribute value (the HTML parser does the same). */
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

/** Strip event handlers and javascript: URLs from one tag; the tag's own angle brackets are kept. */
function sanitizeTag(tag) {
    let t = tag;
    t = t.replace(/([\s/])on[a-z0-9_:.-]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '$1');
    t = t.replace(/\s(on[a-z0-9_:.-]*)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    t = t.replace(/(\b(?:href|src|action|formaction|xlink:href|poster|background|data)\s*=\s*)((?:"[^"]*"|'[^']*'|[^\s>]+))/gi,
        (m, name, value) => (urlLooksLikeScript(value) ? `${name}"#"` : m));
    return t;
}

/** Walk tags with the parser's quote rule instead of `[^>]*`, so a `>` inside a value cannot hide a handler. */
function sanitizeTags(s) {
    let out = '';
    let i = 0;
    while (i < s.length) {
        const lt = s.indexOf('<', i);
        if (lt === -1) { out += s.slice(i); break; }
        out += s.slice(i, lt);
        const next = s[lt + 1] || '';
        if (!/[a-z/]/i.test(next)) { out += '<'; i = lt + 1; continue; }
        const end = tagEnd(s, lt);
        if (end === -1) { out += s.slice(lt); break; }
        out += sanitizeTag(s.slice(lt, end + 1));
        i = end + 1;
    }
    return out;
}

function truncateBytes(s, maxBytes) {
    if (Buffer.byteLength(s, 'utf8') <= maxBytes) return s;
    // Slice bytes, then drop a half-written UTF-8 character at the end.
    const buf = Buffer.from(s, 'utf8').subarray(0, maxBytes);
    let out = buf.toString('utf8');
    if (out.endsWith('\uFFFD')) out = out.slice(0, -1);
    return out;
}

function sanitizeHtml(input, { maxBytes = MAX_BYTES } = {}) {
    let s = input == null ? '' : String(input);
    s = s.replace(/\u0000/g, '');
    s = truncateBytes(s, maxBytes);

    // Comments can hide a script from a naive parser; remove them before anything else.
    s = s.replace(/<!--[\s\S]*?-->/g, '');

    // <script>…</script>, including attributes and whitespace; repeat for nested or overlapping attempts.
    for (let i = 0; i < 4; i++) {
        const before = s;
        s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
        s = s.replace(/<script\b[^>]*\/\s*>/gi, '');
        if (s === before) break;
    }
    // An unclosed script would swallow the rest of the page: drop its opening tag (and any stray closing one).
    s = s.replace(/<\/?script\b[^>]*>/gi, '');
    // Anything that still looks like a script tag (a malformed `<script/x>`) is escaped, never a tag.
    s = s.replace(/<(\/?)(script)\b/gi, '&lt;$1$2');

    // Navigation / embedding tags that a generated page never needs.
    s = s.replace(/<base\b[^>]*>/gi, '');
    s = s.replace(/<meta\b[^>]*http-equiv\s*=\s*(?:"refresh"|'refresh'|refresh)[^>]*>/gi, '');
    s = s.replace(/<\/?(?:iframe|object|embed|applet)\b[^>]*>/gi, '');

    // Attributes: on* handlers and javascript: URLs, with quoted `>` handled as the browser handles it.
    s = sanitizeTags(s);

    // Belt and braces: no javascript: URL survives in any form (including whitespace/HTML entities between letters).
    s = s.replace(/j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/gi, 'blocked:');
    if (/<script/i.test(s)) s = s.replace(/<(\/?)(script)/gi, '&lt;$1$2');

    return truncateBytes(s, maxBytes);
}

/** The document inside the iframe: CSP first, then the model's sanitized page. */
function frameDocument(html) {
    return `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">`
        + `<meta http-equiv="Content-Security-Policy" content="${CSP}">`
        + `<style>html,body{margin:0;min-height:100%;background:#fff;}img{max-width:100%;height:auto;}</style>`
        + sanitizeHtml(html);
}

/**
 * The only renderer for a model output at a viewport width. `sandbox=""` is the strictest sandbox: no scripts,
 * no same-origin, no forms, no popups, no top navigation. The CSP meta is already inside the escaped srcdoc.
 */
function iframeHtml({ html = '', width = 390, height = 844, title = 'A generated design', id = null, className = '' } = {}) {
    const w = Math.max(1, Math.round(Number(width) || 390));
    const h = Math.max(1, Math.round(Number(height) || 844));
    // Keep the attribute list explicit rather than clever: a generated page must never influence it.
    return `<iframe${id ? ` id="${esc(id)}"` : ''} class="ar-frame${className ? ` ${esc(className)}` : ''}"`
        + ` title="${esc(title)}" width="${w}" height="${h}" data-width="${w}"`
        + ` sandbox="" loading="lazy" referrerpolicy="no-referrer"`
        + ` srcdoc="${attrEscape(frameDocument(html))}"></iframe>`;
}

module.exports = { sanitizeHtml, frameDocument, iframeHtml, truncateBytes, MAX_BYTES, CSP, attrEscape, urlLooksLikeScript };
