'use strict';
// Watch mode (plan §AD.25 item 12, server/review/watch.js): every OpenVibe site's home page held to the page audit once
// a day, its latest findings kept with the high ones new since the check before; /watch and /api/v1/watch show them.
//   node test/watch.test.js
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');
const { createWatch } = require('../server/review/watch');

const PAGE = (body) => `<html lang="en"><head><title>A site</title><meta name="viewport" content="width=device-width"></head><body><main><h1>Streams tonight</h1><p>Seven people are live right now, and more join every minute.</p>${body}</main></body></html>`;

(async () => {
    const t = await boot();
    try {
        const frame = { nav: [{ url: 'https://openvibe.alpha/' }, { url: 'https://openvibe.beta/x' }, { url: 'http://insecure.example/' }, { url: 'https://openvibe.alpha/again' }] };
        const fetchImpl = async (url) => (String(url).endsWith('/api/frame') ? new Response(JSON.stringify(frame), { status: 200, headers: { 'content-type': 'application/json' } }) : new Response('', { status: 404 }));
        let alpha = PAGE('');
        const pages = { 'https://openvibe.alpha/': () => alpha, 'https://openvibe.beta/': () => { throw Object.assign(new Error('x'), { detail: 'it answered 503' }); } };
        const read = async (url) => ({ url, html: pages[url]() });
        let clock = Date.parse('2026-11-18T01:00:00Z');
        const w = createWatch({ db: t.store.db, networkUrl: 'https://openvibe.network', fetchImpl, readPage: read, now: () => clock, log: { warn() {} } });

        await check('the first pass: each https site of the frame once, its findings kept, nothing marked new', async () => {
            const out = await w.tick();
            assert.deepStrictEqual(out.map((x) => [x.host, x.ok, x.high]), [['openvibe.alpha', true, 0], ['openvibe.beta', false, 0]]);
            assert.strictEqual(out[1].error, 'it answered 503');
            assert.strictEqual(await w.tick(), false, 'a day apart: the next hour does nothing');
        });

        await check('a day later a new high finding is marked new; the worst site comes first', async () => {
            clock += 25 * 60 * 60 * 1000;
            alpha = PAGE('<select id="x"><option>A</option></select><div class="spinner"></div>');
            await w.tick();
            const rows = await w.list();
            assert.deepStrictEqual(rows.map((r) => [r.host, r.high, r.new_high]), [['openvibe.alpha', 1, ['native-controls']], ['openvibe.beta', 0, []]]);
            assert.strictEqual(rows[0].findings[0].severity, 'high', 'findings worst first');
            assert.ok(rows[0].previous_at, 'the check before is named');
        });

        await check('/watch and /api/v1/watch show them', async () => {
            const api = await t.get('/api/v1/watch');
            assert.strictEqual(api.status, 200);
            assert.deepStrictEqual(api.json().sites.map((s) => s.host), ['openvibe.alpha', 'openvibe.beta']);
            const page = await t.get('/watch');
            assert.strictEqual(page.status, 200);
            assert.match(page.text, /Every site, held to the rules daily\./);
            assert.match(page.text, /openvibe\.alpha[\s\S]*1 new since/);
            assert.match(page.text, /The page could not be read: it answered 503\./);
        });
    } finally {
        await t.close();
    }
    done();
})();
