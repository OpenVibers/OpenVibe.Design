'use strict';
const assert = require('node:assert/strict');
const { boot, check, done } = require('./helpers/boot');

(async () => {
    const t = await boot();
    try {
        await check('Progress shows every state and its shared assets', async () => {
            const page = await t.get('/progress');
            assert.equal(page.status, 200);
            for (const state of ['waiting', 'sending', 'paused', 'processing', 'done', 'failed']) assert.ok(page.text.includes(`data-demo-state="${state}"`));
            assert.ok(page.text.includes('/shared/ov-upload.js') && page.text.includes('/shared/ov-upload.css'));
            assert.ok(page.text.includes('prefers-reduced-motion') || page.text.includes('Reduced motion'));
        });
        await check('Uploader has the demo, queue code and discoverable links', async () => {
            const page = await t.get('/uploader');
            assert.equal(page.status, 200);
            assert.ok(page.text.includes('data-demo-picker') && page.text.includes('OVUpload.queue'));
            assert.ok((await t.get('/sitemap.xml')).text.includes('/progress'));
            assert.ok((await t.get('/llms.txt')).text.includes('/uploader'));
        });
    } finally { await done(t); }
})();
