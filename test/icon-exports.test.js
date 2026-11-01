'use strict';
// Every way to get a glyph (plan L32 I5/I7, 2026-10-31): each glyph's own page (what a search for "<name> icon" lands
// on, with the licence in its JSON-LD), the SVG and PNG with the PNG maker's choices (clamped, never failing), the
// fonts, the sprite and a ZIP of every SVG, and the Font Awesome alternative page; all in the sitemap.
const assert = require('node:assert/strict');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
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
            const o = ex.options({ size: '3', color: 'javascript:', stroke: '9', pad: '-4', ground: '<x>', bg: 'zz', style: 'bold' });
            assert.deepEqual(o, { size: 16, scale: 1, color: '0f172a', stroke: 3, pad: 0, ground: 'none', bg: 'ffffff', fx: 'flat', style: 'auto' });
        });

        await check('every size by itself (L50): style=auto draws the solid drawing at 18 px and under, line and solid on ask', async () => {
            assert.ok(glyphs.solid('mic') && !glyphs.solid('check'), 'mic has a solid drawing; check is only lines');
            const small = (await t.get('/icons/mic.svg?size=16')).text;
            assert.ok(small.includes('<g transform="translate(0 0)" fill="#0f172a" stroke="none">'), 'small and auto: filled');
            assert.ok(small.includes('fill="none" stroke="#0f172a" stroke-width="2.6" stroke-linecap="round"'), 'its lines written out, no class left');
            assert.ok(!small.includes('class='), 'the file needs no page styles');
            assert.ok((await t.get('/icons/mic.svg?size=16&style=line')).text.includes('fill="none" stroke="#0f172a" stroke-width="2"'), 'line on ask');
            assert.ok((await t.get('/icons/mic.svg?size=64&style=solid')).text.includes('fill="#0f172a" stroke="none"'), 'solid on ask, any size');
            assert.ok((await t.get('/icons/mic.svg?size=24')).text.includes('fill="none" stroke="#0f172a"'), 'above 18 px auto is the line');
            assert.ok((await t.get('/icons/check.svg?size=16&style=solid')).text.includes('fill="none" stroke="#0f172a"'), 'a glyph of lines stays lines');
            assert.equal(ex.query(ex.options({ size: 16 })), '?size=16', 'auto is the default and stays out of links');
            assert.equal(ex.query(ex.options({ style: 'solid' })), '?style=solid');
            const png = (await t.get('/icons/mic.png?size=16&scale=3')).buffer;
            assert.deepEqual(pngSize(png), [48, 48], 'a small PNG at 3x, drawn solid');
            const page = (await t.get('/icons/mic')).text;
            assert.ok(page.includes('<h2 class="gp-ladder-h" id="gp-ladder-h">Every size by itself</h2>'));
            assert.equal((page.match(/<div class="gp-sizes is-(light|dark)"/g) || []).length, 2, 'the ladder on light and on dark');
            assert.equal((page.match(/<svg class="is-solid"/g) || []).length, 4, '12 and 16 px solid, on each ground');
            assert.ok(page.includes('<select name="style" data-gp="style">'), 'the maker offers the style');
            assert.ok(/its lines grow a little heavier when small/i.test((await t.get('/icons/check')).text), 'a glyph of lines says why it has no solid');
        });

        await check('the finish (L44): flat by default, depth light to deep, a glow behind, or both', async () => {
            assert.equal(ex.options({}).fx, 'flat');
            assert.equal(ex.options({ fx: 'nonsense' }).fx, 'flat', 'anything unknown is flat');
            assert.equal(ex.query(ex.options({ fx: 'depth-glow' })), '?fx=depth-glow', 'the link rebuilds it');
            const flat = ex.svg('heart', ex.options({}));
            assert.ok(!/ovg-depth|ovg-glow/.test(flat), 'flat is unchanged');
            const depth = ex.svg('heart', ex.options({ fx: 'depth', color: '22c55e' }));
            assert.match(depth, /<linearGradient id="ovg-depth" gradientUnits="userSpaceOnUse"[^>]*><stop offset="0" stop-color="#[0-9a-f]{6}"\/><stop offset="1" stop-color="#[0-9a-f]{6}"\/>/, 'light to deep in its own colour');
            assert.match(depth, /stroke="url\(#ovg-depth\)"/);
            const glow = ex.svg('heart', ex.options({ fx: 'glow' }));
            assert.match(glow, /<filter id="ovg-glow"[^>]*><feGaussianBlur/, 'a blur');
            assert.equal((glow.match(/<g transform=/g) || []).length, 2, 'the glow is a second, wider copy behind');
            assert.ok(glow.indexOf('filter="url(#ovg-glow)"') < glow.lastIndexOf('<g transform='), 'behind, not on top');
            const mark = ex.svg('heart', ex.options({ fx: 'depth', color: 'mark' }));
            assert.ok(mark.includes('url(#ovg-mark)') && !mark.includes('#4f7cff"/>'), 'the mark\'s two colours take the depth too');
            const res = await t.get('/icons/heart.png?size=64&fx=depth-glow&color=mark');
            assert.equal(res.status, 200);
            assert.equal(res.headers.get('content-type'), 'image/png', 'resvg draws the glow');
            const page = (await t.get('/icons/heart?fx=glow')).text;
            assert.ok(page.includes('<option value="glow" selected'), 'the maker remembers the finish');
            const js = fs.readFileSync(path.join(__dirname, '..', 'public/js/icon.js'), 'utf8');
            assert.match(js, /fx: 'flat', style: 'auto' \}/, 'the maker\'s live link leaves a flat finish and the auto style out, as the server does');
        });
        await check('use it anywhere (L50 steps 2-3): <ov-icon>, the drawings by name, and every copy format', async () => {
            const formats = require('../server/glyphs/formats');
            // The web component: a stable address any site can load, open to every origin.
            const wc = await t.get('/ov-icon.js');
            assert.equal(wc.status, 200);
            assert.match(wc.headers.get('content-type'), /javascript/);
            assert.equal(wc.headers.get('access-control-allow-origin'), '*');
            assert.match(wc.headers.get('cache-control'), /max-age=86400/);
            assert.ok(wc.text.includes("customElements.define('ov-icon', OvIcon)") && wc.text.includes('@container (max-width: 18px)'), 'small icons go solid by their real size');
            assert.equal((await t.get('/icons.js')).text, wc.text, 'the plan\'s address works too');
            // The drawings by name, as <ov-icon> asks for them: glyphs and Font Awesome names, unknown ones left out.
            const some = await t.get('/api/v1/glyphs?names=mic,fa-gear,nope-nope,mic,<x>');
            assert.equal(some.headers.get('access-control-allow-origin'), '*');
            const j = some.json();
            assert.deepEqual(j.glyphs.map((g) => [g.asked, g.name]), [['mic', 'mic'], ['fa-gear', 'gear']]);
            assert.equal(j.glyphs[0].svg, glyphs.path('mic'));
            assert.equal(j.glyphs[0].solid, glyphs.solid('mic'));
            assert.ok((await t.get('/api/v1/glyphs')).json().glyphs.find((g) => g.name === 'mic').solid, 'the whole registry carries the solids');
            // An ES module and an Android VectorDrawable, by URL.
            const mjs = await t.get('/icons/mic.mjs');
            assert.match(mjs.headers.get('content-type'), /javascript/);
            assert.ok(mjs.text.includes(`export const line = ${JSON.stringify(glyphs.path('mic'))};`) && mjs.text.includes('export default { name, line, solid };'));
            const xml = await t.get('/icons/robot.xml?color=ff0000');
            assert.match(xml.headers.get('content-type'), /xml/);
            assert.ok(xml.text.includes('<vector xmlns:android="http://schemas.android.com/apk/res/android"') && xml.text.includes('android:strokeColor="#FFFF0000"'));
            assert.ok(!/<(rect|circle)/.test(xml.text), 'Android draws paths only: the rect became path data');
            assert.ok((await t.get('/icons/mic.xml?style=solid')).text.includes('android:fillColor="#FF0F172A"'), 'the solid drawing is filled');
            // Shapes become path data that draws the same thing.
            assert.equal(formats.toPath({ tag: 'circle', attrs: { cx: '12', cy: '12', r: '3' } }), 'M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0Z');
            assert.equal(formats.toPath({ tag: 'rect', attrs: { x: '2', y: '3', width: '4', height: '5' } }), 'M2 3h4v5h-4Z');
            assert.equal(formats.toPath({ tag: 'line', attrs: { x1: '1', y1: '2', x2: '3', y2: '4' } }), 'M1 2L3 4');
            // A favicon set: the files and the <head> lines.
            const fav = await t.get('/icons/heart/favicon.zip');
            assert.equal(fav.headers.get('content-type'), 'application/zip');
            // The central directory's entries: a 46-byte header with the name's length at 28, then the name.
            const names = [];
            for (let at = fav.buffer.indexOf('PK\x01\x02', 0, 'latin1'); at >= 0; at = fav.buffer.indexOf('PK\x01\x02', at + 46, 'latin1')) {
                names.push(fav.buffer.toString('utf8', at + 46, at + 46 + fav.buffer.readUInt16LE(at + 28)));
            }
            assert.deepEqual(names, ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'site.webmanifest', 'head.html']);
            assert.equal((await t.get('/icons/nope/favicon.zip')).status, 404);
            // The copy formats are the same drawing in each language's spelling.
            const o = ex.options({ size: 24 });
            assert.ok(formats.inlineSvg('mic', o).includes(glyphs.path('mic')) && formats.inlineSvg('mic', o).includes('stroke="currentColor"'));
            const jsx = formats.jsx('eye-off', o);
            assert.ok(jsx.startsWith('export function EyeOffIcon(props) {') && jsx.includes('strokeLinecap="round"') && jsx.includes('aria-hidden="true" {...props}>'), 'React: camelCase, aria kept, props spread');
            assert.ok(!/stroke-|fill-rule|class=/.test(jsx), 'no HTML-only attribute names left');
            assert.ok(formats.dataUri('heart', o).startsWith("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'") && formats.dataUri('heart', o).includes('%230f172a'), 'a data URI in a fixed colour');
            assert.ok(formats.cssMask('check', o).includes('background-color: currentColor;') && formats.cssMask('check', o).includes('mask: url("data:image/svg+xml,'));
            // The page offers them: four in view, the rest in a fold that says what it holds.
            const page = (await t.get('/icons/mic')).text;
            ['gp-wc', 'gp-inline', 'gp-jsx', 'gp-url', 'gp-mask', 'gp-data', 'gp-mjs', 'gp-android'].forEach((id) => assert.ok(page.includes(`id="${id}"`), id));
            assert.match(page, /<details class="gp-more"><summary>\d+ more ways <span>Font Awesome markup · The font · The sprite · CSS, no markup/);
            assert.ok(page.includes('href="/icons/mic/favicon.zip" data-gp-fav') && page.includes('href="/icons/mic.xml" download="ic_mic.xml"'));
            assert.ok((await t.get('/icons')).text.includes('&lt;ov-icon name=&quot;heart&quot;&gt;'), '/icons names the component');
            assert.ok((await t.get('/llms.txt')).text.includes('/ov-icon.js'), 'llms.txt names it for agents');
        });

        await check('make it move (L50 step 7): six presets, the one that suits marked, a stylesheet, <ov-icon motion>', async () => {
            const motion = require('../server/glyphs/motion');
            assert.deepEqual(motion.PRESETS.map((p) => p.id), ['draw', 'pop', 'nudge', 'ring', 'beat', 'shake']);
            assert.deepEqual(['bell', 'heart', 'arrow-right', 'check', 'ban', 'gear'].map(motion.suggest), ['ring', 'beat', 'nudge', 'draw', 'shake', 'pop']);
            assert.deepEqual(motion.nudgeOf('back'), { x: -2, y: 0 }, 'an arrow leans its own way');
            const page = (await t.get('/icons/bell')).text;
            assert.ok(page.includes('<h2 id="gp-move">Make it move</h2>'));
            assert.equal((page.match(/<button type="button" class="mv-tile/g) || []).length, 6);
            assert.match(page, /class="mv-tile is-suits" data-mv="ring"/, 'a bell rings');
            assert.ok(page.includes('&lt;ov-icon name=&quot;bell&quot; motion=&quot;ring&quot;&gt;') || page.includes('<ov-icon name="bell" motion="ring">'));
            assert.match(page, /\/css\/icon-motion\.css/, 'the page loads the moves');
            const css = await t.get('/icons/pack/ov-icon-motion.css');
            assert.match(css.headers.get('content-type'), /text\/css/);
            assert.equal(css.headers.get('access-control-allow-origin'), '*');
            for (const id of ['draw', 'pop', 'nudge', 'ring', 'beat', 'shake']) assert.ok(css.text.includes(`.ovm-${id}`), id);
            assert.ok(!/infinite|rotate\(360deg\)|turn\)/.test(css.text), 'nothing loops or spins');
            assert.match(css.text, /@media \(prefers-reduced-motion: reduce\)/);
            assert.match(css.text, /html\[data-ov-motion="reduced"\]/, 'OpenVibe\'s calm setting stops them too');
            const wc = (await t.get('/ov-icon.js')).text;
            for (const k of ['ovm-draw', 'ovm-ring', 'ovm-beat', 'ovm-shake']) assert.ok(wc.includes(`@keyframes ${k}{`) && css.text.includes(`@keyframes ${k} {`), `${k} in both`);
            assert.ok(!/infinite/.test(wc), 'the component loops nothing either');
            assert.ok(wc.includes(":host([data-calm]) svg,:host([data-calm]) svg *{animation:none!important;transition:none!important}"));
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
            assert.equal((map.match(/<loc>https:\/\/openvibe\.design\/icons\/[a-z0-9-]+<\/loc>/g) || []).length, glyphs.NAMES.length + 2, 'each glyph, the alternative and the migration page');
            assert.ok((await t.get('/llms.txt')).text.includes('/icons/font-awesome-alternative'));
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
