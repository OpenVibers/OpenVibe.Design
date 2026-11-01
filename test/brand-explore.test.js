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
                assert.match(r.text, new RegExp(`<a class="mx-tab(?: mx-tab-side)?" role="tab" id="mx-tab-${tab}" href="#${tab}" aria-controls="${tab}"[^>]*><span class="mx-tab-art" data-mx-cycle="${tab}"><span class="mx-ta"><(svg|span)`), `the ${tab} tab shows an example`);
                assert.match(r.text, new RegExp(`<section class="mx-panel" id="${tab}" role="tabpanel"`));
            }
            assert.match(r.text, /<noscript><style>\.mx-panel\[hidden\]\{display:block!important\}<\/style><\/noscript>/, 'without the script every tab shows');
            assert.match(r.text, /<h1>The Loop or the Pair\?<\/h1>/, 'the top says the mark is between two');
            assert.match(r.text, /<span class="mx-qn">1<\/span> The mark: <b>the Loop or the Pair\?<\/b>[\s\S]*?<span class="mx-or" aria-hidden="true">or<\/span>[\s\S]*?<span class="mx-qn">2<\/span> Separately: <b>the menu button&rsquo;s look<\/b>/, 'two questions: the mark, then separately the menu button');
            assert.ok((r.text.match(/<section class="mx-row">/g) || []).length >= 15, 'sorted into rows by idea');
            assert.match(r.text, /<meta name="robots" content="noindex, follow">/, 'proposals are not indexed');
            assert.match(r.text, /data-mx-mine hidden/, 'your picks wait for a pick');
            assert.ok(!/data-mx-bar/.test(r.text), 'no bar over the marks: a card is picked where it is');
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

        await check('picks are saved and counted: one ballot per person or browser, from this site only', async () => {
            const own = t.config.baseUrl.replace(/\/$/, '');
            const empty = (await t.get('/api/v1/brand/picks')).json();
            assert.deepStrictEqual([empty.tally.people, empty.mine], [0, []]);
            const guest = await t.get('/api/v1/brand/picks', { method: 'PUT', json: { picks: ['L03', 'P01', 'P17', 'M07', 'junk', 'L03'] }, origin: own });
            assert.strictEqual(guest.status, 200, guest.text);
            assert.deepStrictEqual(guest.json().mine, ['L03', 'M07', 'P01', 'P17'], 'only real codes, once each');
            const key = (guest.headers.get('set-cookie') || '').match(/ov_mx_voter=([^;]+)/);
            assert.ok(key && /HttpOnly/i.test(guest.headers.get('set-cookie')), 'a guest gets an httpOnly key');
            assert.ok(!(await t.dbDump()).includes(key[1]), 'the key itself is never stored');
            const again = await t.get('/api/v1/brand/picks', { method: 'PUT', json: { picks: ['L03'] }, origin: own, cookie: `ov_mx_voter=${key[1]}` });
            assert.deepStrictEqual(again.json().mine, ['L03'], 'the same browser replaces its picks');
            const ana = t.network.addUser('ana');
            const signed = (await t.get('/api/v1/brand/picks', { method: 'PUT', as: ana, json: { picks: ['P01', 'P02', 'M07'] }, origin: own })).json();
            assert.strictEqual(signed.tally.people, 2);
            assert.deepStrictEqual(signed.tally.lean, { loop: 1, pair: 1 });
            assert.deepStrictEqual(signed.tally.top.P.map((x) => x.code), ['P01', 'P02']);
            assert.deepStrictEqual(signed.tally.top.M, [{ code: 'M07', n: 1 }]);
            assert.deepStrictEqual((await t.get('/api/v1/brand/picks', { as: ana })).json().mine, ['M07', 'P01', 'P02'], 'a person sees their own picks');
            assert.strictEqual((await t.get('/api/v1/brand/picks', { method: 'PUT', json: { picks: ['L01'] }, origin: 'https://evil.example' })).status, 403, 'another site cannot cast a ballot');
            assert.strictEqual((await t.get('/api/v1/brand/picks', { method: 'PUT', json: { picks: ['L01'] } })).status, 403, 'nor a request that says nothing of where it came from');
            const page = await t.get('/brand/explore');
            assert.match(page.text, /<section class="mx-tally" data-mx-tally[\s\S]*?2 people have picked[\s\S]*?data-code="P01"/, 'the tally is at the top of the page');
        });

        await check('the steps bar and "where next" connect the two choices', async () => {
            const r = await t.get('/brand/explore');
            assert.match(r.text, /<nav class="mx-steps" data-mx-steps aria-label="Jump between the choices" hidden>/);
            for (const to of ['loop', 'pair', 'menu']) assert.ok(r.text.includes(`data-mx-go="${to}"`), to);
            assert.strictEqual((r.text.match(/<nav class="mx-next" aria-label="Where next">/g) || []).length, 3, 'each choice ends with where to go next');
            assert.strictEqual((r.text.match(/data-mx-cycle="/g) || []).length, 3, 'each tab example cycles through its fifty');
        });

        await check('the files at /brand/:file still answer', async () => {
            const r = await t.get('/brand/openvibe-mark.svg');
            assert.strictEqual(r.status, 200);
            assert.match(r.headers.get('content-type') || '', /image\/svg\+xml/);
        });
    } finally { await t.close(); }
    done();
})().catch((e) => { console.error(e); process.exit(1); });
