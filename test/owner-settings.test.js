'use strict';
/**
 * Owner settings (D11) for Design's publishing accounts (server/settings.js, design.publishing):
 *   - the Figma token has a plain title, a 30+ character description, x-owner-input words and a test;
 *   - /internal/config is loopback only and needs design.config.manage;
 *   - the token is write-only and marked in summaries, figmaToken() reads the owner's value and
 *     falls back to FIGMA_TOKEN, and the test hook never echoes or logs the token.
 *   node test/owner-settings.test.js
 */
const assert = require('assert');
const http = require('http');
const express = require('express');
const { serviceAuth } = require('openvibe-contracts');
const { boot } = require('./helpers/boot');
const { createSettings } = require('../server/settings');

const CAP = 'design.config.manage';
const NS = 'design.publishing';
const USR = 'usr_01J8Z3Q4R5S6T7V8W9X0Y1Z2A3';
const TOKEN = 'figma-owner-token-sentinel';

(async () => {
    const t = await boot();
    const now = Math.floor(Date.now() / 1000);
    const bearer = serviceAuth.signServiceToken({ iss: t.network.url, sub: 'svc:network', actor_type: 'service', aud: ['openvibe.design'], cap: [CAP], iat: now, exp: now + 300, jti: 'tok_owner_settings' }, t.network.privatePem);
    const checks = [];
    const check = async (name, fn) => {
        try { await fn(); checks.push(name); console.log(`  ✓ ${name}`); } catch (e) { console.log(`  ✗ ${name}\n${e.stack}`); await t.close(); process.exit(1); }
    };

    await check('the Figma token has owner words and a test', async () => {
        const r = await t.get(`/internal/config/${NS}`, { headers: { authorization: `Bearer ${bearer}` } });
        assert.strictEqual(r.status, 200, r.text);
        const f = r.json().schema.properties.figma_token;
        assert.ok(f);
        assert.ok(f.title && f.title.length >= 3);
        assert.ok(f.description && f.description.length >= 30);
        assert.strictEqual(f['x-owner-input'].group, 'Design and publishing');
        assert.ok(f['x-owner-input'].unlocks.length > 20);
        assert.strictEqual(f['x-owner-input'].get_it_at, 'https://www.figma.com/settings');
        assert.strictEqual(f['x-owner-input'].test, true);
        assert.strictEqual(f['x-required-for'], 'Figma import');
    });

    await check('the routes are loopback only and need the capability', async () => {
        assert.strictEqual((await t.get(`/internal/config/${NS}`)).status, 401);
        const wrong = serviceAuth.signServiceToken({ iss: t.network.url, sub: 'svc:network', actor_type: 'service', aud: ['openvibe.design'], cap: ['design.read'], iat: now, exp: now + 300, jti: 'tok_wrong' }, t.network.privatePem);
        assert.strictEqual((await t.get(`/internal/config/${NS}`, { headers: { authorization: `Bearer ${wrong}` } })).status, 403);
        assert.strictEqual((await t.get(`/internal/config/${NS}`, { headers: { authorization: `Bearer ${bearer}`, 'x-forwarded-for': '203.0.113.9' } })).status, 404);
    });

    await check('the token is write-only and the environment is the fallback', async () => {
        const envOnly = createSettings({ db: t.ctx.s.db, env: { FIGMA_TOKEN: 'figma-env-token' } });
        await envOnly.ready;
        assert.strictEqual(envOnly.figmaToken(), 'figma-env-token', 'the env is the fallback');
        const put = await t.get(`/internal/config/${NS}/secrets/figma_token`, {
            method: 'PUT', json: { value: TOKEN, reason: 'owner test' },
            headers: { authorization: `Bearer ${bearer}`, 'x-ov-subject': USR, 'x-ov-fresh': '1' },
        });
        assert.strictEqual(put.status, 200, put.text);
        assert.ok(put.json().fingerprint && put.json().hint);
        assert.ok(!put.text.includes(TOKEN));
        const summary = await t.get(`/internal/config/${NS}`, { headers: { authorization: `Bearer ${bearer}` } });
        assert.ok(summary.json().values.figma_token.redacted);
        assert.ok(!summary.text.includes(TOKEN));
        assert.strictEqual(t.ctx.settings.figmaToken(), TOKEN, 'the code reads the owner value when set');
    });

    await check('the test hook says ok/failed in one line and never echoes a token', async () => {
        const fake = createSettings({
            db: t.ctx.s.db, env: {},
            probes: { figma: async ({ token }) => { throw new Error(`refused ${token}`); } },
        });
        await fake.ready;
        const app = express();
        app.use(express.json());
        fake.mount(app, { guard: (_req, _res, next) => next(), log: console });
        const server = await new Promise((resolve) => { const s = http.createServer(app); s.listen(0, '127.0.0.1', () => resolve(s)); });
        try {
            const r = await fetch(`http://127.0.0.1:${server.address().port}/internal/config/${NS}/test/figma_token`, { method: 'POST' });
            const body = await r.json();
            assert.strictEqual(r.status, 200);
            assert.strictEqual(body.ok, false);
            assert.ok(/^failed — Figma said: /.test(body.detail), body.detail);
            assert.ok(!body.detail.includes(TOKEN));
            assert.ok(!body.detail.includes('\n'));
        } finally { server.close(); }
        assert.ok(!t.logs().includes(TOKEN), 'no token in a captured log line');
    });

    await t.close();
    console.log(`\n${checks.length} checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });
