'use strict';
/**
 * Boots OpenVibe.Design on a random port against an in-process Network (test/helpers/network.js), and returns a
 * small HTTP client. Every test file gets its own process, Network and app.
 *
 *   const t = await boot();
 *   t.get(path, { as: user, cookie, json, headers, method })
 *   t.signIn(user) → cookie header value (design_at = a Network user token, as after /auth/callback)
 *   t.logs(), t.close()
 */
const http = require('http');
const { startNetwork } = require('./network');

async function boot(opts = {}) {
    const network = await startNetwork(opts.network || {});
    const env = {
        NODE_ENV: 'test', PORT: '0', BASE_URL: 'https://openvibe.design', TRUST_PROXY: '1',
        OV_NETWORK_URL: network.url, OV_NETWORK_INTERNAL_URL: network.url, OV_NETWORK_ISSUER: network.url,
        OV_OAUTH_CLIENT_ID: 'design', OV_OAUTH_CLIENT_SECRET: 'design-secret', COOKIE_SECURE: 'false',
        DESIGN_RATE_LIMIT_PER_MIN: '100000',
        ...(opts.env || {}),
    };
    for (const [k, v] of Object.entries(opts.env || {})) if (v === null) delete env[k];

    const logLines = [];
    const log = {
        log: (...a) => logLines.push(a.map(String).join(' ')),
        info: (...a) => logLines.push(a.map(String).join(' ')),
        warn: (...a) => logLines.push(a.map(String).join(' ')),
        error: (...a) => logLines.push(a.map(String).join(' ')),
    };

    const configLib = require('../../server/config');
    const { createApp } = require('../../server/app');
    const config = configLib.load(env);
    const built = createApp({ config, log, now: opts.now });
    await built.ctx.keys.ensure();
    const server = await new Promise((resolve) => { const s = http.createServer(built.app); s.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;

    const signIn = (user) => `design_at=${network.userToken(user)}`;

    async function get(p, o = {}) {
        const headers = { ...(o.headers || {}) };
        if (o.as) headers.cookie = [signIn(o.as), headers.cookie].filter(Boolean).join('; ');
        if (o.cookie) headers.cookie = o.cookie;
        let body = o.body;
        if (o.json !== undefined) { body = JSON.stringify(o.json); headers['content-type'] = 'application/json'; }
        const res = await fetch(base + p, { method: o.method || (body ? 'POST' : 'GET'), headers, body, redirect: 'manual' });
        const text = Buffer.from(await res.arrayBuffer()).toString('utf8');
        return {
            status: res.status,
            headers: res.headers,
            text,
            json() { return JSON.parse(text); },
        };
    }

    return {
        base, network, config, ctx: built.ctx, get, signIn,
        logs: () => logLines.join('\n'),
        async close() {
            await new Promise((r) => server.close(r));
            built.ctx.keys.client.stop();
            await network.close();
        },
    };
}

let failures = 0;
async function check(name, fn) {
    try {
        await fn();
        process.stdout.write(`  ✓ ${name}\n`);
    } catch (e) {
        failures++;
        process.stdout.write(`  ✗ ${name}\n      ${(e.stack || String(e)).split('\n').slice(0, 10).join('\n      ')}\n`);
    }
}
function done() {
    process.stdout.write(failures ? `\n${failures} failed\n` : '\nall passed\n');
    process.exit(failures ? 1 : 0);
}

module.exports = { boot, check, done };
