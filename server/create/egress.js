'use strict';

/**
 * The one path a create request may use to read a page the person named.
 *
 * A starting URL is untrusted input. It is https only, no credentials in the URL, every DNS answer must be a
 * public unicast address (openvibe-shared/egress, checked again at connect time by `safeLookup` so a rebinding
 * answer cannot point the socket inside the network), redirects are followed at most twice and each hop is
 * checked the same way, and the answer is capped. Nothing from the person (cookie, token, header) is sent.
 *
 * The page is reduced to a title and readable text; the generator gets that excerpt, never the raw HTML.
 */
const https = require('https');
const { assertPublicUrl, safeLookup } = require('openvibe-shared/egress');

const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 2;
const MAX_TEXT = 8000;

class StartUrlError extends Error {
    constructor(code, detail) {
        super(detail || code);
        this.name = 'StartUrlError';
        this.status = 422;
        this.code = code;
        this.detail = detail || code;
    }
}

const ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
};

function decode(text) {
    return String(text || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, name) => {
        if (name[0] === '#') {
            const code = name[1] && name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
            return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
        }
        return Object.hasOwn(ENTITIES, name.toLowerCase()) ? ENTITIES[name.toLowerCase()] : ' ';
    });
}

/** The readable text of an HTML page: no script, style, noscript or template, tags as spaces, collapsed. */
function readableText(html) {
    const withoutHead = String(html || '')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
        .replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi, ' ');
    const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html) || /<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i.exec(html);
    const title = decode(titleMatch ? titleMatch[1].replace(/<[^>]+>/g, ' ') : '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const text = decode(withoutHead.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
    return { title, text };
}

function requestOnce(url, { timeoutMs = 6000, authorization = null } = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            method: 'GET',
            lookup: safeLookup,
            headers: {
                Accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8',
                'User-Agent': 'OpenVibe.Design starting-point reader (https://openvibe.design)',
                ...(authorization ? { Authorization: authorization } : {}),
            },
            signal: AbortSignal.timeout(timeoutMs),
        }, (res) => {
            const status = Number(res.statusCode) || 0;
            if (status >= 300 && status < 400 && res.headers.location) {
                res.resume();
                return resolve({ redirect: res.headers.location, status });
            }
            if (status < 200 || status >= 300) {
                res.resume();
                return reject(new StartUrlError('start_url_refused', `That page answered ${status}.`));
            }
            let bytes = 0;
            const chunks = [];
            res.on('data', (chunk) => {
                bytes += chunk.length;
                if (bytes > MAX_BYTES) {
                    req.destroy();
                    reject(new StartUrlError('start_url_too_large', 'That page is too large to read as a starting point.'));
                    return;
                }
                chunks.push(chunk);
            });
            res.on('end', () => resolve({ status, body: Buffer.concat(chunks) }));
            res.on('error', reject);
        });
        req.on('error', (err) => {
            if (err && (err.code === 'EGRESS_DENIED' || err.code === 'EADDRNOTPUBLIC')) {
                return reject(new StartUrlError('start_url_denied', 'That address is not a public web page.'));
            }
            reject(new StartUrlError('start_url_unreachable', 'That page could not be reached.'));
        });
        req.end();
    });
}

/**
 * A page's body through the guarded path (https, public addresses, two checked redirects, capped). → { url, body }
 * Throws StartUrlError(422) for a non-public or unreachable address. fetchStartingPage reads it as text; the page
 * audit (server/review/page-audit.js) reads its markup.
 */
// A token goes only to an OpenVibe Connect preview (plan §AD.25: Network's delegated token for the preview's owner, for a
// room's check), and only while the request stays on the origin it started at: a redirect elsewhere goes without it.
// Anything else would make this public reader a way to send someone's token to any host.
const PREVIEW_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.openvibe\.link$/;

async function fetchGuarded(raw, { timeoutMs = 6000, maxRedirects = MAX_REDIRECTS, auth = null } = {}) {
    let url;
    try { url = new URL(String(raw == null ? '' : raw).trim()); } catch { throw new StartUrlError('start_url_invalid', 'That starting address is not a URL.'); }
    if (url.protocol !== 'https:') throw new StartUrlError('start_url_scheme', 'A starting address must be an https page.');
    if (url.username || url.password) throw new StartUrlError('start_url_credentials', 'A starting address cannot carry a username or password.');
    const token = auth == null ? '' : String(auth).trim();
    if (token && (!PREVIEW_HOST.test(url.hostname) || url.port || !/^[A-Za-z0-9._~+/=-]{16,4096}$/.test(token))) {
        throw new StartUrlError('start_url_auth', 'A token goes only to an OpenVibe Connect preview (https://….openvibe.link).');
    }
    try { await assertPublicUrl(url); } catch {
        throw new StartUrlError('start_url_denied', 'That address is not a public web page.');
    }
    let current = url;
    for (let hop = 0; hop <= maxRedirects; hop++) {
        let out;
        const authorization = token && current.origin === url.origin ? `Bearer ${token}` : null;
        try { out = await requestOnce(current, { timeoutMs, authorization }); } catch (err) {
            if (err instanceof StartUrlError) throw err;
            throw new StartUrlError('start_url_unreachable', 'That page could not be reached.');
        }
        if (out.redirect) {
            let next;
            try { next = new URL(out.redirect, current); } catch { throw new StartUrlError('start_url_redirect', 'That page redirected to an address that is not a URL.'); }
            if (next.protocol !== 'https:') throw new StartUrlError('start_url_redirect', 'That page redirected away from https.');
            try { await assertPublicUrl(next); } catch { throw new StartUrlError('start_url_denied', 'That page redirected to a private address.'); }
            current = next;
            continue;
        }
        return { url: current.toString(), body: out.body };
    }
    throw new StartUrlError('start_url_redirects', 'That page redirected too many times.');
}

/**
 * Read a starting page through the guarded path. → { url, title, text }
 * Throws StartUrlError(422) for a non-public or unreachable address.
 */
async function fetchStartingPage(raw, { timeoutMs = 6000 } = {}) {
    const out = await fetchGuarded(raw, { timeoutMs });
    const read = readableText(out.body.toString('utf8'));
    if (!read.text) throw new StartUrlError('start_url_empty', 'That page had no readable text.');
    return { url: out.url, title: read.title, text: read.text };
}

/** A page's markup through the guarded path, for the page audit. → { url, html } */
async function fetchPageHtml(raw, { timeoutMs = 6000, maxRedirects = MAX_REDIRECTS, auth = null } = {}) {
    const out = await fetchGuarded(raw, { timeoutMs, maxRedirects: Math.min(6, Math.max(0, Number(maxRedirects) || 0)), auth });
    return { url: out.url, html: out.body.toString('utf8') };
}

module.exports = { fetchStartingPage, fetchPageHtml, readableText, StartUrlError, MAX_BYTES, MAX_TEXT, PREVIEW_HOST };
