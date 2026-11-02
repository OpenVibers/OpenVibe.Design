'use strict';

/**
 * Publish a design on openvibe.space (open item D8). Two halves:
 *   publish.js against a fake Space: Design's service token acts for the person (X-OV-Subject), the person's
 *   "Designs" project is made once, the site is named from the prompt (or the name asked for), a taken name tries
 *   another, the working frame is uploaded as index.html and activated, and publishing again reuses the site.
 *   The routes: the owner publishes from the canvas (and the API); a guest's private link and another person cannot;
 *   nothing publishes before a frame is picked; the canvas then says where it is live.
 */
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');
const { createPublisher, slugFor, NAME_RE } = require('../server/publish');

const PERSON = 'usr_01JZ00000000000000000PUB01';

/** A fake Space API: projects, sites (names global), deploys; records each call. */
function fakeSpace({ taken = [] } = {}) {
    const calls = [];
    const projects = [];
    const sites = [];
    const names = new Set(taken);
    const reply = (status, body) => ({ status, ok: status >= 200 && status < 300, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body, text: async () => JSON.stringify(body) });
    const fetchImpl = async (url, init = {}) => {
        const u = new URL(url);
        if (u.pathname === '/oauth/token') return reply(200, { access_token: 'svc-design-token', token_type: 'Bearer', expires_in: 300 });
        const headers = init.headers || {};
        const call = { method: init.method || 'GET', path: u.pathname, query: u.search, subject: headers['X-OV-Subject'], auth: headers.Authorization };
        calls.push(call);
        if (call.path === '/api/v1/projects' && call.method === 'GET') return reply(200, { projects: projects.filter((p) => p.owner === call.subject) });
        if (call.path === '/api/v1/projects' && call.method === 'POST') {
            const p = { id: `prj_${projects.length + 1}`, name: JSON.parse(init.body).name, owner: call.subject, environment: 'production' };
            projects.push(p);
            return reply(201, { project: p });
        }
        let m = /^\/api\/v1\/projects\/([^/]+)\/sites$/.exec(call.path);
        if (m && call.method === 'POST') {
            const name = JSON.parse(init.body).name;
            if (names.has(name)) return reply(409, { code: 'site.name_taken', detail: 'taken' });
            names.add(name);
            const s = { id: `site_${sites.length + 1}`, name, project_id: m[1] };
            sites.push(s);
            return reply(201, { site: s });
        }
        m = /^\/api\/v1\/sites\/([^/]+)$/.exec(call.path);
        if (m && call.method === 'GET') { const s = sites.find((x) => x.id === m[1]); return s ? reply(200, { site: s }) : reply(404, { code: 'site.not_found' }); }
        m = /^\/api\/v1\/sites\/([^/]+)\/deploys$/.exec(call.path);
        if (m && call.method === 'POST') {
            const files = [];
            for (const [k, v] of init.body.entries()) if (k === 'files') files.push({ name: v.name, text: await v.text() });
            call.files = files;
            const s = sites.find((x) => x.id === m[1]);
            return reply(201, { deploy: { id: `dep_${calls.length}` }, activated: true, url: `https://${s.name}.openvibe.space` });
        }
        return reply(404, { code: 'not_found' });
    };
    return { calls, fetchImpl, projects, sites };
}

const config = (extra = {}) => ({ networkInternalUrl: 'http://network.test', oauth: { clientId: 'design', clientSecret: 'design-secret' }, space: { url: 'http://space.test', audience: 'openvibe.space', scope: 'space.site.manage space.deploy.create' }, ...extra });
const quiet = { log() {}, warn() {}, error() {} };

