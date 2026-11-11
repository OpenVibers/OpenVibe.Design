'use strict';
const assert = require('node:assert/strict');
const { searchReferences, createReferenceSearch } = require('../server/glyphs/references');

const iconifyAnswer = {
    icons: ['lucide:hot-tub', 'unknown:no-license'],
    collections: { lucide: { name: 'Lucide', author: { name: 'Lucide' }, license: { spdx: 'ISC', url: 'https://example.test/license' } } },
};

(async () => {
    // With an Exchange key the drafter reads the network's own icon search, not Iconify.
    {
        let requested, sent;
        const refs = await searchReferences('hot tub', { key: 'ovx_test', baseUrl: 'https://exchange.test', fetchImpl: async (url, opts) => {
            requested = new URL(url); sent = opts;
            return { ok: true, async json() { return { results: [
                { name: 'lucide:hot-tub', set: 'lucide', title: 'Lucide: hot tub', author: 'Lucide', license: 'ISC', license_url: 'https://example.test/license', url: 'https://cdn.test/lucide/hot-tub.svg' },
                { name: 'unknown:no-license', set: 'unknown', license: null },
            ] }; } };
        } });
        assert.equal(requested.origin, 'https://exchange.test');
        assert.equal(requested.pathname, '/v1/search/icons');
        assert.equal(sent.method, 'POST');
        assert.equal(sent.headers.authorization, 'Bearer ovx_test');
        assert.deepEqual(JSON.parse(sent.body), { q: 'hot tub', limit: 5 });
        assert.deepEqual(refs, [{ name: 'hot-tub', set: 'lucide', setName: 'hot tub', author: 'Lucide', license: 'ISC',
            source: 'exchange', licenseUrl: 'https://example.test/license', preview: 'https://cdn.test/lucide/hot-tub.svg' }]);
    }
    // Without a key but with a Network service token, Exchange answers with that token and names the source.
    {
        let requested, sent, minted = 0;
        const refs = await searchReferences('hot tub', { key: '', baseUrl: 'https://exchange.test', getToken: async () => {
            minted += 1; return 'svc_design';
        }, fetchImpl: async (url, opts) => {
            requested = new URL(url); sent = opts;
            return { ok: true, async json() { return { results: [
                { name: 'lucide:hot-tub', set: 'lucide', title: 'Lucide: hot tub', author: 'Lucide', license: 'ISC', url: 'https://cdn.test/lucide/hot-tub.svg' },
            ] }; } };
        } });
        assert.equal(minted, 1);
        assert.equal(requested.pathname, '/v1/search/icons');
        assert.equal(sent.headers.authorization, 'Bearer svc_design');
        assert.equal(refs[0].source, 'exchange');
    }
    // Without either it keeps Iconify as the fallback, with the same attribution and the same licence filter.
    {
        let requested;
        const refs = await searchReferences('hot tub', { key: '', fetchImpl: async (url) => {
            requested = new URL(url);
            return { ok: true, async json() { return iconifyAnswer; } };
        } });
        assert.equal(requested.pathname, '/search');
        assert.equal(requested.searchParams.get('query'), 'hot tub');
        assert.deepEqual(refs, [{ name: 'hot-tub', set: 'lucide', setName: 'Lucide', author: 'Lucide', license: 'ISC',
            source: 'iconify', licenseUrl: 'https://example.test/license', preview: 'https://api.iconify.design/lucide/hot-tub.svg' }]);
    }
    // A token that cannot be minted (Network down) does not stop a draft: the fallback answers.
    {
        let calls = 0;
        const refs = await searchReferences('hot tub', { key: '', getToken: async () => { throw new Error('no token'); }, fetchImpl: async (url) => {
            calls += 1;
            assert.equal(new URL(url).hostname, 'api.iconify.design');
            return { ok: true, async json() { return iconifyAnswer; } };
        } });
        assert.equal(calls, 1, 'the Iconify search carries its collections');
        assert.equal(refs[0].source, 'iconify');
    }
    // A configured Exchange that fails does not stop a draft: the fallback answers.
    {
        let calls = 0;
        const refs = await searchReferences('hot tub', { key: 'ovx_test', fetchImpl: async (url) => {
            calls += 1;
            if (new URL(url).hostname !== 'api.iconify.design') return { ok: false, status: 503 };
            return { ok: true, async json() { return iconifyAnswer; } };
        } });
        assert.equal(calls, 2, 'the failed Exchange call and the Iconify fallback');
        assert.equal(refs[0].source, 'iconify');
    }
    // The service's own search: a Network client-credentials token for exchange.search.icons, minted from its
    // OAuth client, and Exchange called with it. No Exchange key anywhere.
    {
        const calls = [];
        const fetchImpl = async (url, opts) => {
            calls.push({ url: String(url), opts });
            if (new URL(url).pathname === '/oauth/token') {
                return { ok: true, async json() { return { access_token: 'svc_design', expires_in: 300 }; } };
            }
            return { ok: true, async json() { return { results: [
                { name: 'lucide:hot-tub', set: 'lucide', title: 'Lucide: hot tub', author: 'Lucide', license: 'ISC', url: 'https://cdn.test/lucide/hot-tub.svg' },
            ] }; } };
        };
        const search = createReferenceSearch({
            config: {
                networkInternalUrl: 'https://network.test',
                oauth: { clientId: 'design', clientSecret: 's3cret' },
                exchange: { url: 'https://exchange.test', audience: 'openvibe.ai', scope: 'exchange.search.icons', timeoutMs: 1000 },
            },
            fetchImpl,
        });
        const refs = await search('hot tub', { limit: 3 });
        const token = calls.find((c) => new URL(c.url).pathname === '/oauth/token');
        assert.equal(token.url, 'https://network.test/oauth/token');
        const form = new URLSearchParams(String(token.opts.body));
        assert.equal(form.get('grant_type'), 'client_credentials');
        assert.equal(form.get('client_id'), 'design');
        assert.equal(form.get('audience'), 'openvibe.ai');
        assert.equal(form.get('scope'), 'exchange.search.icons');
        const exchange = calls.find((c) => new URL(c.url).pathname === '/v1/search/icons');
        assert.equal(exchange.url, 'https://exchange.test/v1/search/icons');
        assert.equal(exchange.opts.headers.authorization, 'Bearer svc_design');
        assert.equal(refs[0].source, 'exchange');
        // The token is cached: a second search does not mint another.
        await search('hot tub');
        assert.equal(calls.filter((c) => new URL(c.url).pathname === '/oauth/token').length, 1);
    }
    // EXCHANGE_SEARCH_KEY stays the override: with it set, no token is minted.
    {
        let tokens = 0, authorization;
        const search = createReferenceSearch({
            config: {
                oauth: { clientId: 'design', clientSecret: 's3cret' },
                exchange: { url: 'https://exchange.test', key: 'ovx_owner' },
            },
            fetchImpl: async (url, opts) => {
                if (new URL(url).pathname === '/oauth/token') { tokens += 1; throw new Error('must not mint'); }
                authorization = opts.headers.authorization;
                return { ok: true, async json() { return { results: [] }; } };
            },
        });
        await search('hot tub');
        assert.equal(tokens, 0);
        assert.equal(authorization, 'Bearer ovx_owner');
    }
    console.log('glyph references: Exchange by service token or key, Iconify fallback, attribution and source kept, unlicensed results filtered');
})().catch((err) => { console.error(err); process.exit(1); });
