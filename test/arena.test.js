'use strict';
/**
 * The Arena end to end: a round generates three outputs through the job, the sanitizer is applied before storage,
 * the budgets refuse in words, the pair is blind, one vote per person, the creator cannot vote, Elo handles a win,
 * a tie and both_bad, the leaderboard reports games/win rate/medians, and the dataset names no voter.
 */
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');

const ORIGIN = 'https://openvibe.design';

(async () => {
    const t = await boot({ random: () => 0, env: { DESIGN_ARENA_PER_DAY: '8', DESIGN_ARENA_DAILY: '40' } });
    const ana = t.network.addUser('ana');
    const bo = t.network.addUser('bo');
    const cy = t.network.addUser('cy');

    const create = (user, category = 'landing', prompt = 'A landing page for a tiny coffee roastery in Seattle', extra = {}) => t.get('/api/v1/arena/rounds', {
        as: user, json: { category, prompt }, origin: ORIGIN, ...extra,
    });
    const getRound = async (id) => (await t.get(`/api/v1/arena/rounds/${id}`)).json().round;
    // Extra rounds would compete with A for the next blind pair; the checks that make them clean up after themselves.
    const dropRounds = async (...ids) => { for (const id of ids.filter(Boolean)) await t.ctx.s.db.exec('DELETE FROM arena_rounds WHERE id = $1', [id]); };

    let A;
    await check('a round is queued by the request, and no AI call happens in the request', async () => {
        const before = t.ai.requests.length;
        const r = await create(ana);
        assert.strictEqual(r.status, 201, r.text);
        A = r.json().round;
        assert.strictEqual(A.status, 'queued');
        assert.deepStrictEqual(A.outputs, []);
        assert.strictEqual(t.ai.requests.length, before, 'the job, not the request, calls AI');
    });

    await check('the job generates three outputs through AI with its reported model, provider, cost, time and tokens', async () => {
        const ready = await t.tick();
        assert.ok(ready, 'a queued round was claimed');
        assert.strictEqual(ready.id, A.id);
        assert.strictEqual(ready.status, 'ready');
        assert.strictEqual(ready.outputs.length, 3);
        const models = ready.outputs.map((o) => o.model);
        const providers = ready.outputs.map((o) => o.provider);
        assert.deepStrictEqual(models, ['alpha-1', 'beta-2', 'gamma-3']);
        assert.deepStrictEqual(providers, ['acme', 'beta', 'gamma']);
        for (const o of ready.outputs) {
            assert.ok(o.id.startsWith('aro_'));
            assert.strictEqual(o.error, null);
            assert.match(o.html, /^<!doctype html>/i);
            assert.strictEqual(o.cost_usd, 0.0012);
            assert.strictEqual(o.ms, 321);
            assert.strictEqual(o.tokens, 600);
        }
        assert.strictEqual(ready.pool_fallback, false, 'three offers were listed, so no pool fallback');
        assert.deepStrictEqual(ready.offers, [
            { provider: 'acme', model: 'alpha-1' },
            { provider: 'beta', model: 'beta-2' },
            { provider: 'gamma', model: 'gamma-3' },
        ]);
        const posts = t.ai.requests.filter((r) => r.method === 'POST' && r.path === '/api/v1/generate');
        assert.strictEqual(posts.length, 3);
        for (const [i, p] of posts.entries()) {
            assert.ok(p.body.options.cache === false);
            assert.strictEqual(p.body.options.model, undefined, 'the pin is a route, not an options.model hint');
            assert.deepStrictEqual(p.body.route, ready.offers[i], 'each slot asks for one distinct offer');
            assert.match(p.body.prompt, /coffee roastery/);
            assert.strictEqual(p.body.target.service, 'design');
        }
    });

    await check('Design asked Network for a client-credentials token for openvibe.ai with ai.run.create', async () => {
        const token = t.network.state.tokenRequests.find((f) => f.grant_type === 'client_credentials');
        assert.ok(token, 'a client-credentials grant was made');
        assert.strictEqual(token.client_id, 'design');
        assert.strictEqual(token.audience, 'openvibe.ai');
        assert.strictEqual(token.scope, 'ai.run.create');
        assert.ok(t.ai.state.tokenClaims);
        assert.ok(t.ai.state.tokenClaims.aud.includes('openvibe.ai'));
        assert.ok(t.ai.state.tokenClaims.cap.includes('ai.run.create'));
        assert.ok(t.ai.state.tokenClaims.ns.includes('ai.*'));
    });

    await check('the sanitizer runs before storage, including the 200 KB cap', async () => {
        t.ai.state.htmlFor = () => '<h1>safe</h1><script>alert(1)</script><img src="x" onerror="alert(2)"><a href="javascript:alert(3)">x</a>';
        const r = await create(ana, 'logo', 'A mark with a script');
        const scripted = r.json().round.id;
        await t.tick();
        const round = await getRound(scripted);
        for (const o of round.outputs) {
            assert.match(o.html, /safe/);
            assert.ok(!/<script/i.test(o.html));
            assert.ok(!/\sonerror\s*=/i.test(o.html));
            assert.ok(!/javascript\s*:/i.test(o.html));
        }
        t.ai.state.htmlFor = () => `<p>${'x'.repeat(300 * 1024)}</p>`;
        const big = await create(ana, 'logo', 'A big page');
        const bigId = big.json().round.id;
        await t.tick();
        const bigRound = await getRound(bigId);
        for (const o of bigRound.outputs) assert.ok(Buffer.byteLength(o.html) <= 200 * 1024, `${Buffer.byteLength(o.html)} bytes`);
        t.ai.state.htmlFor = null;
        await dropRounds(scripted, bigId);
    });

    await check('bad input and a cross-site Origin are refused in words', async () => {
        const signedOut = await t.get('/api/v1/arena/rounds', { json: { category: 'landing', prompt: 'x' } });
        assert.strictEqual(signedOut.status, 401);
        const badCat = await create(ana, 'poster');
        assert.strictEqual(badCat.status, 422);
        assert.match(badCat.json().detail, /category/i);
        const empty = await create(ana, 'landing', '   ');
        assert.strictEqual(empty.status, 422);
        assert.match(empty.json().detail, /describe/i);
        const cross = await create(ana, 'landing', 'x', { origin: 'https://evil.example' });
        assert.strictEqual(cross.status, 403);
        assert.strictEqual(cross.json().code, 'design.cross_site');
    });

    await check('a cookie write needs same-origin: missing headers are refused, Sec-Fetch-Site or Origin passes', async () => {
        const missing = await create(ana, 'landing', 'no header', { origin: null });
        assert.strictEqual(missing.status, 403);
        assert.strictEqual(missing.json().code, 'design.cross_site');
        assert.match(missing.json().detail, /openvibe\.design itself/);
        const byFetchSite = await create(ana, 'landing', 'fetch metadata', { origin: null, headers: { 'sec-fetch-site': 'same-origin' } });
        assert.strictEqual(byFetchSite.status, 201, byFetchSite.text);
        const crossSite = await create(ana, 'landing', 'cross site', { origin: null, headers: { 'sec-fetch-site': 'cross-site' } });
        assert.strictEqual(crossSite.status, 403);
        // A Bearer write is not cookie-authenticated: no Origin is needed.
        const bearer = await t.get('/api/v1/arena/rounds', {
            method: 'POST', json: { category: 'landing', prompt: 'a bearer write' },
            headers: { authorization: `Bearer ${t.network.userToken(ana)}` },
        });
        assert.strictEqual(bearer.status, 201, bearer.text);
        await dropRounds(byFetchSite.json().round.id, bearer.json().round.id);
    });

    await check('the no-JS forms enforce the same policy', async () => {
        const form = { 'content-type': 'application/x-www-form-urlencoded' };
        const body = 'category=landing&prompt=a+form+round';
        const missing = await t.get('/arena/new', { as: ana, method: 'POST', body, headers: form });
        assert.strictEqual(missing.status, 403);
        const same = await t.get('/arena/new', { as: ana, method: 'POST', body, headers: { ...form, 'sec-fetch-site': 'same-origin' } });
        assert.strictEqual(same.status, 303, same.text);
        assert.match(same.headers.get('location'), /^\/arena\/r\/arr_/);
        const cross = await t.get('/arena/new', { as: ana, method: 'POST', body, headers: { ...form, origin: 'https://evil.example' } });
        assert.strictEqual(cross.status, 403);
        await dropRounds(String(same.headers.get('location')).split('/').pop());
    });

    let winner;
    let loser;
    await check('the pair is blind: no model, provider, cost or time before the vote', async () => {
        const pair = await t.get('/api/v1/arena/vote', { as: bo });
        assert.strictEqual(pair.status, 200, pair.text);
        const p = pair.json();
        assert.strictEqual(p.round.id, A.id);
        assert.deepStrictEqual(Object.keys(p.left).sort(), ['html', 'id']);
        assert.deepStrictEqual(Object.keys(p.right).sort(), ['html', 'id']);
        assert.ok(!JSON.stringify(p).includes('alpha-1'));
        assert.ok(!JSON.stringify(p).includes('beta-2'));
        const creator = await t.get('/api/v1/arena/vote', { as: ana });
        assert.strictEqual(creator.json().pair, null, 'the creator cannot be offered their own round');
        t.state = p;
    });

    await check('the creator cannot vote on their own round', async () => {
        const p = t.state;
        const r = await t.get('/api/v1/arena/vote', { as: ana, json: { round_id: A.id, left_output: p.left.id, right_output: p.right.id, winner: 'left' }, origin: ORIGIN });
        assert.strictEqual(r.status, 403);
        assert.strictEqual(r.json().code, 'arena.creator_cannot_vote');
    });

    await check('bo votes once; the models are revealed and the vote is recorded', async () => {
        const p = t.state;
        const r = await t.get('/api/v1/arena/vote', { as: bo, json: { round_id: A.id, left_output: p.left.id, right_output: p.right.id, winner: 'left' }, origin: ORIGIN });
        assert.strictEqual(r.status, 201, r.text);
        const out = r.json();
        assert.strictEqual(out.vote.winner, 'left');
        assert.ok(out.revealed.left.model);
        assert.ok(out.revealed.right.model);
        const leftModel = out.revealed.left.model;
        const rightModel = out.revealed.right.model;
        assert.notStrictEqual(leftModel, rightModel);
        winner = leftModel;
        loser = rightModel;
        const again = await t.get('/api/v1/arena/vote', { as: bo, json: { round_id: A.id, left_output: p.left.id, right_output: p.right.id, winner: 'right' }, origin: ORIGIN });
        assert.strictEqual(again.status, 409);
        assert.strictEqual(again.json().code, 'arena.already_voted');
    });

    await check('the leaderboard updates Elo K=32, games and win rate, with median cost and time', async () => {
        const lb = (await t.get('/api/v1/arena/leaderboard?category=landing')).json().leaderboard;
        const w = lb.find((r) => r.model === winner);
        const l = lb.find((r) => r.model === loser);
        assert.ok(w && l);
        assert.strictEqual(w.elo, 1016);
        assert.strictEqual(l.elo, 984);
        assert.strictEqual(w.games, 1);
        assert.strictEqual(w.wins, 1);
        assert.strictEqual(w.losses, 0);
        assert.strictEqual(w.win_rate, 1);
        assert.strictEqual(l.games, 1);
        assert.strictEqual(l.wins, 0);
        assert.strictEqual(l.losses, 1);
        assert.strictEqual(l.win_rate, 0);
        assert.strictEqual(w.median_cost_usd, 0.0012);
        assert.strictEqual(w.median_ms, 321);
    });

    await check('a tie is half a win for each; both_bad is a game for neither', async () => {
        const b = (await create(bo, 'dashboard', 'An analytics dashboard')).json().round;
        // Earlier same-origin tests queued rounds too: drain until this one is generated.
        let bRound;
        for (let i = 0; i < 12; i++) {
            bRound = await getRound(b.id);
            if (bRound.status === 'ready' || bRound.status === 'failed') break;
            await t.tick();
        }
        assert.strictEqual(bRound.status, 'ready');
        const tie = await t.ctx.arena.vote({ roundId: b.id, subject: cy.subject, leftOutput: bRound.outputs[0].id, rightOutput: bRound.outputs[1].id, winner: 'tie' });
        assert.strictEqual(tie.winner, 'tie');
        const lb = (await t.get('/api/v1/arena/leaderboard?category=dashboard')).json().leaderboard;
        const tied = lb.filter((r) => [bRound.outputs[0].model, bRound.outputs[1].model].includes(r.model));
        for (const row of tied) {
            assert.strictEqual(row.games, 1);
            assert.strictEqual(row.ties, 1);
            assert.strictEqual(row.wins, 0);
            assert.strictEqual(row.win_rate, 0.5);
            assert.strictEqual(row.elo, 1000, 'equal ratings tie to the same Elo');
        }

        const c = (await create(cy, 'game_ui', 'A game HUD')).json().round;
        await t.tick();
        const cRound = await getRound(c.id);
        const before = new Map(lb.map((r) => [r.model, r.games]));
        const both = await t.ctx.arena.vote({ roundId: c.id, subject: ana.subject, leftOutput: cRound.outputs[0].id, rightOutput: cRound.outputs[1].id, winner: 'both_bad' });
        assert.strictEqual(both.winner, 'both_bad');
        const after = (await t.get('/api/v1/arena/leaderboard?category=game_ui')).json().leaderboard;
        for (const row of after) {
            assert.strictEqual(row.games, 0, 'both_bad counted a game for neither');
            assert.strictEqual(row.elo, 1000);
            assert.strictEqual(row.ties, 0);
        }
        assert.ok(before.size >= 0);
    });

    await check('the dataset has prompts, output HTML and votes, and no voter ids', async () => {
        const ds = await t.get('/api/v1/arena/dataset.jsonl');
        assert.strictEqual(ds.status, 200);
        assert.match(ds.headers.get('content-type'), /ndjson|jsonl/);
        const lines = ds.text.trim().split('\n').map((l) => JSON.parse(l));
        assert.ok(lines.length >= 3);
        const a = lines.find((r) => r.id === A.id);
        assert.strictEqual(a.prompt, 'A landing page for a tiny coffee roastery in Seattle');
        assert.strictEqual(a.outputs.length, 3);
        assert.ok(a.outputs.every((o) => typeof o.html === 'string' && o.html.length));
        assert.strictEqual(a.votes.length, 1);
        assert.strictEqual(a.votes[0].winner, 'left');
        assert.ok(!ds.text.includes(ana.subject));
        assert.ok(!ds.text.includes(bo.subject));
        assert.ok(!ds.text.includes(cy.subject));
        assert.ok(!/voter_subject|"voter"/.test(ds.text));
    });

    await check('the pages render the leaderboard, the form and the frames with the CSP and both widths', async () => {
        const home = await t.get('/arena');
        assert.strictEqual(home.status, 200);
        assert.match(home.text, /id="ar-leaderboard"/);
        assert.match(home.text, /id="ar-lb-landing"/);
        assert.match(home.text, new RegExp(winner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        const round = await t.get(`/arena/r/${A.id}`);
        assert.strictEqual(round.status, 200);
        assert.match(round.text, /sandbox=""/);
        assert.match(round.text, /default-src 'none'/);
        assert.match(round.text, /width="390"/);
        assert.match(round.text, /width="1280"/);
        assert.match(round.text, /Phone · 390 px/);
        assert.match(round.text, /Desktop · 1280 px/);
        assert.doesNotMatch(round.text, /allow-scripts/);
        assert.doesNotMatch(round.text, /allow-same-origin/);
        const form = await t.get('/arena/new', { as: ana });
        assert.match(form.text, /id="ar-new-form"/);
        assert.match(form.text, /id="ar-category"/);
        assert.match(form.text, /id="ar-prompt"/);
        const anonVote = await t.get('/arena/vote');
        assert.match(anonVote.text, /Sign in to vote/);
        const gone = await t.get('/arena/r/nope');
        assert.strictEqual(gone.status, 404);
    });

    await check('only when fewer than three offers are listed does a round fall back to the pool, and say so', async () => {
        const two = await boot({ aiOptions: { models: [
            { provider: 'acme', model: 'alpha-1' },
            { provider: 'beta', model: 'beta-2' },
        ] } });
        try {
            const u = two.network.addUser('few');
            const r = await two.get('/api/v1/arena/rounds', { as: u, json: { category: 'landing', prompt: 'Two offers only' }, origin: ORIGIN });
            assert.strictEqual(r.status, 201, r.text);
            const done = await two.tick();
            assert.strictEqual(done.status, 'ready');
            assert.strictEqual(done.pool_fallback, true);
            assert.deepStrictEqual(done.offers, [
                { provider: 'acme', model: 'alpha-1' },
                { provider: 'beta', model: 'beta-2' },
                { provider: 'ai', model: null },
            ]);
            const posts = two.ai.requests.filter((x) => x.method === 'POST' && x.path === '/api/v1/generate');
            assert.strictEqual(posts.length, 3);
            assert.deepStrictEqual(posts[0].body.route, { provider: 'acme', model: 'alpha-1' });
            assert.deepStrictEqual(posts[1].body.route, { provider: 'beta', model: 'beta-2' });
            assert.strictEqual(posts[2].body.route, undefined, 'the third slot is the routing pool');
            const page = await two.get(`/arena/r/${done.id}`);
            assert.match(page.text, /id="ar-round-pool"/);
            assert.match(page.text, /Fewer than three distinct offers/);
        } finally { await two.close(); }
    });

    await check('the create page refuses over the person budget in words and keeps a 429', async () => {
        const small = await boot({ env: { DESIGN_ARENA_PER_DAY: '2', DESIGN_ARENA_DAILY: '3' } });
        try {
            const u = small.network.addUser('limit');
            const v = small.network.addUser('other');
            assert.strictEqual((await small.get('/api/v1/arena/rounds', { as: u, json: { category: 'landing', prompt: 'one' }, origin: ORIGIN })).status, 201);
            assert.strictEqual((await small.get('/api/v1/arena/rounds', { as: u, json: { category: 'landing', prompt: 'two' }, origin: ORIGIN })).status, 201);
            const refused = await small.get('/api/v1/arena/rounds', { as: u, json: { category: 'landing', prompt: 'three' }, origin: ORIGIN });
            assert.strictEqual(refused.status, 429);
            assert.strictEqual(refused.json().code, 'arena.limit_person');
            assert.match(refused.json().detail, /You can start 2 Arena rounds a day/);
            const page = await small.get('/arena/new', { as: u });
            assert.match(page.text, /0 of 2 rounds left/);
            assert.strictEqual((await small.get('/api/v1/arena/rounds', { as: v, json: { category: 'landing', prompt: 'v one' }, origin: ORIGIN })).status, 201);
            const site = await small.get('/api/v1/arena/rounds', { as: v, json: { category: 'landing', prompt: 'v two' }, origin: ORIGIN });
            assert.strictEqual(site.status, 429);
            assert.strictEqual(site.json().code, 'arena.limit_site');
            assert.match(site.json().detail, /reached its 3 rounds for today/);
        } finally { await small.close(); }
    });

    await t.close();
    done();
})().catch((err) => { console.error(err); process.exit(1); });
