'use strict';
// /motion: how OpenVibe moves (plan L45). The page is whole without JavaScript: every effect is shown as plain markup
// with its data-fx words (the navbar's ov-fx.js brings them to life), with what each one says and the word to copy;
// the shared curves are drawn from their real cubic-bezier points; the rules and the code are there; and the page is
// listed in the menu and the sitemap.
const assert = require('node:assert/strict');
const { boot, check, done } = require('./helpers/boot');
const { EFFECTS, CURVES, curvePath } = require('../server/views/motion');

(async () => {
    const t = await boot();
    try {
        await check('every effect is live, explained, and one word to copy', async () => {
            const res = await t.get('/motion');
            assert.equal(res.status, 200);
            const html = res.text;
            assert.ok(html.includes('<h1 class="mo-h1">Motion that means something.</h1>'));
            assert.ok(html.includes('data-mo-hero') && html.includes('data-glow'), 'the hero mark, glowing, for ov-mark.js');
            for (const e of EFFECTS) {
                assert.ok(html.includes(`id="mo-${e.id}"`), `${e.name}: its card`);
                assert.ok(html.includes(`data-fx="${e.fx}"`), `${e.name}: live markup`);
                assert.ok(new RegExp(`<code>data-fx=("|&quot;|&#34;)${e.fx}("|&quot;|&#34;)</code>`).test(html), `${e.name}: the words to copy`);
            }
            assert.ok(/data-fx="[^"]*"/.test(html), 'the navbar loads ov-fx.js for this page');
            assert.ok(html.includes('Nothing spins.') && html.includes('Calm wins.') && html.includes('Never hide to animate.'), 'the rules');
            assert.ok(/\/shared\/ov-fx\.js(&quot;|&#34;) defer&gt;&lt;\/script&gt;/.test(html) && html.includes('OVFx.confetti'), 'the code');
            assert.ok(html.includes('css/motion.css') && html.includes('js/motion.js'), 'its own style and script');
        });
        await check('the curves are drawn from their points, and the timing is the kit\'s', async () => {
            const html = (await t.get('/motion')).text;
            for (const c of CURVES) {
                assert.ok(html.includes(`d="${curvePath(c.bezier)}"`), `${c.name}: its curve`);
                assert.ok(html.includes(`--mo-ease:var(${c.token})`), `${c.name}: the dot races on the shared token`);
            }
            assert.equal(curvePath([0.34, 1.56, 0.64, 1]), 'M0 100C34 -56 64 0 100 0', 'a spring overshoots above the box');
            for (const tok of ['--ov-dur-1', '--ov-dur-2', '--ov-dur-3', '--ov-dur-4']) assert.ok(html.includes(`<code>${tok}</code>`), tok);
        });
        await check('the script only adds conveniences, and the route and listing are wired', async () => {
            const fs = require('node:fs');
            const path = require('node:path');
            const js = fs.readFileSync(path.join(__dirname, '..', 'public/js/motion.js'), 'utf8');
            assert.match(js, /replay\.hidden = false/, 'Play it again appears only with JavaScript');
            assert.match(js, /OVMark\.intro\(hero\)/, 'and replays the mark\'s own intro');
            assert.match(js, /classList\.add\('is-run'\)/, 'the curves race on a press');
            const pages = fs.readFileSync(path.join(__dirname, '..', 'server/http/pages.js'), 'utf8');
            assert.match(pages, /r\.get\('\/motion'/);
            const discovery = fs.readFileSync(path.join(__dirname, '..', 'server/http/discovery.js'), 'utf8');
            assert.match(discovery, /path: '\/motion'/);
        });
        await check('it is in the menu and the sitemap', async () => {
            const home = (await t.get('/')).text;
            assert.ok(home.includes('href="/motion"'), 'the menu');
            const map = (await t.get('/sitemap.xml')).text;
            assert.ok(map.includes('/motion</loc>'), 'the sitemap');
        });
    } finally {
        await done(t);
    }
})();
