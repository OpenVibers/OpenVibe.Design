'use strict';
// The corner of a ground (plan AB.29, 2026-11-14): one scale for the marks, the app icons and the PNG maker. The
// four names (none, soft, round, squircle) are a choice a URL may make wherever a ground is taken; an unknown name is
// refused; and a file with no rounding given is drawn exactly as it was before.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { boot, check, done } = require('./helpers/boot');
const ex = require('../server/glyphs/export');
const rounding = require('../server/glyphs/rounding');

(async () => {
    const t = await boot();
    try {
        await check('the scale: four names, one set of numbers', async () => {
            assert.deepEqual(rounding.ROUNDINGS, ['none', 'soft', 'round', 'squircle']);
            assert.deepEqual(ex.ROUNDINGS, rounding.ROUNDINGS, 'the export knows the same names');
            assert.equal(rounding.CORNERS.none, 0);
            assert.equal(rounding.CORNERS.soft, 0.12, 'a 12 % corner');
            assert.equal(rounding.CORNERS.round, 0.225, 'the app icon\'s corner');
            assert.equal(rounding.SQUIRCLE_N, 5, 'the squircle is a superellipse');
            // One module: every ground drawing uses it.
            const src = fs.readFileSync(path.join(__dirname, '..', 'server', 'glyphs', 'export.js'), 'utf8');
            assert.match(src, /require\('\.\/rounding'\)/, 'the export draws its ground through the scale');
        });

        await check('each name draws its own corner', async () => {
            const tile = (r) => (ex.svg('eye', ex.options({ ground: 'square', rounding: r, size: 48, bg: '000000' })).match(/<(rect|path)[^>]*>/) || [''])[0];
            assert.equal(tile('none'), '<rect width="24" height="24" fill="#000000"/>', 'no corner at all');
            assert.equal(tile('soft'), '<rect width="24" height="24" rx="2.88" fill="#000000"/>', 'a 12 % corner');
            assert.equal(tile('round'), '<rect width="24" height="24" rx="5.4" fill="#000000"/>', 'the app icon\'s corner');
            const sq = tile('squircle');
            assert.ok(sq.startsWith('<path d="M'), 'the squircle is a path, not a rounded rectangle');
            assert.ok(sq.includes('Z" fill="#000000"/>'), 'and it fills the ground');
            // The squircle keeps a curve along the side: it is squarer than a circle, rounder than a square.
            const path = ex.svg('eye', ex.options({ ground: 'square', rounding: 'squircle', size: 48 })).match(/<path d="([^"]+)"/)[1];
            const nums = path.slice(1, -1).split('L').map((p) => p.split(' ').map(Number));
            assert.ok(nums.length > 60, 'drawn with enough points to look smooth');
            const corner = nums.map(([x, y]) => Math.max(Math.abs(x - 12), Math.abs(y - 12)));
            assert.ok(Math.max(...corner) >= 11.9, 'it reaches the tile\'s corner');
            assert.ok(Math.max(...corner) < 12.001, 'and no further');
        });

        await check('a circle ignores the corner; nothing behind the glyph has no ground to round', async () => {
            const circle = (r) => ex.svg('eye', ex.options({ ground: 'circle', rounding: r, size: 48, bg: '000000' }));
            assert.equal(circle('round'), circle('none'), 'the same circle either way');
            assert.ok(circle('round').includes('<circle cx="12" cy="12" r="12" fill="#000000"/>'));
            const none = ex.svg('eye', ex.options({ ground: 'none', rounding: 'squircle', size: 48, bg: '000000' }));
            assert.ok(!none.includes('fill="#000000"'), 'no ground at all');
        });

        await check('an unknown name is refused, with a plain message', async () => {
            for (const bad of ['squarish', 'ROUND', '0', 'soft;']) {
                const res = await t.get(`/icons/eye.svg?ground=square&rounding=${encodeURIComponent(bad)}`);
                assert.equal(res.status, 400, `rounding=${bad}`);
                assert.match(res.headers.get('content-type') || '', /text\/plain/, 'a plain message');
                assert.match(res.text, /rounding must be one of: none, soft, round, squircle/);
            }
            // Everywhere a ground is taken.
            assert.equal((await t.get('/icons/eye.png?rounding=nope')).status, 400);
            assert.equal((await t.get('/icons/eye.xml?rounding=nope')).status, 400);
            assert.equal((await t.get('/icons/eye/favicon.zip?rounding=nope')).status, 400);
            assert.equal((await t.get('/icons/eye?rounding=nope')).status, 400, 'the maker\'s page too');
            // A name of the four is welcome everywhere.
            assert.equal((await t.get('/icons/eye.svg?rounding=soft')).status, 200);
            assert.equal((await t.get('/icons/eye.png?rounding=squircle')).status, 200);
        });

        await check('with no rounding given, the file is the one it always was', async () => {
            // The squircle ground has always been a rounded square with the app icon\'s corner: the same bytes.
            const old = '<rect width="48" height="48" rx="10.8" fill="#000000"/>';
            const res = await t.get('/icons/eye.svg?size=64&color=ff0000&stroke=1.5&pad=25&ground=squircle&bg=000000');
            assert.equal(res.status, 200);
            assert.ok(res.text.includes(old), 'the same ground, byte for byte');
            assert.ok(res.text.includes('<g transform="translate(12 12)" fill="none" stroke="#ff0000" stroke-width="1.5"'));
            // A plain square has square corners, as before.
            assert.ok((await t.get('/icons/eye.svg?ground=square&bg=000000')).text.includes('<rect width="24" height="24" fill="#000000"/>'));
            // The link does not say a corner the ground already has.
            assert.equal(ex.query(ex.options({ ground: 'squircle' })), '?ground=squircle', 'the ground\'s own corner stays out of the link');
            assert.equal(ex.query(ex.options({ ground: 'square' })), '?ground=square');
            assert.equal(ex.query(ex.options({ ground: 'square', rounding: 'soft' })), '?ground=square&rounding=soft');
            assert.equal(ex.query(ex.options({ ground: 'squircle', rounding: 'none' })), '?ground=squircle&rounding=none');
            assert.equal(ex.options({}).rounding, 'none', 'no ground, no corner');
            assert.equal(ex.options({ ground: 'squircle' }).rounding, 'round', 'the old ground keeps its corner');
            assert.equal(ex.options({ ground: 'square' }).rounding, 'none', 'a square keeps square corners');
        });

        await check('the maker offers the corner, and the preview follows it', async () => {
            const page = (await t.get('/icons/eye')).text;
            assert.ok(page.includes('<select name="rounding" data-gp="rounding">'), 'the control');
            assert.ok(page.includes('data-gp-round-field'), 'it is beside the ground');
            for (const [v, label] of [['none', 'None, square corners'], ['soft', 'Soft: a 12% corner'], ['round', 'Round: the app-icon corner'], ['squircle', 'Squircle: the superellipse']]) {
                assert.ok(new RegExp(`<option value="${v}"[^>]*>${label}</option>`).test(page), v);
            }
            // The page remembers a corner asked for.
            assert.ok((await t.get('/icons/eye?ground=square&rounding=soft')).text.includes('<option value="soft" selected>'), 'the corner it was given');
            // And the live preview asks for it too.
            const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'icon.js'), 'utf8');
            assert.match(js, /rounding: 'none' \}/, 'the maker knows the field');
            assert.match(js, /if \(v !== GROUND_ROUNDING\[ground\]\) p\.set\(k, v\)/, 'and says it when it is not the ground\'s own');
            assert.match(js, /GROUND_ROUNDING = \{ none: 'none', circle: 'none', square: 'none', squircle: 'round' \}/);
        });

        await check('the PNG is drawn with the corner too', async () => {
            const soft = await t.get('/icons/eye.png?ground=square&rounding=soft&size=32');
            assert.equal(soft.status, 200);
            assert.equal(soft.headers.get('content-type'), 'image/png');
            const round = await t.get('/icons/eye.png?ground=square&rounding=round&size=32');
            assert.equal(round.status, 200);
            assert.ok(!soft.buffer.equals(round.buffer), 'the two corners are two pictures');
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
