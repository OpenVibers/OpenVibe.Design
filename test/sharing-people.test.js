'use strict';
/**
 * Sharing a design with specific people (design 2026-11-06, VISIBILITY-EVERYWHERE step 5).
 *
 * A signed-in maker's design starts Only me. The Share sheet's four audiences are enforced by canView
 * on the page and the API; the named person opens it, a stranger gets the gate (never the prompt), and
 * a guest design keeps its secret edit key exactly as before. Leaving Everyone takes it out of the
 * public answer at once.
 */
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');

(async () => {
    const t = await boot();
    const carol = t.network.addUser('carol');
    const maticus = t.network.addUser('maticus');
    const sam = t.network.addUser('sam');
    const make = async (prompt = 'A landing page for a robot café') => {
        const r = await t.get('/api/v1/designs', { as: carol, origin: 'https://openvibe.design', json: { prompt, kind: 'page' } });
        assert.strictEqual(r.status, 201, r.text);
        return r.json().design;
    };
    const share = (id, opts = {}) => t.get(`/api/v1/design/${id}/share`, { headers: { 'sec-fetch-site': 'same-origin' }, ...opts });

    await check('a signed-in maker’s design is registered Only me, and a guest design has no share row', async () => {
        const d = await make();
        const row = await t.ctx.s.db.maybe('SELECT * FROM shares WHERE service = $1 AND kind = $2 AND resource_id = $3', ['design', 'design', d.id]);
        assert.ok(row, 'the signed-in design has a share row');
        assert.strictEqual(row.audience, 'private');
        assert.deepStrictEqual(row.owner_subject, { type: 'user', id: carol.subject });
        const guest = await t.get('/api/v1/designs', { origin: 'https://openvibe.design', json: { prompt: 'A guest design' } });
        assert.strictEqual(guest.status, 201, guest.text);
        const none = await t.ctx.s.db.maybe('SELECT * FROM shares WHERE service = $1 AND kind = $2 AND resource_id = $3', ['design', 'design', guest.json().design.id]);
        assert.strictEqual(none, null, 'a guest design is reached by its key, not a share row');
    });

    await check('Specific people: the named person opens it, a stranger gets the gate and never the prompt', async () => {
        const d = await make('SECRET-CANARY robot café');
        const put = await share(d.id, { method: 'PUT', as: carol, json: { audience: 'people', members: [{ name: '@maticus', role: 'viewer' }] } });
        assert.strictEqual(put.status, 200, put.text);
        assert.strictEqual(put.json().audience, 'people');
        const row = await t.ctx.s.db.maybe('SELECT audience FROM shares WHERE service = $1 AND kind = $2 AND resource_id = $3', ['design', 'design', d.id]);
        assert.strictEqual(row.audience, 'people');

        const member = await t.get(`/d/${d.id}`, { as: maticus });
        assert.strictEqual(member.status, 200);
        assert.ok(member.text.includes('SECRET-CANARY robot café'), 'the person on the list reads the design');
        assert.match(member.headers.get('cache-control') || '', /private, no-store/);
        const memberApi = await t.get(`/api/v1/designs/${d.id}`, { as: maticus });
        assert.strictEqual(memberApi.status, 200);
        assert.match(memberApi.headers.get('cache-control') || '', /private, no-store/);

        const stranger = await t.get(`/d/${d.id}`, { as: sam });
        assert.strictEqual(stranger.status, 404);
        assert.ok(stranger.text.includes('shared with specific people') && stranger.text.includes('data-ov-share-gate'));
        assert.ok(stranger.text.includes(`data-id="${d.id}"`) && !stranger.text.includes('OVShare.gate('), 'markup gate, no inline script');
        assert.ok(!stranger.text.includes('SECRET-CANARY'), 'never the prompt');
        assert.strictEqual((await t.get(`/api/v1/designs/${d.id}`, { as: sam })).status, 403, 'the API refuses it too');
        assert.strictEqual((await t.get(`/api/v1/designs/${d.id}`)).status, 403);
        assert.strictEqual((await share(d.id, { as: sam })).status, 404, 'the sheet is the owner’s');
    });

    await check('Everyone and the link, then Only me: the page follows the audience at once', async () => {
        const d = await make('Public by choice');
        assert.strictEqual((await share(d.id, { as: carol, method: 'PUT', json: { audience: 'public' } })).status, 200);
        assert.strictEqual((await t.get(`/d/${d.id}`)).status, 200, 'Everyone');
        assert.strictEqual((await share(d.id, { as: carol, method: 'PUT', json: { audience: 'link' } })).status, 200);
        assert.strictEqual((await t.get(`/d/${d.id}`)).status, 200, 'the link is the key');
        assert.strictEqual((await share(d.id, { as: carol, method: 'PUT', json: { audience: 'private' } })).status, 200);
        assert.strictEqual((await t.get(`/d/${d.id}`)).status, 404, 'Only me');
        assert.strictEqual((await t.get(`/d/${d.id}`, { as: carol })).status, 200, 'the owner still opens it');
    });

    await check('the sheet lists the people for the owner, and the agent API (subjects) agrees with names', async () => {
        const d = await make('Reviewed by two');
        const put = await share(d.id, { as: carol, method: 'PUT', json: { audience: 'people',
            members: [{ subject: { type: 'user', id: sam.subject }, role: 'viewer' }, { name: '@maticus', role: 'editor' }] } });
        assert.strictEqual(put.status, 200, put.text);
        const mine = await share(d.id, { as: carol });
        assert.strictEqual(mine.status, 200);
        const body = mine.json();
        assert.strictEqual(body.you.role, 'owner');
        assert.deepStrictEqual(body.members.map((m) => m.username).sort(), ['maticus', 'sam']);
        assert.strictEqual(body.members.find((m) => m.username === 'maticus').role, 'editor');
        assert.strictEqual((await t.get(`/d/${d.id}`, { as: sam })).status, 200);
        // Can view and Can edit are different doors: a viewer cannot change the working frame, the editor can.
        const origin = 'https://openvibe.design';
        assert.strictEqual((await t.get(`/api/v1/designs/${d.id}/undo`, { as: sam, method: 'POST', origin, json: {} })).status, 403, 'a viewer cannot edit');
        assert.strictEqual((await t.get(`/api/v1/designs/${d.id}/undo`, { as: maticus, method: 'POST', origin, json: {} })).status, 409, 'an editor passes the door (no working frame yet)');
    });

    await done();
})().catch((err) => { console.error(err); process.exit(1); });
