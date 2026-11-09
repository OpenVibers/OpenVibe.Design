'use strict';
// The decision register (/rules), the system map (/system), the theme editor's move to /themes, and the bar.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { boot, check, done } = require('./helpers/boot');
const { AREAS, RULES } = require('../server/rules/register');
const { patterns } = require('../server/patterns/catalog');
const { NAV } = require('../server/render/layout');

(async () => {
    const t = await boot();
    try {
        await check('every rule is whole: a unique id, a known area, a real date, a sentence and a reason', async () => {
            const ids = new Set();
            const areas = new Set(AREAS.map((a) => a.id));
            const today = new Date().toISOString().slice(0, 10);
            for (const r of RULES) {
                assert.ok(/^[a-z0-9-]+$/.test(r.id), `${r.id} id`);
                assert.ok(!ids.has(r.id), `${r.id} is unique`);
                ids.add(r.id);
                assert.ok(areas.has(r.area), `${r.id} area ${r.area}`);
                assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(r.decided) && r.decided <= today, `${r.id} decided ${r.decided}`);
                assert.ok(/[.!?]$/.test(r.rule) && r.rule.length <= 120, `${r.id}: one sentence`);
                assert.ok(r.detail && r.why, `${r.id} detail and why`);
            }
            for (const a of AREAS) assert.ok(RULES.some((r) => r.area === a.id), `${a.id} has rules`);
        });

        await check('what a rule points at exists: patterns by slug, pages by route, tests by file', async () => {
            const slugs = new Set(patterns.map((p) => p.slug));
            for (const r of RULES) {
                for (const s of r.see) {
                    const m = s.href.match(/^\/patterns\/([a-z0-9-]+)$/);
                    if (m) assert.ok(slugs.has(m[1]), `${r.id} → pattern ${m[1]}`);
                    else if (s.href.startsWith('/')) assert.equal((await t.get(s.href)).status, 200, `${r.id} → ${s.href}`);
                }
                for (const c of r.checked) {
                    const file = c.match(/^test\/[\w.-]+\.js$/);
                    if (file) assert.ok(fs.existsSync(path.join(__dirname, '..', c)), `${r.id} checked by ${c}`);
                }
            }
        });

        await check('/rules shows every rule under its area, with its date and an anchor', async () => {
            const res = await t.get('/rules');
            assert.equal(res.status, 200);
            for (const r of RULES) assert.ok(res.text.includes(`id="${r.id}"`), r.id);
            for (const a of AREAS) assert.ok(res.text.includes(`id="area-${a.id}"`), a.id);
            assert.ok(res.text.includes('How OpenVibe decides.'));
            assert.ok(res.text.includes(`${RULES.length}`), 'the count');
            assert.ok(!/spin/i.test(res.text.replace(/no-spin|spinning|spinner/gi, '')), 'no spinner on the rules page');
        });

        await check('the register as Markdown and as JSON', async () => {
            const md = await t.get('/rules.md');
            assert.equal(md.status, 200);
            assert.match(md.headers.get('content-type'), /markdown/);
            for (const r of RULES) assert.ok(md.text.includes(r.rule), r.id);
            const js = await t.get('/api/v1/rules');
            assert.equal(js.status, 200);
            const body = js.json();
            assert.equal(body.count, RULES.length);
            assert.equal(body.rules.length, RULES.length);
            assert.ok(body.rules.every((r) => r.url.endsWith(`/rules#${r.id}`)));
            assert.equal(js.headers.get('access-control-allow-origin'), '*');
        });

        await check('/system maps every reference page, and a count is shown only where it is counted', async () => {
            const res = await t.get('/system');
            assert.equal(res.status, 200);
            for (const href of ['/themes', '/tokens', '/fonts', '/icons', '/brand', '/motion', '/components', '/kit', '/forms', '/loading', '/progress', '/uploader', '/rules', '/patterns', '/prompts', '/native', '/developers']) {
                assert.ok(res.text.includes(`href="${href}"`), href);
            }
            assert.ok(res.text.includes(`${RULES.length} rules`), 'the rules count');
            assert.ok(res.text.includes(`${patterns.length} patterns`), 'the patterns count');
            assert.ok(!/<em>0 /.test(res.text), 'no zero counts');
        });

        await check('the theme editor is /themes, and /studio answers 301 with its query', async () => {
            assert.equal((await t.get('/themes')).status, 200);
            const old = await t.get('/studio?theme=forest');
            assert.equal(old.status, 301);
            assert.equal(old.headers.get('location'), '/themes?theme=forest');
            assert.equal((await t.get('/studio')).headers.get('location'), '/themes');
        });

        await check('the pages that moved point at /themes, and the rules page brings its own files', async () => {
            for (const asset of ['/js/rules.js', '/css/rules.css', '/js/look.js', '/js/studio.js']) assert.equal((await t.get(asset)).status, 200, asset);
            assert.ok((await t.get('/look')).text.includes('href="/themes"'), 'Your look sends people to /themes');
            assert.ok(!(await t.get('/components/registry')).text.includes('href="/studio'), 'the registry has no /studio link');
            assert.ok((await t.get('/patterns/tabs-not-folds')).text.includes('never split content'), 'tabs are for settings, never content');
        });

        await check('the bar holds six places, the rest under More, and no two share an icon', async () => {
            const bar = NAV.filter((l) => !l.more);
            assert.equal(bar.length, 6, bar.map((l) => l.label).join(', '));
            assert.deepEqual(bar.map((l) => l.href), ['/', '/create', '/themes', '/look', '/arena', '/system']);
            const icons = NAV.map((l) => l.icon);
            assert.equal(new Set(icons).size, icons.length, 'one icon per place');
            assert.ok(NAV.every((l) => l.label.length <= 22), 'labels stay short');
        });
    } finally {
        await t.close();
    }
    done();
})().catch((error) => { console.error(error); process.exitCode = 1; });
