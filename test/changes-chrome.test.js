'use strict';
// The component pages and /changes in real Chrome at 390 and 1280: no console error, no sideways scroll, one request
// per script. The Frame's two reads of the live Network are cross-origin from the test's local app and are the only
// ignored errors: everything a component page itself loads is local and must be clean.
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');
const harness = require('openvibe-shared/browser-harness');

(async () => {
    const t = await boot();
    try {
        await check('the component pages and /changes render with no console errors at 390 and 1280', async () => {
            const routes = ['/changes', '/components/registry', '/components/brand', '/components/menu', '/components/search-pill',
                '/components/quest-card', '/components/avatar', '/components/player', '/components/soft-pages', '/components/icon-ink', '/components/footer'];
            const report = await harness.run({
                base: t.base,
                routes,
                widths: [390, 1280],
                checks: { status: true, errors: true, overflow: true, scripts: true, nojs: false, canonical: false, jsonld: false, axe: false, text: false, navigation: false },
                ignoreErrors: [
                    // The shared Frame asks the live Network for the person's theme, the site record, the online strip
                    // and the pulse. The test's app is local, so those three reads are cross-origin and refused; they
                    // are the Frame's, not a specimen's, and every local file a page loads is still checked.
                    { label: 'the shared Frame reads the live Network API', text: /openvibe\.network\/api\/(themes|frame)(?:\/|\?)/ },
                    { label: 'the shared Frame reads the live Network API', url: /openvibe\.network\/api\/(themes|frame)(?:\/|\?)/ },
                ],
            });
            assert.ok(report.ok, `\n${harness.format(report)}`);
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
