'use strict';

/**
 * The create page's own API: /api/create/options, /api/create/estimate, /api/create and /api/create/recent.
 * The AI client is a stand-in for OpenVibe.AI: it offers two runnable models, publishes the same three in the
 * Exchange catalogue (one 18+), and reports the person's own key and machine when it is given their token.
 */
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');

const html = '<!doctype html><html><head><style>body{background:#ffffff;color:#222222}</style></head><body><h1>Design</h1></body></html>';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CATALOG = {
    models: [
        { slug: 'alpha/one', canonical: 'alpha/one', name: 'Alpha One', family: 'Alpha', kind: 'chat', uncensored: false,
            offers: [{ provider: 'alpha', model: 'one', provider_name: 'Alpha', status: 'up', price: { in: 1, out: 2, currency: 'USD', per: '1M tokens' } }] },
        { slug: 'beta/two', canonical: 'beta/two', name: 'Beta Two', family: 'Beta', kind: 'chat', uncensored: false,
            offers: [{ provider: 'beta', model: 'two', provider_name: 'Beta', status: 'up', price: { in: 3, out: 6, currency: 'USD', per: '1M tokens' } }] },
        { slug: 'secret/abliterated', canonical: 'secret/abliterated', name: 'Secret Uncensored', family: 'Secret', kind: 'chat', uncensored: true,
            offers: [{ provider: 'secret', model: 'abliterated', provider_name: 'Secret', status: 'up', price: { in: 4, out: 8, currency: 'USD', per: '1M tokens' } }] },
    ],
};

function fakeAi() {
    return {
        async offeredModels() { return [{ provider: 'alpha', model: 'one' }, { provider: 'beta', model: 'two' }, { provider: 'secret', model: 'abliterated' }]; },
        async exchangeCatalog() { return CATALOG; },
        async choices({ token } = {}) {
            if (!token) return { adult: false, options: { openvibe: [], keys: [], machines: [] } };
            return { adult: true, options: {
                openvibe: [],
                keys: [{ model: 'my/model', name: 'My key model', source: 'keys', adult: false }],
                machines: [{ machine: 'dev_1', machine_name: 'My laptop', model: 'local/model', name: 'Local model', source: 'machines', adult: false }],
            } };
        },
        async designPlan() {
            return { slots: [{ provider: 'alpha', model: 'one' }, { provider: 'beta', model: 'two' }, { provider: 'alpha', model: 'one' }],
                prefer: { provider: 'anthropic', model: 'claude-opus-5-5' }, pin: false };
        },
        async generate({ slot }) {
            await pause(5);
            return { html, provider: slot.provider, model: slot.model, cost_usd: 0.002, ms: 12 };
        },
    };
}

const balance = { read: async () => ({ currency: 'USD', balance_usd: 2, held_usd: 0.5, available_usd: 1.5 }) };

