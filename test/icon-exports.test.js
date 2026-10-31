'use strict';
// Every way to get a glyph (plan L32 I5/I7, 2026-10-31): each glyph's own page (what a search for "<name> icon" lands
// on, with the licence in its JSON-LD), the SVG and PNG with the PNG maker's choices (clamped, never failing), the
// fonts, the sprite and a ZIP of every SVG, and the Font Awesome alternative page; all in the sitemap.
const assert = require('node:assert/strict');
const zlib = require('zlib');
const { boot, check, done } = require('./helpers/boot');
const glyphs = require('openvibe-shared/glyphs');
const ex = require('../server/glyphs/export');
const { related } = require('../server/views/icon-page');

const pngSize = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

(async () => {
    const t = await boot();
    try {
        await check('a glyph has its own page: the drawing, its Font Awesome names, every export, the licence', async () => {
            const res = await t.get('/icons/eye');
            assert.equal(res.status, 200);
            const html = res.text;
            assert.match(html, /<title>Eye icon: free SVG, PNG and font · OpenVibe\.Design<\/title>/);
            assert.ok(html.includes('<h1 class="gp-h1">Eye</h1>'));
            assert.ok(html.includes('<code>fa-eye</code>'), 'the Font Awesome name it stands in for');
            assert.ok(html.includes(`<code>U+${ex.codepointOf('eye')}</code>`), 'its character in the font');
            assert.ok(html.includes('<link rel="canonical" href="https://openvibe.design/icons/eye">'));
            assert.ok(/<meta property="og:image" content="https:\/\/openvibe\.design\/icons\/eye\.png\?size=512/.test(html), 'its own share picture');
            const img = jsonLd(html).find((j) => j['@type'] === 'ImageObject');
            assert.equal(img.license, 'https://opensource.org/license/mit');
            assert.equal(img.acquireLicensePage, 'https://openvibe.design/icons/eye');
            assert.equal(img.contentUrl, 'https://openvibe.design/icons/eye.svg');
            assert.ok(jsonLd(html).some((j) => j['@type'] === 'BreadcrumbList'));
            assert.ok(html.includes('method="get" action="/icons/eye#png"') && html.includes('name="ground"') && html.includes('name="stroke"'), 'the PNG maker works as a form');
            assert.ok(html.includes('ovi ovi-eye') && html.includes('/shared/ov-glyphs.svg#ovg-eye') && html.includes('fa-solid fa-eye'), 'the font, the sprite and the drop-in');
            const near = related('eye');
            assert.ok(near.includes('eye-off') && near.length === 12 && !near.includes('eye'));
            assert.ok(html.includes('href="/icons/eye-off"'), 'glyphs near it, linked');
            assert.ok(html.includes('/js/icon.js'));
        });

        await check('the maker\'s choices come back in the page, and a crawler-style URL never fails', async () => {
            const res = await t.get('/icons/live?size=512&color=mark&ground=circle&bg=101820&pad=12&stroke=2.5');
            assert.equal(res.status, 200);
            assert.ok(res.text.includes('src="/icons/live.png?size=512&amp;color=mark&amp;stroke=2.5&amp;pad=12&amp;ground=circle&amp;bg=101820"'));
            assert.ok(res.text.includes('<link rel="canonical" href="https://openvibe.design/icons/live">'), 'variants share one canonical');
            assert.equal((await t.get('/icons/live?size=nope&color=<b>')).status, 200);
            assert.equal((await t.get('/icons/not-a-glyph')).status, 404);
            assert.equal((await t.get('/icons/draft')).status, 404);
        });

        await check('the SVG: unchanged by default, drawn with the choices otherwise', async () => {
            assert.equal((await t.get('/icons/eye.svg')).text, glyphs.svg('eye', { size: 24, title: 'eye' }));
            const res = await t.get('/icons/eye.svg?size=64&color=ff0000&stroke=1.5&pad=25&ground=squircle&bg=000000');
            assert.equal(res.status, 200);
            assert.match(res.headers.get('content-type'), /^image\/svg\+xml/);
            const s = res.text;
            assert.ok(s.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="64" height="64">'), 'a quarter of room each side doubles the box');
            assert.ok(s.includes('<rect width="48" height="48" rx="10.8" fill="#000000"/>'), 'the squircle ground');
            assert.ok(s.includes('<g transform="translate(12 12)" fill="none" stroke="#ff0000" stroke-width="1.5"'));
            assert.ok(s.includes(glyphs.path('eye')));
            const mark = (await t.get('/icons/eye.svg?color=mark')).text;
            assert.ok(mark.includes('<linearGradient id="ovg-mark" gradientUnits="userSpaceOnUse"') && mark.includes('stroke="url(#ovg-mark)"'), "the mark's two colours");
        });

        await check('the PNG: any size at 1-3x, clamped, transparent or on a ground', async () => {
            const res = await t.get('/icons/heart.png?size=128&scale=2&ground=circle');
            assert.equal(res.status, 200);
            assert.equal(res.headers.get('content-type'), 'image/png');
            assert.equal(res.headers.get('access-control-allow-origin'), '*');
            assert.equal(res.buffer.subarray(1, 4).toString('latin1'), 'PNG');
            assert.deepEqual(pngSize(res.buffer), [256, 256]);
            assert.deepEqual(pngSize((await t.get('/icons/heart.png?size=99999')).buffer), [1024, 1024], 'clamped to 1024');
            assert.deepEqual(pngSize((await t.get('/icons/heart.png')).buffer), [256, 256], 'the default');
            assert.equal((await t.get('/icons/nope.png')).status, 404);
            const o = ex.options({ size: '3', color: 'javascript:', stroke: '9', pad: '-4', ground: '<x>', bg: 'zz' });
            assert.deepEqual(o, { size: 16, scale: 1, color: '0f172a', stroke: 3, pad: 0, ground: 'none', bg: 'ffffff' });
        });

        await check('the pack: fonts, the sprite, the CSS, the code points and a ZIP of every SVG', async () => {
            const woff = await t.get('/icons/pack/ov-glyphs.woff2');
            assert.equal(woff.status, 200);
            assert.equal(woff.headers.get('content-type'), 'font/woff2');
            assert.match(woff.headers.get('content-disposition'), /attachment; filename="ov-glyphs.woff2"/);
            assert.equal(woff.buffer.subarray(0, 4).toString('latin1'), 'wOF2');
            assert.equal((await t.get('/icons/pack/ov-glyphs.ttf')).buffer.readUInt32BE(0), 0x00010000);
            assert.equal((await t.get('/icons/pack/ov-glyphs.otf')).buffer.subarray(0, 4).toString('latin1'), 'OTTO');
            assert.ok((await t.get('/icons/pack/ov-glyphs.svg')).text.includes('<symbol id="ovg-eye"'));
            assert.ok((await t.get('/icons/pack/ov-glyphs-font.css')).text.includes('.ovi-eye::before'));
            assert.ok((await t.get('/icons/pack/glyph-codepoints.json')).json().glyphs.eye);
            assert.equal((await t.get('/icons/pack/../package.json')).status, 404);
            assert.equal((await t.get('/icons/pack/server.js')).status, 404);
            const z = await t.get('/icons/pack/ov-glyphs-svg.zip');
            assert.equal(z.headers.get('content-type'), 'application/zip');
            const buf = z.buffer;
            assert.equal(buf.readUInt32LE(0), 0x04034b50, 'a ZIP');
            const end = buf.length - 22;
            assert.equal(buf.readUInt32LE(end), 0x06054b50);
            assert.equal(buf.readUInt16LE(end + 10), glyphs.NAMES.length + 1, 'every glyph and the licence');
            const nameLen = buf.readUInt16LE(26), size = buf.readUInt32LE(18);
            const first = zlib.inflateRawSync(buf.subarray(30 + nameLen, 30 + nameLen + size)).toString();
            assert.equal(buf.subarray(30, 30 + nameLen).toString(), `ov-glyphs/${glyphs.NAMES[0]}.svg`);
            assert.equal(first, glyphs.svg(glyphs.NAMES[0], { size: 24 }));
            assert.equal(ex.crc32(Buffer.from(first)), buf.readUInt32LE(14), 'its checksum');
        });

        await check('the Font Awesome alternative: how to switch, what keeps working, questions', async () => {
            const res = await t.get('/icons/font-awesome-alternative');
            assert.equal(res.status, 200);
            assert.ok(res.text.includes('Keep your markup. Change your icons.'));
            assert.ok(res.text.includes('/shared/ov-glyphs.js') && res.text.includes('/shared/ov-glyphs-fa.css'));
            assert.ok(res.text.includes('<code>data-fa-transform</code>') && res.text.includes('Keep theirs'), 'the parity table, honest about brands');
            assert.ok(jsonLd(res.text).some((j) => j['@type'] === 'FAQPage' && j.mainEntity.length >= 5));
        });

        await check('the icons page links every glyph to its page and offers the pack', async () => {
            const html = (await t.get('/icons')).text;
            assert.equal((html.match(/<a class="ic-tile" href="\/icons\/[a-z0-9-]+"/g) || []).length, glyphs.NAMES.length);
            assert.ok(html.includes('href="/icons/pack/ov-glyphs-svg.zip"') && html.includes('href="/icons/pack/ov-glyphs.otf"'));
            assert.ok(html.includes('href="/icons/font-awesome-alternative"'));
        });

        await check('every glyph page is in the sitemap with its pictures; the alternative is in llms.txt', async () => {
            const map = (await t.get('/sitemap.xml')).text;
            assert.ok(map.includes('<loc>https://openvibe.design/icons/eye</loc>'));
            assert.ok(map.includes('<image:image><image:loc>https://openvibe.design/icons/eye.svg</image:loc></image:image>'));
            assert.equal((map.match(/<loc>https:\/\/openvibe\.design\/icons\/[a-z0-9-]+<\/loc>/g) || []).length, glyphs.NAMES.length + 1, 'each glyph, and the alternative');
            assert.ok((await t.get('/llms.txt')).text.includes('/icons/font-awesome-alternative'));
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
