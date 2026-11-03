'use strict';
// /forms (2026-11-03): OpenVibe's own form controls, live and copyable. The page draws plain controls in its first HTML
// (they work without JavaScript), loads the shared ov-forms.js, shows every attribute the select reads, and is in the
// menu, the sitemap and llms.txt.
const assert = require('node:assert/strict');
const { boot, check, done } = require('./helpers/boot');
const { ATTRS } = require('../server/views/forms');

(async () => {
    const t = await boot();
    try {
        await check('the page: the select with state and badges, several and search, switches, fields, the attributes', async () => {
            const r = await t.get('/forms');
            assert.equal(r.status, 200);
            const html = r.text;
            assert.match(html, /<select id="fm-agent" name="agent" data-ov-title="Fallback agent">/, 'a plain select in the first HTML');
            assert.match(html, /data-state="ok" data-badge="20% used"/);
            assert.match(html, /data-href="#fm-attrs" data-href-label="Sign in"/, 'a choice that is not ready says how');
            assert.match(html, /<select id="fm-sites" name="sites" multiple/);
            assert.match(html, /<optgroup label="DeepSeek">/);
            assert.match(html, /<input type="checkbox" role="switch" checked>/);
            assert.match(html, /class="ov-field"/);
            assert.match(html, /class="ov-choice"/);
            assert.equal((html.match(/<tr><td><code>/g) || []).length, ATTRS.length, 'every attribute in the table');
            assert.match(html, /\/shared\/ov-forms\.js/, 'the shared script');
            assert.match(html, /\/js\/forms-page\.js/);
            assert.match(html, /data-ov-forms=&quot;off&quot;|data-ov-forms="off"/, 'how a site keeps the browser\'s own');
        });
        await check('found: the menu, the sitemap and llms.txt', async () => {
            assert.ok((await t.get('/')).text.includes('/forms'), 'the menu');
            assert.ok((await t.get('/sitemap.xml')).text.includes('https://openvibe.design/forms'));
            assert.ok((await t.get('/llms.txt')).text.includes('/forms'));
        });
    } finally {
        await done(t);
    }
})();
