'use strict';
const assert = require('node:assert/strict');
const { searchReferences } = require('../server/glyphs/references');

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
            licenseUrl: 'https://example.test/license', preview: 'https://cdn.test/lucide/hot-tub.svg' }]);
    }
    // Without one it keeps Iconify as the fallback, with the same attribution and the same licence filter.
    {
        let requested;
        const refs = await searchReferences('hot tub', { key: '', fetchImpl: async (url) => {
            requested = new URL(url);
            return { ok: true, async json() { return {
                icons: ['lucide:hot-tub', 'unknown:no-license'],
                collections: { lucide: { name: 'Lucide', author: { name: 'Lucide' }, license: { spdx: 'ISC', url: 'https://example.test/license' } } },
            }; } };
        } });
        assert.equal(requested.pathname, '/search');
        assert.equal(requested.searchParams.get('query'), 'hot tub');
        assert.deepEqual(refs, [{ name: 'hot-tub', set: 'lucide', setName: 'Lucide', author: 'Lucide', license: 'ISC',
            licenseUrl: 'https://example.test/license', preview: 'https://api.iconify.design/lucide/hot-tub.svg' }]);
    }
    // A configured Exchange that fails does not stop a draft: the fallback answers.
    {
        let calls = 0;
        const refs = await searchReferences('hot tub', { key: 'ovx_test', fetchImpl: async (url) => {
            calls += 1;
            if (calls === 1) return { ok: false, status: 503 };
            return { ok: true, async json() { return { icons: ['lucide:hot-tub'], collections: { lucide: { name: 'Lucide', license: { spdx: 'ISC' } } } }; } };
        } });
        assert.equal(calls, 2);
        assert.equal(refs[0].name, 'hot-tub');
    }
    console.log('glyph references: Exchange first, Iconify fallback, attribution kept and unlicensed results filtered');
})().catch((err) => { console.error(err); process.exit(1); });
