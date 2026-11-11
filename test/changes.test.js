'use strict';
// /changes: every release in the openvibe-shared this site pins, newest first, with its pages, rules and plates.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { boot, check, done } = require('./helpers/boot');
const changes = require('../server/changes');
require('../server/views/changes');
require('../server/views/component-notes');
require('../server/views/component-registry');
require('../server/views/components-list');
require('../server/views/components');
require('../server/http/api');
const { spawnSync } = require('child_process');
const { PUBLIC_DIR } = require('../server/assets');

(async () => {
    const t = await boot();
    try {
        const all = changes.releases();

        await check('/changes lists every release in the pinned CHANGELOG, newest first, in its own words', async () => {
            const r = await t.get('/changes');
            assert.strictEqual(r.status, 200);
            // 136 KB (2026-11-11, was 120): each folded release is a row with its version, title and date as parts.
            assert.ok(Buffer.byteLength(r.text) < 136 * 1024, `${Buffer.byteLength(r.text)} bytes`);
            assert.match(r.text, /Every shared release, and where it shows/);
            assert.match(r.text, new RegExp(`openvibe-shared@${changes.SHARED_VERSION.replace(/\./g, '\\.')}`));
            assert.strictEqual((r.text.match(/data-release="/g) || []).length, 12, 'exactly twelve full releases');
            const folded = [...r.text.matchAll(/<summary><b>([^<]+)<\/b><span class="chg-month-n">(\d+) releases?<\/span><\/summary>/g)];
            assert.strictEqual(folded.reduce((n, m) => n + Number(m[2]), 0), all.length - 12, 'fold counts cover every remaining release');
            assert.strictEqual((r.text.match(/<details class="chg-month">/g) || []).length, folded.length);
            let last = -1;
            for (const [i, release] of all.entries()) {
                const marker = i < 12 ? `data-release="${release.version}"` : `href="/changes/${release.version}"`;
                const at = r.text.indexOf(marker);
                assert.ok(at > last, `${release.version} is in order`);
                last = at;
            }
            assert.ok(r.text.includes('The button becomes its tab; Vibe holds Chat and Agents'), '4.200.0 as written');
            assert.ok(r.text.includes('/changes/1.0.0'), 'the oldest release has its own page');
            assert.ok(r.text.includes('navbar.js no longer ships every glyph'), 'older release title is in the compact archive');
        });

        await check('each version page renders its full release, canonical, TechArticle date, neighbors, and plates', async () => {
            for (let i = 0; i < all.length; i++) {
                const release = all[i];
                const r = await t.get(`/changes/${release.version}`);
                assert.strictEqual(r.status, 200, release.version);
                assert.match(r.text, new RegExp(`canonical" href="https://openvibe\\.design/changes/${release.version.replace(/\./g, '\\.')}`));
                assert.match(r.text, new RegExp(`"datePublished":"${release.date}"`));
                assert.match(r.text, new RegExp(`data-release="${release.version.replace(/\./g, '\\.')}`));
                if (i + 1 < all.length) assert.ok(r.text.includes(`/changes/${all[i + 1].version}`), `${release.version} previous`);
                if (i > 0) assert.ok(r.text.includes(`/changes/${all[i - 1].version}`), `${release.version} next`);
                for (const shot of changes.screenshots(release.version).flatMap((g) => g.files)) {
                    const image = await t.get(shot.href);
                    assert.strictEqual(image.status, 200, shot.href);
                }
            }
            assert.strictEqual((await t.get('/changes/not-a-release')).status, 404);
            assert.strictEqual((await t.get('/changes/specimen-player.mp4')).status, 200);
        });

        await check('each release links the component pages it touches, and every link answers', async () => {
            const r = await t.get('/changes');
            const links = [...new Set([...r.text.matchAll(/href="(\/components\/[a-z0-9-]+)"/g)].map((m) => m[1]))];
            assert.ok(links.length >= 8, `${links.length} component pages linked`);
            for (const href of links) assert.strictEqual((await t.get(href)).status, 200, href);
            assert.match(r.text, /href="\/components\/menu"/);
            assert.match(r.text, /href="\/components\/brand"/);
            assert.match(r.text, /href="\/components\/player"/);
        });

        await check('the rule numbers are the register’s own, and each links to its rule', async () => {
            const r = await t.get('/changes');
            const { RULES } = require('../server/rules/register');
            const rule = RULES.find((x) => x.id === 'button-becomes-its-tab');
            assert.ok(rule && rule.n > 0, 'numbered');
            assert.match(r.text, new RegExp(`href="/rules#button-becomes-its-tab"[^>]*><b>${rule.n}</b>`));
            assert.match(r.text, new RegExp(`href="/rules#places-say-what-they-hold"[^>]*><b>${RULES.find((x) => x.id === 'places-say-what-they-hold').n}</b>`));
        });

        await check('every screenshot path named exists, and 4.195.0 through 4.200.0 each have plates', async () => {
            const r = await t.get('/changes');
            const paths = [...new Set([...r.text.matchAll(/\/changes\/(\d+\.\d+\.\d+)\/([a-z0-9-]+-(?:390|1280)-(?:dark|light)\.webp)/g)].map((m) => m[0]))];
            // 24 plates (2026-11-11, was 40): /changes renders the newest twelve releases; the 4.211.0 pin
            // pushed 4.195.0 and 4.196.0 past that fold, and each still shows its plates on its own page below.
            assert.ok(paths.length >= 24, `${paths.length} plates named`);
            for (const p of paths) assert.ok(fs.existsSync(path.join(PUBLIC_DIR, p)), p);
            for (const v of ['4.195.0', '4.196.0', '4.197.0', '4.198.0', '4.199.0', '4.200.0']) {
                // /changes keeps the newest releases as cards; an older one still names its plates on its own page.
                const one = await t.get(`/changes/${v}`);
                assert.strictEqual(one.status, 200);
                assert.match(one.text, new RegExp(`/changes/${v.replace(/\./g, '\\.')}/[a-z0-9-]+-(390|1280)-(dark|light)\\.webp`), `${v} has plates`);
                assert.ok(fs.existsSync(path.join(PUBLIC_DIR, 'changes', v)), `${v} folder`);
            }
            const { screenshots } = changes;
            const shots = screenshots('4.200.0');
            assert.ok(shots.length >= 3, '4.200.0 names the bar, the menu and the search pill');
            for (const g of shots) assert.strictEqual(g.files.length, 4, `${g.component}: 390 and 1280, dark and light`);
        });

        await check('/api/v1/changes is the same archive as data, CORS open, cached', async () => {
            const r = await t.get('/api/v1/changes');
            assert.strictEqual(r.status, 200);
            assert.strictEqual(r.headers.get('access-control-allow-origin'), '*');
            assert.match(r.headers.get('cache-control'), /max-age=3600/);
            const body = r.json();
            assert.strictEqual(body.schema, 'openvibe.changes@1');
            assert.strictEqual(body.pinned.version, changes.SHARED_VERSION);
            assert.strictEqual(body.releases.length, all.length);
            assert.strictEqual(body.releases[0].version, all[0].version);
            // 4.200.0 is the curated release here: a new pin adds a release at the head, it does not change
            // the pages and rules that release already names. Read it by version, not by its index.
            const curated = body.releases.find((r) => r.version === '4.200.0');
            assert.ok(curated, '4.200.0 is in the archive');
            assert.deepStrictEqual(curated.pages.map((p) => p.key), ['brand', 'menu', 'search-pill', 'dock']);
            assert.ok(curated.rules.some((x) => x.id === 'button-becomes-its-tab' && x.n > 0));
        });

        await check('/api/v1/changes supports limit and before without changing the default shape', async () => {
            const first = (await t.get('/api/v1/changes?limit=2')).json();
            assert.deepStrictEqual(first.releases.map((x) => x.version), all.slice(0, 2).map((x) => x.version));
            const next = (await t.get(`/api/v1/changes?limit=2&before=${all[1].version}`)).json();
            assert.deepStrictEqual(next.releases.map((x) => x.version), all.slice(2, 4).map((x) => x.version));
            assert.deepStrictEqual((await t.get('/api/v1/changes?before=missing')).json().releases, []);
        });

        await check('the sitemap includes each release page', async () => {
            const map = (await t.get('/sitemap.xml')).text;
            for (const release of all) assert.ok(map.includes(`https://openvibe.design/changes/${release.version}`), release.version);
        });

        await check('the home and every component page link the changes archive', async () => {
            assert.match((await t.get('/')).text, /href="\/changes"/, 'the home links it');
            const pages = ['/components/registry', '/components/brand', '/components/menu', '/components/navbar', '/components/search-pill',
                '/components/quest-card', '/components/avatar', '/components/player', '/components/soft-pages', '/components/icon-ink', '/components/footer'];
            for (const href of pages) {
                const r = await t.get(href);
                assert.strictEqual(r.status, 200, href);
                assert.match(r.text, /href="\/changes"/, `${href} links the archive`);
            }
            const registry = await t.get('/components/registry');
            for (const name of ['brand', 'search-pill', 'quest-card', 'avatar', 'player', 'soft-pages', 'icon-ink', 'footer']) {
                assert.match(registry.text, new RegExp(`href="/components/${name}"`), name);
            }
        });

        await check('the capture script refuses a run with no release and names its usage', async () => {
            const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'capture-release.js')], { encoding: 'utf8' });
            assert.strictEqual(r.status, 2);
            assert.match(r.stderr, /usage: node scripts\/capture-release\.js/);
        });

        await check('a light or dark plate has the built-in theme’s own tokens, forced over the account’s', async () => {
            const css = changes.schemeCss('light');
            assert.match(css, /--ov-color-bg-base:\s*#[0-9a-f]{6}\s*!important/);
            assert.match(css, /--bg-primary:\s*var\(--ov-color-bg-base\)\s*!important/);
            assert.match(css, /color-scheme:\s*light/i);
            const r = await t.get('/scheme.css?scheme=light');
            assert.strictEqual(r.status, 200);
            assert.match(r.headers.get('content-type'), /text\/css/);
            assert.strictEqual(r.text, css);
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
