'use strict';
const assert = require('assert');
const { createBenchClient } = require('../server/arena/bench');
const { check, done } = require('./helpers/boot');

(async () => {
    const calls = [];
    const fetchImpl = async (url, opts) => {
        const path = new URL(url).pathname + new URL(url).search;
        calls.push({ path, opts });
        let body = {};
        if (path === '/oauth/token') body = { access_token: 'service-token', token_type: 'Bearer', expires_in: 300 };
        if (path === '/api/v1/kinds/design.page/tasks') body = { task: { id: 'btk_1', prompt: 'Page', task_class: 'landing' } };
        if (path === '/api/v1/tasks/btk_1/rounds') body = { round: { id: 'brd_1' } };
        if (path === '/api/v1/judgements/next?kind=design.page') body = { round: { id: 'brd_1' }, left: { id: 'bte_1', payload: { html: 'a' } }, right: { id: 'bte_2', payload: { html: 'b' } } };
        if (path === '/api/v1/rounds/brd_1/judgements') body = { judgement: { at: 'now' }, revealed: {} };
        return { ok: true, status: 200, json: async () => body };
    };
    const config = { bench: { url: 'http://bench.test', publicUrl: 'https://bench.openvibe.services', audience: 'openvibe.bench', scope: 'bench.task.create' },
        oauth: { clientId: 'design', clientSecret: 'fixture' }, networkInternalUrl: 'http://network.test' };
    const client = createBenchClient({ config, fetchImpl });
    await check('task uses service token and round uses the person token', async () => {
        const result = await client.createRound({ category: 'landing', prompt: 'Page', token: 'person-token' });
        assert.strictEqual(result.round.id, 'brd_1');
        const task = calls.find((c) => c.path === '/api/v1/kinds/design.page/tasks');
        const round = calls.find((c) => c.path === '/api/v1/tasks/btk_1/rounds');
        assert.strictEqual(task.opts.headers.Authorization, 'Bearer service-token');
        assert.strictEqual(round.opts.headers.Authorization, 'Bearer person-token');
        assert.deepStrictEqual(JSON.parse(round.opts.body), {});
    });
    await check('Bench pair and vote use the person token and exact wire shape', async () => {
        const pair = await client.nextPair('design.page', 'person-token');
        assert.strictEqual(pair.round.id, 'brd_1');
        await client.castVote({ roundId: 'brd_1', token: 'person-token', pair: { left: 'bte_1', right: 'bte_2' }, winner: 'left' });
        const vote = calls.find((c) => c.path === '/api/v1/rounds/brd_1/judgements');
        assert.strictEqual(vote.opts.headers.Authorization, 'Bearer person-token');
        assert.deepStrictEqual(JSON.parse(vote.opts.body), { pair: { left: 'bte_1', right: 'bte_2' }, outcome: 'left' });
        assert.strictEqual(client.datasetUrl('design.page'), 'https://bench.openvibe.services/api/v1/datasets/design.page.jsonl');
    });
    await check('imported votes use Bench service judgements without person identity', async () => {
        await client.castImportedVote({ roundId: 'brd_1', pair: { left: 'bte_1', right: 'bte_2' }, winner: 'both_bad' });
        const vote = calls.filter((c) => c.path === '/api/v1/rounds/brd_1/judgements').at(-1);
        assert.strictEqual(vote.opts.headers.Authorization, 'Bearer service-token');
        assert.deepStrictEqual(JSON.parse(vote.opts.body), {
            judge: 'automatic_grader', judge_name: 'design.arena.legacy_vote',
            pair: { left: 'bte_1', right: 'bte_2' }, outcome: 'both_bad',
        });
    });
    done();
})().catch((err) => { console.error(err); process.exit(1); });
