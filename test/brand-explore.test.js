'use strict';
/**
 * /brand/explore: a hundred takes on the two OpenVibe marks for feedback (the owner, 2026-11-01). Fifty Loops and
 * fifty Pairs, each numbered and pickable, each drawn large and at 16 and 32 px on dark and light; the page is not
 * indexed (they are proposals, not the mark), and /brand/:file still serves the SVG files.
 */
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');

(async () => {
    const t = await boot();
    try {
        await check('a hundred numbered marks, fifty of each, every one pickable', async () => {
            const r = await t.get('/brand/explore');
            assert.strictEqual(r.status, 200);
            const codes = [...r.text.matchAll(/<li class="mx-card" id="([LP]\d{2})" data-code="\1">/g)].map((m) => m[1]);
            assert.strictEqual(codes.length, 100);
            assert.strictEqual(new Set(codes).size, 100, 'each number once');
            assert.strictEqual(codes.filter((c) => c[0] === 'L').length, 50);
            assert.strictEqual(codes.filter((c) => c[0] === 'P').length, 50);
            assert.ok(codes.every((c) => r.text.includes(`data-pick="${c}"`)), 'each has its Pick button');
            assert.match(r.text, /<meta name="robots" content="noindex, follow">/, 'proposals are not indexed');
            assert.match(r.text, /data-mx-bar hidden/, 'the picks bar waits for a pick');
            const ids = [...r.text.matchAll(/<(?:linearGradient|mask) id="([^"]+)"/g)].map((m) => m[1]);
            assert.strictEqual(new Set(ids).size, ids.length, 'every gradient and mask id is unique on the page');
        });
        await check('the files at /brand/:file still answer', async () => {
            const r = await t.get('/brand/openvibe-mark.svg');
            assert.strictEqual(r.status, 200);
            assert.match(r.headers.get('content-type') || '', /image\/svg\+xml/);
        });
    } finally { await t.close(); }
    done();
})().catch((e) => { console.error(e); process.exit(1); });
