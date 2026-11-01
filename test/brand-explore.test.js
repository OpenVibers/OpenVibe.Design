'use strict';
/**
 * /brand/explore: help choose the OpenVibe mark (the owner, 2026-11-01). Three tabs, each showing what it holds:
 * fifty Loops, fifty Pairs and fifty menu buttons, sorted into rows by idea, each numbered and pickable. Every mark is
 * drawn large, beside a site's name, and at 16 and 32 px; the small copies reuse the large drawing. The page is not
 * indexed (they are proposals, not the mark); without the script every tab still shows; /brand/:file still serves.
 */
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');
const explore = require('../server/views/marks-explore');

(async () => {
    await check('fifty distinct takes in each family: no two share their whole recipe', () => {
        for (const [name, list] of [['Loop', explore.LOOPS], ['Pair', explore.PAIRS], ['menu', explore.MENUS]]) {
            assert.strictEqual(list.length, 50, `${name}: fifty`);
            const recipes = list.map((x) => JSON.stringify(x.slice(2)));
            assert.strictEqual(new Set(recipes).size, 50, `${name}: every recipe differs`);
            assert.strictEqual(new Set(list.map((x) => x[0])).size, 50, `${name}: every name differs`);
        }
    });

    const t = await boot();
    try {
        await check('three tabs, a hundred and fifty numbered cards in rows, every one pickable', async () => {
            const r = await t.get('/brand/explore');
            assert.strictEqual(r.status, 200);
            const codes = [...r.text.matchAll(/<li class="mx-card(?: mb-card)?" id="([LPM]\d{2})" data-code="\1"/g)].map((m) => m[1]);
            assert.strictEqual(codes.length, 150);
            assert.strictEqual(new Set(codes).size, 150, 'each number once');
            for (const k of 'LPM') assert.strictEqual(codes.filter((c) => c[0] === k).length, 50, k);
            assert.ok(codes.every((c) => r.text.includes(`data-pick="${c}"`)), 'each has its Pick button');
            for (const tab of ['loop', 'pair', 'menu']) {
                assert.match(r.text, new RegExp(`<a class="mx-tab(?: mx-tab-side)?" role="tab" id="mx-tab-${tab}" href="#${tab}" aria-controls="${tab}"[^>]*><span class="mx-tab-art"><(svg|span)`), `the ${tab} tab shows an example`);
                assert.match(r.text, new RegExp(`<section class="mx-panel" id="${tab}" role="tabpanel"`));
            }
            assert.match(r.text, /<noscript><style>\.mx-panel\[hidden\]\{display:block!important\}<\/style><\/noscript>/, 'without the script every tab shows');
            assert.match(r.text, /<h1>The Loop or the Pair\?<\/h1>/, 'the top says the mark is between two');
            assert.match(r.text, /<span class="mx-qn">1<\/span> The mark: <b>the Loop or the Pair\?<\/b>[\s\S]*?<span class="mx-or" aria-hidden="true">or<\/span>[\s\S]*?<span class="mx-qn">2<\/span> Separately: <b>the menu button&rsquo;s look<\/b>/, 'two questions: the mark, then separately the menu button');
            assert.ok((r.text.match(/<section class="mx-row">/g) || []).length >= 15, 'sorted into rows by idea');
            assert.match(r.text, /<meta name="robots" content="noindex, follow">/, 'proposals are not indexed');
            assert.match(r.text, /data-mx-bar hidden/, 'the picks bar waits for a pick');
            assert.match(r.text, /data-mx-tools hidden/, 'the name and font bar waits for the script');
        });

        await check('each mark beside a site\'s name and small, reusing one drawing; every id unique', async () => {
            const r = await t.get('/brand/explore');
            assert.match(r.text, /<div class="mx-lock"><svg viewBox="0 0 100 100" width="26" height="26" aria-hidden="true"><use href="#art-L01"\/><\/svg><span class="mx-word"><b>OpenVibe<\/b><span class="mx-sep">\.<\/span><span class="mx-site" data-mx-site>Live<\/span><\/span><\/div>/);
            assert.match(r.text, /<use href="#art-P50"\/>/);
            const ids = [...r.text.matchAll(/<(?:linearGradient|mask|filter|clipPath|g) id="([^"]+)"/g)].map((m) => m[1]);
            assert.strictEqual(new Set(ids).size, ids.length, 'every gradient, mask and drawing id is unique on the page');
            const refs = [...r.text.matchAll(/(?:href="#|url\(#)([^")]+)/g)].map((m) => m[1]).filter((x) => /^(art-|m\d|x)/.test(x));
            assert.ok(refs.every((x) => ids.includes(x)), 'every reference has its target');
            assert.match(r.text, /data-mb aria-pressed="false"/, 'the menu buttons can be pressed');
            assert.ok(!/class="mx-s[^"]*"[^>]*class=/.test(r.text), 'no element carries two class attributes');
        });

        await check('the files at /brand/:file still answer', async () => {
            const r = await t.get('/brand/openvibe-mark.svg');
            assert.strictEqual(r.status, 200);
            assert.match(r.headers.get('content-type') || '', /image\/svg\+xml/);
        });
    } finally { await t.close(); }
    done();
})().catch((e) => { console.error(e); process.exit(1); });
