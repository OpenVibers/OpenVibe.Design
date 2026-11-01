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
            const want = { Loop: 72, Pair: 60, menu: 50 }[name];
            assert.strictEqual(list.length, want, `${name}: ${want}`);
            const recipes = list.map((x) => JSON.stringify(x.slice(2)));
            assert.strictEqual(new Set(recipes).size, want, `${name}: every recipe differs`);
            assert.strictEqual(new Set(list.map((x) => x[0])).size, want, `${name}: every name differs`);
        }
    });

    const t = await boot();
    try {
        await check('three tabs, a hundred and fifty numbered cards in rows, every one pickable', async () => {
            const r = await t.get('/brand/explore');
            assert.strictEqual(r.status, 200);
            const codes = [...r.text.matchAll(/<li class="mx-card(?: mb-card| fx-card| mx-wild)?" id="([LPMFW]\d{2})" data-code="\1"/g)].map((m) => m[1]);
            assert.strictEqual(codes.length, 234);
            assert.strictEqual(new Set(codes).size, 234, 'each number once');
            assert.deepStrictEqual(['L', 'P', 'W', 'M', 'F'].map((k) => codes.filter((c) => c[0] === k).length), [72, 60, 40, 50, 12], 'the Wildcards: forty other ideas (the owner, 11-01)');
            assert.ok(codes.every((c) => r.text.includes(`data-pick="${c}"`)), 'each has its Pick button');
            for (const tab of ['loop', 'pair', 'wild', 'menu', 'font']) {
                assert.match(r.text, new RegExp(`<a class="mx-tab(?: mx-tab-side)?" role="tab" id="mx-tab-${tab}" href="#${tab}" aria-controls="${tab}"[^>]*><span class="mx-tab-art" data-mx-cycle="${tab}"><span class="mx-ta"><(svg|span)`), `the ${tab} tab shows an example`);
                assert.match(r.text, new RegExp(`<section class="mx-panel" id="${tab}" role="tabpanel"`));
            }
            assert.match(r.text, /<noscript><style>\.mx-panel\[hidden\]\{display:block!important\}<\/style><\/noscript>/, 'without the script every tab shows');
            assert.match(r.text, /<h1>Which logo should OpenVibe use\?<\/h1>\n<p class="mx-lede">Tap every logo you like: the Loop, the Pair and\/or the Wildcards, any mix\. Then pick a menu button and a font\. Votes count right away\.<\/p>/, 'the top says it simply');
            assert.match(r.text, /<span class="mx-qn">1<\/span> <b>Pick a logo<\/b>[\s\S]*?<span class="mx-or" aria-hidden="true">\+<\/span>[\s\S]*?<span class="mx-qn">2<\/span> <b>Pick a menu button<\/b>[\s\S]*?<span class="mx-qn">3<\/span> <b>Pick a font<\/b>/, 'three steps: a logo, a menu button, a font');
            assert.ok((r.text.match(/<section class="mx-row">/g) || []).length >= 15, 'sorted into rows by idea');
            assert.match(r.text, /<meta name="robots" content="noindex, follow">/, 'proposals are not indexed');
            assert.match(r.text, /data-mx-mine hidden/, 'your picks wait for a pick');
            assert.ok(!/data-mx-bar/.test(r.text), 'no bar over the marks: a card is picked where it is');
            assert.ok(!/data-mx-tools|data-mx-set-site|data-mx-own/.test(r.text), 'no per-site picker: one example name');
            assert.match(r.text, /<div class="mx-nudge" data-mx-nudge role="status" hidden>/, 'a nudge to step 2 waits for the first pick');
            assert.match(r.text, /<span class="mx-stepn" aria-hidden="true">1<\/span>[\s\S]*?<span class="mx-stepn" aria-hidden="true">2<\/span>[\s\S]*?<span class="mx-stepn" aria-hidden="true">3<\/span>/, 'the steps bar numbers the three steps');
            assert.strictEqual((r.text.match(/<div class="mx-stephead">/g) || []).length, 5, 'each section opens with its step');
        });

        await check('each mark beside a site\'s name and small, reusing one drawing; every id unique', async () => {
            const r = await t.get('/brand/explore');
            assert.match(r.text, /<div class="mx-lock"><svg viewBox="0 0 100 100" width="26" height="26" aria-hidden="true"><use href="#art-L01"\/><\/svg><span class="mx-word"><b>OpenVibe<\/b><span class="mx-sep">\.<\/span><span class="mx-site">Chat<\/span><\/span><\/div>/);
            assert.match(r.text, /<use href="#art-P60"\/>/);
            assert.match(r.text, /<li class="mx-card" id="L72"/, 'the outside-the-box row ends the Loops');
            const ids = [...r.text.matchAll(/<(?:linearGradient|radialGradient|mask|filter|clipPath|g) id="([^"]+)"/g)].map((m) => m[1]);
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
            const wide = await t.get('/api/v1/brand/picks', { method: 'PUT', json: { picks: ['L72', 'P60', 'F12'] }, origin: own, cookie: `ov_mx_voter=${key[1]}` });
            assert.deepStrictEqual(wide.json().mine, ['F12', 'L72', 'P60'], 'the new takes and the fonts save (migration 0006)');
            const again = await t.get('/api/v1/brand/picks', { method: 'PUT', json: { picks: ['L03'] }, origin: own, cookie: `ov_mx_voter=${key[1]}` });
            assert.deepStrictEqual(again.json().mine, ['L03'], 'the same browser replaces its picks');
            const ana = t.network.addUser('ana');
            const signed = (await t.get('/api/v1/brand/picks', { method: 'PUT', as: ana, json: { picks: ['P01', 'P02', 'M07'] }, origin: own })).json();
            assert.strictEqual(signed.tally.people, 2);
            assert.deepStrictEqual(signed.tally.lean, { loop: 1, pair: 1, wild: 0, both: 0 });
            // Picking from both families counts for both (the owner, 11-01: "a combination is fine… gauge all of it").
            const bea = t.network.addUser('bea');
            const mixed = (await t.get('/api/v1/brand/picks', { method: 'PUT', as: bea, json: { picks: ['L03', 'L40', 'P02'] }, origin: own })).json();
            assert.deepStrictEqual(mixed.tally.lean, { loop: 2, pair: 2, wild: 0, both: 1 }, 'two Loop takes and one Pair take: one person for each, and one who likes more than one kind');
            const cal = t.network.addUser('cal');
            const wild = (await t.get('/api/v1/brand/picks', { method: 'PUT', as: cal, json: { picks: ['W13', 'W40', 'P02'] }, origin: own })).json();
            assert.deepStrictEqual(wild.mine, ['P02', 'W13', 'W40'], 'the Wildcards save (migration 0007)');
            assert.deepStrictEqual(wild.tally.lean, { loop: 2, pair: 3, wild: 1, both: 2 });
            assert.deepStrictEqual(wild.tally.top.W.map((x) => x.code), ['W13', 'W40']);
            assert.deepStrictEqual(mixed.tally.top.P.map((x) => [x.code, x.n]), [['P02', 2], ['P01', 1]], 'the Pair take shows in the results');
            assert.deepStrictEqual(mixed.tally.all.map((x) => x.code).sort(), ['L03', 'L40', 'M07', 'P01', 'P02'], 'every take that has a vote, for the next round');
            assert.deepStrictEqual(signed.tally.top.P.map((x) => x.code), ['P01', 'P02']);
            assert.deepStrictEqual(signed.tally.top.M, [{ code: 'M07', n: 1 }]);
            assert.deepStrictEqual((await t.get('/api/v1/brand/picks', { as: ana })).json().mine, ['M07', 'P01', 'P02'], 'a person sees their own picks');
            assert.strictEqual((await t.get('/api/v1/brand/picks', { method: 'PUT', json: { picks: ['L01'] }, origin: 'https://evil.example' })).status, 403, 'another site cannot cast a ballot');
            assert.strictEqual((await t.get('/api/v1/brand/picks', { method: 'PUT', json: { picks: ['L01'] } })).status, 403, 'nor a request that says nothing of where it came from');
            const page = await t.get('/brand/explore');
            assert.match(page.text, /<section class="mx-tally" data-mx-tally[\s\S]*?4 people<\/span>[\s\S]*?data-code="P0[12]"/, 'the tally is at the top of the page');
            assert.match(page.text, /<p class="mx-both" data-mx-both>2 people like more than one kind<\/p>/);
            assert.match(page.text, /<span class="mx-s3 mx-s3-w">[\s\S]*?Wild <b data-mx-wild>1<\/b>/, 'the bar counts the three kinds');
            assert.match(page.text, /<span class="mx-tops-k">Wild<\/span><span class="mx-tops-list" data-mx-tops-w>/);
            assert.match(page.text, /<span class="mx-tops-k">Loop<\/span><span class="mx-tops-list" data-mx-tops-l>[\s\S]*?<span class="mx-tops-k">Pair<\/span><span class="mx-tops-list" data-mx-tops-p>/, 'the Loop and the Pair on rows of their own');
            assert.match(page.text, /<details class="mx-all" data-mx-all><summary>Every vote <span data-mx-all-n>7 takes<\/span>/, 'every vote, open to anyone');
            const js = require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'js', 'marks.js'), 'utf8');
            assert.match(js, /function navPreview\(\)/, 'the site\'s own bar wears the picks while the page is open');
        });

        await check('the steps bar and "where next" connect the two choices', async () => {
            const r = await t.get('/brand/explore');
            assert.match(r.text, /<nav class="mx-steps" data-mx-steps aria-label="Jump between the choices" hidden>/);
            for (const to of ['loop', 'pair', 'wild', 'menu', 'font']) assert.ok(r.text.includes(`data-mx-go="${to}"`), to);
            assert.strictEqual((r.text.match(/<nav class="mx-next" aria-label="Where next">/g) || []).length, 5, 'each choice ends with where to go next');
            assert.strictEqual((r.text.match(/data-mx-cycle="/g) || []).length, 5, 'each tab has its example');
            // Each wildcard moves its own way, attaches the name its own way, and shows itself as a status.
            const wilds = r.text.match(/<li class="mx-card mx-wild" id="W\d\d"[\s\S]*?<\/li>/g) || [];
            assert.strictEqual(wilds.length, 40);
            assert.strictEqual(new Set(wilds.map((c) => /data-wild="([a-z]+)"/.exec(c)[1])).size, 40, 'forty different ideas');
            assert.ok(wilds.every((c) => /<div class="mx-lock lk-(side|pill|under|bubble|stack|tag|trail)">/.test(c)), 'a lockup each');
            assert.ok(wilds.every((c) => /class="[^"]*\bw-k\b/.test(c)), 'a key part each, for the live status');
            assert.ok(wilds.every((c) => /data-st="live"[\s\S]*data-st="new"/.test(c)), 'the live and new slots');
            assert.ok(new Set(wilds.map((c) => /lk-([a-z]+)/.exec(c)[1])).size >= 6, 'the name attaches in several ways');
            const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'css', 'marks.css'), 'utf8');
            const { KEYS } = require('../server/views/wild-marks');
            assert.deepStrictEqual(KEYS.filter((k) => !css.includes(`svg[data-wild=${k}]`) && !css.includes(`svg[data-wild=${k}],`)), [], 'every idea has its motion');
        });

        await check('the files at /brand/:file still answer', async () => {
            const r = await t.get('/brand/openvibe-mark.svg');
            assert.strictEqual(r.status, 200);
            assert.match(r.headers.get('content-type') || '', /image\/svg\+xml/);
        });
    } finally { await t.close(); }
    done();
})().catch((e) => { console.error(e); process.exit(1); });
