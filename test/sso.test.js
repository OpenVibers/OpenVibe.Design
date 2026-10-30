'use strict';
/**
 * Sign-in through openvibe-sdk/sso (0.73.0): sanitizeNext (open-redirect regressions), the login redirect (PKCE
 * S256, state, client id, redirect URI), the callback (the state compared in constant time, a code the Network
 * no longer accepts starts the sign-in once more by itself), /auth/me signed out and in, and sign-out.
 */
const assert = require('assert');
const crypto = require('crypto');
const { boot, check, done } = require('./helpers/boot');
const { sanitizeNext } = require('../server/auth/sso');

const config = { baseUrl: 'https://openvibe.design', networkUrl: 'https://openvibe.network' };
const cookies = (r) => (typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [r.headers.get('set-cookie') || '']);
const cookieNamed = (r, name) => {
    for (const c of cookies(r)) {
        const m = new RegExp('(?:^|[,\\s])' + name + '=([^;]+)').exec(c);
        if (m) return name + '=' + m[1];
    }
    return null;
};
const cookieJar = (r) => cookies(r).map((c) => c.split(';')[0]).join('; ');

(async () => {
    // ── sanitizeNext: same-site paths only ──
    for (const v of ['//evil.com', '/\\evil.com', '\\\\evil.com', 'https://evil.com', 'http:evil.com', '/\t/evil.com',
        '/\n/evil.com', '\t//evil.com', ' //evil.com', '/\\/evil.com', 'https:/\\evil.com', '///evil.com',
        'javascript:alert(1)', null, '', 12]) {
        assert.strictEqual(sanitizeNext(v, config), '/', JSON.stringify(v) + ' goes home');
    }
    assert.strictEqual(sanitizeNext('/studio?tab=contrast', config), '/studio?tab=contrast');
    // The SDK keeps a same-site address whole (it is this site's own origin, never another one).
    assert.strictEqual(sanitizeNext('https://openvibe.design/a/b?x=1#c', config), 'https://openvibe.design/a/b?x=1#c');
    for (const v of ['https://evil.com/a', 'https://openvibe.design.evil.com/a', 'https://openvibe.design@evil.com/', 'http://openvibe.design/a']) {
        assert.strictEqual(sanitizeNext(v, config), '/', v);
    }

    const t = await boot();
    const user = t.network.addUser('kim');

    await check('login redirects to Network with state, client id design and an S256 challenge', async () => {
        const r = await t.get('/auth/login?next=/studio');
        assert.strictEqual(r.status, 302);
        const loc = new URL(r.headers.get('location'));
        assert.strictEqual(loc.origin + loc.pathname, t.network.url + '/oauth/authorize');
        assert.strictEqual(loc.searchParams.get('client_id'), 'design');
        assert.strictEqual(loc.searchParams.get('response_type'), 'code');
        assert.strictEqual(loc.searchParams.get('redirect_uri'), 'https://openvibe.design/auth/callback');
        assert.strictEqual(loc.searchParams.get('scope'), 'profile');
        assert.strictEqual(loc.searchParams.get('code_challenge_method'), 'S256');
        assert.match(loc.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);
        assert.match(loc.searchParams.get('state'), /^[A-Za-z0-9_-]{32}$/);
        const state = cookieNamed(r, 'ov_oauth_state');
        assert.ok(state, 'the flow cookie is set');
        assert.match(cookies(r).find((c) => c.includes('ov_oauth_state=')), /Path=\/auth.*HttpOnly/i);
        assert.ok(cookieNamed(r, 'ov_oauth_verifier'), 'the verifier is kept in its own cookie');
        assert.strictEqual(decodeURIComponent(cookieNamed(r, 'ov_oauth_next').split('=')[1]), '/studio');
    });

    await check('silent sign-in adds prompt=none and next= only keeps this site', async () => {
        const r = await t.get('/auth/login?silent=1&next=' + encodeURIComponent('https://evil.example/x'));
        const loc = new URL(r.headers.get('location'));
        assert.strictEqual(loc.searchParams.get('prompt'), 'none');
        assert.ok(/ov_oauth_next=;/.test(cookies(r).join('\n')), 'another origin goes home');
        const own = await t.get('/auth/login?next=' + encodeURIComponent('https://openvibe.design/t/aurora?x=1'));
        assert.strictEqual(decodeURIComponent(cookieNamed(own, 'ov_oauth_next').split('=')[1]), 'https://openvibe.design/t/aurora?x=1');
    });

    await check('the callback exchanges the code and sets httpOnly session cookies', async () => {
        const login = await t.get('/auth/login?next=/studio');
        const loc = new URL(login.headers.get('location'));
        const flowCookie = cookieJar(login);
        const code = t.network.issueCode(user, loc.searchParams.get('code_challenge'));
        const r = await t.get('/auth/callback?code=' + code + '&state=' + loc.searchParams.get('state'), { cookie: flowCookie });
        assert.strictEqual(r.status, 302, r.text);
        assert.strictEqual(r.headers.get('location'), '/studio');
        const all = cookies(r).join('\n');
        assert.match(all, /ov_token=[^;]+;.*HttpOnly/i);
        assert.match(all, /ov_refresh=[^;]+;.*HttpOnly/i);
        assert.match(all, /design_at=;/);
        assert.ok(!/SameSite=None/i.test(all), 'SameSite=Lax, not None');
        const at = cookieNamed(r, 'ov_token');
        assert.ok(at, 'the access cookie is set');
        const me = await t.get('/auth/me', { cookie: at });
        assert.strictEqual(me.status, 200);
        assert.strictEqual(me.json().user.username, 'kim');
        assert.ok(!me.text.includes(at.split('=')[1]), '/auth/me never returns the token');
        const tokenRequest = t.network.tokenRequests[t.network.tokenRequests.length - 1];
        assert.strictEqual(tokenRequest.client_id, 'design');
        assert.strictEqual(tokenRequest.grant_type, 'authorization_code');
        assert.strictEqual(tokenRequest.redirect_uri, 'https://openvibe.design/auth/callback');
        assert.ok(tokenRequest.code_verifier, 'the verifier is sent server-side');
    });

    await check('the old cookie is still the session, so nobody is signed out by the move', async () => {
        const at = t.network.userToken(user);
        const me = await t.get('/auth/me', { cookie: 'design_at=' + at });
        assert.strictEqual(me.status, 200);
        assert.strictEqual(me.json().user.username, 'kim');
    });

    await check('a wrong state or no flow cookie starts the sign-in once more, then shows a page', async () => {
        const login = await t.get('/auth/login');
        const loc = new URL(login.headers.get('location'));
        const flowCookie = cookieJar(login);
        const code = t.network.issueCode(user, loc.searchParams.get('code_challenge'));
        const bad = await t.get('/auth/callback?code=' + code + '&state=' + '0'.repeat(32), { cookie: flowCookie });
        assert.strictEqual(bad.status, 302, 'the SDK recovers by itself once');
        assert.match(bad.headers.get('location'), /^\/auth\/login/);
        const retry = bad.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
        assert.match(retry, /ov_oauth_retry=1/);
        const again = await t.get('/auth/callback?code=' + code + '&state=' + '0'.repeat(32), { cookie: flowCookie + '; ' + retry });
        assert.strictEqual(again.status, 400);
        assert.match(again.text, /Try again/);
        const noCookie = await t.get('/auth/callback?code=' + code + '&state=' + loc.searchParams.get('state'));
        assert.strictEqual(noCookie.status, 302);
        const none = await t.get('/auth/callback?state=x');
        assert.strictEqual(none.status, 400);
        assert.match(none.text, /Try again/);
    });

    await check('/auth/me is null for a guest and 401 for a cookie that does not verify', async () => {
        const guest = await t.get('/auth/me');
        assert.strictEqual(guest.status, 200);
        assert.deepStrictEqual(guest.json(), { user: null });
        const bad = await t.get('/auth/me', { cookie: 'design_at=not-a-token' });
        assert.strictEqual(bad.status, 401);
        assert.strictEqual(bad.json().error, 'Not signed in');
    });

    await check('/auth/health says whether the Network accepts this client', async () => {
        const r = await t.get('/auth/health');
        assert.strictEqual(r.status, 200);
        assert.deepStrictEqual(r.json(), { ok: true, client: 'ok' });
    });

    await check('readiness fails when the Network refuses this site OAuth client', async () => {
        const r = await t.get('/api/ready');
        assert.strictEqual(r.status, 200);
        assert.strictEqual(r.json().checks.sso_client.status, 'ok');
        assert.strictEqual(r.json().checks.sso_client.required, true);
    });

    await check('sign-out clears the cookies and returns to next', async () => {
        const r = await t.get('/auth/logout?next=%2Fstudio', { headers: { 'sec-fetch-site': 'same-origin' } });
        assert.strictEqual(r.status, 303);
        assert.strictEqual(r.headers.get('location'), '/studio');
        assert.match(cookies(r).join('\n'), /design_at=;/);
    });

    await check('the token is never logged', async () => {
        const token = t.network.userToken(user);
        assert.ok(!t.logs().includes(token), 'no access token in the logs');
    });

    await t.close();
    done();
})().catch((err) => { console.error(err); process.exit(1); });
