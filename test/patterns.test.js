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
        await check('the live demo assets are served', async () => {
            for (const asset of ['/js/pattern-kit.js', '/js/patterns.js', '/css/patterns.css']) {
                const res = await t.get(asset);
                assert.equal(res.status, 200, asset);
                assert.ok(res.text.length > 100, asset);
            }
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
