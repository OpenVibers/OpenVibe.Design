'use strict';
// /create never waits on a slow model catalogue again (11-28: the first visit after the five-minute copy expired waited
// 26 s). An expired copy answers at once and the next is read behind it, one read at a time; with no copy yet the page
// waits at most firstWaitMs and goes on without models while the read finishes and fills the copy.
const assert = require('assert');
const { createCreateOptions } = require('../server/create/options');

const route = { provider: 'deepseek', model: 'deepseek-chat' };
const doc = (name) => ({ models: [{ slug: 'deepseek-chat', name, kind: 'chat', offers: [{ provider: 'deepseek', model: 'deepseek-chat', price_in: 0.27, price_out: 1.1 }] }] });

// The fake slow read holds nothing open (in the service the server does): keep the test alive, and fail if it ends early.
const alive = setInterval(() => {}, 1000);
let finished = false;
process.on('exit', (code) => { if (!finished && code === 0) { console.error('create-fast: ended before its last check'); process.exitCode = 1; } });

(async () => {
    let clock = 1_000_000;
    let release = null;
    let reads = 0;
    let slow = false;
    let name = 'DeepSeek Chat';
    const ai = {
        offeredModels: async () => [route],
        exchangeCatalog: async () => { reads++; if (slow) await new Promise((r) => { release = r; }); return doc(name); },
    };
    const o = createCreateOptions({ ai, catalog: { list: async () => ({ themes: [] }) }, log: { warn() {} }, now: () => clock, firstWaitMs: 150 });

    const first = await o.modelCatalogue();
    assert.ok(first.length >= 1, 'a quick first read is used');
    const firstName = first[0].name;
    console.log('  ✓ a quick first read fills the page and the copy');

    // Expired, and the next read is slow: the page gets the copy at once; one read runs behind it, whoever asks.
    clock += 6 * 60_000; slow = true; name = 'DeepSeek Chat (new)';
    const t0 = Date.now();
    const stale = await o.modelCatalogue();
    const again = await o.modelCatalogue();
    assert.ok(Date.now() - t0 < 100, `the expired copy answers at once (${Date.now() - t0} ms)`);
    assert.strictEqual(stale[0].name, firstName);
    assert.strictEqual(again[0].name, firstName);
    assert.strictEqual(reads, 2, 'one read behind the copy, not one per page');
    release();
    await new Promise((r) => setImmediate(r));
    const fresh = await o.modelCatalogue();
    assert.strictEqual(fresh[0].name, 'DeepSeek Chat (new)', 'the read behind it fills the copy');
    console.log('  ✓ an expired copy answers at once; one read refreshes it behind the page');

    // No copy at all and a slow read: the page waits firstWaitMs, goes on without models, and the read still fills the copy.
    o.clear(); reads = 0; slow = true; name = 'DeepSeek Chat (later)';
    const t1 = Date.now();
    const none = await o.modelCatalogue();
    const waited = Date.now() - t1;
    assert.deepStrictEqual(none, []);
    assert.ok(waited >= 120 && waited < 1000, `waited about firstWaitMs (${waited} ms)`);
    release();
    await new Promise((r) => setImmediate(r));
    assert.strictEqual((await o.modelCatalogue())[0].name, 'DeepSeek Chat (later)');
    console.log('  ✓ with no copy, the page waits a moment at most and the late read still fills the copy');
    console.log('create-fast: all passed');
    finished = true;
    clearInterval(alive);
})().catch((e) => { console.error(e); process.exit(1); });
