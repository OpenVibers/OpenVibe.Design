'use strict';
// Every glyph as a CSS class (plan L50: "a CSS file of every mask class"): /icons.css gives icon-<name> for every glyph,
// is-solid where a solid drawing exists, one shared rule for the shape, and ?names= for a smaller file. Open to any site.
const assert = require('node:assert/strict');
const { boot, check, done } = require('./helpers/boot');
const glyphs = require('openvibe-shared/glyphs');

(async () => {
    const t = await boot();
    try {
        await check('the whole set: one rule for the shape, a class per glyph, solids where they differ', async () => {
            const res = await t.get('/icons.css');
            assert.equal(res.status, 200);
            assert.match(String(res.headers.get('content-type')), /text\/css/);
            assert.equal(res.headers.get('access-control-allow-origin'), '*', 'any site may link it');
            const css = res.text;
            assert.ok(css.includes('[class^="icon-"],[class*=" icon-"]{--ovi:linear-gradient(transparent,transparent);display:inline-block;width:1em;height:1em;'), 'one rule for the shape');
            assert.ok(css.includes('mask:var(--ovi) center/contain no-repeat'));
            assert.ok(css.includes('{--ovi:linear-gradient(transparent,transparent);'), 'a name that is not a glyph draws nothing, not a square');
            const classes = css.match(/^\.icon-[a-z0-9-]+\{--ovi:url\("data:image\/svg\+xml,/gm) || [];
            assert.equal(classes.length, glyphs.NAMES.length, 'a class for every glyph');
            assert.ok(/^\.icon-search\.is-solid\{--ovi:url\(/m.test(css), 'search has a solid');
            assert.ok(!/^\.icon-check\.is-solid\{/m.test(css), 'a glyph of lines only has no solid rule');
            assert.ok(!/currentColor/.test(css.split('\n').slice(3).join('\n')), 'the pictures are masks: plain black shapes');
        });

        await check('?names= keeps the file to those glyphs, and ignores what is not one', async () => {
            const res = await t.get('/icons.css?names=search,heart,search,not-a-glyph,%3Cx%3E');
            assert.equal(res.status, 200);
            const rules = res.text.match(/^\.icon-[a-z0-9-]+\{/gm) || [];
            assert.deepEqual(rules, ['.icon-search{', '.icon-heart{'], 'each once, in order, nothing else');
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
