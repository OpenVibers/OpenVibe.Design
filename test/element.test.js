'use strict';
/**
 * Design /create's kind Element and the Elements and packs gallery beside it (owner correction, 2026-11-11:
 * the gallery is on Design; Exchange is only the AI price catalogue). The AI writes a ui.element@1 look and
 * recipe as JSON, a bad take is asked again once with its reasons, the picked element runs on sample data
 * (never a robot), the generated sliders move size, tint and label, and the element is added to Live and
 * published, installed, rated, remixed and reported on Design itself.
 */
const assert = require('assert');
const http = require('http');
const { boot, check, done } = require('./helpers/boot');

const ELEMENT = {
    name: 'Big red button',
    description: 'A big red button that makes the robot spin, once a minute, for 100 points.',
    look: { component: 'button', label: 'Spin', icon: 'spark', props: { size: 'large' }, style: { tint: 'accent', shape: 'pill', opacity: 1, show_label: true } },
    recipe: {
        triggers: [{ kind: 'press' }],
        conditions: { role: 'everyone', cost: { points: 100 }, cooldown: { per_person_seconds: 60, overall_seconds: 60 } },
        actions: [{ kind: 'robot.drive_pulse', product: 'bot', direction: 'spin_left', ms: 2000 }],
    },
    capabilities: ['robot.drive_pulse'],
    initial_state: { spins: 0 },
};

