'use strict';
/**
 * ADR-033: the Arena's part of an account export and deletion, through /internal/events with the SDK's signed
 * delivery and a stand-in Network. A's rounds and outputs and A's votes are exported; B's identity is not; deleting
 * A removes their rounds (cascading every vote on them) and their votes, and a redelivery changes nothing.
 */
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');
const { signDeliveryHeaders } = require('openvibe-sdk/events');

const A = 'usr_01JZ0000000000000000000AAA';
const B = 'usr_01JZ0000000000000000000BBB';
const EXP = 'exp_01JZ0000000000000000000EXP';
const DEL = 'del_01JZ0000000000000000000DEX';
const SECRET = `fixture_${'arena'.repeat(8)}`;
const WRONG = `fixture_${'wrong'.repeat(8)}`;
const ORIGIN = 'https://openvibe.design';

const exportEvent = { event_id: 'evt_01JZ0000000000000000000E01', event_type: 'network.account.export_requested', source: 'network', payload: { export_id: EXP, subject: A } };
const deleteEvent = { event_id: 'evt_01JZ0000000000000000000D01', event_type: 'network.account.deleted', source: 'network', payload: { deletion_id: DEL, subject: A, aliases: [] } };
const bodyOf = (ev) => JSON.stringify({ event: ev, seq: 1 });

(async () => {
    const calls = [];
    const sender = async (path, body) => { calls.push({ path, body }); return { ok: true, status: 201, json: async () => ({}) }; };
    const t = await boot({ env: { DESIGN_EVENTS_SECRET: SECRET }, accountSend: sender });
    const ana = t.network.addUser('ana');
    const bo = t.network.addUser('bo');
    try {
        // Legacy Arena tables stay read-only in the active flow. Seed historical data to exercise ADR-033.
        const aRound = { id: 'arr_legacy_a' };
        const bRound = { id: 'arr_legacy_b' };
        const db = t.ctx.s.db;
        await db.exec("INSERT INTO arena_rounds (id, category, prompt, created_by, status) VALUES ($1, 'landing', 'A round to export', $2, 'ready'), ($3, 'dashboard', 'B round stays', $4, 'ready')", [aRound.id, A, bRound.id, B]);
        await db.exec("INSERT INTO arena_outputs (id, \"round\", model, provider, html) VALUES ('aro_legacy_a1', $1, 'model-a', 'ai', '<h1>A</h1>'), ('aro_legacy_a2', $1, 'model-b', 'ai', '<h1>B</h1>'), ('aro_legacy_b1', $2, 'model-a', 'ai', '<h1>C</h1>'), ('aro_legacy_b2', $2, 'model-b', 'ai', '<h1>D</h1>')", [aRound.id, bRound.id]);
        const aOutputs = await db.many('SELECT * FROM arena_outputs WHERE "round" = $1 ORDER BY id', [aRound.id]);
        const bOutputs = await db.many('SELECT * FROM arena_outputs WHERE "round" = $1 ORDER BY id', [bRound.id]);
        await db.exec("INSERT INTO arena_votes (\"round\", voter_subject, left_output, right_output, winner) VALUES ($1, $2, $3, $4, 'left')", [aRound.id, bo.subject, aOutputs[0].id, aOutputs[1].id]);
        await t.ctx.s.db.exec(`INSERT INTO arena_votes ("round", voter_subject, left_output, right_output, winner) VALUES ($1, $2, $3, $4, 'tie')`,
            [bRound.id, A, bOutputs[0].id, bOutputs[1].id]);

        await check('an export carries A\'s rounds, their outputs and A\'s votes, never B\'s identity', async () => {
            const raw = bodyOf(exportEvent);
            const res = await t.get('/internal/events', { method: 'POST', body: raw, headers: { 'content-type': 'application/json', ...signDeliveryHeaders(raw, SECRET) } });
            assert.strictEqual(res.status, 200, res.text);
            assert.strictEqual(res.json().outcome, 'exported');
            const part = calls.find((c) => c.path === `/internal/account-exports/${EXP}/parts`);
            assert.ok(part, 'the part was pushed to Network');
            assert.strictEqual(part.body.subject, A);
            const names = part.body.files.map((f) => f.name).sort();
            assert.deepStrictEqual(names, ['arena_outputs.json', 'arena_rounds.json', 'arena_votes.json']);
            const all = JSON.stringify(part.body);
            assert.ok(all.includes('A round to export'));
            const outputsFile = part.body.files.find((f) => f.name === 'arena_outputs.json');
            assert.ok(outputsFile.content.some((o) => o.html === aOutputs[0].html), 'the output HTML travels with the round');
            assert.ok(all.includes(bRound.id), 'A\'s vote on B\'s round is exported');
            assert.ok(!all.includes(B), 'another voter is never named');
            assert.ok(!all.includes(bo.subject), 'another account is never named');
        });

        await check('a deletion erases A\'s rounds (with their outputs and votes) and A\'s votes; B\'s round stays', async () => {
            const raw = bodyOf(deleteEvent);
            const res = await t.get('/internal/events', { method: 'POST', body: raw, headers: { 'content-type': 'application/json', ...signDeliveryHeaders(raw, SECRET) } });
            assert.strictEqual(res.status, 200, res.text);
            assert.strictEqual(res.json().outcome, 'erased');
            const db = t.ctx.s.db;
            assert.strictEqual(Number(await db.value('SELECT COUNT(*) FROM arena_rounds WHERE id = $1', [aRound.id])), 0);
            assert.strictEqual(Number(await db.value('SELECT COUNT(*) FROM arena_outputs WHERE "round" = $1', [aRound.id])), 0);
            assert.strictEqual(Number(await db.value('SELECT COUNT(*) FROM arena_votes WHERE voter_subject = $1', [A])), 0);
            assert.strictEqual(Number(await db.value('SELECT COUNT(*) FROM arena_votes WHERE "round" = $1', [aRound.id])), 0, 'B\'s vote on A\'s round went with the round');
            assert.strictEqual(Number(await db.value('SELECT COUNT(*) FROM arena_rounds WHERE id = $1', [bRound.id])), 1, 'B\'s round stays');
            const confirmation = calls.find((c) => c.path === `/internal/account-deletions/${DEL}/confirmations`);
            assert.ok(confirmation, 'the confirmation was sent');
            assert.ok(confirmation.body.erased.arena_rounds >= 1);
            assert.ok(!Number.isNaN(Date.parse(confirmation.body.completed_at)));
        });

        await check('a redelivery changes nothing; the internal route refuses a bad signature and a forwarded request', async () => {
            const before = Number(await t.ctx.s.db.value('SELECT COUNT(*) FROM arena_rounds'));
            const raw = bodyOf(deleteEvent);
            const again = await t.get('/internal/events', { method: 'POST', body: raw, headers: { 'content-type': 'application/json', ...signDeliveryHeaders(raw, SECRET) } });
            assert.strictEqual(again.status, 200);
            assert.strictEqual(again.json().outcome, 'unchanged');
            assert.strictEqual(Number(await t.ctx.s.db.value('SELECT COUNT(*) FROM arena_rounds')), before);
            const bad = await t.get('/internal/events', { method: 'POST', body: bodyOf(exportEvent), headers: { 'content-type': 'application/json', ...signDeliveryHeaders(bodyOf(exportEvent), WRONG) } });
            assert.strictEqual(bad.status, 401);
            const forwarded = await t.get('/internal/events', { method: 'POST', body: bodyOf(exportEvent), headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9', ...signDeliveryHeaders(bodyOf(exportEvent), SECRET) } });
            assert.strictEqual(forwarded.status, 403);
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
