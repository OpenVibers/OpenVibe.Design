'use strict';
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');
const ORIGIN = 'https://openvibe.design';

(async () => {
    const t = await boot();
    const ana = t.network.addUser('ana');
    const bo = t.network.addUser('bo');
    const create = (as, category, prompt) => t.get('/api/v1/arena/rounds', { as, json: { category, prompt }, origin: ORIGIN });
    try {
        let round;
        await check('a signed-in start creates a Bench task and person-owned round', async () => {
            const r = await create(ana, 'landing', 'A coffee roastery landing page');
            assert.strictEqual(r.status, 201, r.text);
            round = r.json().round;
            assert.match(round.id, /^brd_/);
            assert.strictEqual(round.category, 'landing');
            assert.strictEqual(round.status, 'queued');
            const task = [...t.bench.state.tasks.values()][0];
            assert.strictEqual(task.kind_id, 'design.page');
            assert.strictEqual(task.task_class, 'landing');
            assert.strictEqual(t.bench.state.rounds.get(round.id).created_by, ana.subject);
            const taskCall = t.bench.state.requests.find((x) => x.path.endsWith('/tasks') && x.method === 'POST');
            const roundCall = t.bench.state.requests.find((x) => x.path.endsWith('/rounds') && x.method === 'POST');
            assert.ok(taskCall && roundCall);
            assert.notStrictEqual(taskCall.authorization, roundCall.authorization);
            const grant = t.network.state.tokenRequests.find((x) => x.audience === 'openvibe.bench');
            assert.ok(grant);
            assert.match(grant.scope, /bench.task.create/);
        });

        await check('Bench generates entries; the creator can read a sanitized round', async () => {
            await t.tick();
            const r = await t.get(`/api/v1/arena/rounds/${round.id}`, { as: ana });
            assert.strictEqual(r.status, 200, r.text);
            const ready = r.json().round;
            assert.strictEqual(ready.status, 'ready');
            assert.strictEqual(ready.outputs.length, 3);
            assert.ok(ready.outputs.every((o) => o.model && /<html>/i.test(o.html)));
            assert.strictEqual(Number(await t.ctx.s.db.value('SELECT COUNT(*) FROM arena_rounds')), 0);
        });

        let pair;
        await check('Bench supplies a blind pair and excludes its creator', async () => {
            const r = await t.get('/api/v1/arena/vote', { as: bo });
            assert.strictEqual(r.status, 200, r.text);
            pair = r.json();
            assert.strictEqual(pair.round.id, round.id);
            assert.deepStrictEqual(Object.keys(pair.left).sort(), ['html', 'id']);
            assert.ok(!JSON.stringify(pair).includes('alpha-1'));
            const own = await t.get('/api/v1/arena/vote', { as: ana });
            assert.strictEqual(own.json().pair, null);
        });

        await check('Bench refuses creator vote, records one vote, and reveals models', async () => {
            const body = { round_id: round.id, left_output: pair.left.id, right_output: pair.right.id, winner: 'left' };
            const own = await t.get('/api/v1/arena/vote', { as: ana, json: body, origin: ORIGIN });
            assert.strictEqual(own.status, 403);
            const r = await t.get('/api/v1/arena/vote', { as: bo, json: body, origin: ORIGIN });
            assert.strictEqual(r.status, 201, r.text);
            assert.ok(r.json().revealed.left.model);
            assert.ok(r.json().revealed.right.model);
            const again = await t.get('/api/v1/arena/vote', { as: bo, json: body, origin: ORIGIN });
            assert.strictEqual(again.status, 409);
        });

        await check('Elo and Cost views read Bench boards', async () => {
            const elo = await t.get('/api/v1/arena/leaderboard?category=landing');
            assert.strictEqual(elo.status, 200);
            assert.ok(elo.json().leaderboard.some((r) => r.games === 1 && r.provisional && r.ci_lower != null));
            const cost = await t.get('/api/v1/arena/leaderboard?type=cost&category=landing');
            assert.strictEqual(cost.status, 200);
            assert.ok(cost.json().leaderboard.some((r) => r.entries > 0 && r.cost_per_solved != null));
            assert.ok(t.bench.state.requests.some((x) => x.path === '/api/v1/boards/design.page' && x.query === '?type=cost'));
            const page = await t.get('/arena');
            assert.match(page.text, /What each model costs/, 'the cost view, folded under the boards');
            assert.match(page.text, /class="ar-provisional" title="Fewer than 10 games">new</, 'a model with few games is marked new');
        });

        await check('logo uses design.component and dataset redirects to public Bench', async () => {
            const logo = await create(bo, 'logo', 'A simple mark');
            assert.strictEqual(logo.status, 201, logo.text);
            assert.strictEqual([...t.bench.state.tasks.values()].at(-1).kind_id, 'design.component');
            await t.tick();
            const vote = await t.get('/api/v1/arena/vote?category=logo', { as: ana });
            assert.strictEqual(vote.status, 200);
            assert.strictEqual(vote.json().round.id, logo.json().round.id);
            const ds = await t.get('/api/v1/arena/dataset.jsonl');
            assert.strictEqual(ds.status, 302);
            assert.strictEqual(ds.headers.get('location'), `${t.bench.url}/api/v1/datasets/design.page.jsonl`);
        });

        await check('bad input and cross-site cookie writes fail', async () => {
            assert.strictEqual((await create(ana, 'poster', 'x')).status, 422);
            assert.strictEqual((await create(ana, 'landing', '  ')).status, 422);
            assert.strictEqual((await t.get('/api/v1/arena/rounds', { as: ana, json: { category: 'landing', prompt: 'x' }, origin: 'https://evil.example' })).status, 403);
        });
    } finally { await t.close(); }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
