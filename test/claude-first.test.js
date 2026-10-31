'use strict';
// openvibe.design is Claude-first (plan L37, 2026-10-31): a design's three takes are Claude Opus 5.5, Claude Sonnet 5.5
// and Opus again when OpenVibe.AI offers them; a missing one is filled by the Arena's next pick, and no Claude at all
// is said in the answer. "Compare models" is the Arena's three providers. The create form offers both, Claude checked.
const assert = require('node:assert/strict');
const { createArenaAi } = require('../server/arena/ai');
const { boot, check, done } = require('./helpers/boot');

const clientOf = (models) => createArenaAi({
    config: { ai: { url: 'https://ai.test', models, waitMs: 1000 }, oauth: { clientId: 'design', clientSecret: 'x' }, networkUrl: 'https://network.test' },
    fetchImpl: async () => { throw new Error('no network in this test'); },
    log: { warn() {}, info() {}, log() {}, error() {} },
});

(async () => {
    await check('Claude first: Opus 5.5, Sonnet 5.5, then Opus again', async () => {
        const plan = await clientOf(['openai:gpt-5.5', 'anthropic:claude-sonnet-5-5', 'deepseek:deepseek-chat', 'anthropic:claude-opus-5-5']).designPlan();
        assert.deepEqual(plan.slots, [
            { provider: 'anthropic', model: 'claude-opus-5-5' },
            { provider: 'anthropic', model: 'claude-sonnet-5-5' },
            { provider: 'anthropic', model: 'claude-opus-5-5' },
        ]);
        assert.equal(plan.who, 'claude');
        assert.equal(plan.claude, true);
    });

    await check('a Claude model AI does not offer is filled by the Arena\'s next pick', async () => {
        const plan = await clientOf(['openai:gpt-5.5', 'anthropic:claude-opus-5-5', 'deepseek:deepseek-chat']).designPlan('claude');
        assert.deepEqual(plan.slots.map((s) => s.model), ['claude-opus-5-5', 'claude-opus-5-5', 'gpt-5.5']);
    });

    await check('no Claude offered: the Arena\'s picks, and the answer says so', async () => {
        const plan = await clientOf(['openai:gpt-5.5', 'deepseek:deepseek-chat']).designPlan();
        assert.equal(plan.claude, false);
        assert.deepEqual(plan.slots, [{ provider: 'openai', model: 'gpt-5.5' }, { provider: 'deepseek', model: 'deepseek-chat' }, { provider: 'ai', model: null }]);
        assert.equal(plan.pool_fallback, true);
    });

    await check('compare: one per provider, as the Arena asks', async () => {
        const plan = await clientOf(['anthropic:claude-opus-5-5', 'anthropic:claude-sonnet-5-5', 'openai:gpt-5.5', 'deepseek:deepseek-chat']).designPlan('compare');
        assert.equal(plan.who, 'compare');
        assert.deepEqual(plan.slots.map((s) => s.provider), ['anthropic', 'openai', 'deepseek']);
    });

    const asked = [];
    const ai = {
        designPlan: async (who) => { asked.push(who); return { slots: [{ provider: 'anthropic', model: 'claude-opus-5-5' }, { provider: 'anthropic', model: 'claude-sonnet-5-5' }, { provider: 'anthropic', model: 'claude-opus-5-5' }] }; },
        generate: () => new Promise(() => {}),
    };
    const t = await boot({ ai });
    try {
        await check('the create form offers Claude Opus 5.5 (checked) or a comparison, and passes the choice on', async () => {
            const page = await t.get('/create');
            assert.ok(page.text.includes('<input type="radio" name="who" value="claude" checked>') && page.text.includes('value="compare"'));
            const ana = t.network.addUser('ana');
            const form = (who) => ({ method: 'POST', as: ana, body: `prompt=A+coffee+roaster&who=${who}`, headers: { 'content-type': 'application/x-www-form-urlencoded' }, origin: 'https://openvibe.design' });
            await t.get('/create', form('compare'));
            await t.get('/create', form('claude'));
            await t.get('/create', form('anything'));
            assert.deepEqual(asked, ['compare', 'claude', 'claude'], 'anything else is Claude');
            const api = await t.get('/api/v1/designs', { as: ana, json: { prompt: 'Pricing section', kind: 'page' }, origin: 'https://openvibe.design' });
            assert.equal(api.status, 201);
            assert.equal(asked[asked.length - 1], 'claude', 'the API defaults to Claude too');
            const read = await t.get(`/api/v1/designs/${api.json().design.id}`, { as: ana });
            assert.deepEqual(read.json().variants.map((v) => v.model), ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5']);
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
