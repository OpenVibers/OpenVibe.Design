'use strict';
/**
 * openvibe.design/prompts (the owner, 2026-11-01: "publishing the prompts… public facing"): every prompt the service
 * sends, word for word, built by the same functions that send them, so the page cannot drift; the same list as JSON.
 */
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');
const { systemPrompt } = require('../server/arena/ai');
const { themePrompt, editPrompt } = require('../server/designs');
const { SYSTEM } = require('../server/glyphs/drafts');

const unescape = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

(async () => {
    const t = await boot();
    try {
        await check('the page shows each prompt as the code builds it', async () => {
            const r = await t.get('/prompts');
            assert.strictEqual(r.status, 200);
            const html = unescape(r.text);
            assert.ok(html.includes(systemPrompt('{category}')), 'the page-design system prompt');
            assert.ok(html.includes(themePrompt('{your prompt}', ["{the theme's colour variables}"])), 'the theme prompt');
            assert.ok(html.includes(editPrompt('{your instruction}', '{the current page}', "{the theme's colour variables}")), 'the edit prompt');
            assert.ok(html.includes(SYSTEM.slice(0, 200)), 'the icon prompt');
            assert.match(r.text, /href="\/prompts"/, 'linked from the navigation');
        });
        await check('the same list as JSON, cacheable', async () => {
            const r = await t.get('/api/v1/prompts');
            assert.strictEqual(r.status, 200);
            assert.deepStrictEqual(r.json().prompts.map((p) => p.id), ['design-page', 'design-theme', 'design-edit', 'glyph-draft']);
            assert.match(r.headers.get('cache-control') || '', /public/);
        });
    } finally { await t.close(); }
    done();
})().catch((e) => { console.error(e); process.exit(1); });
