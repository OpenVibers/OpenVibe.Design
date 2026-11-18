'use strict';
// /components/picker and /components/session in real Chrome, at 390 and 1280: the demos work, not only render.
// The picker opens from its button, searching narrows the list, a pick lands on the button; several at once keep
// several. The session draws the recorded coding session (the files card, the tools, the approval) and the words
// streaming in after it. No page error and no sideways scroll; the Frame's reads of the live Network are the only
// ignored errors (the test's app is local, so they are cross-origin and refused).
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const h = require('openvibe-shared/browser-harness');
const { boot } = require('./helpers/boot');

if (process.env.OV_SKIP_BROWSER === '1' || !h.findChrome()) {
    console.log('components-picker-session-chrome: skipped (no Chrome)');
    process.exit(0);
}
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function until(p, expr, label, maxMs = 6000) {
    const end = Date.now() + maxMs;
    for (;;) {
        if (await p.evaluate(`!!(${expr})`)) return;
        if (Date.now() > end) throw new Error(`timed out: ${label}`);
        await pause(60);
    }
}
const own = (errors) => errors.filter((e) => !/openvibe\.network\/api\/(themes|frame)/.test(`${e.text} ${e.url || ''}`));

(async () => {
    const t = await boot();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-design-ps-'));
    const browser = await h.launch({ tmpDir: tmp });
    try {
        const context = await browser.newContext();
        for (const width of [390, 1280]) {
            const p = await h.openPage(browser, context, { width, height: 900 });
            await p.goto(`${t.base}/components/picker`, { maxMs: 8000 });
            await until(p, 'window.OpenVibePicker && document.querySelector(\'[data-cr-pick="model"]\')', `${width}: the picker demo`);
            await p.evaluate('document.querySelector(\'[data-cr-pick="model"]\').click()');
            await until(p, 'document.querySelectorAll(".ovp-row").length >= 10', `${width}: the model list opens with every row`);
            await p.evaluate(`(() => { const f = document.querySelector('.ovp-find input, input.ovp-find');
                f.value = 'sonn'; f.dispatchEvent(new Event('input', { bubbles: true })); })()`);
            await until(p, '[...document.querySelectorAll(".ovp-row")].filter((r) => r.offsetParent).length === 1', `${width}: search narrows to one`);
            await p.evaluate('[...document.querySelectorAll(".ovp-row")].find((r) => r.offsetParent).click()');
            await until(p, 'document.querySelector(\'[data-cr-pick-v="model"]\').textContent === "Sonnet 5.5"', `${width}: the pick lands on the button`);
            assert.strictEqual(await p.evaluate('document.querySelector("[data-cr-pick-said]").textContent'), 'Picked Sonnet 5.5.');
            await until(p, '!document.querySelector(".ovp-list") || !document.querySelector(".ovp-list").offsetParent', `${width}: the picker closes`);

            await p.evaluate('document.querySelector(\'[data-cr-pick="sources"]\').click()');
            await until(p, 'document.querySelector(\'.ovp-list[aria-multiselectable="true"]\')', `${width}: several at once`);
            await p.evaluate('document.querySelector(\'.ovp-row[data-id="news"]\').click()');
            await until(p, 'document.querySelector(\'.ovp-row[data-id="news"]\').getAttribute("aria-selected") === "true"', `${width}: a second source chosen`);
            assert.strictEqual(await p.evaluate('document.querySelector(\'.ovp-row[data-id="web"]\').getAttribute("aria-selected")'), 'true', `${width}: the first stays chosen`);
            assert.ok(await p.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), `${width}: no sideways scroll on /components/picker`);
            assert.deepStrictEqual(own(p.state.errors), [], `${width}: no page error on /components/picker`);
            await p.close();

            const s = await h.openPage(browser, context, { width, height: 900 });
            await s.goto(`${t.base}/components/session`, { maxMs: 8000 });
            await until(s, 'document.querySelector("#cr-session .ovse-files-h")', `${width}: the session's files card`, 8000);
            assert.match(await s.evaluate('document.querySelector("#cr-session .ovse-files-h").textContent'), /Changed 2 files/);
            assert.strictEqual(await s.evaluate('getComputedStyle(document.querySelector("#cr-session .ovse-main")).marginTop'), '0px',
                `${width}: the page's own section spacing stays out of the component`);
            assert.ok(await s.evaluate('document.querySelectorAll("#cr-session .ovse-tool-h").length') >= 2, `${width}: the tools it used`);
            assert.match(await s.evaluate('document.querySelector("#cr-session").textContent'), /Run them|Run the tests on Studio PC/, `${width}: the answered approval`);
            await until(s, 'document.querySelector("#cr-session").textContent.includes("All 48 tests pass. Opening the pull request now.")', `${width}: the words stream in`, 8000);
            assert.ok(await s.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), `${width}: no sideways scroll on /components/session`);
            assert.deepStrictEqual(own(s.state.errors), [], `${width}: no page error on /components/session`);
            if (process.env.OV_DESIGN_SHOTS) {
                fs.mkdirSync(process.env.OV_DESIGN_SHOTS, { recursive: true });
                const shot = await s.send('Page.captureScreenshot', { format: 'png' });
                fs.writeFileSync(path.join(process.env.OV_DESIGN_SHOTS, `session-${width}.png`), Buffer.from(shot.data, 'base64'));
            }
            await s.close();
        }
        console.log('components-picker-session-chrome: the picker opens, searches, picks one and several; the session draws and streams, at 390 and 1280');
    } finally {
        await browser.close();
        await t.close();
        fs.rmSync(tmp, { recursive: true, force: true });
    }
})().catch((e) => { console.error(e); process.exit(1); });
