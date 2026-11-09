'use strict';
const assert = require('node:assert/strict');
const { searchReferences } = require('../server/glyphs/references');

(async () => {
    let requested;
    const refs = await searchReferences('hot tub', { fetchImpl: async (url) => {
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
    console.log('glyph references: Iconify search keeps attribution and filters unlicensed results');
})().catch((err) => { console.error(err); process.exit(1); });
