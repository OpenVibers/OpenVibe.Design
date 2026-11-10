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
        assert.ok(js.includes('This device asks for less motion, so you are seeing the calm versions') && js.includes('Calm is on: every effect here plays, smaller and slower.') && js.includes('Motion is off, so nothing on this page moves.'), 'each reason is said in words: the device, Calm, Off');
        assert.ok(js.includes("'Always play in full'") && js.includes("'Turn Calm off everywhere'") && js.includes("'Turn motion back on'"), 'one way out beside the notice, named for what it changes');

        // Calm reduces, only Off removes (openvibe-shared 4.183.0): no stylesheet here stops an effect under Calm or
        // because the device asked for less.
        for (const f of fs.readdirSync(path.join(__dirname, '..', 'public', 'css'))) {
            const css = read(`public/css/${f}`);
            assert.ok(!/prefers-reduced-motion:\s*reduce\)\s*\{[^@]*?(animation|transition)\s*:\s*none/.test(css), `${f}: nothing stops because the device asked for less`);
            assert.ok(!/data-ov-motion="?reduced"?\][^{}]*\{[^}]*(animation|transition)\s*:\s*none/.test(css), `${f}: nothing stops under Calm`);
        }

        // The shared code that honours the scope is the pinned one.
        const fx = fs.readFileSync(path.join(path.dirname(require.resolve('openvibe-shared/package.json')), 'ov-fx.js'), 'utf8');
        assert.ok(fx.includes('[data-fx-demo]'), 'openvibe-shared is 4.180.0 or newer (the demo scope)');
        assert.ok(fx.includes('html[data-ov-motion=off]{--ov-move:0;'), 'and 4.183.0 or newer (Calm reduces, only Off removes)');

        const pages = ['/motion', '/brand'];
        const answers = await Promise.all(pages.map((p) => t.get(p)));
        answers.forEach((r, i) => {
            assert.strictEqual(r.status, 200, pages[i]);
            assert.match(r.text, /\/js\/demo-motion-controls\.js\?v=[0-9a-f]{10}/, `${pages[i]} loads the controls`);
        });

        // Your look: four Motion choices, and one line under them that says what the chosen one does.
        const look = await t.get('/look');
        for (const [value, label] of [['auto', 'Automatic'], ['full', 'Full'], ['reduced', 'Calm'], ['off', 'Off']]) assert.match(look.text, new RegExp(`name="motion" value="${value}"[^>]*>\\s*<span>${label}</span>`), `Motion offers ${label}`);
        assert.match(look.text, /<p class="lk-motion-note" id="lk-motion-note" aria-live="polite">Follows your device\.<\/p>/);
        const lookJs = read('public/js/look.js');
        assert.ok(lookJs.includes('Every effect still plays, smaller and slower.') && lookJs.includes('Nothing moves.') && lookJs.includes('It asks for less motion, so you get Calm'), 'the line says what each choice does, the device counted in');
        console.log('demo-motion: the real effects play in a demo scope; each reason is said; Calm stops nothing; Your look offers four choices and says what each does');
    } finally {
        await t.close();
    }
})().catch((e) => { console.error(e); process.exit(1); });
