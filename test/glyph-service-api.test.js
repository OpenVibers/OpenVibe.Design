'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { boot, check, done } = require('./helpers/boot');

const calls = [];
const ai = { enabled: true, async text(args) {
    calls.push(args);
    return { text: JSON.stringify({ candidates: [
        { line: '<path d="M5 12h14"/>', solid: '<path d="M5 11h14v2H5z"/>' },
        { line: '<path d="M12 5v14"/>', solid: '<path d="M11 5h2v14h-2z"/>' },
    ] }), provider: 'test', model: 'test' };
} };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(t, cap = ['design.glyph.draft'], sub = 'svc:quest') {
    const now = Math.floor(Date.now() / 1000);
    const data = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: t.network.url, sub, actor_type: 'service',
        aud: ['openvibe.design'], cap, iat: now, exp: now + 300, jti: 'tok_glyph_test' })}`;
    return `${data}.${crypto.sign('RSA-SHA256', Buffer.from(data), t.network.privatePem).toString('base64url')}`;
}

(async () => {
    const t = await boot({ ai });
    const boss = t.network.addUser('reviewer', { role: 'admin' });
    const body = { name: 'daily-2026-11-09', sentence: 'A shared quest across several sites' };
    const post = (bearer, json = body) => t.get('/api/v1/glyphs/drafts', { method: 'POST', json,
        headers: bearer ? { authorization: `Bearer ${bearer}` } : {} });
    try {
        await check('service-only capability and validated body protect the draft API', async () => {
            assert.equal((await post(null)).status, 401);
            assert.equal((await post(t.network.userToken(boss))).status, 401);
            assert.equal((await post(token(t, []))).status, 403);
            assert.equal((await post(token(t, ['design.glyph.draft']), { ...body, svg: '<svg/>' })).status, 422);
            assert.equal(calls.length, 0);
        });
        await check('a service request creates review drafts on the design.icon task and deduplicates', async () => {
            const first = await post(token(t));
            assert.equal(first.status, 201, first.text.slice(0, 180));
            assert.equal(first.json().status, 'pending');
            assert.ok(first.json().draft_ids.length > 0);
            assert.equal(calls.length, 1);
            assert.equal(calls[0].task, 'design.icon', 'AI resolves the model for the task');
            assert.equal(calls[0].preset, undefined, 'Design no longer names a routing preset');
            assert.equal(calls[0].person, undefined, 'a service request never spends a person’s key');
            const again = await post(token(t));
            assert.equal(again.status, 200);
            assert.equal(again.json().created, false);
            assert.deepEqual(again.json().draft_ids, first.json().draft_ids);
            assert.equal(calls.length, 1);
            const review = await t.get(`/icons/drafts/${first.json().draft_ids[0]}/review`, { method: 'POST', as: boss,
                body: new URLSearchParams({ action: 'approve' }).toString(),
                headers: { 'content-type': 'application/x-www-form-urlencoded' }, origin: 'https://openvibe.design' });
            assert.equal(review.status, 303);
            const after = await post(token(t));
            assert.equal(after.json().status, 'approved');
            assert.equal(calls.length, 1);
        });
    } finally { await t.close(); }
    done();
})().catch((err) => { process.stderr.write(`${err.stack || err}\n`); process.exit(1); });