function listen(handler) {
    return new Promise((resolve) => {
        const srv = http.createServer((req, res) => {
            const chunks = [];
            req.on('data', (c) => chunks.push(c));
            req.on('end', async () => {
                const body = Buffer.concat(chunks).toString('utf8');
                let json = {};
                try { json = JSON.parse(body || '{}'); } catch { /* empty */ }
                const answer = (status, doc) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(doc)); };
                try { await handler(req, json, answer); } catch (err) { answer(500, { detail: err.message }); }
            });
        });
        srv.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${srv.address().port}`, close: () => new Promise((r) => srv.close(r)) }));
    });
}

const fakeAi = (state, doc = ELEMENT) => ({
    designPlan: async () => ({ slots: [{ provider: 'acme', model: 'alpha-1' }], prefer: { provider: 'acme', model: 'alpha-1' }, pin: true }),
    text: async ({ prompt, system }) => {
        state.prompts.push(prompt);
        (state.systems = state.systems || []).push(system);
        const answer = state.badFirst && state.prompts.length === 1 ? JSON.stringify({ name: 'Broken' }) : JSON.stringify(doc);
        return { text: answer, model: 'alpha-1', provider: 'acme', run_id: `run_${state.prompts.length}`, cost_usd: 0.0012, ms: 300 };
    },
    exchangeCatalog: async () => ({ models: [{ slug: 'acme/alpha-1', name: 'Alpha', offers: [{ price: { in: 1, out: 2 } }] }] }),
});

(async () => {
    const aiState = { prompts: [], systems: [], badFirst: false };
    const ai = fakeAi(aiState);
    const liveCalls = [];
    const live = await listen((req, body, answer) => {
        liveCalls.push({ url: req.url, auth: Boolean(req.headers.authorization), body });
        answer(201, { id: 'el_LIVE0000000000000000000000', url: 'https://openvibe.live/elements/el_LIVE0000000000000000000000' });
    });
    const t = await boot({ ai, env: { OV_LIVE_URL: live.url } });
    const alice = t.network.addUser('alice');
    const bob = t.network.addUser('bob');
    const mod = t.network.addUser('mod', { role: 'global_mod' });
    const token = (u) => ({ authorization: `Bearer ${t.network.userToken(u)}` });
    const read = async (path, as = alice) => { for (let i = 0; i < 80; i += 1) { const r = await t.get(path, { as }); const d = r.json(); if (d.variants.every((v) => v.status === 'done' || v.status === 'failed')) return r; await new Promise((r) => setTimeout(r, 25)); } throw new Error('generation did not finish'); };

    try {
        await check('an Element design is generated as one JSON document, never HTML', async () => {
            const r = await t.get('/api/v1/designs', { headers: token(alice), json: { prompt: 'a big red button that makes the robot spin, once a minute, costs 100 points', kind: 'element' } });
            assert.strictEqual(r.status, 201, r.text);
            const id = r.json().design.id;
            const data = (await read(`/api/v1/designs/${id}`)).json();
            const v = data.variants[0];
            assert.strictEqual(v.status, 'done', v.error || '');
            assert.strictEqual(v.element.name, 'Big red button');
            assert.strictEqual(v.element.look.component, 'button');
            assert.strictEqual(v.element.recipe.actions[0].kind, 'robot.drive_pulse');
            assert.ok(!v.html.includes('<'), 'an element is not an HTML document');
            assert.ok(v.look.includes('dv-elx'), 'the look is drawn from the component');
            t.designId = id;
            t.elementVariant = v;
            assert.ok(aiState.systems[0].includes('ui.element@1'), 'the prompt asks for the element contract');
            assert.ok(aiState.systems[0].includes('robot.drive_pulse'), 'the prompt carries the action catalog');
        });

        await check('an invalid first take is asked once more with the reasons', async () => {
            aiState.badFirst = true;
            aiState.prompts = [];
            const r = await t.get('/api/v1/designs', { headers: token(alice), json: { prompt: 'a big red button', kind: 'element' } });
            assert.strictEqual(r.status, 201, r.text);
            const data = (await read(`/api/v1/designs/${r.json().design.id}`)).json();
            assert.strictEqual(aiState.prompts.length, 2, 'one retry');
            assert.match(aiState.prompts[1], /refused for these reasons/);
            assert.strictEqual(data.variants[0].status, 'done');
            aiState.badFirst = false;
        });

        await check('pick, then the generated sliders move size, tint and label', async () => {
            const picked = await t.get(`/api/v1/designs/${t.designId}/pick`, { headers: token(alice), json: { variantIndex: 0 } });
            assert.strictEqual(picked.status, 201, picked.text);
            const page = await t.get(`/d/${t.designId}`, { as: alice });
            assert.strictEqual(page.status, 200, page.text);
            assert.ok(page.text.includes('Open the element preview'));
            assert.ok(!page.text.includes('Edit with AI'), 'an element is changed with its sliders, not a chat edit');
            const first = t.elementVariant;
            const tweak = await t.get(`/api/v1/designs/${t.designId}/element/tweak`, { headers: token(alice), json: { size: 0, tint: 1, label: 'Spin it!' } });
            assert.strictEqual(tweak.status, 200, tweak.text);
            const v = tweak.json().variants[0];
            assert.strictEqual(v.element.look.label, 'Spin it!');
            assert.strictEqual(v.element.look.props.size, 'small');
            assert.notStrictEqual(v.element.look.style.tint, first.element.look.style.tint);
            assert.ok(v.tweaks.find((x) => x.name === 'size'));
        });

        await check('the preview runs the recipe on sample data: roles, cost, cooldown and a simulated robot', async () => {
            const sim = await t.get(`/api/v1/designs/${t.designId}/element/simulate`, { as: alice });
            assert.strictEqual(sim.status, 200, sim.text);
            const out = sim.json();
            assert.ok(out.events.some((e) => e.kind === 'press'));
            assert.ok(out.events.some((e) => e.kind === 'cost' && e.text.includes('100')));
            assert.ok(out.events.some((e) => e.kind === 'refused' && /cooldown/.test(e.text)));
            assert.ok(out.events.some((e) => e.kind === 'robot' && /simulated/.test(e.text)));
            assert.ok(!out.events.some((e) => e.kind === 'ai'), 'nothing calls AI');
            const page = await t.get(`/d/${t.designId}/element/preview`, { as: alice });
            assert.strictEqual(page.status, 200, page.text);
            assert.ok(page.text.includes('On sample data'));
            assert.ok(page.text.includes("Bot's simulated arena"));
            assert.ok(page.text.includes('Build with Codes'));
            assert.ok(page.text.includes('id="el-sim"'));
        });

        await check('Add to my channel and Publish to the gallery both use the person\'s own token', async () => {
            const channel = await t.get(`/d/${t.designId}/element/channel`, { headers: token(alice), body: 'key=' });
            assert.strictEqual(channel.status, 303, channel.text);
            assert.strictEqual(liveCalls.length, 1);
            assert.strictEqual(liveCalls[0].url, '/api/me/elements');
            assert.strictEqual(liveCalls[0].body.author.name, 'alice');
            assert.strictEqual(liveCalls[0].body.sharing, 'private');
            const published = await t.get(`/d/${t.designId}/element/gallery`, { headers: token(alice), body: 'key=' });
            assert.strictEqual(published.status, 303, published.text);
            const page = await t.get(`/d/${t.designId}/element/preview`, { as: alice });
            assert.ok(page.text.includes('On your channel'));
            assert.ok(page.text.includes('In the gallery'));
            const gallery = await t.get('/gallery');
            assert.strictEqual(gallery.status, 200, gallery.text);
            assert.ok(gallery.text.includes('Big red button'));
            const listing = await t.get('/gallery/big-red-button');
            assert.strictEqual(listing.status, 200, listing.text);
            assert.ok(listing.text.includes('Free'));
            assert.ok(listing.text.includes('Try it'));
        });

        await check('another person installs it, rates it and remixes it with credit', async () => {
            const install = await t.get('/gallery/big-red-button/install', { headers: token(bob), body: 'key=' });
            assert.strictEqual(install.status, 303, install.text);
            assert.ok(liveCalls.some((c) => c.url === '/api/me/elements'), 'the install goes to Live too');
            const page = await t.get('/gallery/big-red-button', { as: bob });
            assert.ok(page.text.includes('Installed'));
            const rate = await t.get('/gallery/big-red-button/rating', { headers: { ...token(bob), 'content-type': 'application/x-www-form-urlencoded' }, body: 'stars=5&note=It+spins' });
            assert.strictEqual(rate.status, 303, rate.text);
            const rated = await t.get('/gallery/big-red-button');
            assert.ok(rated.text.includes('5 / 5 from 1 rating'));
            const remix = await t.get('/gallery/big-red-button/remix', { headers: token(bob), body: 'key=' });
            assert.strictEqual(remix.status, 303, remix.text);
            const remixId = /^\/d\/([^?]+)/.exec(remix.headers.get('location') || '')?.[1];
            assert.ok(remixId, 'the remix opens in the canvas');
            const copy = await t.get(`/d/${remixId}`, { as: bob });
            assert.strictEqual(copy.status, 200, copy.text);
            assert.ok(copy.text.includes('Open the element preview'));
            const data = (await t.get(`/api/v1/designs/${remixId}`, { as: bob })).json();
            const original = (await t.get(`/api/v1/designs/${t.designId}`, { as: alice })).json();
            t.listingId = original.design.elementListing.id;
            assert.strictEqual(data.design.elementRemixOf, t.listingId, 'the remix credits the original');
            // Publishing the remix keeps the credit on the listing.
            const published = await t.get(`/d/${remixId}/element/gallery`, { headers: token(bob), body: 'key=' });
            assert.strictEqual(published.status, 303, published.text);
            const remixListing = t.ctx.gallery.get('big-red-button-remix');
            const copyListing = await t.get('/gallery/big-red-button-remix');
            assert.strictEqual((await remixListing).remix_of, t.listingId, 'the published remix keeps the credit');
            assert.strictEqual(copyListing.status, 200, copyListing.text);
        });

        await check('Try it runs the public listing; a report reaches staff and hides it', async () => {
            const tryPage = await t.get('/gallery/big-red-button/try');
            assert.strictEqual(tryPage.status, 200, tryPage.text);
            assert.ok(tryPage.text.includes('On sample data'));
            assert.ok(tryPage.text.includes('href="/gallery/big-red-button"'), 'Try it leads back to its listing');
            assert.ok(tryPage.text.includes('class="el-turns"'), 'the sample run reads as turns: who pressed, then what happened');
            const report = await t.get('/gallery/big-red-button/report', { headers: { ...token(bob), 'content-type': 'application/x-www-form-urlencoded' }, body: 'reason=broken&detail=The+button+does+nothing' });
            assert.strictEqual(report.status, 303, report.text);
            const queue = await t.get('/gallery/moderation', { as: mod });
            assert.strictEqual(queue.status, 200, queue.text);
            assert.ok(queue.text.includes('The button does nothing'));
            const accept = await t.get('/gallery/moderation/reports/' + /\/gallery\/moderation\/reports\/([^"]+)/.exec(queue.text)?.[1], { headers: token(mod), body: 'key=' });
            assert.strictEqual(accept.status, 303, accept.text);
            assert.strictEqual((await t.get('/gallery/big-red-button')).status, 404, 'a hidden listing is not public');
        });

        await check('a look prop cannot smuggle a colour or a URL into the gallery', async () => {
            const bad = { ...ELEMENT, name: 'Prop colour', look: { ...ELEMENT.look, props: { size: 'large', colour: '#ff0000' } } };
            const r = await t.get('/api/v1/gallery/listings', { headers: token(alice), json: { document: bad } });
            assert.strictEqual(r.status, 422, r.text);
            assert.match(r.json().detail, /literal colour/);
        });

        await check('the price line names the AI an element calls, from the live catalogue', async () => {
            const elementLib = require('../server/create/element');
            const priced = await elementLib.priceOf({ recipe: { actions: [{ kind: 'ai.ask', product: 'ai', prompt: 'Is it good?', model: 'acme/alpha-1' }] } }, ai);
            assert.ok(priced.calls.length === 1);
            assert.strictEqual(priced.calls[0].price_in, 1);
            assert.strictEqual(priced.calls[0].price_out, 2);
            assert.match(priced.text, /\$1\/M in/);
        });

        await check('Live can hand a validated element to the gallery with the person\'s own token', async () => {
            const doc = { ...ELEMENT, name: 'Live sent button' };
            const r = await t.get('/api/v1/gallery/listings', { headers: token(alice), json: { document: doc, source: 'live', source_id: 'live_1' } });
            assert.strictEqual(r.status, 201, r.text);
            assert.strictEqual(r.json().slug, 'live-sent-button');
            assert.strictEqual(r.json().source, 'live');
            const one = await t.get('/api/v1/gallery/listings/live-sent-button');
            assert.strictEqual(one.status, 200, one.text);
        });

        await check('the official LOOI pack is published by OpenVibe once', async () => {
            const { seedOfficial } = require('../server/elements/official');
            const first = await seedOfficial(t.ctx.gallery, { log() {}, warn() {} });
            const again = await seedOfficial(t.ctx.gallery, { log() {}, warn() {} });
            assert.ok(first && first.id);
            assert.strictEqual(first.official, true);
            assert.strictEqual(first.author.subject, null);
            assert.strictEqual(first.kind, 'pack');
            assert.strictEqual(again.id, first.id);
            const page = await t.get('/gallery/looi-pack');
            assert.strictEqual(page.status, 200, page.text);
            assert.ok(page.text.includes('LOOI pack'));
            assert.ok(page.text.includes('Headlights on'));
            // The pack's page shows its whole deck, each element a door to Try it on that element.
            const items = first.document.items;
            assert.strictEqual((page.text.match(/class="el-deck-tile"/g) || []).length, items.length, 'every element of the pack is on its page');
            assert.ok(page.text.includes('href="/gallery/looi-pack/try?item=2"'));
            const third = await t.get('/gallery/looi-pack/try?item=2');
            assert.strictEqual(third.status, 200, third.text);
            assert.ok(third.text.includes(`<h1`) && third.text.includes(items[2].name), 'Try it opens the element asked for');
            assert.ok(third.text.includes('aria-current="page"') && third.text.includes('class="el-pack-pick"'), 'the pack\'s other elements are one tap away');
            const far = await t.get('/gallery/looi-pack/try?item=99');
            assert.ok(far.text.includes(items[items.length - 1].name), 'an item past the end opens the last one');
            // The gallery's kind chips carry their counts.
            const gallery = await t.get('/gallery');
            assert.match(gallery.text, /Packs<\/span><span class="el-g-n">\d+<\/span>/);
            assert.ok(gallery.text.includes('class="el-g-mini"'), 'a pack card shows its first elements, not one button');
            const remix = await t.get('/gallery/looi-pack/remix', { headers: token(bob), body: 'key=' });
            assert.strictEqual(remix.status, 303, remix.text);
            const copySlug = /\/gallery\/([^?]+)/.exec(remix.headers.get('location') || '')?.[1];
            assert.strictEqual(copySlug, 'looi-pack-remix');
            const copy = await t.ctx.gallery.get(copySlug);
            assert.strictEqual(copy.remix_of, first.id, 'a pack remix credits the original');
            assert.strictEqual(copy.kind, 'pack');
        });
    } finally {
        await t.close();
        await live.close();
    }
    return done();
})();
