'use strict';
// /icons: the OpenVibe glyphs (plan L32, 2026-10-31). The page shows every glyph with the Font Awesome names it stands
// for and is whole without JavaScript; each glyph is a standalone SVG anyone may fetch; the registry is data; a signed-in
// person asks OpenVibe.AI for drafts, which pass the validator before they are kept; only an admin reviews them, and
// only approved drafts are public.
const assert = require('node:assert/strict');
const { boot, check, done } = require('./helpers/boot');
const glyphs = require('openvibe-shared/glyphs');
const { clean } = require('../server/glyphs/validate');
const { stillFontAwesome } = require('../server/views/icons');

const ORIGIN = 'https://openvibe.design';
const asked = [];
let answer = '';
const ai = {
    enabled: true,
    text: async (req) => { asked.push(req); return { text: answer, provider: 'fake', model: 'fake-draw-1', run_id: 'run_1' }; },
    slotPlan: async () => ({ slots: [] }),
};
const form = (fields) => ({ body: new URLSearchParams(fields).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' } });

(async () => {
    const t = await boot({ ai });
    const ana = t.network.addUser('ana');
    const boss = t.network.addUser('boss', { role: 'admin' });
    try {
        await check('the page shows every glyph with its Font Awesome names, the finder and the sheet', async () => {
            const res = await t.get('/icons');
            assert.equal(res.status, 200);
            const html = res.text;
            assert.ok(html.includes('<h1 class="ic-h1">One hand for every icon.</h1>'), 'its heading');
            assert.equal((html.match(/class="ic-tile"/g) || []).length, glyphs.NAMES.length, 'one tile a glyph');
            const eye = Object.entries(glyphs.FA).filter(([, g]) => g === 'eye').map(([fa]) => fa);
            assert.ok(eye.length && html.includes(`data-name="eye" data-fa="${eye.join(' ')}"`), 'a tile carries its Font Awesome names for the search');
            assert.ok(html.includes(`<path d="${glyphs.path('eye').match(/d="([^"]+)"/)[1]}"`), 'the glyph is drawn on the server');
            assert.ok(html.includes('data-ic-tools hidden'), 'the finder waits for the script');
            assert.ok(html.includes('<dialog class="ic-sheet" data-ic-sheet'), 'the one-glyph sheet');
            assert.ok(html.includes('/css/icons.css') && html.includes('/js/icons.js'), 'its style and script');
            assert.ok(html.includes('id="draw"') && html.includes('action="/icons/draft"'), 'Draw an icon');
            assert.ok(!html.includes('Waiting for review'), 'no review list for a visitor');
            assert.ok(html.includes('/shared/ov-glyphs.js'), 'the drop-in snippet');
        });

        await check('what is still Font Awesome: uncovered names only, brand logos aside, most used first', async () => {
            const left = stillFontAwesome();
            assert.ok(left.length > 0);
            for (const n of left) assert.equal(glyphs.fromFa(n.name), null, `${n.name} has no glyph`);
            assert.ok(!left.some((n) => n.name === 'youtube' || n.name === 'github'), 'brands stay theirs');
            for (let i = 1; i < left.length; i++) assert.ok(left[i - 1].uses >= left[i].uses, 'most used first');
            const html = (await t.get('/icons')).text;
            assert.ok(html.includes(`href="/icons?draw=${encodeURIComponent(left[0].name)}#draw"`), 'each one links to Draw an icon');
        });

        await check('one glyph is a standalone SVG anyone may fetch; an unknown name is a 404', async () => {
            const res = await t.get('/icons/eye.svg');
            assert.equal(res.status, 200);
            assert.match(res.headers.get('content-type'), /^image\/svg\+xml/);
            assert.equal(res.headers.get('access-control-allow-origin'), '*');
            assert.equal(res.text, glyphs.svg('eye', { size: 24, title: 'eye' }));
            assert.equal((await t.get('/icons/not-a-glyph.svg')).status, 404);
            assert.equal((await t.get('/icons/EYE.svg')).status, 404);
        });

        await check('the registry is data', async () => {
            const res = await t.get('/api/v1/glyphs');
            assert.equal(res.status, 200);
            assert.equal(res.headers.get('access-control-allow-origin'), '*');
            const j = res.json();
            assert.equal(j.count, glyphs.NAMES.length);
            const eye = j.glyphs.find((g) => g.name === 'eye');
            assert.equal(eye.svg, glyphs.path('eye'));
            assert.ok(eye.fa.includes('eye'));
            assert.equal(j.fa['fa-eye'] || j.fa.eye, 'eye');
        });

        await check('the validator keeps strokes on the grid and refuses anything else', async () => {
            const ok = clean('<path d="M4 12h16"/><circle cx="12" cy="12" r="8"/>');
            assert.ok(ok.ok, ok.why);
            assert.equal(ok.svg, '<path d="M4 12h16"/><circle cx="12" cy="12" r="8"/>');
            for (const [bad, what] of [
                ['<script>alert(1)</script>', 'a script'],
                ['<path d="M4 12h16" onload="x()"/>', 'a handler'],
                ['<image href="https://x.test/a.png"/>', 'an image'],
                ['<path d="M4 12h16" style="fill:red"/>', 'a style'],
                ['<path d="M400 12h16"/>', 'off the grid'],
                [Array.from({ length: 12 }, (_, i) => `<line x1="2" y1="${i + 2}" x2="22" y2="${i + 2}"/>`).join(''), 'too many shapes'],
                ['', 'nothing'],
            ]) assert.equal(clean(bad).ok, false, what);
        });

        await check('drawing takes this site\'s own form, signed in or not', async () => {
            const cross = await t.get('/icons/draft', { method: 'POST', as: ana, ...form({ name: 'hot-tub' }), origin: 'https://evil.test' });
            assert.equal(cross.status, 403);
            const anonCross = await t.get('/icons/draft', { method: 'POST', ...form({ name: 'hot-tub' }), origin: 'https://evil.test' });
            assert.equal(anonCross.status, 403, 'a guest\'s post must come from openvibe.design too');
            const noOrigin = await t.get('/icons/draft', { method: 'POST', ...form({ name: 'hot-tub' }) });
            assert.equal(noOrigin.status, 403, 'and say so');
            assert.equal(asked.length, 0, 'no AI call for any of them');
        });

        await check('a guest draws without signing in, inside the caps: per guest, per address, all guests', async () => {
            answer = JSON.stringify({ candidates: ['<rect x="4" y="10" width="16" height="8" rx="2"/><line x1="8" y1="4" x2="8" y2="7"/>', '<path d="M5 10h14v8H5z"/><path d="M9 6c0-1 1-1 1-2"/>'] });
            const before = asked.length;
            const page0 = await t.get('/icons');
            assert.ok(page0.text.includes('you can draw 2 icons a day as a guest'), 'the form says what a guest may do');
            const first = await t.get('/icons/draft', { method: 'POST', ...form({ name: 'kettle', sentence: 'A kettle' }), origin: ORIGIN });
            assert.equal(first.status, 303);
            assert.match(first.headers.get('location'), /^\/icons\?drafted=2&draw=kettle#draw$/);
            const cookie = (first.headers.get('set-cookie') || '').split(';')[0];
            assert.match(cookie, /^ovd_guest=[0-9a-f]{32}$/, 'a random guest id, in a cookie');
            assert.match(first.headers.get('set-cookie'), /HttpOnly/i);
            assert.equal(asked.length, before + 1);
            assert.equal(asked[asked.length - 1].person, undefined, 'a guest runs on OpenVibe\'s key, not a person\'s');
            const row = await t.store.db.maybe("SELECT subject FROM glyph_drafts WHERE name = 'kettle'");
            assert.match(row.subject, /^guest:[0-9a-f]{40}$/, 'stored under a keyed hash, never the id itself');
            const mine = await t.get('/icons', { headers: { cookie } });
            assert.ok(mine.text.includes('<h3>Your drafts, on this browser</h3>'), 'the guest sees their drafts');
            assert.match(mine.headers.get('cache-control'), /no-store/);
            const said = (r) => decodeURIComponent(String(r.headers.get('location') || '').replace(/\+/g, ' '));
            const asGuest = (f) => { const x = form(f); return { ...x, headers: { ...x.headers, cookie } }; };
            const second = await t.get('/icons/draft', { method: 'POST', ...asGuest({ name: 'teapot' }), origin: ORIGIN });
            assert.match(second.headers.get('location'), /drafted=2/);
            const third = await t.get('/icons/draft', { method: 'POST', ...asGuest({ name: 'mugs' }), origin: ORIGIN });
            assert.match(said(third), /you can draw 2 icons a day/, 'the guest\'s day is spent');
            assert.equal(asked.length, before + 2, 'and no model was asked for the third');
            // Two drawn so far from this address; two more from fresh browsers reach its four, the fifth is refused.
            const fresh = () => t.get('/icons/draft', { method: 'POST', ...form({ name: 'cups' }), origin: ORIGIN });
            assert.match(said(await fresh()), /drafted=2/);
            assert.match(said(await fresh()), /drafted=2/);
            assert.match(said(await fresh()), /this connection can draw today/, 'a new cookie does not reset the address');
            const rows = await t.store.db.many('SELECT guest, ip_hash FROM glyph_guest_draws');
            assert.ok(rows.length >= 4 && rows.every((r) => /^[0-9a-f]{40}$/.test(r.guest) && /^[0-9a-f]{40}$/.test(r.ip_hash)), 'only hashes are kept');
            await t.store.db.exec('DELETE FROM glyph_guest_draws');
            await t.store.db.exec("DELETE FROM glyph_drafts WHERE subject LIKE 'guest:%'");
            asked.length = 0;
        });

        await check('OpenVibe.AI drafts candidates; the checked ones are kept, the rest refused', async () => {
            answer = '```json\n' + JSON.stringify({ candidates: [
                '<path d="M5 10h14v8H5z"/><path d="M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2"/>',
                '<rect x="4" y="10" width="16" height="8" rx="2"/><line x1="8" y1="4" x2="8" y2="7"/>',
                '<path d="M5 10h14v8H5z" onclick="steal()"/>',
                '<rect x="4" y="10" width="16" height="8" rx="2"/><line x1="8" y1="4" x2="8" y2="7"/>',
            ] }) + '\n```';
            const res = await t.get('/icons/draft', { method: 'POST', as: ana, ...form({ name: 'hot-tub', sentence: 'A tub with steam over it' }), origin: ORIGIN });
            assert.equal(res.status, 303);
            assert.match(res.headers.get('location'), /^\/icons\?drafted=2&draw=hot-tub#draw$/);
            assert.equal(asked.length, 1);
            assert.ok(asked[0].prompt.includes('hot-tub') && asked[0].prompt.includes('A tub with steam over it'));
            assert.deepEqual(asked[0].target, { service: 'design', type: 'glyph_draft', id: 'hot-tub' });
            const page = await t.get('/icons?drafted=2&draw=hot-tub', { as: ana });
            assert.ok(page.text.includes('2 candidates drawn'), 'the notice');
            assert.ok(page.text.includes('<h3>Your drafts</h3>'), 'their drafts');
            assert.equal((page.text.match(/class="ic-draft is-draft"/g) || []).length, 2);
            assert.ok(page.text.includes('value="hot-tub"'), 'the form keeps the name');
            assert.ok(!page.text.includes('onclick="steal()"'), 'the refused one is nowhere');
            assert.ok(!page.text.includes('Waiting for review'), 'not a reviewer');
        });

        await check('a bad name or an empty answer says so, without a stored draft', async () => {
            const bad = await t.get('/icons/draft', { method: 'POST', as: ana, ...form({ name: 'Hot Tub!' }), origin: ORIGIN });
            assert.equal(bad.status, 303);
            assert.match(new URLSearchParams(bad.headers.get('location').split('?')[1]).get('error'), /^a name is 2 to 32/);
            answer = 'I cannot draw that.';
            const none = await t.get('/icons/draft', { method: 'POST', as: ana, ...form({ name: 'cloud-sync' }), origin: ORIGIN });
            assert.match(none.headers.get('location'), /drafted=0/);
            const page = await t.get('/icons?drafted=0', { as: ana });
            assert.ok(page.text.includes('No candidate passed the checks'));
        });

        let ids = [];
        await check('only an admin sees and reviews the waiting drafts', async () => {
            const asAna = await t.get('/api/v1/glyphs/drafts?status=draft', { as: ana });
            assert.equal(asAna.status, 403);
            const waiting = await t.get('/api/v1/glyphs/drafts?status=draft', { as: boss });
            assert.equal(waiting.status, 200);
            ids = waiting.json().drafts.map((d) => d.id);
            assert.equal(ids.length, 2);
            const page = await t.get('/icons', { as: boss });
            assert.ok(page.text.includes('Waiting for review'));
            assert.equal((page.text.match(/action="\/icons\/drafts\/gd_[0-9a-f]+\/review"/g) || []).length, 4, 'approve and reject on each');
            const notAdmin = await t.get(`/icons/drafts/${ids[0]}/review`, { method: 'POST', as: ana, ...form({ action: 'approve' }), origin: ORIGIN });
            assert.equal(notAdmin.status, 403);
            const cross = await t.get(`/icons/drafts/${ids[0]}/review`, { method: 'POST', as: boss, ...form({ action: 'approve' }), origin: 'https://evil.test' });
            assert.equal(cross.status, 403);
            const ok = await t.get(`/icons/drafts/${ids[0]}/review`, { method: 'POST', as: boss, ...form({ action: 'approve' }), origin: ORIGIN });
            assert.equal(ok.status, 303);
            assert.match(ok.headers.get('location'), /reviewed=approved/);
            const no = await t.get(`/icons/drafts/${ids[1]}/review`, { method: 'POST', as: boss, ...form({ action: 'reject' }), origin: ORIGIN });
            assert.match(no.headers.get('location'), /reviewed=rejected/);
            const missing = await t.get('/icons/drafts/gd_0000000000000000/review', { method: 'POST', as: boss, ...form({ action: 'approve' }), origin: ORIGIN });
            assert.match(new URLSearchParams(missing.headers.get('location').split('?')[1]).get('error'), /^no such draft/);
        });

        await check('approved drafts are public data for openvibe-shared to take in; the others are not', async () => {
            const res = await t.get('/api/v1/glyphs/drafts');
            assert.equal(res.status, 200);
            const list = res.json().drafts;
            assert.equal(list.length, 1);
            assert.equal(list[0].id, ids[0]);
            assert.equal(list[0].name, 'hot-tub');
            assert.equal(list[0].status, 'approved');
            assert.ok(clean(list[0].svg).ok, 'what is served passed the validator');
            assert.ok(!('subject' in list[0]), 'who asked stays private');
            assert.equal((await t.get('/api/v1/glyphs/drafts?status=rejected')).status, 403);
            assert.equal((await t.get('/api/v1/glyphs/drafts?status=nope', { as: boss })).status, 422);
        });

        await check('it is in the navbar, the sitemap and llms.txt', async () => {
            assert.ok((await t.get('/sitemap.xml')).text.includes('/icons</loc>'), 'sitemap');
            assert.ok((await t.get('/llms.txt')).text.includes('/icons'), 'llms.txt');
            assert.ok(/"href":"\/icons"[^}]*"active":true/.test((await t.get('/icons')).text), 'the navbar marks it');
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
