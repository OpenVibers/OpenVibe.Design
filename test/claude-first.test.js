'use strict';
// openvibe.design is Claude-first (plan L37, 2026-10-31) as a soft preference, not a pinned route: a signed-in
// person's own key is tried first, and a design's three takes are three takes of the chosen model. `claude` (the
// default) prefers Claude Opus 5.5, `sonnet` prefers Claude Sonnet 5.5, `any` prefers nothing; `compare` is the one
// mode that really asks for different providers and keeps the Arena's pinned three. The run's explain says which key
// paid and whether the preference was honoured, and the design's variants carry that answer to the page.
const assert = require('node:assert/strict');
const { createArenaAi } = require('../server/arena/ai');
const { boot, check, done } = require('./helpers/boot');

const OPUS = { provider: 'anthropic', model: 'claude-opus-5-5' };
const SONNET = { provider: 'anthropic', model: 'claude-sonnet-5-5' };
const ORIGIN = 'https://openvibe.design';
const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const clientOf = (models) => createArenaAi({
    config: { ai: { url: 'https://ai.test', models, waitMs: 1000 }, oauth: { clientId: 'design', clientSecret: 'x' }, networkUrl: 'https://network.test' },
    fetchImpl: async () => { throw new Error('no network in this test'); },
    log: { warn() {}, info() {}, log() {}, error() {} },
});

