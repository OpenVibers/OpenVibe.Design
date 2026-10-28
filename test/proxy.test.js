'use strict';
/**
 * The theme API proxy: the catalogue is cached, /api/me/theme is 401 signed out, a PUT forwards the person's token
 * and source 'studio', a cross-site Origin is 403 design.cross_site, a Network 422 passes through, and a Network
 * failure is 502. Also the history restore's positive-integer check.
 */
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');

const ORIGIN = 'https://openvibe.design';

(async () => {
    const t = await boot();
    const user = t.network.addUser('kim');
    const token = t.network.userToken(user);
    const signedIn = { cookie: `design_at=${token}` };
    const writes = (path) => t.network.requests.filter((r) => r.method !== 'GET' && r.path === path);

    await check('GET /api/themes serves the catalogue from memory for five minutes', async () => {
        const before = t.network.state.catalogRequests;
        const one = await t.get('/api/themes');
        assert.strictEqual(one.status, 200);
        assert.strictEqual(one.json().themes.length, 3);
        assert.strictEqual(t.network.state.catalogRequests, before + 1);
        const two = await t.get('/api/themes');
        assert.strictEqual(two.status, 200);
        assert.strictEqual(two.json().themes[1].slug, 'aurora');
        assert.strictEqual(t.network.state.catalogRequests, before + 1, 'the second read is the cached one');
    });

    await check('GET /api/me/theme is a 401 problem when signed out, and private, no-store', async () => {
        const r = await t.get('/api/me/theme');
        assert.strictEqual(r.status, 401);
        assert.match(r.headers.get('content-type'), /application\/problem\+json/);
        assert.strictEqual(r.json().code, 'token.required');
        assert.strictEqual(r.headers.get('cache-control'), 'private, no-store');
    });

    await check('GET /api/me/theme returns theme_id, theme and custom_variables with the person\'s token', async () => {
        const r = await t.get('/api/me/theme', signedIn);
        assert.strictEqual(r.status, 200, r.text);
        const b = r.json();
        assert.strictEqual(b.theme_id, 'vibe');
        assert.strictEqual(b.theme.slug, 'vibe');
        assert.deepStrictEqual(b.custom_variables, { '--bg-primary': '#0b0f1a' });
        assert.strictEqual(r.headers.get('cache-control'), 'private, no-store');
        const active = t.network.requests.filter((x) => x.path === '/api/themes/me/active').pop();
        assert.strictEqual(active.authorization, `Bearer ${token}`);
    });

    await check('PUT /api/me/theme forwards the token and source "studio"', async () => {
        const r = await t.get('/api/me/theme', {
            ...signedIn,
            method: 'PUT',
            json: { theme_id: 'aurora', custom_variables: { '--bg-primary': '#07131f' } },
            headers: { origin: ORIGIN },
        });
        assert.strictEqual(r.status, 200, r.text);
        assert.strictEqual(r.json().source, 'studio');
        const sent = writes('/api/themes/me').pop();
        assert.ok(sent, 'Network received PUT /api/themes/me');
        assert.strictEqual(sent.authorization, `Bearer ${token}`);
        const body = JSON.parse(sent.body);
        assert.deepStrictEqual(body, { theme_id: 'aurora', custom_variables: { '--bg-primary': '#07131f' }, source: 'studio' });
        assert.ok(!t.logs().includes(token), 'the token is never logged');
    });

    await check('a write with another site\'s Origin is 403 design.cross_site (and never reaches Network)', async () => {
        const before = writes('/api/themes/me').length;
        const r = await t.get('/api/me/theme', {
            ...signedIn,
            method: 'PUT',
            json: { theme_id: 'paper' },
            headers: { origin: 'https://evil.example' },
        });
        assert.strictEqual(r.status, 403);
        assert.match(r.headers.get('content-type'), /application\/problem\+json/);
        assert.strictEqual(r.json().code, 'design.cross_site');
        assert.strictEqual(writes('/api/themes/me').length, before, 'no Network write');
        const missing = await t.get('/api/me/theme', { ...signedIn, method: 'PUT', json: { theme_id: 'paper' } });
        assert.strictEqual(missing.status, 403, 'no Origin is not this site');
    });

    await check('a cookie write may say same-origin with Sec-Fetch-Site; a Bearer write needs no Origin', async () => {
        const site = await t.get('/api/me/theme', {
            ...signedIn, method: 'PUT', json: { theme_id: 'paper' }, headers: { 'sec-fetch-site': 'same-origin' },
        });
        assert.strictEqual(site.status, 200, site.text);
        const bearer = await t.get('/api/me/theme', {
            method: 'PUT', json: { theme_id: 'aurora' }, headers: { authorization: `Bearer ${token}` },
        });
        assert.strictEqual(bearer.status, 200, bearer.text);
        const sent = writes('/api/themes/me').pop();
        assert.strictEqual(sent.authorization, `Bearer ${token}`, 'the Bearer token is forwarded, not the cookie');
    });

    await check('a Network 422 answer passes through with its status and body', async () => {
        const r = await t.get('/api/themes/submit', {
            ...signedIn,
            method: 'POST',
            json: { name: 'Taken', slug: 'taken', description: '', mode: 'dark', variables: { '--bg-primary': 'nope' }, tags: [] },
            headers: { origin: ORIGIN },
        });
        assert.strictEqual(r.status, 422, r.text);
        const b = r.json();
        assert.strictEqual(b.code, 'theme.invalid_variables');
        assert.ok(Array.isArray(b.errors));
    });

    await check('history reads and restores through the proxy; a bad id is 400', async () => {
        const history = await t.get('/api/me/theme/history', signedIn);
        assert.strictEqual(history.status, 200);
        assert.strictEqual(history.json().history.length, 2);
        for (const id of ['0', '-1', '1.5', 'abc', '1e3']) {
            const bad = await t.get(`/api/me/theme/history/${encodeURIComponent(id)}/restore`, {
                ...signedIn, method: 'POST', headers: { origin: ORIGIN },
            });
            assert.strictEqual(bad.status, 400, id);
        }
        const ok = await t.get('/api/me/theme/history/2/restore', { ...signedIn, method: 'POST', headers: { origin: ORIGIN } });
        assert.strictEqual(ok.status, 200, ok.text);
        assert.strictEqual(ok.json().id, 2);
        const sent = writes('/api/themes/me/history/2/restore').pop();
        assert.strictEqual(sent.authorization, `Bearer ${token}`);
    });

    await check('a Network failure is a 502 problem', async () => {
        t.network.setDown(true);
        const r = await t.get('/api/themes/aurora');
        assert.strictEqual(r.status, 502, r.text);
        assert.strictEqual(r.json().code, 'network.unavailable');
        const me = await t.get('/api/me/theme', signedIn);
        assert.strictEqual(me.status, 502);
        t.network.setDown(false);
    });

    await t.close();
    done();
})().catch((err) => { console.error(err); process.exit(1); });
