'use strict';
// /brand: the OpenVibe mark for anyone who wants to use it (2026-10-31, the Pair). The page is whole without
// JavaScript (every mark on it is openvibe-shared/mark's static SVG), says what each move means, and offers the files
// and the code; the files are standalone SVGs anyone can fetch.
const assert = require('node:assert/strict');
const { boot, check, done } = require('./helpers/boot');
const mark = require('openvibe-shared/mark');
const { FILES, STATES } = require('../server/views/brand');

(async () => {
    const t = await boot();
    try {
        await check('the page shows the mark, every move in words, and how to use it', async () => {
            const res = await t.get('/brand');
            assert.equal(res.status, 200);
            const html = res.text;
            assert.ok(html.includes('<h1 class="br-h1">A ring and a round&nbsp;V.</h1>'), 'its heading');
            assert.ok((html.match(/<mask id="br\d+h"/g) || []).length >= 20, 'every mark is drawn on the server, each with its own mask');
            assert.equal(new Set(html.match(/<mask id="br\d+h"/g)).size, (html.match(/<mask id="br\d+h"/g) || []).length, 'no two masks share an id');
            for (const [id, label, line] of STATES) {
                assert.ok(html.includes(`>${label}</button>`), `the ${label} button`);
                if (id) assert.ok(html.includes(`data-state="${id}" data-static`) && html.includes(line), `${label}: its small mark and what it means`);
            }
            assert.ok(html.includes('A page on its way'), 'the page-load ring, in words');
            assert.ok(html.includes('data-br-hero') && html.includes('data-br-demo'), 'the live marks for ov-mark.js');
            assert.ok(/data-glow data-br-hero/.test(html), 'the hero mark keeps its glow on (4.65.0)');
            assert.ok(html.includes('href="/motion"'), 'and the page points to how everything else moves');
            assert.ok(html.includes('/shared/ov-mark.js&quot; async&gt;&lt;/script&gt;'), 'the script snippet');
            assert.ok(html.includes('require(&#39;openvibe-shared/mark&#39;)'), 'the Node snippet');
            assert.ok(html.includes('/shared/ov-brand.woff2'), 'the font snippet');
            for (const f of FILES) assert.ok(html.includes(`href="/brand/${f.name}" download="${f.name}"`), `the ${f.label} file`);
            assert.ok(html.includes(mark.COLORS.o) && html.includes(mark.COLORS.v), 'its two colours');
            assert.ok(html.includes('/css/brand.css') && html.includes('/js/brand.js'), 'its style and demos');
        });

        await check('the files are standalone SVGs of the mark, anyone can fetch them', async () => {
            for (const f of FILES) {
                const res = await t.get(`/brand/${f.name}`);
                assert.equal(res.status, 200, f.name);
                assert.match(res.headers.get('content-type'), /^image\/svg\+xml/);
                assert.equal(res.headers.get('access-control-allow-origin'), '*');
                assert.equal(res.text, mark.svg({ form: f.form, tone: f.tone, wide: f.wide, title: 'OpenVibe', id: 'ov' }), f.name);
            }
            const none = await t.get('/brand/not-a-file.svg');
            assert.equal(none.status, 404);
        });

        await check('it is in the navbar, the sitemap and llms.txt, and the mark pattern points to it', async () => {
            const map = await t.get('/sitemap.xml');
            assert.ok(map.text.includes('/brand</loc>'), 'sitemap');
            const llms = await t.get('/llms.txt');
            assert.ok(llms.text.includes('/brand'), 'llms.txt');
            const pattern = await t.get('/patterns/mark-system');
            assert.ok(pattern.text.includes('href="/brand"'), 'the mark pattern links it');
            const page = await t.get('/brand');
            assert.ok(/"href":"\/brand"[^}]*"active":true/.test(page.text), 'the navbar marks it');
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
