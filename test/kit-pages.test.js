'use strict';
/**
 * openvibe.design/kit (plan L54 K3): every builder of openvibe-shared/kit has a part (or is a listed helper), every
 * sample draws, the code a page shows is exactly the code that drew it, a part's weight counts only its own rules,
 * and the pages: the index by group with still thumbnails, a part's page with its snippets, an unknown part is 404.
 */
const assert = require('assert');
const kit = require('openvibe-shared/kit');
const { PARTS, GROUPS, HELPERS, render } = require('../server/kit/parts');
const weight = require('../server/kit/weight');
const { pretty, still } = require('../server/views/kit');
const { boot, check, done } = require('./helpers/boot');

(async () => {
    await check('every builder is a part or a helper, and every sample draws', () => {
        const named = new Set([...PARTS.map((p) => p.fn), ...HELPERS.map(([c]) => c.replace(/^kit\.|\(.*$/g, '')), 'sidebarButton', 'withSidebar', 'sheetButton']);
        const missing = Object.keys(kit).filter((k) => typeof kit[k] === 'function' && !named.has(k));
        assert.deepStrictEqual(missing, [], 'a new builder in openvibe-shared needs a part on /kit');
        PARTS.forEach((p) => { assert.ok(render(p).length > 20, `${p.id} draws`); assert.ok(!p.error, `${p.id}: ${p.error}`); });
        assert.ok(PARTS.every((p) => GROUPS.some(([g]) => g === p.group)), 'every part is in a group');
        assert.strictEqual(new Set(PARTS.map((p) => p.id)).size, PARTS.length, 'ids are unique');
    });

    await check('the code a page shows, run as shown, returns the HTML it drew', () => {
        PARTS.forEach((p) => {
            const shown = pretty(p.code);
            assert.strictEqual(String(new Function('kit', `return (${shown});`)(kit)), render(p), `${p.id}: the shown code is the drawn code`);
        });
    });

    await check('a part weighs only its own rules', () => {
        const css = weight.rulesOf('.ovk-btn{a:1}.ovk-tool .ovk-btn{b:2}@media (x){.ovk-btn--quiet,.ovk-zz{c:3}}@keyframes k{from{x:1}}/* .ovk-btn{} */');
        assert.deepStrictEqual(css.map((r) => r.selector), ['.ovk-btn', '.ovk-tool .ovk-btn', '.ovk-btn--quiet,.ovk-zz']);
        const btn = weight.ofPart(render(PARTS.find((p) => p.id === 'button')));
        const tool = weight.ofPart(render(PARTS.find((p) => p.id === 'tool')));
        assert.ok(btn.rules > 0 && btn.brotli > 0 && btn.files.includes('kit.css'));
        assert.ok(tool.rules > btn.rules, 'the tool frame reaches more than a button');
        assert.strictEqual(weight.ofPart(render(PARTS.find((p) => p.id === 'num'))).bytes, 0, 'a number is text');
        assert.ok(weight.files().some((f) => f.file === 'kit.css' && f.brotli > 1000 && f.brotli < f.bytes));
    });

    await check('a thumbnail is still: no ids, labels or open tabs of its own', () => {
        const html = still('<div id="a"><label for="a">x</label><a aria-current="page" href="/">t</a><main>m</main></div>');
        assert.ok(!/\sid=|\sfor=|\saria-current=|<main/.test(html), html);
    });

    const t = await boot();
    try {
        await check('the index and a part\'s page', async () => {
            const index = await t.get('/kit');
            assert.strictEqual(index.status, 200);
            assert.strictEqual((index.text.match(/<li class="kt-tile/g) || []).length, PARTS.length, 'every part, drawn small');
            assert.strictEqual((index.text.match(/<a class="kt-tile-a" href="\/kit\/[a-z-]+">/g) || []).length, PARTS.length);
            const thumbs = index.text.match(/<div class="kt-thumb" aria-hidden="true" inert>[\s\S]*?<div class="kt-tile-t">/g) || [];
            assert.strictEqual(thumbs.length, PARTS.length);
            assert.ok(thumbs.every((th) => !/\sid="|\saria-current="/.test(th)), 'thumbnails carry no ids and no open tab');
            assert.ok(index.text.includes('href="https://openvibe.network/shared/kit.css"') || index.text.includes('https://openvibe.network/shared/kit.css'), 'the CDN');
            assert.match(index.text, /<nav class="kt-gnav" aria-label="Groups">/);
            assert.ok(index.text.includes('/shared/kit-data.css'), 'the data parts are drawn with their stylesheet');
            const part = await t.get('/kit/button');
            assert.strictEqual(part.status, 200);
            assert.match(part.text, /<h1>Button<\/h1>/);
            assert.match(part.text, /kit\.button\(\{ label: &#39;Go live&#39;/, 'the server line');
            assert.match(part.text, /OpenVibeKit\.button\(/, 'the page line');
            assert.match(part.text, /of CSS · \d+ rules/);
            assert.match(part.text, /href="\/components\?c=button&amp;p=android">Jetpack Compose/, 'native where it is');
            assert.match(part.text, /rel="next"><small>Next<\/small>Icon button/);
            assert.strictEqual((await t.get('/kit/nope')).status, 404);
            const lay = await t.get('/kit/layout');
            assert.strictEqual(lay.status, 200, 'the layout page, not a part called layout');
            assert.strictEqual((lay.text.match(/<section class="kt-prim" id="kt-l-/g) || []).length, 8, 'eight primitives');
            assert.strictEqual((lay.text.match(/class="kt-step"/g) || []).length, 8, 'eight type steps');
            assert.strictEqual((lay.text.match(/class="kt-space"/g) || []).length, 9, 'nine spaces');
            assert.match(lay.text, /<code>--step-0<\/code><small>16–18 px<\/small>/, 'sizes read from the release\'s own file');
            assert.match(lay.text, /<div class="ov-switcher" style="--min: 36rem">/, 'the real primitive, not a picture');
            assert.ok(lay.text.includes('/shared/kit-layout.css'), 'drawn with the file it documents');
            assert.match(index.text, /<a class="kt-layout-card" href="\/kit\/layout">/, 'the index leads to it');
            const page = await t.get('/kit/page');
            assert.strictEqual((page.text.match(/<main\b/g) || []).length, 1, 'the page sample is not a second <main>');
        });
    } finally { await t.close(); }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
