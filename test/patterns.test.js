'use strict';
const assert = require('node:assert/strict');
const { boot, check, done } = require('./helpers/boot');
const { patterns, TOKENS, nativeSpecs, esc } = require('../server/patterns/catalog');

(async () => {
    const t = await boot();
    try {
        await check('every production pattern page renders a live demo and generated native specs', async () => {
            const index = await t.get('/patterns');
            assert.equal(index.status, 200);
            for (const pattern of patterns) {
                const res = await t.get(`/patterns/${pattern.slug}`);
                assert.equal(res.status, 200, pattern.slug);
                assert.ok(res.text.includes(`data-pattern-demo="${pattern.slug}"`), `${pattern.slug} demo`);
                assert.ok(res.text.includes(pattern.bug), `${pattern.slug} dated bug`);
                const spec = nativeSpecs(pattern);
                assert.ok(res.text.includes(esc(spec.swift)), `${pattern.slug} generated SwiftUI`);
                assert.ok(res.text.includes(esc(spec.compose)), `${pattern.slug} generated Compose`);
                for (const key of pattern.tokens) assert.ok(res.text.includes(esc(TOKENS[key].path)), `${pattern.slug} token ${key}`);
            }
        });
        await check('the copied mark-studies demo includes all five studies', async () => {
            const res = await t.get('/patterns/mark/studies');
            assert.equal(res.status, 200);
            for (const name of ['Ribbon', 'Breadcrumb', 'Porthole', 'Liquid', 'Seal']) assert.ok(res.text.includes(name), name);
        });
        await check('the one-menu pattern draws the menu button at the top of the page, not the old burger', async () => {
            const res = await t.get('/patterns/one-menu');
            assert.equal(res.status, 200);
            assert.ok(res.text.includes('The menu button at the top of the page'), 'the rule names the button');
            assert.ok(!/burger/i.test(res.text), 'no burger in the rule');
            const js = await t.get('/js/patterns.js');
            assert.ok(js.text.includes('window.OpenVibeOrb ? window.OpenVibeOrb.svg(20, open)'), 'drawn by the shared orb');
            assert.ok(js.text.includes('x="4" y="5.2" width="16" height="5.6"'), 'the inline fallback is the same shapes');
            assert.ok(!js.text.includes('☰'), 'no three-line button');
        });
        await check('the live demo assets are served', async () => {
            for (const asset of ['/js/pattern-kit.js', '/js/patterns.js', '/css/patterns.css']) {
                const res = await t.get(asset);
                assert.equal(res.status, 200, asset);
                assert.ok(res.text.length > 100, asset);
            }
        });
        await check('filled pattern pill actions use the Shared on-accent text token', async () => {
            const res = await t.get('/css/patterns.css');
            assert.equal(res.status, 200);
            assert.match(res.text, /\.opill\.primary\{[^}]*color:var\(--on-accent\)/);
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
