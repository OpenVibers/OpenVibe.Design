'use strict';
/**
 * The Design Arena as a view of Bench's nine design kinds (plan L51 step 1): a blind pair of any kind judged on
 * /arena, signed in or not. Signed out, Design relays the vote (its service token and X-OV-Voter: anon:<a keyed hash
 * of its own cookie>) and caps the address itself; Bench's own caps answer "Sign in to keep voting today". The
 * outputs are drawn by Bench's render origin in sandbox="allow-scripts" frames, the models stay hidden until the vote,
 * and every kind's board carries its voter counts.
 */
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');
const views = require('../server/views');
const { kindOf, DESIGN_KINDS } = require('../server/arena/kinds');

const ORIGIN = 'https://openvibe.design';
const RENDER = 'https://bench-render.openvibe.services';
const pairPart = (html) => html.slice(html.indexOf('id="ar-pair"'), html.indexOf('id="ar-boards"'));
const voterCookie = (res) => {
    const m = /ovd_voter=([0-9a-f]{32})/.exec(res.headers.get('set-cookie') || '');
    return m ? `ovd_voter=${m[1]}` : null;
};
const field = (html, name) => (new RegExp(`name="${name}" value="([^"]+)"`).exec(html) || [])[1];
const form = (fields) => ({ body: new URLSearchParams(fields).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' } });

(async () => {
    await check('the nine kinds, by id or short name', () => {
        assert.strictEqual(DESIGN_KINDS.length, 9);
        assert.strictEqual(kindOf('svg').id, 'design.svg');
        assert.strictEqual(kindOf('design.shader').id, 'design.shader');
        assert.strictEqual(kindOf('poster').id, 'design.page', 'anything else is the default');
        const off = views.arenaHome({ me: {}, guestVotes: false });
        assert.match(off, /Sign in to judge/, 'with signed-out voting off, the pair asks to sign in');
    });

    await check('the nine boards are read once a minute, a failed kind stays a gap, and nothing is kept when all fail', async () => {
        const { createArenaStore } = require('../server/arena/store');
        const calls = [];
        let down = false;
        const bench = {
            getBoard: async (kind, { voters }) => {
                calls.push(`${kind}|${voters}`);
                if (down || kind === 'design.shader') throw new Error('unreachable');
                return { rows: [{ subject: 'm1', elo: 1010, games: 3 }], voters: { person: 1, anon: 2, total: 3 } };
            },
        };
        const store = createArenaStore({ config: { arena: { maxPrompt: 4000 } }, bench });
        const first = await store.boardsAll({ now: 1000 });
        assert.strictEqual(first.length, 9);
        assert.deepStrictEqual(first.find((b) => b.kind === 'design.svg').voters, { person: 1, anon: 2, total: 3 });
        assert.strictEqual(first.find((b) => b.kind === 'design.shader').failed, true);
        await store.boardsAll({ now: 50_000 });
        assert.strictEqual(calls.length, 9, 'kept for a minute');
        await store.boardsAll({ now: 1000, voters: 'people' });
        assert.strictEqual(calls.filter((c) => c.endsWith('|people')).length, 9, 'each filter has its own');
        down = true;
        await store.boardsAll({ now: 70_000 });
        await store.boardsAll({ now: 70_001 });
        assert.strictEqual(calls.length, 36, 'an all-failed read is not kept');
    });

    await check('arena.js opens a pair at the phone view on a phone, and leaves it on a computer', () => {
        const fs = require('fs');
        const vm = require('vm');
        const src = fs.readFileSync(require.resolve('../public/js/arena.js'), 'utf8');
        const run = (narrow) => {
            const radio = { checked: false };
            const document = { getElementById: (id) => (id === 'ar-view-phone' ? radio : null), querySelectorAll: () => [], documentElement: { classList: { add() {} } } };
            const window = { matchMedia: (q) => ({ matches: narrow && /max-width: 759px/.test(q) }), location: {} };
            vm.runInNewContext(src, { document, window, setTimeout, fetch: () => null });
            return radio.checked;
        };
        assert.strictEqual(run(true), true);
        assert.strictEqual(run(false), false);
    });

    const t = await boot({ env: { DESIGN_ARENA_GUEST_VOTES_PER_ADDRESS: '2' } });
    const ana = t.network.addUser('ana');
    const bo = t.network.addUser('bo');
    try {
        const svg = t.bench.seedRound({ kind: 'design.svg', prompt: 'A fox curled up asleep, as a flat SVG', createdBy: ana.subject });
        let cookie;
        let page;
        await check('signed out: a blind pair of the chosen kind, drawn by Bench\'s render origin', async () => {
            page = await t.get('/arena?kind=svg', { headers: { 'x-forwarded-for': '198.51.100.7' } });
            assert.strictEqual(page.status, 200, page.text);
            assert.strictEqual(page.headers.get('cache-control'), 'private, no-store', 'a pair is this visitor\'s own');
            cookie = voterCookie(page);
            assert.ok(cookie, 'a voter cookie for the arena');
            assert.match(page.headers.get('set-cookie'), /Path=\/arena/i);
            assert.match(page.headers.get('set-cookie'), /HttpOnly/i);
            assert.ok((page.headers.get('content-security-policy') || '').includes(`frame-src 'self' https://openvibe.network ${RENDER}`), 'the CSP lets the render origin be framed');
            const pair = pairPart(page.text);
            assert.ok(pair.includes('A fox curled up asleep'), 'the brief');
            assert.strictEqual((pair.match(new RegExp(`src="${RENDER}/render/e/bte_`, 'g')) || []).length, 2, 'one 4:3 frame a side for art');
            assert.strictEqual((pair.match(/sandbox="allow-scripts"/g) || []).length, 2, 'scripts only, never same origin');
            assert.ok(!/alpha-1|beta-2|acme/.test(pair), 'the models stay hidden');
            assert.strictEqual((page.text.match(/class="ar-kind"/g) || []).length, 9, 'a chip for each kind');
            assert.match(page.text, /data-kind="design\.svg" aria-current="page"|aria-current="page" data-kind="design\.svg"/);
            const asked = t.bench.state.requests.filter((r) => r.path === '/api/v1/judgements/next').at(-1);
            assert.match(asked.voter, /^anon:[0-9a-f]{40}$/, 'a keyed hash of the cookie, never the cookie');
            assert.ok(!asked.voter.includes(cookie.split('=')[1]));
            const service = t.network.state.tokenRequests.find((x) => x.audience === 'openvibe.bench');
            assert.ok(service && /bench\.judgement\.cast/.test(service.scope), 'Design\'s own service token relays it');
        });

        await check('signed out: the vote is relayed, the models revealed, and that pair is done', async () => {
            const fields = { kind: 'design.svg', round_id: field(page.text, 'round_id'), left_output: field(page.text, 'left_output'), right_output: field(page.text, 'right_output'), winner: 'left' };
            const cross = await t.get('/arena/vote', { ...form(fields), cookie, origin: 'https://evil.example' });
            assert.strictEqual(cross.status, 403, 'a cross-site post is refused');
            const r = await t.get('/arena/vote', { ...form(fields), cookie, origin: ORIGIN, headers: { ...form(fields).headers, 'x-forwarded-for': '198.51.100.7' } });
            assert.strictEqual(r.status, 200, r.text);
            const j = t.bench.state.judgements.at(-1);
            assert.strictEqual(j.round_id, svg.id);
            assert.strictEqual(j.voter_kind, 'anon');
            assert.match(j.subject, /^anon_/);
            assert.match(r.text, /You picked A/);
            assert.match(r.text, /Your pick/);
            assert.ok(/alpha-1/.test(pairPart(r.text)) && /beta-2/.test(pairPart(r.text)), 'both models named');
            assert.match(r.text, /href="\/arena\?kind=design\.svg#ar-pair">Next pair/);
            const after = await t.get('/arena?kind=svg', { cookie, headers: { 'x-forwarded-for': '198.51.100.7' } });
            assert.match(after.text, /Nothing waiting in Illustration/, 'the same voter is not shown it again');
            assert.match(after.text, /Try Motion/);
        });

        await check('Bench\'s cap and Design\'s own address cap: "Sign in to keep voting today"', async () => {
            const more = t.bench.seedRound({ kind: 'design.shader', prompt: 'Northern lights', createdBy: ana.subject });
            const ask = async (addr, c) => t.get('/arena?kind=shader', { cookie: c, headers: { 'x-forwarded-for': addr } });
            const vote = async (addr, c, p) => t.get('/arena/vote', {
                ...form({ kind: 'design.shader', round_id: field(p.text, 'round_id'), left_output: field(p.text, 'left_output'), right_output: field(p.text, 'right_output'), winner: 'tie' }),
                cookie: c, origin: ORIGIN, headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': addr },
            });
            t.bench.state.anonPerDay = 0;
            const first = await ask('203.0.113.5', null);
            const c1 = voterCookie(first);
            const capped = await vote('203.0.113.5', c1, first);
            assert.strictEqual(capped.status, 429);
            assert.match(capped.text, /Sign in to keep voting today\. <a href="\/auth\/login\?next=/);
            t.bench.state.anonPerDay = 30;
            // Design counts the address: two votes from one address, then no more, whatever the cookie.
            const second = t.bench.seedRound({ kind: 'design.shader', prompt: 'Ink in water', createdBy: ana.subject });
            const p1 = await ask('203.0.113.9', null);
            assert.strictEqual((await vote('203.0.113.9', voterCookie(p1), p1)).status, 200);
            const p2 = await ask('203.0.113.9', null);
            assert.strictEqual((await vote('203.0.113.9', voterCookie(p2), p2)).status, 200);
            const p3 = await ask('203.0.113.9', null);
            const before = t.bench.state.requests.filter((r) => r.method === 'POST' && r.path.endsWith('/judgements')).length;
            const third = await vote('203.0.113.9', voterCookie(p3), p3);
            assert.strictEqual(third.status, 429);
            assert.match(third.text, /Sign in to keep voting today/);
            assert.strictEqual(t.bench.state.requests.filter((r) => r.method === 'POST' && r.path.endsWith('/judgements')).length, before, 'refused before Bench');
            assert.ok(more && second);
        });

        await check('signed in: the person\'s own token, and the reveal', async () => {
            const made = await t.get('/api/v1/arena/rounds', { as: ana, json: { category: 'landing', prompt: 'A bakery landing page' }, origin: ORIGIN });
            assert.strictEqual(made.status, 201, made.text);
            await t.tick();
            const p = await t.get('/arena', { as: bo });
            assert.strictEqual(p.status, 200);
            const pair = pairPart(p.text);
            assert.ok(pair.includes('A bakery landing page'));
            assert.strictEqual((pair.match(/class="ar-shot ar-shot--(phone|desktop)"/g) || []).length, 4, 'a page kind at phone and desktop widths');
            assert.match(pair, /You vote as yourself/);
            const r = await t.get('/arena/vote', {
                as: bo, origin: ORIGIN,
                ...form({ kind: 'design.page', round_id: field(p.text, 'round_id'), left_output: field(p.text, 'left_output'), right_output: field(p.text, 'right_output'), winner: 'right' }),
            });
            assert.strictEqual(r.status, 200, r.text);
            assert.match(r.text, /You picked B/);
            const call = t.bench.state.requests.filter((x) => x.method === 'POST' && x.path.endsWith('/judgements')).at(-1);
            assert.strictEqual(call.voter, null, 'no relay for a person');
            assert.strictEqual(t.bench.state.judgements.at(-1).subject, bo.subject);
        });

        await check('the boards: nine kinds, voter counts, whose votes', async () => {
            const p = await t.get('/arena?voters=anon');
            assert.strictEqual((p.text.match(/class="ar-kb( is-on)?"/g) || []).length, 9);
            assert.match(p.text, /id="ar-kb-design-svg"[\s\S]*?1 vote · 0 signed in · 1 signed out/);
            assert.ok(t.bench.state.requests.some((r) => r.path === '/api/v1/boards/design.shader' && /voters=anon/.test(r.query)));
            assert.match(p.text, /<a href="\/arena\?kind=design\.page&amp;voters=anon#ar-boards" aria-current="true">Signed out<\/a>|<a href="\/arena\?kind=design\.page&voters=anon#ar-boards" aria-current="true">Signed out<\/a>/);
            assert.match(p.text, /What each model costs/);
        });

        await check('the old vote address leads to the arena', async () => {
            const r = await t.get('/arena/vote?category=logo');
            assert.strictEqual(r.status, 302);
            assert.strictEqual(r.headers.get('location'), '/arena?kind=design.component#ar-pair');
        });
    } finally { await t.close(); }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
