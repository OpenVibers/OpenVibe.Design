'use strict';
/**
 * The pages and the plumbing: /, /studio, /t/:slug, /developers, the 404; public vs signed-in cache policy; the
 * crawl artifacts (robots.txt, sitemap.xml with the public themes, llms.txt); health and truthful readiness; the
 * release manifest and content-hashed static assets.
 */
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');
const { assetVersion } = require('../server/assets');

(async () => {
    const t = await boot();
    const user = t.network.addUser('kim');

    await check('the home page lists the catalogue, escaped, and is publicly cacheable', async () => {
        const r = await t.get('/');
        assert.strictEqual(r.status, 200);
        assert.match(r.text, /Your look, everywhere/);
        assert.match(r.text, /href="\/tokens"/, 'the nav and the home lead to the tokens');
        assert.match(r.text, /<a class="ds-swatch" href="\/t\/aurora">[\s\S]*?<span class="ds-swatch-name">Aurora<\/span>/);
        assert.match(r.text, /<main id="main"/);
        const ld = [...r.text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])).flatMap((b) => b['@graph'] || [b]);
        assert.ok(ld.some((x) => x['@type'] === 'WebSite'), 'home has WebSite JSON-LD');
        const org = ld.find((x) => x['@type'] === 'Organization');
        assert.ok(org && Array.isArray(org.sameAs) && org.sameAs.includes('https://github.com/OpenVibers'), 'home has the OpenVibe Organization');
        assert.strictEqual(r.headers.get('cache-control'), 'public, max-age=120');
        assert.match(r.headers.get('vary'), /Cookie/i);
    });

    await check('/studio includes the studio script and stylesheet, and says who is signed in', async () => {
        const r = await t.get('/studio');
        assert.strictEqual(r.status, 200);
        assert.match(r.text, /\/js\/studio\.js\?v=[0-9a-f]{10}/);
        assert.match(r.text, /\/css\/design\.css\?v=[0-9a-f]{10}/);
        assert.match(r.text, /Sign in to use a theme/);
        assert.strictEqual(r.headers.get('cache-control'), 'public, max-age=120');
        const me = await t.get('/studio', { as: user });
        assert.strictEqual(me.status, 200);
        assert.match(me.text, /kim/);
        assert.strictEqual(me.headers.get('cache-control'), 'private, no-store', 'a signed-in page is never cached');
    });

    await check('one theme, a missing theme, developers and an unknown page', async () => {
        const one = await t.get('/t/aurora');
        assert.strictEqual(one.status, 200);
        assert.match(one.text, /Aurora/);
        assert.match(one.text, /--bg-primary/);
        const missing = await t.get('/t/nope');
        assert.strictEqual(missing.status, 404);
        assert.match(missing.text, /Nothing here/);
        const dev = await t.get('/developers');
        assert.strictEqual(dev.status, 200);
        assert.match(dev.text, /GET \/api\/themes/);
        const gone = await t.get('/not-a-page');
        assert.strictEqual(gone.status, 404);
    });

    await check('robots.txt, sitemap.xml and llms.txt describe the public pages', async () => {
        const robots = await t.get('/robots.txt');
        assert.strictEqual(robots.status, 200);
        assert.match(robots.text, /Sitemap: https:\/\/openvibe\.design\/sitemap\.xml/);
        assert.match(robots.text, /Disallow: \/api\//);
        const sitemap = await t.get('/sitemap.xml');
        assert.strictEqual(sitemap.status, 200);
        assert.match(sitemap.headers.get('content-type'), /application\/xml/);
        assert.match(sitemap.text, /<loc>https:\/\/openvibe\.design\/<\/loc>/);
        assert.match(sitemap.text, /<loc>https:\/\/openvibe\.design\/studio<\/loc>/);
        assert.match(sitemap.text, /<loc>https:\/\/openvibe\.design\/t\/aurora<\/loc>/);
        const llms = await t.get('/llms.txt');
        assert.strictEqual(llms.status, 200);
        assert.match(llms.text, /OpenVibe\.Design/);
        assert.match(llms.text, /https:\/\/openvibe\.design\/api\/themes/);
    });

    await check('health and readiness are honest; a Network outage is degraded, not down', async () => {
        const health = await t.get('/api/health');
        assert.strictEqual(health.status, 200);
        assert.strictEqual(health.json().status, 'ok');
        assert.strictEqual(health.json().service, 'openvibe-design');
        assert.strictEqual(health.json().version, '0.1.0');
        const ready = await t.get('/api/ready');
        assert.strictEqual(ready.status, 200);
        assert.strictEqual(ready.json().ready, true);
        assert.strictEqual(ready.json().checks.network.status, 'ok');
        t.network.setDown(true);
        const degraded = await t.get('/api/ready');
        t.network.setDown(false);
        assert.strictEqual(degraded.status, 200, 'the process still serves');
        assert.strictEqual(degraded.json().ready, true);
        assert.strictEqual(degraded.json().status, 'degraded');
        assert.ok(degraded.json().degraded.includes('network'));
    });

    await check('the release manifest and content-hashed static assets', async () => {
        const rel = await t.get('/release.json');
        assert.strictEqual(rel.status, 200);
        assert.strictEqual(rel.json().service, 'design');
        assert.match(rel.headers.get('content-type'), /application\/json/);
        const css = await t.get('/css/design.css');
        assert.strictEqual(css.status, 200);
        const hashed = await t.get(`/css/design.css?v=${assetVersion('css/design.css')}`);
        assert.strictEqual(hashed.status, 200);
        assert.strictEqual(hashed.headers.get('cache-control'), 'public, max-age=31536000, immutable');
        const js = await t.get(`/js/studio.js?v=${assetVersion('js/studio.js')}`);
        assert.strictEqual(js.status, 200);
        assert.match(js.headers.get('content-type'), /javascript/);
        const shared = await t.get('/shared/room.css');
        assert.strictEqual(shared.status, 200);
    });

    await t.close();
    done();
})().catch((err) => { console.error(err); process.exit(1); });
