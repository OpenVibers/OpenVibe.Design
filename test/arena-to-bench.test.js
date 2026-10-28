'use strict';
const assert = require('assert');
const { migrate } = require('../scripts/arena-to-bench');
const { check, done } = require('./helpers/boot');

const rows = {
    rounds: [{ id: 'arr_a', category: 'landing', prompt: 'A page', status: 'ready' }],
    outputs: [
        { id: 'aro_a', round: 'arr_a', provider: 'ai', model: 'alpha', html: '<h1>A</h1>', cost_usd: 0.01, ms: 3, tokens: 4 },
        { id: 'aro_b', round: 'arr_a', provider: 'ai', model: 'beta', html: '<h1>B</h1>', cost_usd: 0.02, ms: 5, tokens: 7 },
    ],
    votes: [{ round: 'arr_a', left_output: 'aro_a', right_output: 'aro_b', winner: 'tie' }],
};
const db = (source) => ({ many: async (sql) => source[sql.includes('arena_rounds') ? 'rounds' : sql.includes('arena_outputs') ? 'outputs' : 'votes'] });

(async () => {
    await check('migration dry run reads legacy tables and writes nothing', async () => {
        const result = await migrate({ db: db(rows), bench: null });
        assert.deepStrictEqual(result, { dry_run: true, rounds: 1, entries: 2, judgements: 1, problems: [] });
    });
    await check('migration maps entries and casts an anonymous service judgement', async () => {
        const calls = [];
        const bench = {
            createRound: async (input) => { calls.push(['round', input]); return { round: { id: 'brd_1' } }; },
            addEntry: async (input) => { calls.push(['entry', input]); return { entry: { id: `bte_${calls.length}` } }; },
            castImportedVote: async (input) => { calls.push(['vote', input]); },
        };
        await migrate({ db: db(rows), bench, apply: true });
        assert.strictEqual(calls[0][1].category, 'landing');
        assert.strictEqual(calls[1][1].payload.html, '<h1>A</h1>');
        assert.deepStrictEqual(calls[3][1].pair, { left: 'bte_2', right: 'bte_3' });
        assert.strictEqual(calls[3][1].winner, 'tie');
        assert.ok(!JSON.stringify(calls).includes('voter_subject'));
    });
    await check('migration retains multiple votes and both_bad without voter identities', async () => {
        const source = { ...rows, votes: [...rows.votes, { ...rows.votes[0], winner: 'both_bad' }] };
        const winners = [];
        const bench = {
            createRound: async () => ({ round: { id: 'brd_1' } }),
            addEntry: async (entry) => ({ entry: { id: entry.model } }),
            castImportedVote: async (vote) => winners.push(vote.winner),
        };
        await migrate({ db: db(source), bench, apply: true });
        assert.deepStrictEqual(winners, ['tie', 'both_bad']);
    });
    await check('invalid legacy references stop before any Bench write', async () => {
        const source = { ...rows, votes: [...rows.votes, { ...rows.votes[0], left_output: 'missing' }] };
        await assert.rejects(() => migrate({ db: db(source), bench: { createRound: () => { throw new Error('must not write'); } }, apply: true }), /Import refused/);
    });
    done();
})().catch((err) => { console.error(err); process.exit(1); });
