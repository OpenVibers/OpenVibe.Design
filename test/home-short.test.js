'use strict';
/**
 * The home on a phone (the owner's short-pages rule, 2026-10-30): the three scenes are one pick block, a row of chips
 * picks one of them, and the parts a reader rarely needs are folds. Radio inputs and :has(), no script for the chips;
 * every scene stays in the page for crawlers; a wider screen shows them all and no chips.
 */
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');

(async () => {
    const t = await boot();
    try {
        await check('the scenes are one pick block: a chip per scene, the first picked, every scene in the page', async () => {
            const r = await t.get('/');
            assert.strictEqual(r.status, 200, r.text);
            const page = r.text;
            const start = page.indexOf('<div class="pick" id="pick-scenes">');
            assert.ok(start > 0, 'the pick block is on the home');
            const block = page.slice(start, page.indexOf('<section aria-labelledby="ds-strip-h">'));
            assert.match(block, /<div class=\"ov-parts ov-parts--front\" data-parts=\"\d+\">/, 'its parts are tabs on a phone');
            const chips = [...block.matchAll(/<label for="ovp-[a-z0-9]+-(?:pp-scenes-)?(ds-scene-\d+)">()()([^<]+)(?: <span class="ov-parts-n">[^<]*<\/span>)?<\/label>/g)];
            assert.strictEqual(chips.length, 3, `a chip per scene (${chips.length})`);
            assert.ok(/<input type=\"radio\" class=\"ov-parts-r\"[^>]* checked>/.test(block), 'the first part is open on a phone (Shared pick(): tabs, 11-12)');
            // Every scene stays in the page, each in its own pane.
            const scenes = [...block.matchAll(/<article class="sc-scene/g)];
            assert.strictEqual(scenes.length, chips.length, 'every scene is in the page');
            for (const m of chips) assert.ok(block.includes(`id="${m[1]}"`), `the pane of ${m[1]} is in the page`);
            assert.ok(block.includes('One theme, every site') && block.includes('Make it with AI, on your theme') && block.includes('See which AI designs best'), 'every scene is named in the page');
        });

        await check('the CSS guard: the chips are hidden and the scenes all show until 640 px and where :has() is understood', async () => {
            const r = await t.get('/');
            const page = r.text;
            const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'css', 'design.css'), 'utf8');
            assert.match(css, /\.pick-row \{ display: none; \}/, 'the chips are hidden by default');
        });

        await check('the parts a reader rarely needs are folds, open in the page and closed on a phone', async () => {
            const r = await t.get('/');
            const page = r.text;
            for (const id of ['dev', 'faq']) {
                assert.ok(page.includes(`<details class="ds-fold ds-fold-block" id="${id}" open>`), `${id} is a fold, open in the page`);
                assert.ok(page.includes(`document.getElementById("${id}")`), `${id} has the script that closes it on a phone`);
            }
            // The content of the folds stays in the page.
            assert.match(page, /<h2 id="ds-dev-h">Your theme, in your app<\/h2>/);
            assert.match(page, /<h2 id="ds-faq-h">Questions<\/h2>/);
            assert.match(page, /MaterialTheme\(/, 'the code samples are still on the page');
        });
    } finally {
        await done(t);
    }
})().catch((e) => { console.error(e); process.exit(1); });
