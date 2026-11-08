'use strict';

const assert = require('node:assert/strict');
const { boot, check, done } = require('./helpers/boot');
const { testDb } = require('./helpers/db');
const { createFontCatalog, validFont, due, WEEK } = require('../server/fonts/catalog');
const seed = require('../server/fonts/seed.json');

(async () => {
    const t = await boot();
    try {
        await check('the seed contains only licensed families with source and downloadable files', () => {
            assert.equal(seed.length, 38);
            assert.ok(seed.every(validFont));
            assert.ok(seed.every(f => f.designer && f.version && f.source && f.sri));
            assert.deepEqual(new Set(seed.map(f => f.license)), new Set(['OFL-1.1', 'Apache-2.0', 'UFL-1.0']));
        });
        await check('font pages show live samples, every style, CSS, licence, download and pairings', async () => {
            const index = await t.get('/fonts');
            assert.equal(index.status, 200);
            assert.match(index.text, /Find a face for your idea/);
            assert.match(index.text, /data-font-sample/);
            assert.match(index.text, /fonts\/inter/);
            const detail = await t.get('/fonts/inter');
            assert.equal(detail.status, 200);
            for (const text of ['Every style', 'OFL-1.1', 'Download the regular WOFF2', 'aria-label="Download Inter 400 normal (WOFF2)"', 'More styles <span>(', 'A heading in ', '@font-face', 'Suggested pairings', 'SHA-384 integrity', 'integrity="sha384-']) assert.ok(detail.text.includes(text), text);
            assert.equal((await t.get('/fonts/no-such-family')).status, 404);
        });
        await check('the API filters by category, script and weight and rejects missing families', async () => {
            const all = await t.get('/api/v1/fonts');
            assert.equal(all.status, 200);
            assert.equal(all.json().count, 38);
            assert.ok(all.json().fonts.every(f => ['OFL-1.1', 'Apache-2.0', 'UFL-1.0'].includes(f.license)));
            const arabic = (await t.get('/api/v1/fonts?script=arabic&weight=400')).json().fonts;
            assert.ok(arabic.length && arabic.every(f => f.subsets.includes('arabic') && f.weights.includes(400)));
            const serif = (await t.get('/api/v1/fonts?category=serif')).json().fonts;
            assert.ok(serif.length && serif.every(f => f.category === 'serif'));
            const inter = (await t.get('/api/v1/fonts/inter')).json();
            assert.equal(inter.pairings.length, 3);
            assert.ok(inter.pairings.every(p => p.reason && p.id !== 'inter'));
            assert.equal((await t.get('/api/v1/fonts/no-such-family')).status, 404);
        });
        await check('MCP and llms.txt expose the catalogue', async () => {
            const mcp = await t.get('/mcp', { json: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
            assert.ok(mcp.json().result.tools.some(x => x.name === 'openvibe_design_get_font'));
            assert.ok((await t.get('/llms.txt')).text.includes('/api/v1/fonts'));
        });
    } finally { await t.close(); }

    await check('weekly refresh is database claimed and filters revoked licences', async () => {
        const test = await testDb();
        try {
            let time = Date.UTC(2026, 10, 8);
            let blocked = 'inter';
            const fakeFetch = async url => {
                if (url.startsWith('https://api.fontsource.org/')) {
                    const f = seed.find(x => url.endsWith(`/${x.id}`));
                    const variants = {};
                    for (const [key, link] of Object.entries(f.files)) {
                        const [weight, style] = key.split('-');
                        variants[weight] ||= {};
                        variants[weight][style] = { latin: { url: { woff2: link } } };
                    }
                    return { ok: true, json: async () => ({ ...f, license: f.id === blocked ? 'CC0-1.0' : f.license,
                        defSubset: 'latin', variants }) };
                }
                if (url.endsWith('/METADATA.pb')) return { ok: true, text: async () => 'designer: "Test Designer"\n' };
                return { ok: true, arrayBuffer: async () => Buffer.from('font bytes') };
            };
            const options = { db: test.db, fetchImpl: fakeFetch, now: () => time };
            const a = createFontCatalog(options), b = createFontCatalog(options);
            await a.seedMissing();
            assert.equal(due({ last_success_at: null, claimed_until: null }, time), true);
            assert.equal((await Promise.all([a.tick(), b.tick()])).filter(Boolean).length, 1);
            assert.equal((await a.list()).length, 37);
            assert.equal(await a.get(blocked), null);
            assert.equal(await a.tick(), false);
            await a.seedMissing();
            assert.equal(await a.get(blocked), null, 'restart seeding cannot restore a revoked licence');
            time += WEEK + 1;
            blocked = null;
            assert.equal(await b.tick(), true);
            assert.equal((await b.list()).length, 38);
        } finally { await test.close(); }
    });
    done();
})().catch(e => { console.error(e); process.exit(1); });
