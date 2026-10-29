'use strict';

/**
 * Design Studio part B: picking the working frame (and its one Arena vote), chat and click edits, the append-only
 * version list with undo/redo, quotas, authorization and the CSP after an edit. The AI and Bench are in-process
 * fakes from test/helpers, so nothing here spends money or touches the network.
 */
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');

const slots = [{ provider: 'alpha', model: 'one' }, { provider: 'beta', model: 'two' }, { provider: 'gamma', model: 'three' }];
const page = (title) => `<!doctype html><html><head><style>body{background:#ffffff;color:#222222}</style></head><body><section><h1>${title}</h1><p>Body copy</p><button>Get started</button></section></body></html>`;
let editCalls = 0;
let failEdit = false;
let lastEditPrompt = '';
const ai = {
    slotPlan: async () => ({ slots }),
    generate: async ({ slot, prompt }) => {
        if (prompt.includes('CURRENT_DESIGN')) {
            editCalls++;
            lastEditPrompt = prompt;
            if (failEdit) throw Object.assign(new Error('fake AI failed'), { status: 502, code: 'ai.run_failed', detail: 'fake AI failed' });
            const asked = /instruction: (.*)/.exec(prompt);
            const unsafe = '<script>alert(1)</script><img src="https://evil.example/x.png" onerror="alert(2)">';
            return { html: page(`Edited ${asked ? asked[1] : ''}${unsafe}`), provider: slot.provider, model: slot.model, cost_usd: 0.002, ms: 80 };
        }
        return { html: page('Generated'), provider: slot.provider, model: slot.model, cost_usd: 0.001, ms: 50 };
    },
};
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const t = await boot({ ai, env: { DESIGN_CHAT_EDITS_PER_DESIGN: '2' } });
    const kim = t.network.addUser('kim');
    const bob = t.network.addUser('bob');
    const POST = { origin: 'https://openvibe.design' };
    async function waitDone(id, key, as) {
        for (let i = 0; i < 80; i++) {
            const response = await t.get(`/api/v1/designs/${id}${key ? `?key=${encodeURIComponent(key)}` : ''}`, { as });
            if (response.json().design.status === 'done') return response.json();
            await pause(20);
        }
        throw new Error('design generation did not finish');
    }
    let guestIp = 0;
    async function guestDesign(prompt = 'A coffee roaster landing page') {
        // One address per guest design, so the part A two-a-day design cap does not mask the part B behaviour.
        const created = await t.get('/api/v1/designs', { ...POST, headers: { 'x-forwarded-for': `198.51.100.${++guestIp}` }, json: { prompt, kind: 'page' } });
        assert.equal(created.status, 201, created.text);
        const id = created.json().design.id;
        const key = created.json().editKey;
        assert.ok(key);
        await waitDone(id, key);
        return { id, key };
    }
    async function userDesign(prompt = 'A signed-in design') {
        const created = await t.get('/api/v1/designs', { ...POST, as: kim, json: { prompt, kind: 'page' } });
        assert.equal(created.status, 201, created.text);
        const id = created.json().design.id;
        await waitDone(id, null, kim);
        return { id };
    }
    const pick = (id, variantIndex, { key, as } = {}) => t.get(`/api/v1/designs/${id}/pick`, {
        ...POST, as, ...(key ? { headers: { 'x-design-key': key } } : {}), json: { variantIndex },
    });
    const click = (id, body, { key, as } = {}) => t.get(`/api/v1/designs/${id}/click`, {
        ...POST, as, ...(key ? { headers: { 'x-design-key': key } } : {}), json: body,
    });
    const edit = (id, instruction, { key, as, origin = true } = {}) => t.get(`/api/v1/designs/${id}/edit`, {
        ...(origin ? POST : {}), as, ...(key ? { headers: { 'x-design-key': key } } : {}), json: { instruction },
    });
    const versions = (id, { key, as } = {}) => t.get(`/api/v1/designs/${id}/versions${key ? `?key=${encodeURIComponent(key)}` : ''}`, { as });

    try {
        await check('pick is idempotent, persists the working frame and starts one version', async () => {
            const { id, key } = await guestDesign();
            const first = await pick(id, 1, { key });
            assert.equal(first.status, 201, first.text);
            const one = first.json();
            assert.equal(one.pick.variantIndex, 1);
            assert.equal(one.pick.currentSeq, 1);
            assert.equal(one.versions.length, 1);
            assert.equal(one.versions[0].kind, 'generated');
            assert.equal(one.vote.state, 'guest');
            assert.equal(one.variants[1].currentSeq, 1);
            const again = await pick(id, 1, { key });
            assert.equal(again.status, 200, again.text);
            assert.equal(again.json().idempotent, true);
            assert.equal(again.json().versions.length, 1);
            const wrong = await pick(id, 2, { key });
            assert.equal(wrong.status, 409);
            const rows = await t.store.db.many('SELECT * FROM design_picks WHERE design_id=$1', [id]);
            assert.equal(rows.length, 1);
            assert.equal(rows[0].variant_index, 1);
            assert.equal((await versions(id, { key })).headers.get('cache-control'), 'private, no-store');
        });

        await check('owner and guest-key authorization is enforced on pick and reads', async () => {
            const { id } = await userDesign('Owner only');
            assert.equal((await pick(id, 0, { as: bob })).status, 403);
            assert.equal((await pick(id, 0)).status, 403);
            assert.equal((await t.get(`/api/v1/designs/${id}`)).status, 403);
            assert.equal((await pick(id, 0, { as: kim })).status, 201);
            const guest = await guestDesign('Guest secret');
            assert.equal((await pick(guest.id, 0, { key: 'not-the-key' })).status, 403);
            assert.equal((await t.get(`/api/v1/designs/${guest.id}?key=not-the-key`)).status, 403);
            assert.equal((await pick(guest.id, 0, { key: guest.key })).status, 201);
        });

        await check('a signed-in pick records exactly one Bench round, three entries and one Arena vote', async () => {
            const { id } = await userDesign('Arena vote design');
            const response = await pick(id, 2, { as: kim });
            assert.equal(response.status, 201, response.text);
            const out = response.json();
            assert.equal(out.vote.state, 'recorded', JSON.stringify(out.vote));
            assert.ok(out.vote.roundId);
            const round = t.bench.state.rounds.get(out.vote.roundId);
            assert.ok(round, 'the pick created a Bench round');
            assert.equal(round.status, 'finished');
            const entries = [...t.bench.state.entries.values()].filter(e => e.round_id === round.id);
            assert.equal(entries.length, 3);
            assert.deepEqual(entries.map(e => e.model).sort(), ['one', 'three', 'two']);
            const votes = t.bench.state.judgements.filter(j => j.round_id === round.id);
            assert.equal(votes.length, 1);
            assert.equal(votes[0].subject, kim.subject);
            assert.equal(votes[0].outcome, 'left');
            assert.equal(votes[0].pair.left, entries.find(e => e.model === 'three').id);
            const again = await pick(id, 2, { as: kim });
            assert.equal(again.status, 200, again.text);
            assert.equal(t.bench.state.judgements.filter(j => j.round_id === round.id).length, 1, 'a repeated click is not a second vote');
            const rounds = [...t.bench.state.rounds.values()].filter(r => r.prompt === 'Arena vote design');
            assert.equal(rounds.length, 1, 'a repeated click is not a second Bench round');
        });

        await check('two simultaneous picks still record one vote', async () => {
            const { id } = await userDesign('Concurrent pick');
            const [a, b] = await Promise.all([pick(id, 1, { as: kim }), pick(id, 1, { as: kim })]);
            assert.deepEqual([a.status, b.status].sort(), [200, 201], a.text + b.text);
            const rounds = [...t.bench.state.rounds.values()].filter(r => r.prompt === 'Concurrent pick');
            assert.equal(rounds.length, 1, 'one Bench round for one design');
            assert.equal(t.bench.state.judgements.filter(j => j.round_id === rounds[0].id).length, 1);
            const list = await t.get(`/api/v1/designs/${id}/versions`, { as: kim });
            assert.equal(list.json().versions.length, 1);
        });

        await check('chat edit changes only the working frame, keeps its tokens and saves a new version', async () => {
            const { id, key } = await guestDesign('Chat edit design');
            assert.equal((await pick(id, 1, { key })).status, 201);
            const before = editCalls;
            const response = await edit(id, 'make the headline warmer', { key });
            assert.equal(response.status, 200, response.text);
            const out = response.json();
            assert.equal(out.version.seq, 2);
            assert.equal(out.version.kind, 'chat');
            assert.equal(out.version.model, 'two');
            assert.equal(editCalls, before + 1);
            assert.match(lastEditPrompt, /<<<CURRENT_DESIGN\n[\s\S]*<h1>Generated<\/h1>/);
            assert.match(lastEditPrompt, /--bg-primary/);
            assert.match(lastEditPrompt, /make the headline warmer/);
            const data = (await t.get(`/api/v1/designs/${id}?key=${encodeURIComponent(key)}`)).json();
            assert.match(data.variants[1].html, /Edited make the headline warmer/);
            assert.match(data.variants[1].html, /<style id="design-tokens">/);
            assert.doesNotMatch(data.variants[1].html, /<script\b/i);
            assert.doesNotMatch(data.variants[1].html, /onerror/i);
            assert.doesNotMatch(data.variants[0].html, /Edited/);
            assert.doesNotMatch(data.variants[2].html, /Edited/);
            assert.equal(data.versions.length, 2);
            assert.equal(data.versions[0].kind, 'generated');
            assert.equal(data.pick.currentSeq, 2);
            const stored = await t.store.db.many('SELECT html FROM design_versions WHERE design_id=$1 ORDER BY seq', [id]);
            assert.equal(stored.length, 2);
            assert.match(stored[0].html, /Generated/);
            assert.match(stored[1].html, /Edited/);
        });

        await check('chat edit enforces ownership, same-origin and the per-design AI budget', async () => {
            const owner = await userDesign('Chat auth design');
            assert.equal((await pick(owner.id, 0, { as: kim })).status, 201);
            assert.equal((await edit(owner.id, 'change it', { as: bob })).status, 403);
            assert.equal((await edit(owner.id, 'change it', { as: kim, origin: false })).status, 403, 'a cookie write without a same-origin signal is refused');
            assert.equal((await edit(owner.id, 'change it', { key: 'wrong' })).status, 403);

            const { id, key } = await guestDesign('Quota design');
            assert.equal((await pick(id, 0, { key })).status, 201);
            failEdit = true;
            const failed = await edit(id, 'this one fails', { key });
            assert.equal(failed.status, 502);
            failEdit = false;
            const ok = await edit(id, 'this one works', { key });
            assert.equal(ok.status, 200, ok.text);
            assert.equal(ok.json().version.seq, 2, 'the failed attempt spent budget but did not create a version');
            const refused = await edit(id, 'one too many', { key });
            assert.equal(refused.status, 429);
            assert.match(refused.json().detail, /2 AI edits/);
            const list = (await versions(id, { key })).json();
            assert.equal(list.versions.length, 2, 'the last good version survives a failed AI call and the quota refusal');
            const stored = await t.store.db.many('SELECT html FROM design_versions WHERE design_id=$1 ORDER BY seq', [id]);
            assert.match(stored[1].html, /this one works/);
        });

        await check('click edit validates the path and values and saves an escaped, token-only change', async () => {
            const { id, key } = await guestDesign('Click edit design');
            assert.equal((await pick(id, 1, { key })).status, 201);
            const path = 'body > section:nth-of-type(1) > h1:nth-of-type(1)';
            const response = await click(id, { path, text: 'Hello <img src=x onerror=alert(1)>', color: '--accent', spacing: 'md', align: 'center' }, { key });
            assert.equal(response.status, 201, response.text);
            const out = response.json();
            assert.equal(out.version.seq, 2);
            assert.equal(out.version.kind, 'click');
            assert.match(out.version.change.path, /^body > section/);
            const data = (await t.get(`/api/v1/designs/${id}?key=${encodeURIComponent(key)}`)).json();
            assert.match(data.variants[1].html, /Hello &lt;img src=x onerror=alert\(1\)&gt;/);
            assert.doesNotMatch(data.variants[1].html, /<img/);
            assert.match(data.variants[1].html, /style="[^"]*color:var\(--accent\)[^"]*padding:16px[^"]*text-align:center/);
            assert.match(data.variants[1].html, /<style id="design-tokens">/);

            const refused = [
                { path: 'body > script:nth-of-type(1)', text: 'x' },
                { path: 'body > section:nth-of-type(1) > h1:nth-of-type(1)', color: 'red' },
                { path: 'body > section:nth-of-type(1) > h1:nth-of-type(1)', color: '--not-in-the-theme' },
                { path: 'body > section:nth-of-type(1) > h1:nth-of-type(1)', spacing: '999px' },
                { path: 'body > section:nth-of-type(1) > h1:nth-of-type(1)', align: 'justify' },
                { path: 'body > section:nth-of-type(1) > h1:nth-of-type(1)', text: 'x', color: 'url(javascript:alert(1))' },
                { path: 'body > section:nth-of-type(1)', text: 'wipes the children' },
                { path: 'body > section:nth-of-type(1) > h1:nth-of-type(1) > span:nth-of-type(1)', text: 'missing' },
                { path: 'body #id', text: 'x' },
            ];
            for (const body of refused) {
                const bad = await click(id, body, { key });
                assert.equal(bad.status, 422, `${JSON.stringify(body)} should be refused`);
            }
            assert.equal((await click(id, { path, text: 'x' }, { key: 'wrong' })).status, 403);
            assert.equal((await click(id, { path, text: 'x' }, { as: bob })).status, 403);
        });

        await check('the rendered canvas keeps the frame CSP and injects the overlay outside stored HTML', async () => {
            const { id, key } = await guestDesign('CSP after edit');
            assert.equal((await pick(id, 1, { key })).status, 201);
            assert.equal((await click(id, { path: 'body > section:nth-of-type(1) > h1:nth-of-type(1)', text: 'Safe' }, { key })).status, 201);
            const canvas = await t.get(`/d/${id}?key=${encodeURIComponent(key)}`);
            assert.equal(canvas.status, 200);
            assert.equal(canvas.headers.get('cache-control'), 'private, no-store');
            assert.equal((canvas.text.match(/sandbox="allow-scripts"/g) || []).length, 3);
            assert.equal((canvas.text.match(/default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'/g) || []).length, 3);
            assert.equal((canvas.text.match(/data-dv-overlay=&quot;1&quot;/g) || []).length, 1, 'only the working frame carries the click overlay');
            const data = (await t.get(`/api/v1/designs/${id}?key=${encodeURIComponent(key)}`)).json();
            assert.doesNotMatch(data.variants[1].html, /data-dv-overlay/);
            assert.doesNotMatch(data.variants[1].html, /<script\b/i);
            assert.doesNotMatch(data.variants[1].html, /https?:\/\//);
        });

        await check('the page forms work without JavaScript (pick, chat edit, undo)', async () => {
            const { id, key } = await guestDesign('No-JS canvas');
            const form = { 'content-type': 'application/x-www-form-urlencoded' };
            const picked = await t.get(`/d/${id}/pick`, { headers: form, body: `key=${encodeURIComponent(key)}&variantIndex=0` });
            assert.equal(picked.status, 303);
            assert.match(picked.headers.get('location'), new RegExp(`^/d/${id}\\?key=`));
            const page1 = await t.get(`/d/${id}?key=${encodeURIComponent(key)}`);
            assert.match(page1.text, /Working frame/);
            const edited = await t.get(`/d/${id}/edit`, { headers: form, body: `key=${encodeURIComponent(key)}&instruction=no-js+edit` });
            assert.equal(edited.status, 303);
            const v = (await versions(id, { key })).json();
            assert.equal(v.versions.length, 2);
            assert.equal(v.versions[1].kind, 'chat');
            const undone = await t.get(`/d/${id}/undo`, { headers: form, body: `key=${encodeURIComponent(key)}` });
            assert.equal(undone.status, 303);
            assert.equal((await versions(id, { key })).json().currentSeq, 1);
        });

        await check('versions, undo, redo and a new edit after undo keep every version', async () => {
            const { id, key } = await guestDesign('Version history');
            assert.equal((await pick(id, 0, { key })).status, 201);
            assert.equal((await edit(id, 'second version', { key })).status, 200);
            const path = 'body > section:nth-of-type(1) > h1:nth-of-type(1)';
            assert.equal((await click(id, { path, color: '--accent' }, { key })).status, 201);
            let list = (await versions(id, { key })).json();
            assert.deepEqual(list.versions.map(v => v.seq), [1, 2, 3]);
            assert.equal(list.currentSeq, 3);

            const undo1 = await t.get(`/api/v1/designs/${id}/undo`, { ...POST, headers: { 'x-design-key': key }, json: {} });
            assert.equal(undo1.status, 200, undo1.text);
            assert.equal(undo1.json().changed, true);
            assert.equal(undo1.json().pick.currentSeq, 2);
            assert.match(undo1.json().variants[0].html, /Edited second version/);
            const redo = await t.get(`/api/v1/designs/${id}/redo`, { ...POST, headers: { 'x-design-key': key }, json: {} });
            assert.equal(redo.status, 200, redo.text);
            assert.equal(redo.json().pick.currentSeq, 3);
            assert.match(redo.json().variants[0].html, /color:var\(--accent\)/);

            const undo2 = await t.get(`/api/v1/designs/${id}/undo`, { ...POST, headers: { 'x-design-key': key }, json: {} });
            const undo3 = await t.get(`/api/v1/designs/${id}/undo`, { ...POST, headers: { 'x-design-key': key }, json: {} });
            assert.equal(undo2.json().pick.currentSeq, 2);
            assert.equal(undo3.json().pick.currentSeq, 1);
            const baseUndo = await t.get(`/api/v1/designs/${id}/undo`, { ...POST, headers: { 'x-design-key': key }, json: {} });
            assert.equal(baseUndo.status, 200);
            assert.equal(baseUndo.json().changed, false);

            const fresh = await click(id, { path, spacing: 'lg' }, { key });
            assert.equal(fresh.status, 201, fresh.text);
            assert.equal(fresh.json().version.seq, 4);
            list = (await versions(id, { key })).json();
            assert.deepEqual(list.versions.map(v => v.seq), [1, 2, 3, 4], 'undo + a new edit keeps the old versions');
            assert.equal(list.versions[1].kind, 'chat');
            assert.equal(list.versions[2].kind, 'click');
            assert.equal(list.currentSeq, 4);
            const noRedo = await t.get(`/api/v1/designs/${id}/redo`, { ...POST, headers: { 'x-design-key': key }, json: {} });
            assert.equal(noRedo.json().changed, false, 'a new edit clears the redo branch');
            assert.equal((await t.get(`/api/v1/designs/${id}/undo`, { ...POST, json: {} })).status, 403);
        });
    } finally {
        await t.close();
    }
    done();
})().catch(err => { console.error(err); process.exit(1); });