(async () => {
    await check('site names: from the prompt, valid for Space', async () => {
        assert.equal(slugFor('A coffee roaster landing page!'), 'a-coffee-roaster-landing');
        assert.equal(slugFor('Hi'), 'design-hi');
        assert.equal(slugFor('Café ☕ menu', 'ab12'), 'cafe-menu-ab12');
        ['a-coffee-roaster-landing', 'design-hi', 'cafe-menu-ab12'].forEach((n) => assert.ok(NAME_RE.test(n), n));
    });

    await check('the first publish makes the person\'s Designs project and a site, uploads the frame and activates it', async () => {
        const space = fakeSpace({ taken: ['a-coffee-roaster-landing'] });
        const pub = createPublisher({ config: config(), fetchImpl: space.fetchImpl, log: quiet });
        const design = { id: 'des_01ABCDEFGH', prompt: 'A coffee roaster landing page' };
        const out = await pub.publish({ design, html: '<!doctype html><html><body><h1>Roast</h1></body></html>', subject: PERSON });
        assert.ok(out.created);
        assert.equal(out.url, 'https://a-coffee-roaster-landing-efgh.openvibe.space', 'a taken name tries the next one');
        assert.ok(space.calls.every((c) => c.subject === PERSON && c.auth === 'Bearer svc-design-token'), 'Design\'s token, acting for the person');
        assert.deepStrictEqual(space.projects.map((p) => [p.name, p.owner]), [['Designs', PERSON]]);
        const dep = space.calls.find((c) => c.files);
        assert.match(dep.query, /activate=1/);
        assert.deepStrictEqual(dep.files.map((f) => f.name), ['index.html']);
        assert.match(dep.files[0].text, /<h1>Roast<\/h1>/);

        // Again: the same site, a new deploy, no new project.
        const again = await pub.publish({ design: { ...design, space_site_id: out.siteId }, html: '<!doctype html><html><body><h1>Roast 2</h1></body></html>', subject: PERSON });
        assert.equal(again.siteId, out.siteId);
        assert.equal(again.created, false);
        assert.equal(space.projects.length, 1);
        assert.equal(space.sites.length, 1);
    });

    await check('a name asked for is used, or refused plainly', async () => {
        const space = fakeSpace({ taken: ['taken-name'] });
        const pub = createPublisher({ config: config(), fetchImpl: space.fetchImpl, log: quiet });
        const d = { id: 'des_02', prompt: 'x' };
        assert.equal((await pub.publish({ design: d, html: '<p>x</p>', subject: PERSON, name: 'my-page' })).url, 'https://my-page.openvibe.space');
        await assert.rejects(pub.publish({ design: d, html: '<p>x</p>', subject: PERSON, name: 'taken-name' }), (e) => e.code === 'publish.name_taken' && /taken-name\.openvibe\.space is taken/.test(e.detail));
        await assert.rejects(pub.publish({ design: d, html: '<p>x</p>', subject: PERSON, name: 'Bad_Name' }), (e) => e.code === 'publish.invalid_name');
        await assert.rejects(pub.publish({ design: d, html: '', subject: PERSON }), (e) => e.code === 'publish.no_frame');
        await assert.rejects(pub.publish({ design: d, html: '<p>x</p>', subject: null }), (e) => e.code === 'auth.required');
    });

    await check('without its secret the publisher is off and says so', async () => {
        const pub = createPublisher({ config: config({ oauth: { clientId: 'design', clientSecret: '' } }), fetchImpl: async () => { throw new Error('no call'); }, log: quiet });
        assert.equal(pub.enabled, false);
        await assert.rejects(pub.publish({ design: { id: 'd', prompt: 'p' }, html: '<p></p>', subject: PERSON }), (e) => e.code === 'publish.off');
    });

    // ── The routes, with an in-process fake publisher ──
    const published = [];
    const publisher = { enabled: true, publish: async ({ design, html, subject, name }) => { published.push({ id: design.id, html, subject, name }); return { url: `https://${name || 'from-prompt'}.openvibe.space`, siteId: 'site_9', siteName: name || 'from-prompt', created: true }; } };
    const ai = {
        slotPlan: async () => ({ slots: [{ provider: 'alpha', model: 'one' }, { provider: 'beta', model: 'two' }] }),
        generate: async ({ slot }) => ({ html: '<!doctype html><html><body><h1>Shop</h1></body></html>', provider: slot.provider, model: slot.model, cost_usd: 0.001, ms: 10 }),
    };
    const t = await boot({ ai, publisher });
    const kim = t.network.addUser('kim-pub');
    const bob = t.network.addUser('bob-pub');
    const POST = { origin: 'https://openvibe.design' };
    const formPost = (fields, extra = {}) => ({ method: 'POST', body: new URLSearchParams(fields).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' }, ...extra });
    try {
        const made = await t.get('/api/v1/designs', { ...POST, as: kim, json: { prompt: 'A shop page', kind: 'page' } });
        assert.equal(made.status, 201, made.text);
        const id = made.json().design.id;
        for (let i = 0; i < 80; i++) { if ((await t.get(`/api/v1/designs/${id}`, { as: kim })).json().design.status === 'done') break; await new Promise((r) => setTimeout(r, 20)); }

        await check('nothing publishes before a frame is picked; the canvas says to pick one', async () => {
            const page = await t.get(`/d/${id}`, { as: kim });
            assert.match(page.text, /id="dv-publish"/);
            assert.match(page.text, /Pick a frame first: the working frame is what gets published\./);
        });

        await check('the owner publishes from the canvas; the canvas then says where it is live', async () => {
            assert.equal((await t.get(`/api/v1/designs/${id}/pick`, { ...POST, as: kim, json: { variantIndex: 0 } })).status, 201);
            const form = await t.get(`/d/${id}/publish`, formPost({ name: 'kims-shop' }, { ...POST, as: kim }));
            assert.equal(form.status, 303, form.text);
            assert.match(form.headers.get('location'), /published=1#dv-publish$/);
            assert.deepStrictEqual([published[0].subject, published[0].name], [kim.subject, 'kims-shop']);
            assert.match(published[0].html, /<h1>Shop<\/h1>/, 'the working frame');
            const page = await t.get(`/d/${id}?published=1`, { as: kim });
            assert.match(page.text, /Live at <a href="https:\/\/kims-shop\.openvibe\.space"/);
            assert.match(page.text, />Publish this version</);
            const api = (await t.get(`/api/v1/designs/${id}`, { as: kim })).json();
            assert.equal(api.design.published.url, 'https://kims-shop.openvibe.space');
        });

        await check('another person cannot publish it; a cross-site form is refused', async () => {
            const n = published.length;
            const other = await t.get(`/api/v1/designs/${id}/publish`, { ...POST, as: bob, json: {} });
            assert.ok([403, 404].includes(other.status), other.text);
            const cross = await t.get(`/d/${id}/publish`, formPost({}, { origin: 'https://evil.example', as: kim }));
            assert.equal(cross.status, 403);
            assert.equal(published.length, n);
        });
    } finally { await t.close(); }
    done();
})();
