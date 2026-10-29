'use strict';

const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');

const html = '<!doctype html><html><head><style>body{background:#ffffff;color:#222222}</style></head><body><h1>Design</h1></body></html>';
const slots = [{ provider: 'alpha', model: 'one' }, { provider: 'beta', model: 'two' }, { provider: 'gamma', model: 'three' }];
const waiting = [];
const ai = {
    slotPlan: async () => ({ slots }),
    generate: ({ slot, prompt }) => prompt.includes('Signed design')
        ? Promise.resolve({ html, provider: slot.provider, model: slot.model, cost_usd: 0.001, ms: 125 })
        : new Promise(resolve => waiting.push(() => resolve({ html, provider: slot.provider,
            model: slot.model, cost_usd: 0.001, ms: 125 }))),
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const t = await boot({ ai });
    try {
        let id, key, cookie;
        const user = t.network.addUser('kim');
        await check('unknown design returns 404', async () => {
            const response = await t.get('/api/v1/designs/unknown');
            assert.equal(response.status, 404);
        });
        await check('create queues three distinct AI route pins in one row', async () => {
            const response = await t.get('/api/v1/designs', { json: { prompt: 'A coffee roaster landing page', kind: 'page' }, origin: 'https://openvibe.design' });
            assert.equal(response.status, 201, response.text);
            ({ id } = response.json().design);
            key = response.json().editKey;
            cookie = response.headers.get('set-cookie').split(';')[0];
            assert.ok(key);
            for (let i = 0; i < 30 && waiting.length < 3; i++) await pause(20);
            assert.equal(waiting.length, 3);
            const rows = await t.store.db.many('SELECT * FROM designs WHERE id=$1', [id]);
            assert.equal(rows.length, 1);
            assert.equal(rows[0].variants.length, 3);
            assert.deepEqual(rows[0].variants.map(v => v.provider), ['alpha', 'beta', 'gamma']);
            assert.equal((await t.get(`/api/v1/designs/${id}`)).status, 403);
            const progress = (await t.get(`/api/v1/designs/${id}?key=${key}`)).json();
            assert.equal(progress.variants.filter(v => v.status === 'running').length, 3);
        });
        await check('poll shows each completed frame while other models run', async () => {
            waiting[0]();
            let progress;
            for (let i = 0; i < 30; i++) {
                progress = (await t.get(`/api/v1/designs/${id}?key=${key}`)).json();
                if (progress.variants[0].status === 'done') break;
                await pause(20);
            }
            assert.equal(progress.variants[0].status, 'done');
            assert.equal(progress.variants[1].status, 'running');
            assert.match(progress.variants[0].html, /<style id="design-tokens">/);
            assert.doesNotMatch(progress.variants[0].html, /background:#ffffff/);
            waiting[1](); waiting[2]();
            for (let i = 0; i < 30; i++) {
                progress = (await t.get(`/api/v1/designs/${id}?key=${key}`)).json();
                if (progress.design.status === 'done') break;
                await pause(20);
            }
            assert.equal(progress.variants.filter(v => v.status === 'done').length, 3);
            assert.equal(progress.design.status, 'done');
        });
        await check('canvas is server rendered and themes repaint every frame', async () => {
            const page = await t.get(`/d/${id}?key=${key}`);
            assert.equal(page.status, 200);
            assert.equal(page.headers.get('cache-control'), 'private, no-store');
            assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
            assert.equal((page.text.match(/sandbox="allow-scripts"/g) || []).length, 3);
            assert.equal((page.text.match(/default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'/g) || []).length, 3,
                'each frame blocks external network requests through its CSP');
            assert.match(page.text, /Desktop · 1280/);
            const changed = await t.get(`/api/v1/designs/${id}/theme`, { json: { themeId: 'paper', editKey: key }, origin: 'https://openvibe.design' });
            assert.equal(changed.status, 200, changed.text);
            const progress = (await t.get(`/api/v1/designs/${id}?key=${key}`)).json();
            assert.equal(progress.design.themeId, 'paper');
            assert.ok(progress.variants.every(v => v.html.includes('#fbfaf7')));
            const recent = await t.get('/create', { cookie });
            assert.equal(recent.headers.get('cache-control'), 'private, no-store');
            assert.match(recent.text, /A coffee roaster landing page/);
            assert.match(recent.text, /Mobile onboarding/);
        });
        await check('guest and signed-in studio HTML stay private without changing public pages', async () => {
            const guest = await t.get('/create');
            assert.equal(guest.headers.get('cache-control'), 'private, no-store');
            const signedCreate = await t.get('/create', { as: user });
            assert.equal(signedCreate.headers.get('cache-control'), 'private, no-store');
            const created = await t.get('/api/v1/designs', { as: user,
                json: { prompt: 'Signed design', kind: 'page' }, origin: 'https://openvibe.design' });
            assert.equal(created.status, 201, created.text);
            const signedCanvas = await t.get(`/d/${created.json().design.id}`, { as: user });
            assert.equal(signedCanvas.status, 200);
            assert.equal(signedCanvas.headers.get('cache-control'), 'private, no-store');
            assert.equal(signedCanvas.headers.get('referrer-policy'), 'no-referrer');
            assert.equal((await t.get('/')).headers.get('cache-control'), 'public, max-age=120');
        });
    } finally { waiting.splice(0).forEach(resolve => resolve()); await t.close(); }
    done();
})().catch(err => { console.error(err); process.exit(1); });
