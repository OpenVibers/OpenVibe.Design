'use strict';

// Icon references for the glyph drafter. OpenVibe.Exchange is the network's own search (the Exchange platform API,
// POST /v1/search/icons at api.openvibe.exchange, served by OpenVibe.AI). Design asks with its own Network
// client-credentials token (audience openvibe.ai, scope exchange.search.icons) and no Exchange key; an
// EXCHANGE_SEARCH_KEY override still wins when the owner sets one. Iconify is the fallback when neither answers. The
// model receives names and concepts only; SVG paths are never sent to it.
const { serviceAuth } = require('openvibe-contracts');

const EXCHANGE_API = 'https://api.openvibe.exchange';
const ICONIFY_API = 'https://api.iconify.design';

const clean = (value, max) => String(value == null ? '' : value).trim().slice(0, max);
const nameOf = (icon) => String(icon || '').split(':').pop().replace(/[^a-z0-9-]/gi, '');

/** Exchange's /v1/search/icons answer → the drafter's reference shape; entries without a licence are dropped. */
function fromExchange(body, limit) {
    const items = Array.isArray(body && body.results) ? body.results : [];
    return items.slice(0, limit).flatMap((item) => {
        const name = nameOf(item && item.name);
        const set = clean(item && item.set, 60);
        const license = clean(item && item.license, 80);
        if (!name || !set || !license) return [];
        return [{ name, set, setName: clean(item.title || item.name || set, 100).replace(/^[^:]+:\s*/, ''),
            author: clean(item.author, 100), license, source: 'exchange',
            licenseUrl: clean(item.license_url, 300), preview: clean(item.url || item.thumbnail, 500) }];
    });
}

async function searchExchange(query, { fetchImpl, limit, authorization, baseUrl, timeoutMs }) {
    const response = await fetchImpl(`${String(baseUrl || EXCHANGE_API).replace(/\/+$/, '')}/v1/search/icons`, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json', authorization },
        body: JSON.stringify({ q: query, limit }),
        signal: AbortSignal.timeout(timeoutMs || 5000),
    });
    if (!response.ok) throw new Error(`Exchange icon references returned ${response.status}`);
    return fromExchange(await response.json(), limit);
}

async function searchIconify(query, { fetchImpl, limit, timeoutMs }) {
    const url = new URL('/search', ICONIFY_API);
    url.searchParams.set('query', query);
    url.searchParams.set('limit', String(limit));
    const response = await fetchImpl(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs || 5000) });
    if (!response.ok) throw new Error(`Icon references returned ${response.status}`);
    const body = await response.json();
    return (Array.isArray(body.icons) ? body.icons : []).slice(0, 8).flatMap((fullName) => {
        const [prefix, name] = String(fullName).split(':');
        const collection = body.collections && body.collections[prefix];
        const license = collection && collection.license;
        if (!/^[a-z0-9-]+$/.test(prefix || '') || !/^[a-z0-9-]+$/.test(name || '') || !license || !license.spdx) return [];
        return [{ name, set: prefix, setName: String(collection.name || prefix).slice(0, 100),
            author: String((collection.author && collection.author.name) || '').slice(0, 100),
            license: String(license.spdx).slice(0, 80), licenseUrl: String(license.url || '').slice(0, 300),
            source: 'iconify', preview: `${ICONIFY_API}/${prefix}/${name}.svg` }];
    });
}

/**
 * Reference icons for a glyph name and sentence. Exchange answers when this service holds an Exchange key
 * (EXCHANGE_SEARCH_KEY, the owner's override) or a Network service token can be minted for exchange.search.icons;
 * Iconify answers otherwise, and after any Exchange failure.
 */
async function searchReferences(query, {
    fetchImpl = globalThis.fetch,
    limit = 5,
    key = process.env.EXCHANGE_SEARCH_KEY,
    getToken,
    baseUrl = process.env.EXCHANGE_API_URL,
    timeoutMs = 5000,
} = {}) {
    const q = String(query || '').trim().slice(0, 120);
    const n = Math.min(Math.max(Number(limit) || 5, 1), 8);
    if (!q) return [];
    if (key || getToken) {
        try {
            const authorization = key ? `Bearer ${key}` : `Bearer ${await getToken()}`;
            return await searchExchange(q, { fetchImpl, limit: n, authorization, baseUrl, timeoutMs });
        } catch { /* the fallback keeps a draft working while Exchange is unreachable */ }
    }
    return await searchIconify(q, { fetchImpl, limit: n, timeoutMs });
}

/**
 * The service's reference search, bound to its own Network token. EXCHANGE_SEARCH_KEY, when the owner sets it,
 * replaces the token; with no secret the service cannot mint one and Iconify answers. searchReferences keeps its
 * direct-test form above.
 */
function createReferenceSearch({ config = {}, fetchImpl = globalThis.fetch, tokenClient } = {}) {
    const exchange = config.exchange || {};
    const key = String(exchange.key || '');
    const tokens = key ? null : (tokenClient || (config.oauth && config.oauth.clientSecret
        ? serviceAuth.createTokenClient({
            tokenUrl: `${config.networkInternalUrl || config.networkUrl || 'http://127.0.0.1:4000'}/oauth/token`,
            clientId: config.oauth.clientId || 'design',
            clientSecret: config.oauth.clientSecret,
            audience: exchange.audience || 'openvibe.ai',
            scope: exchange.scope || 'exchange.search.icons',
            fetchImpl,
        })
        : null));
    return (query, opts = {}) => searchReferences(query, {
        fetchImpl,
        ...opts,
        key: opts.key !== undefined ? opts.key : key,
        baseUrl: opts.baseUrl || exchange.url,
        getToken: opts.getToken || (tokens ? () => tokens.getToken() : undefined),
        timeoutMs: opts.timeoutMs || exchange.timeoutMs || 5000,
    });
}

module.exports = { searchReferences, createReferenceSearch, fromExchange };
