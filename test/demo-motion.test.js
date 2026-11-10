'use strict';
/**
 * The pages that show motion, when motion is reduced (public/js/demo-motion-controls.js).
 *
 * A phone that asks for less motion showed /motion completely still, and "Play animations here" played a stand-in
 * bounce made by this site, not the effects the page describes. The rule now: the page says why nothing moves, and
 * its button plays the REAL effects inside a demo scope (openvibe-shared 4.180.0, data-fx-demo) on this page only.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { boot } = require('./helpers/boot');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

(async () => {
    const t = await boot();
    try {
        const js = read('public/js/demo-motion-controls.js');
        assert.ok(js.includes("setAttribute('data-fx-demo', '')"), 'Play sets the demo scope on the page');
        assert.ok(js.includes("removeAttribute('data-fx-demo')"), 'Stop takes it back');
        assert.ok(!/\.animate\(/.test(js), 'no stand-in animation: what plays is the shared effect itself');
        assert.ok(!js.includes("removeAttribute('data-ov-motion')"), 'the person\'s Motion setting is never touched to play a demo');
        assert.ok(js.includes('This device asks for less motion') && js.includes('Calm is on'), 'both reasons are said in words');

        // The pages' own reduced-motion rules leave the scope alone.
        assert.ok(read('public/css/motion.css').includes('.mo-race.is-run:not([data-fx-demo] *) i{transition:none}'));
        assert.ok(read('public/css/brand.css').includes('.br-chip:not([data-fx-demo] *)'));

        // The shared code that honours the scope is the pinned one.
        const fx = fs.readFileSync(path.join(path.dirname(require.resolve('openvibe-shared/package.json')), 'ov-fx.js'), 'utf8');
        assert.ok(fx.includes('[data-fx-demo]'), 'openvibe-shared is 4.180.0 or newer (the demo scope)');

        const pages = ['/motion', '/brand'];
        const answers = await Promise.all(pages.map((p) => t.get(p)));
        answers.forEach((r, i) => {
            assert.strictEqual(r.status, 200, pages[i]);
            assert.match(r.text, /\/js\/demo-motion-controls\.js\?v=[0-9a-f]{10}/, `${pages[i]} loads the controls`);
        });

        // Your look: the Motion choice says what it is, and has the line for a device that asks for less motion.
        const look = await t.get('/look');
        assert.match(look.text, /name="motion" value="auto"[^>]*>\s*<span>On<\/span>/);
        assert.match(look.text, /name="motion" value="reduced"[^>]*>\s*<span>Calm<\/span>/);
        assert.match(look.text, /<p class="lk-motion-note" id="lk-motion-note" hidden>This device asks for less motion/);
        console.log('demo-motion: the real effects play in a demo scope; the reasons are said; Your look is honest about the device');
    } finally {
        await t.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