(async () => {
    const t = await boot({ ai: fakeAi(), balance });
    try {
        const user = t.network.addUser('kim');
        let signedOutOptions;

        await check('signed out options list kinds, frames, looks and priced models', async () => {
            const r = await t.get('/api/create/options');
            assert.equal(r.status, 200, r.text);
            signedOutOptions = r.json();
            assert.ok(signedOutOptions.kinds.some((k) => k.id === 'component' && k.frames.includes('desktop')));
            assert.ok(signedOutOptions.frames.some((f) => f.id === 'email' && f.width === 600));
            assert.ok(signedOutOptions.looks.some((l) => l.source === 'theme' && l.id === 'paper'));
            const alpha = signedOutOptions.models.find((m) => m.id === 'alpha:one');
            assert.ok(alpha, 'the runnable catalogue model is listed');
            assert.equal(alpha.price_in, 1);
            assert.equal(alpha.price_out, 2);
            assert.equal(alpha.adult, false);
            assert.match(alpha.exchange_url, /openvibe\.exchange\/models\/alpha\/one/);
            assert.ok(!signedOutOptions.models.some((m) => m.adult), 'the 18+ model is not listed signed out');
            assert.equal(signedOutOptions.takes.default, 3);
        });

        await check('signed in options add adult models and the person own keys and machines', async () => {
            const r = await t.get('/api/create/options', { as: user });
            assert.equal(r.status, 200, r.text);
            const body = r.json();
            assert.ok(body.models.some((m) => m.id === 'secret:abliterated' && m.adult === true), 'AI says this person may use 18+');
            assert.ok(body.models.some((m) => m.id === 'keys:my/model' && m.price_in === 0));
            assert.ok(body.models.some((m) => m.id === 'machines:dev_1:local/model' && m.price_in === 0));
        });

        await check('the estimate prices the chosen models and says whether Balance covers it', async () => {
            const r = await t.get('/api/create/estimate', { as: user, origin: 'https://openvibe.design',
                json: { prompt: 'A pricing card', kind: 'component', frame: 'desktop', models: ['alpha:one', 'beta:two'] } });
            assert.equal(r.status, 200, r.text);
            const body = r.json();
            assert.equal(body.currency, 'USD');
            assert.equal(body.per_model.length, 2);
            assert.ok(body.total_usd > 0);
            assert.equal(body.cost.currency, 'USD');
            assert.equal(body.cost.total_usd, body.total_usd);
            assert.equal(body.balance.available_usd, 1.5);
            assert.equal(body.covers, true);
            assert.equal(body.takes, 2);
        });

        await check('two takes per model doubles the estimate through the same function', async () => {
            const body = { prompt: 'A pricing card', kind: 'component', frame: 'desktop', models: ['alpha:one', 'beta:two'] };
            const one = (await t.get('/api/create/estimate', { as: user, origin: 'https://openvibe.design', json: body })).json();
            const two = (await t.get('/api/create/estimate', { as: user, origin: 'https://openvibe.design',
                json: { ...body, takes: 2 } })).json();
            assert.equal(two.takes, 4);
            assert.ok(Math.abs(two.total_usd - one.total_usd * 2) < 1e-6);
        });

        await check('signed out estimate answers without a Balance', async () => {
            const r = await t.get('/api/create/estimate', { origin: 'https://openvibe.design',
                json: { prompt: 'A pricing card', kind: 'component', models: ['alpha:one'] } });
            assert.equal(r.status, 200, r.text);
            const body = r.json();
            assert.ok(body.total_usd > 0);
            assert.equal(body.balance, null);
            assert.equal(body.covers, null);
        });

        let created;
        await check('a component with two models returns two takes that record their model', async () => {
            const r = await t.get('/api/create', { as: user, origin: 'https://openvibe.design',
                json: { prompt: 'A pricing card', kind: 'component', frame: 'desktop', look: 'paper',
                    models: ['alpha:one', 'beta:two'] } });
            assert.equal(r.status, 201, r.text);
            created = r.json();
            assert.equal(created.takes.length, 2);
            assert.deepEqual(created.takes.map((x) => x.modelId).sort(), ['alpha:one', 'beta:two']);
            assert.deepEqual(created.takes.map((x) => x.model).sort(), ['one', 'two']);
            const row = await t.store.db.maybe('SELECT * FROM designs WHERE id=$1', [created.design.id]);
            assert.equal(row.kind, 'component');
            assert.equal(row.frame, 'desktop');
            assert.equal(row.look, 'paper');
            assert.equal(row.models.length, 2);
            assert.ok(row.thumbnail_svg && row.thumbnail_svg.startsWith('<svg'));
        });

        await check('the two takes run and recent lists the design with a thumbnail, kind, model and time', async () => {
            let data;
            for (let i = 0; i < 150; i++) {
                data = (await t.get(`/api/v1/designs/${created.design.id}`, { as: user })).json();
                if (data.design.status !== 'running') break;
                await pause(20);
            }
            assert.equal(data.design.status, 'done');
            assert.deepEqual(data.variants.map((v) => v.model).sort(), ['one', 'two']);
            const r = await t.get('/api/create/recent', { as: user });
            assert.equal(r.status, 200, r.text);
            const body = r.json();
            assert.equal(body.designs[0].id, created.design.id);
            assert.equal(body.designs[0].kind, 'component');
            assert.equal(body.designs[0].model, 'Alpha One');
            assert.ok(body.designs[0].createdAt);
            assert.match(body.designs[0].thumbnail, /^\/api\/create\/designs\/.+\/thumb\.svg$/);
            const thumb = await t.get(body.designs[0].thumbnail, { as: user });
            assert.equal(thumb.status, 200);
            assert.match(thumb.headers.get('content-type'), /image\/svg\+xml/);
            assert.match(thumb.text, /^<svg/);
        });

        await check('paging with before and limit answers the next page', async () => {
            const first = (await t.get('/api/create/recent?limit=1', { as: user })).json();
            assert.equal(first.designs.length, 1);
            assert.ok(first.next);
            const second = (await t.get(`/api/create/recent?limit=1&before=${encodeURIComponent(first.next)}`, { as: user })).json();
            assert.ok(!second.designs.length || second.designs[0].id !== first.designs[0].id);
        });

        await check('an unknown model and a frame the kind does not allow are refused', async () => {
            const unknown = await t.get('/api/create/estimate', { as: user, origin: 'https://openvibe.design',
                json: { prompt: 'x', kind: 'component', models: ['nobody/none'] } });
            assert.equal(unknown.status, 422);
            const frame = await t.get('/api/create/estimate', { as: user, origin: 'https://openvibe.design',
                json: { prompt: 'x', kind: 'slide', frame: 'phone' } });
            assert.equal(frame.status, 422);
        });

        await check('a starting design is loaded through the ordinary access check', async () => {
            const listed = (await t.get('/api/create/recent', { as: user })).json();
            const source = listed.designs[0];
            const r = await t.get('/api/create/estimate', { as: user, origin: 'https://openvibe.design',
                json: { prompt: 'A variation on that card', kind: 'component', start: { design_id: source.id } } });
            assert.equal(r.status, 200, r.text);
            assert.equal(r.json().kind, 'component');
            const outsider = (await t.get('/api/create/estimate', { origin: 'https://openvibe.design',
                json: { prompt: 'A variation on that card', kind: 'component', start: { design_id: source.id } } })).json();
            assert.ok(outsider.detail);
        });

        await check('a starting URL is refused unless it is a public https page', async () => {
            for (const url of ['http://127.0.0.1/private', 'https://localhost/private', 'https://169.254.169.254/latest']) {
                const r = await t.get('/api/create/estimate', { origin: 'https://openvibe.design',
                    json: { prompt: 'x', kind: 'component', start: { url } } });
                assert.equal(r.status, 422, `${url} should be refused: ${r.text}`);
            }
        });

        await check('the present page and its three-take create still work', async () => {
            const page = await t.get('/create');
            assert.equal(page.status, 200);
            assert.match(page.text, /What will you design/);
            const r = await t.get('/create', { as: user, origin: 'https://openvibe.design',
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                body: 'prompt=Old+page+design&kind=page&who=claude' });
            assert.equal(r.status, 303, r.text);
            const id = r.headers.get('location').replace('/d/', '');
            let data;
            for (let i = 0; i < 150; i++) {
                data = (await t.get(`/api/v1/designs/${id}`, { as: user })).json();
                if (data.design.status !== 'running') break;
                await pause(20);
            }
            assert.equal(data.variants.length, 3);
            assert.equal(data.design.status, 'done');
        });
    } finally { await t.close(); }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
