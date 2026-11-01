'use strict';
// /loading (plan L52 step 5): how OpenVibe waits, every part live and copyable. The placeholders are in the first HTML
// (as anywhere), each with its real content of the same shape; the page loads the shared loader; it is in the menu,
// the sitemap and llms.txt.
const assert = require('node:assert/strict');
const { boot, check, done } = require('./helpers/boot');
const { SHAPES } = require('../server/views/loading');

(async () => {
    const t = await boot();
    try {
        await check('the page: seven shapes in the first HTML, each with its real content and Fill in; the loader; the rules', async () => {
            const r = await t.get('/loading');
            assert.equal(r.status, 200);
            const html = r.text;
            assert.deepEqual(SHAPES.map(([k]) => k), ['card', 'row', 'tile', 'chip', 'line', 'chat', 'stat']);
            SHAPES.forEach(([kind]) => {
                assert.match(html, new RegExp(`<div class="ovk-skels ovk-skels-${kind}" role="status" aria-busy="true"`), `${kind}: its placeholder, server-rendered`);
                assert.match(html, new RegExp(`<template data-ld-real><div class="ovk-skels ovk-skels-${kind}">`), `${kind}: its real content`);
            });
            assert.equal((html.match(/data-ld-fill aria-pressed="false">Fill in</g) || []).length, 7);
            assert.match(html, /\/shared\/loading\.js/, 'the shared loader');
            assert.match(html, /\/js\/loading-page\.js/);
            assert.ok(html.includes('data-ld-do="start"') && html.includes('data-ld-busy'));
            assert.ok(html.includes('Nothing spins.') && html.includes('content-visibility: auto'), 'the rules');
            assert.ok(!/fa-spin|class="[^"]*spinner/i.test(html), 'no spinner anywhere');
        });
        await check('the page script: Fill in measures the move, the loader runs its states, the navbar shows busy', async () => {
            const js = require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'js', 'loading-page.js'), 'utf8');
            assert.match(js, /const moved = Math\.round\(Math\.abs\(stage\.getBoundingClientRect\(\)\.height - before\) \* 10\) \/ 10;/, 'how far the page moved');
            ['update(', 'slow(', 'fail(', 'done()'].forEach((m) => assert.ok(js.includes(`loader.${m}`), m));
            assert.match(js, /window\.OpenVibeLoading\.mount\(screen/);
            assert.match(js, /nav\.busy\(true\)[\s\S]*nav\.busy\(false\)/);
        });
        await check('found: the menu, the sitemap and llms.txt', async () => {
            assert.ok((await t.get('/')).text.includes('/loading'), 'the menu');
            assert.ok((await t.get('/sitemap.xml')).text.includes('https://openvibe.design/loading'));
            assert.ok((await t.get('/llms.txt')).text.includes('/loading'));
        });
    } finally {
        await done(t);
    }
})();
