'use strict';
// /native (11-07): the road from the web to Android and iOS, without a frame. The page renders whole without
// JavaScript, links each shared layer, says every size class, every platform difference and every road step, is in
// the sitemap, and sits under the See door (its breadcrumb leads back).
const assert = require('node:assert/strict');
const { boot, check, done } = require('./helpers/boot');
const { LAYERS, CLASSES, PLATFORM, ROAD, CHECKLIST } = require('../server/views/native');
const { NAV } = require('../server/render/layout');

(async () => {
    const t = await boot();
    try {
        await check('the page says the whole road, with every layer linked', async () => {
            const r = await t.get('/native');
            assert.equal(r.status, 200);
            assert.match(r.text, /without a frame/);
            for (const l of LAYERS) assert.ok(r.text.includes(`href="${l.href}"`), `${l.name} is linked`);
            for (const c of CLASSES) assert.ok(r.text.includes(c.name) && r.text.includes(c.width), c.name);
            for (const [k] of PLATFORM) assert.ok(r.text.includes(`<dt>${k}</dt>`), k);
            for (const s of ROAD) assert.ok(r.text.includes(s.step), s.step);
            assert.equal((r.text.match(/<li>/g) || []).length >= CHECKLIST.length, true, 'the checklist');
            assert.ok(r.text.includes('/css/native.css'), 'its stylesheet');
            assert.ok(!/<script[^>]*native/.test(r.text), 'no page script: whole without JavaScript');
        });
        await check('it is in the sitemap and under the See door', async () => {
            const map = await t.get('/sitemap.xml');
            assert.match(map.text, /\/native</);
            const page = await t.get('/native');
            assert.match(page.text, /<a href="\/see">See<\/a>[\s\S]*?aria-current="page">Native</, 'its breadcrumb is See › Native');
            assert.ok(NAV.some((l) => l.href === '/see'), 'See is a door in the bar');
            const css = await t.get('/css/native.css');
            assert.equal(css.status, 200);
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
