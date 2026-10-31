'use strict';
// Icon kits (plan L32 I5, 2026-10-31): pick glyphs on /icons/kit and get a font with only those, as a ZIP with WOFF2,
// TTF, the CSS (Font Awesome's class names when asked), the code points and a README. The same kit comes from a link.
// Unknown names are dropped, Font Awesome names pick their glyph, and a kit with nothing in it says so.
const assert = require('node:assert/strict');
const zlib = require('zlib');
const { boot, check, done } = require('./helpers/boot');
const glyphs = require('openvibe-shared/glyphs');
const kits = require('../server/glyphs/kits');
const ex = require('../server/glyphs/export');

/** The entries of a ZIP the export writer made: { name: Buffer }. */
function unzip(buf) {
    const out = {};
    const end = buf.length - 22;
    let at = buf.readUInt32LE(end + 16);
    const n = buf.readUInt16LE(end + 10);
    for (let i = 0; i < n; i++) {
        const nameLen = buf.readUInt16LE(at + 28), size = buf.readUInt32LE(at + 20), local = buf.readUInt32LE(at + 42);
        const name = buf.subarray(at + 46, at + 46 + nameLen).toString();
        const lnl = buf.readUInt16LE(local + 26);
        out[name] = zlib.inflateRawSync(buf.subarray(local + 30 + lnl, local + 30 + lnl + size));
        at += 46 + nameLen;
    }
    return out;
}
const form = (fields) => ({ method: 'POST', body: fields, headers: { 'content-type': 'application/x-www-form-urlencoded' }, origin: 'https://openvibe.design' });

(async () => {
    await check('a choice: known glyphs, Font Awesome names picked, unknowns dropped, a tidy name', async () => {
        const c = kits.parse({ names: 'eye, fa-video, nope, eye, live', name: 'My Site!', fa: '1' });
        assert.deepEqual(c, { names: ['eye', 'video', 'live'], slug: 'my-site', fa: true });
        assert.throws(() => kits.parse({ names: 'nope' }), /pick at least one glyph/);
    });

    const t = await boot();
    try {
        await check('the page: every glyph a checkbox, picks from the link ticked, a download bar', async () => {
            const res = await t.get('/icons/kit?names=eye,live');
            assert.equal(res.status, 200);
            const html = res.text;
            assert.ok(html.includes('<h1 class="ic-h1">Only the icons you use.</h1>'));
            assert.equal((html.match(/<input type="checkbox" name="names" value=/g) || []).length, glyphs.NAMES.length);
            assert.ok(html.includes('value="eye" checked') && html.includes('value="live" checked') && !html.includes('value="heart" checked'));
            assert.ok(html.includes('method="post" action="/icons/kit"') && html.includes('name="fa" value="1" checked'));
            assert.ok(html.includes('/js/kit.js'));
        });

        await check('the form gives a ZIP: a small WOFF2 and TTF, the CSS with Font Awesome names, the characters', async () => {
            const res = await t.get('/icons/kit', form('names=eye&names=live&names=heart&name=Shop&fa=1'));
            assert.equal(res.status, 200);
            assert.equal(res.headers.get('content-type'), 'application/zip');
            assert.match(res.headers.get('content-disposition'), /attachment; filename="ov-glyphs-kit-shop\.zip"/);
            const files = unzip(res.buffer);
            assert.deepEqual(Object.keys(files).sort(), ['shop/README.txt', 'shop/shop.css', 'shop/shop.json', 'shop/shop.ttf', 'shop/shop.woff2']);
            assert.equal(files['shop/shop.woff2'].subarray(0, 4).toString('latin1'), 'wOF2');
            assert.ok(files['shop/shop.woff2'].length < 2048, `three glyphs are small (${files['shop/shop.woff2'].length} bytes)`);
            assert.equal(files['shop/shop.ttf'].readUInt32BE(0), 0x00010000);
            const css = files['shop/shop.css'].toString();
            assert.ok(css.includes("@font-face{font-family:'OV Glyphs shop';src:url(shop.woff2) format('woff2'),url(shop.ttf) format('truetype')"));
            assert.ok(css.includes(`.ovi-eye::before{content:"\\${ex.codepointOf('eye').toLowerCase()}"}`));
            assert.ok(css.includes(`.fa-eye::before{content:"\\${ex.codepointOf('eye').toLowerCase()}"}`), "Font Awesome's names, asked for");
            assert.ok(!css.includes('.ovi-video'), 'only what was picked');
            assert.deepEqual(Object.keys(JSON.parse(files['shop/shop.json']).glyphs), ['eye', 'live', 'heart']);
        });

        await check('without Font Awesome\'s names, the CSS has only ovi classes', async () => {
            const files = unzip((await t.get('/icons/kit', form('names=eye&name=plain'))).buffer);
            assert.ok(!files['plain/plain.css'].toString().includes('.fa-eye'));
        });

        await check('the same kit from a link, cacheable; nothing picked is a plain 422', async () => {
            const res = await t.get('/icons/kit.zip?names=eye,fa-video&name=link');
            assert.equal(res.status, 200);
            assert.equal(res.headers.get('cache-control'), 'public, max-age=86400');
            assert.ok(Object.keys(unzip(res.buffer)).includes('link/link.woff2'));
            assert.equal((await t.get('/icons/kit.zip?names=nope')).status, 422);
            const empty = await t.get('/icons/kit', form('name=empty'));
            assert.equal(empty.status, 422);
            assert.ok(empty.text.includes('pick at least one glyph'));
        });

        await check('glyph pages, /icons and the Font Awesome page lead to kits', async () => {
            assert.ok((await t.get('/icons/eye')).text.includes('href="/icons/kit?names=eye"'));
            assert.ok((await t.get('/icons')).text.includes('href="/icons/kit"'));
            assert.ok((await t.get('/icons/font-awesome-alternative')).text.includes('<a href="/icons/kit">'));
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
