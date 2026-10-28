'use strict';
/**
 * migration 0001_arena.sql: the five tables the Arena and ADR-033 need, their columns, checks, defaults and
 * the one-vote-per-person primary key.
 */
const assert = require('assert');
const { testDb } = require('./helpers/db');
const { check, done } = require('./helpers/boot');

(async () => {
    const t = await testDb();
    const db = t.db;
    try {
        await check('the Arena tables and their columns exist', async () => {
            const cols = async (table) => (await db.many('SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 ORDER BY ordinal_position', [table])).map((r) => r.column_name);
            assert.deepStrictEqual(await cols('arena_rounds'), ['id', 'category', 'prompt', 'created_by', 'status', 'offers', 'pool_fallback', 'created_at']);
            assert.deepStrictEqual(await cols('arena_outputs'), ['id', 'round', 'model', 'provider', 'html', 'cost_usd', 'ms', 'tokens', 'error', 'ui_check', 'created_at']);
            assert.deepStrictEqual(await cols('arena_votes'), ['round', 'voter_subject', 'left_output', 'right_output', 'winner', 'at']);
            assert.deepStrictEqual(await cols('arena_ratings'), ['category', 'model', 'elo', 'games', 'wins', 'losses', 'ties', 'updated_at']);
            assert.deepStrictEqual(await cols('account_data_events'), ['id', 'kind', 'subject', 'outcome', 'applied_at', 'sent_at']);
        });

        await check('rounds default to queued and ratings to Elo 1000', async () => {
            await db.exec("INSERT INTO arena_rounds (id, category, prompt, created_by) VALUES ('arr_A', 'landing', 'p', 'usr_A')");
            const r = await db.one("SELECT status, created_at FROM arena_rounds WHERE id = 'arr_A'");
            assert.strictEqual(r.status, 'queued');
            assert.ok(!Number.isNaN(Date.parse(r.created_at)));
            await db.exec("INSERT INTO arena_ratings (category, model) VALUES ('landing', 'model-a')");
            const rt = await db.one("SELECT elo, games, wins, losses, ties FROM arena_ratings WHERE category = 'landing' AND model = 'model-a'");
            assert.strictEqual(Number(rt.elo), 1000);
            assert.deepStrictEqual([rt.games, rt.wins, rt.losses, rt.ties], [0, 0, 0, 0]);
        });

        await check('categories and statuses are checked', async () => {
            await assert.rejects(() => db.exec("INSERT INTO arena_rounds (id, category, prompt, created_by) VALUES ('arr_B', 'poster', 'p', 'usr_A')"), /check|constraint/i);
            await assert.rejects(() => db.exec("INSERT INTO arena_rounds (id, category, prompt, created_by, status) VALUES ('arr_C', 'landing', 'p', 'usr_A', 'cooking')"), /check|constraint/i);
        });

        await check('one vote per person per round is a primary-key refusal', async () => {
            await db.exec("INSERT INTO arena_outputs (id, \"round\", model, provider, html) VALUES ('aro_L', 'arr_A', 'model-a', 'p', '<h1>L</h1>'), ('aro_R', 'arr_A', 'model-b', 'p', '<h1>R</h1>')");
            await db.exec("INSERT INTO arena_votes (\"round\", voter_subject, left_output, right_output, winner) VALUES ('arr_A', 'usr_V', 'aro_L', 'aro_R', 'left')");
            await assert.rejects(() => db.exec("INSERT INTO arena_votes (\"round\", voter_subject, left_output, right_output, winner) VALUES ('arr_A', 'usr_V', 'aro_R', 'aro_L', 'right')"), (err) => err.code === '23505');
        });

        await check('deleting a round cascades its outputs and votes', async () => {
            await db.exec("DELETE FROM arena_rounds WHERE id = 'arr_A'");
            assert.strictEqual(Number(await db.value('SELECT COUNT(*) FROM arena_outputs')), 0);
            assert.strictEqual(Number(await db.value('SELECT COUNT(*) FROM arena_votes')), 0);
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
