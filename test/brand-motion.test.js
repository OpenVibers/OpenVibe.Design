'use strict';
// The mark's intro as files: every one of them is there, /brand links every one of them with its size, and they are
// served with the right content type and a long life.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { boot, check, done } = require('./helpers/boot');
const { MOTION } = require('../server/views/brand');
const { assetVersion } = require('../server/assets');

const DIR = path.join(__dirname, '..', 'public', 'brand', 'motion');
const TYPES = { '.webm': 'video/webm', '.mp4': 'video/mp4', '.gif': 'image/gif', '.png': 'image/png' };
const url = (name) => {
    const rel = 'brand/motion/' + name;
    return '/' + rel + '?v=' + assetVersion(rel);
};

(async () => {
    const t = await boot();
    try {
        await check('every file is there, and is a real file', async () => {
            assert.equal(MOTION.length, 10, 'the ten motion files');
            for (const f of MOTION) {
                const p = path.join(DIR, f.name);
                assert.ok(fs.existsSync(p), f.name + ' is missing');
                const size = fs.statSync(p).size;
                assert.ok(size > 2048, f.name + ' is too small to be the mark (' + size + ' bytes)');
                if (f.name.endsWith('.gif')) assert.ok(size < 600 * 1024, f.name + ' is over 600 KB (' + size + ' bytes)');
            }
        });

        await check('/brand shows the intro and links every file, with its size', async () => {
            const res = await t.get('/brand');
            assert.equal(res.status, 200);
            const html = res.text;
            for (const f of MOTION) {
                assert.ok(html.includes(`href="${url(f.name)}" download="${f.name}"`), f.name + ' is not linked');
                assert.ok(new RegExp('href="[^"]*' + f.name.replace('.', '\\.') + '[^"]*"[^>]*>.{0,400}?\\d+ (KB|MB)').test(html), f.name + ' has no size beside it');
            }
            assert.ok(html.includes('<video class="br-motion-video"'), 'the intro plays');
            assert.ok(html.includes('muted') && html.includes('loop') && html.includes('playsinline'), 'muted, looping, inline');
            assert.ok(html.includes(url('ov-mark-poster.png')), 'the poster');
            assert.ok(html.includes('/shared/ov-mark.js'), 'the drop-in snippet');
            assert.ok(html.includes('data-size=&quot;64&quot;'), 'the drop-in shows the mark');
        });

        await check('the files are served with the right type, and for a long time', async () => {
            for (const f of MOTION) {
                const res = await t.get(url(f.name));
                assert.equal(res.status, 200, f.name);
                assert.match(res.headers.get('content-type'), new RegExp('^' + TYPES[path.extname(f.name)]));
                const cc = res.headers.get('cache-control') || '';
                assert.ok(cc.includes('max-age=31536000') && cc.includes('immutable'), f.name + ' is not cached for long: ' + cc);
                assert.ok(res.buffer.length > 2048, f.name + ' came back empty');
            }
            const gone = await t.get('/brand/motion/ov-mark-intro.mov');
            assert.equal(gone.status, 404);
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