const settle = async (t, id, opts = {}) => {
    for (let i = 0; i < 100; i++) {
        const r = await t.get(`/api/v1/designs/${id}`, opts);
        if (r.status !== 200) throw new Error(`read ${r.status}: ${r.text}`);
        const body = r.json();
        if (body.design.status !== 'running') return body;
        await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('the design did not settle');
};

(async () => {
    await check('claude: three Opus 5.5 takes, a soft preference and no pin', async () => {
        const plan = await clientOf(['openai:gpt-5.5', 'anthropic:claude-opus-5-5', 'deepseek:deepseek-chat']).designPlan();
        assert.deepEqual(plan.slots, [OPUS, OPUS, OPUS]);
        assert.deepEqual(plan.prefer, OPUS);
        assert.equal(plan.who, 'claude');
        assert.equal(plan.claude, true);
        assert.equal(plan.pin, false);
    });

    await check('sonnet: three Sonnet 5.5 takes, preferred', async () => {
        const plan = await clientOf(['openai:gpt-5.5', 'anthropic:claude-sonnet-5-5']).designPlan('sonnet');
        assert.deepEqual(plan.slots, [SONNET, SONNET, SONNET]);
        assert.deepEqual(plan.prefer, SONNET);
        assert.equal(plan.who, 'sonnet');
        assert.equal(plan.pin, false);
    });

    await check('any: the Arena\'s picks and no preference', async () => {
        const plan = await clientOf(['openai:gpt-5.5', 'deepseek:deepseek-chat']).designPlan('any');
        assert.equal(plan.who, 'any');
        assert.equal(plan.prefer, null);
        assert.equal(plan.pin, false);
        assert.deepEqual(plan.slots.map((s) => s.model), ['gpt-5.5', 'deepseek-chat', null]);
    });

    await check('a model AI does not offer keeps the Arena\'s next picks and says no Claude', async () => {
        const plan = await clientOf(['openai:gpt-5.5', 'deepseek:deepseek-chat']).designPlan('claude');
        assert.equal(plan.claude, false);
        assert.deepEqual(plan.prefer, OPUS);
        assert.deepEqual(plan.slots, [{ provider: 'openai', model: 'gpt-5.5' }, { provider: 'deepseek', model: 'deepseek-chat' }, { provider: 'ai', model: null }]);
        assert.equal(plan.pool_fallback, true);
    });

    await check('compare: one per provider, pinned', async () => {
        const plan = await clientOf(['anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5', 'openai:gpt-5.5', 'deepseek:deepseek-chat']).designPlan('compare');
        assert.equal(plan.who, 'compare');
        assert.deepEqual(plan.slots.map((s) => s.provider), ['anthropic', 'openai', 'deepseek']);
        assert.equal(plan.prefer, null);
        assert.equal(plan.pin, true);
    });

    const plans = [], generates = [];
    const planFor = (who) => {
        const prefer = who === 'sonnet' ? SONNET : who === 'any' || who === 'compare' ? null : OPUS;
        const slot = prefer || { provider: 'openai', model: 'gpt-5.5' };
        return { slots: [slot, slot, slot], prefer, pin: who === 'compare',
            who: who === 'sonnet' ? 'sonnet' : who === 'any' ? 'any' : who === 'compare' ? 'compare' : 'claude',
            claude: prefer ? true : null };
    };
    const ai = {
        designPlan: async (who) => { plans.push(who); return planFor(who || 'claude'); },
        generate: async (args) => {
            generates.push(args);
            const prefer = args.prefer || null;
            return { html: '<!doctype html><html><body><h1>ok</h1></body></html>', model: prefer ? prefer.model : 'gpt-5.5',
                provider: prefer ? prefer.provider : 'openai', cost_usd: 0, ms: 1, tokens: 1,
                paid_by: args.person ? 'your anthropic key …-key' : 'openvibe',
                prefer: prefer ? { ...prefer, honoured: true, why: args.person ? 'your own anthropic key answered, as you asked' : 'the network offer answered' } : null };
        },
    };
    const t = await boot({ ai });
    const create = (as, body) => t.get('/api/v1/designs', { ...(as ? { as } : {}), json: body, origin: ORIGIN });
    try {
        await check('a signed-in create asks for Opus as a preference and acts as the person', async () => {
            const ana = t.network.addUser('ana');
            const r = await create(ana, { prompt: 'A coffee roaster pricing page', kind: 'page' });
            assert.equal(r.status, 201, r.text);
            const data = await settle(t, r.json().design.id, { as: ana });
            const asked = generates.filter((g) => g.roundId === data.design.id);
            assert.equal(asked.length, 3);
            for (const g of asked) {
                assert.deepEqual(g.prefer, OPUS);
                assert.equal(g.person, ana.subject);
                assert.equal(g.pin, false, 'a preference never pins a route');
            }
            assert.ok(data.variants.every((v) => v.status === 'done'));
            assert.equal(data.variants[0].paid_by, 'your anthropic key …-key');
            assert.equal(data.variants[0].prefer.honoured, true);
            assert.equal(data.variants[0].prefer.provider, 'anthropic');
            assert.ok(!('pin' in data.variants[0]), 'the routing plan is not part of the frame');
        });

        await check('a signed-out create asks for Opus but acts as Design itself', async () => {
            const r = await create(null, { prompt: 'A guest pricing page', kind: 'page' });
            assert.equal(r.status, 201, r.text);
            const { design, editKey } = r.json();
            assert.ok(editKey);
            const data = await settle(t, design.id, { headers: { 'x-design-key': editKey } });
            const asked = generates.filter((g) => g.roundId === design.id);
            assert.equal(asked.length, 3);
            assert.deepEqual(asked[0].prefer, OPUS);
            assert.equal(asked[0].person, null, 'no person, so Design runs as itself');
            assert.equal(asked[0].pin, false);
            assert.equal(data.variants[0].paid_by, 'openvibe');
        });

        await check('who=sonnet asks for Sonnet; who=any asks for nothing', async () => {
            const ana = t.network.addUser('ana2');
            const sonnet = await create(ana, { prompt: 'A sonnet page', kind: 'page', who: 'sonnet' });
            assert.equal(sonnet.status, 201, sonnet.text);
            const sData = await settle(t, sonnet.json().design.id, { as: ana });
            const sAsk = generates.filter((g) => g.roundId === sData.design.id);
            assert.deepEqual(sAsk[0].prefer, SONNET);
            assert.equal(sAsk[0].person, ana.subject);

            const any = await create(ana, { prompt: 'Any model page', kind: 'page', who: 'any' });
            assert.equal(any.status, 201, any.text);
            const aData = await settle(t, any.json().design.id, { as: ana });
            const aAsk = generates.filter((g) => g.roundId === aData.design.id);
            assert.equal(aAsk[0].prefer, null);
            assert.equal(aAsk[0].pin, false);
        });

        await check('who=compare is the one pinned mode', async () => {
            const ana = t.network.addUser('ana3');
            const r = await create(ana, { prompt: 'Three providers page', kind: 'page', who: 'compare' });
            assert.equal(r.status, 201, r.text);
            const data = await settle(t, r.json().design.id, { as: ana });
            const asked = generates.filter((g) => g.roundId === data.design.id);
            assert.equal(asked.length, 3);
            assert.ok(asked.every((g) => g.pin === true && g.prefer === null));
            assert.deepEqual(plans, ['claude', 'claude', 'sonnet', 'any', 'compare']);
        });

        await check('the run request carries prefer and the person, no route, and returns paid_by', async () => {
            const seen = [];
            const http = createArenaAi({
                config: { ai: { url: 'https://ai.test', models: ['anthropic:claude-opus-5-5'], waitMs: 1000, pollMs: 1, timeoutMs: 5000 },
                    oauth: { clientId: 'design', clientSecret: 'x' }, networkUrl: 'https://network.test', networkInternalUrl: 'https://network.test' },
                fetchImpl: async (url, init = {}) => {
                    if (String(url).endsWith('/oauth/token')) return respond({ access_token: 'test-token', expires_in: 3600 });
                    seen.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null });
                    return respond({ run: { id: 'run_test', status: 'succeeded',
                        output: { text: '<!doctype html><html><body><h1>ok</h1></body></html>' },
                        usage: { tokens_in: 3, tokens_out: 4, cost_usd: 0 },
                        provenance: { provider: 'byo:self:usr_x:anthropic', model: 'claude-opus-5-5' },
                        explain: { paid_by: 'your anthropic key …-key', prefer: { provider: 'anthropic', model: 'claude-opus-5-5', honoured: true, why: 'your own anthropic key answered, as you asked' } } } });
                },
                log: { warn() {}, info() {}, log() {}, error() {} },
            });
            const out = await http.generate({ prompt: 'A page', category: 'landing', slot: OPUS, roundId: 'dsn_test', index: 0, prefer: OPUS, person: 'usr_x', pin: false });
            const run = seen.find((x) => x.url.includes('/api/v1/runs'));
            assert.ok(run, 'the run API is used');
            assert.equal(run.body.workflow, 'ai.chat', 'the step that honours prefer');
            assert.deepEqual(run.body.prefer, OPUS);
            assert.deepEqual(run.body.on_behalf_of, { type: 'user', id: 'usr_x' });
            assert.ok(!('route' in run.body), 'no route is pinned');
            assert.equal(out.paid_by, 'your anthropic key …-key');
            assert.equal(out.prefer.honoured, true);
            assert.equal(out.provider, 'anthropic', 'the key reference is not the provider name');

            await http.generate({ prompt: 'A page', category: 'landing', slot: { provider: 'openai', model: 'gpt-5.5' }, roundId: 'dsn_cmp', index: 0, pin: true });
            const pinned = seen.filter((x) => x.url.includes('/api/v1/runs')).at(-1);
            assert.equal(pinned.body.workflow, 'ai.generate');
            assert.deepEqual(pinned.body.route, { provider: 'openai', model: 'gpt-5.5' });
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
