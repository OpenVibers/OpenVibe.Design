'use strict';

/**
 * The design deep dive's own pages on OpenVibe.Design (11-15, the owner: the deep dive "was supposed to be for
 * openvibe.design", built on Exchange's general deep dive):
 *   - /deep-dive: what it does; signed out, a sign-in; signed in, the form with the depths and their prices; starting
 *     one signed out signs in and comes back with the question kept;
 *   - starting one asks AI for a design deep dive for the person and opens /research/:id;
 *   - /research/:id while it runs: the live view (its seed and script), Stop; /research/:id/state is AI's state, the
 *     person's own only; choosing: the candidates with Drop, Add and Start the capture (AI gets them); Stop cancels;
 *   - when it ends, /research/:id is the report;
 *   - "Your deep dives" lists it.
 */

const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');
const { startAi } = require('./helpers/ai');

const report = {
    id: 'run_x', schema: 'ai.deep-dive@1', status: 'succeeded',
    input: { question: 'A phone-first robot control panel', depth: 'quick', max_sites: 6, sites: [] },
    steps: [], sources: [{ id: 'src_acme', kind: 'web', title: 'Acme controls', url: 'https://acme.example/controls', read_at: '2026-11-15T22:00:00.000Z' }],
    captures: [
        { id: 'cap_1', source_id: 'src_acme', url: 'https://acme.example/controls', captured_at: '2026-11-15T22:01:00.000Z', viewport: 390, theme: 'dark', full_page: true, media_id: 'med_01JKLMNPQRSTVWXYZ012345678', crops: [{ id: 'crop_1_1', media_id: 'med_01JKLMNPQRSTVWXYZ012345679', y: 0, height: 844 }], skip: null, cached: false },
        { id: 'cap_2', source_id: 'src_acme', url: 'https://acme.example/controls', captured_at: '2026-11-15T22:01:00.000Z', viewport: 1280, theme: 'light', full_page: true, media_id: 'med_01JKLMNPQRSTVWXYZ01234567A', crops: [{ id: 'crop_2_1', media_id: 'med_01JKLMNPQRSTVWXYZ01234567B', y: 0, height: 844 }], skip: null, cached: true },
        { id: 'cap_3', source_id: 'src_acme', url: 'https://acme.example/controls', captured_at: '2026-11-15T22:01:00.000Z', viewport: 390, theme: 'light', full_page: false, media_id: null, crops: [], skip: 'robots_disallowed', cached: false },
    ],
    analysis: [],
    synthesis: { patterns: [{ name: 'One primary button in the thumb arc', what: 'The primary button sits in the thumb arc.', sites: [], usage_count: 2, evidence: [] }], comparison: { columns: [], rows: [] }, best: { source_id: null, what: '', evidence: [] }, mistakes: [], gap: 'No one shows the state.', reference_tokens: { palettes: [], type_scales: [], spacing: [] }, do: ['Keep Stop visible.'], dont: [], accessibility: [], speed: [] },
    recommendations: [], receipt: { price_usd: 0.25, held_usd: 0.25, cost_usd: 0.1, models: [], captures_count: 0, synthetic: false }, gaps: [],
    created_at: '2026-11-15T22:00:00.000Z', updated_at: '2026-11-15T22:03:00.000Z', finished_at: '2026-11-15T22:03:00.000Z',
};

(async () => {
    const dive = await startAi({ deepDive: {
        options: { depths: [
            { id: 'quick', name: 'Quick', price_usd: 0.25, sites: 6, minutes: 3, line: 'Six sites, about three minutes' },
            { id: 'thorough', name: 'Thorough', price_usd: 0.65, sites: 15, line: 'Fifteen sites' },
            { id: 'expert', name: 'Expert', price_usd: 1.5, sites: 30, line: 'Thirty sites' },
        ] },
        report,
    } });
    dive.state.deepDiveHold = true;   // the dive keeps running until the test lets it finish
    const t = await boot({ env: { DESIGN_DEEP_DIVE_URL: dive.url, DESIGN_DEEP_DIVE_POLL_MS: '5' } });
    const ORIGIN = 'https://openvibe.design';
    const form = (o) => new URLSearchParams(o).toString();
    try {
        const owner = t.network.addUser('goosely', { role: 'owner' });
        const kim = t.network.addUser('kim');
        let researchId;

        await check('a report built on the general deep dive leads with what the write-ups say, each with its pages', async () => {
            const { normalizeReport } = require('../server/deepdive/report');
            const withResearch = { ...report, research: { questions: [{ key: 'q', question: 'What makes a control panel usable?' }],
                reads: [{ id: 'read_1', source_id: 'src_w', url: 'https://ux.example/panels', final_url: 'https://ux.example/panels', title: 'Panels', site: 'UX', published: null, read_at: '2026-11-15T22:00:00.000Z', words: 900, status: 'read', reason: null, relevant: true, summary: 'On panels.', kind: 'opinion', findings: [] }],
                answer: { summary: 'Keep Stop alone.', key_points: [{ text: 'Stop is always one press away.', sources: ['src_w'] }], answers: [], comparison: null, disagreements: [], open_questions: [], next_steps: [] } } };
            const n = normalizeReport(withResearch, { question: 'A phone-first robot control panel', depth: 'quick' });
            assert.equal(n.points[0].group, 'research');
            assert.equal(n.points[0].text, 'Stop is always one press away.');
            assert.equal(n.points[0].evidence[0].url, 'https://ux.example/panels');
            const { STEP_NAMES } = require('../server/deepdive/report');
            assert.ok(STEP_NAMES.includes('Reading write-ups'), 'the read step has its name');
        });

        await check('the report: each point says its text once, a screenshot is drawn once, and an image sheet shows what the model saw', async () => {
            // 11-16, a real report: the evidence line repeated the point word for word with "(Source 1)", and one crop was
            // drawn under twenty points; the image sheet showed only its reading.
            const { researchPage } = require('../server/views/deepdive');
            const ev = { site: 'home-assistant.io', url: 'https://www.home-assistant.io/dashboards', cropId: 'crop_1_1', note: 'One hero per viewport. (Source 1)' };
            const html = researchPage({ research: { id: 'rsr_1', question: 'A robot dashboard', depth: 'quick', status: 'done', points: [
                { n: 1, group: 'pattern', text: 'One hero per viewport. (Source 1)', evidence: [ev] },
                { n: 2, group: 'pattern', text: 'Status is explicit.', evidence: [{ ...ev, note: 'Offline states are said, not implied.' }] },
            ], shots: [], imageSheets: [{ id: 'sheet_1', query: 'robot app dashboard ui', engine: 'Google and Bing images', recency: 'month', count: 38, width: 1654, height: 1036,
                reading: 'Mostly dark dashboards.', patterns: ['Grid cards'], styles: ['dark UI with neon accents'], palette: ['#0a0f1f', 'red;x', '#00BAFF'], outliers: ['Row 1, column 1 is a photo'],
                sources: [{ page: 'https://www.behance.net/x', title: 'Robot app' }, { page: 'javascript:alert(1)', title: 'Bad' }] }] } });
            assert.ok(!/\(Source 1\)/.test(html), 'no citation tails');
            assert.equal((html.match(/One hero per viewport\./g) || []).length, 1, 'the point says it once');
            assert.equal((html.match(/<img class="dd-crop" src="\/research\/rsr_1\/crop\/crop_1_1"/g) || []).length, 1, 'the screenshot is drawn once');
            assert.match(html, /<a class="dd-ev-again" href="\/research\/rsr_1\/crop\/crop_1_1" data-dd-shot="home-assistant\.io">.*The screenshot under point 1/);
            assert.match(html, /Offline states are said, not implied\./, 'a note that says more stays');
            assert.match(html, /<img src="\/research\/rsr_1\/crop\/sheet_1" alt="A page of image results for robot app dashboard ui" width="1654" height="1036"/);
            assert.match(html, /What most of them do<\/h3><ul class="ddi-chips"><li>Grid cards<\/li>/);
            assert.match(html, /<rect width="20" height="20" rx="5" fill="#0a0f1f"\/>/);
            assert.ok(!/red;x/.test(html), 'only real colours become swatches');
            assert.match(html, /Where the picture came from/);
            assert.ok(!/javascript:/.test(html), 'only http(s) sources are linked');
            assert.match(html, /one sheet · 38 images/);
        });

        await check('the options: an unopened fold leaves everything to the depth; an opened one sends only what changed', async () => {
            const { fromForm } = require('../server/deepdive/options');
            assert.equal(fromForm({ vp: ['390', '1280'], th: ['light', 'dark'], images: '1', recency: 'year', per_sheet: '40' }), null, 'never opened: nothing sent');
            assert.equal(fromForm({ custom: '1', vp: ['390', '1280'], th: ['light', 'dark'], images: '1', recency: 'year', per_sheet: '40' }), null, 'opened, nothing changed');
            assert.deepEqual(fromForm({ custom: '1', vp: '390', th: ['light', 'dark'], sites: '4', writeups: '0', extras: '1', images: '1', recency: 'week', per_sheet: '60', eng: ['searxng', 'evil'], img_q: 'dashboard ui\n\nrobot app' }),
                { viewports: [390], sites: 4, writeups: 0, extras: true, images: { recency: 'week', per_sheet: 60, queries: ['dashboard ui', 'robot app'], engines: ['searxng'] } });
            assert.deepEqual(fromForm({ custom: '1', images: '0', recency: 'day' }), { images: { enabled: false } }, 'image search off: its details are not sent');
            assert.equal(fromForm({ custom: '1', sites: '99', vp: '800' }), null, 'out of range is ignored');
        });

        await check('/deep-dive: what it does, a sign-in, then the form with the depths and their prices', async () => {
            let r = await t.get('/deep-dive');
            assert.equal(r.status, 200);
            assert.match(r.text, /<h1>Design deep dive<\/h1>/);
            assert.match(r.text, /Sign in to run a design deep dive/);
            assert.match(r.text, /What a design deep dive does/);
            assert.match(r.text, /Exchange.{0,20}s deep dive/, 'it says it builds on Exchange\'s');
            r = await t.get('/deep-dive?q=A%20robot%20panel', { as: owner });
            assert.match(r.text, /What are you designing\?/);
            assert.match(r.text, /<textarea name="question"[^>]*>A robot panel<\/textarea>/);
            assert.match(r.text, /name="depth" value="quick" checked/);
            assert.match(r.text, /25¢/);
            assert.match(r.text, /\$1\.50/);
            assert.match(r.text, /<details class="ddh-more" data-ddh-options>/, 'every option, folded');
            assert.match(r.text, /name="recency" value="year" checked/);
            assert.match(r.text, /js\/deep-dive-options\.js/);
        });

        await check('starting: signed out signs in with the question kept; signed in, a design dive for the person, then its page', async () => {
            let r = await t.get('/deep-dive', { method: 'POST', origin: ORIGIN, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ question: 'A phone-first robot control panel', depth: 'quick' }) });
            assert.equal(r.status, 303);
            assert.equal(r.headers.get('location'), `/auth/login?next=${encodeURIComponent('/deep-dive?q=A%20phone-first%20robot%20control%20panel')}`);
            r = await t.get('/deep-dive', { as: owner, method: 'POST', origin: ORIGIN, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ question: 'A phone-first robot control panel', depth: 'quick', sites: 'https://acme.example/controls' }) });
            assert.equal(r.status, 303, r.text.slice(0, 300));
            const m = /^\/research\/([^/]+)$/.exec(r.headers.get('location') || '');
            assert.ok(m, r.headers.get('location'));
            researchId = decodeURIComponent(m[1]);
            const started = dive.requests.filter((x) => x.method === 'POST' && x.path === '/api/v1/deep-dives').pop();
            assert.ok(started, 'AI was asked');
            assert.equal(started.body.question, 'A phone-first robot control panel');
            assert.notEqual(started.body.kind, 'research', 'a design deep dive');
            assert.deepEqual(started.body.on_behalf_of, { type: 'user', id: owner.sub || owner.subject || started.body.on_behalf_of.id });
            // An opened Options fold: what changed reaches AI as the dive's options.
            r = await t.get('/deep-dive', { as: owner, method: 'POST', origin: ORIGIN, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ question: 'A dashboard', depth: 'quick', custom: '1', vp: '1280', th: 'dark', images: '1', recency: 'month', eng: 'searxng' }) });
            assert.equal(r.status, 303);
            const withOptions = dive.requests.filter((x) => x.method === 'POST' && x.path === '/api/v1/deep-dives').pop();
            assert.deepEqual(withOptions.body.options, { viewports: [1280], themes: ['dark'], images: { recency: 'month', engines: ['searxng'] } });
            r = await t.get('/deep-dive', { as: owner, method: 'POST', origin: ORIGIN, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ question: '' }) });
            assert.equal(r.status, 422);
            assert.match(r.text, /Say what you are designing first/);
        });

        await check('/research/:id while it runs: the live view and Stop; its state is the person\'s own', async () => {
            let r = await t.get(`/research/${encodeURIComponent(researchId)}`, { as: owner });
            assert.equal(r.status, 200);
            assert.match(r.text, /data-dd-run/);
            assert.match(r.text, /js\/deep-dive-live\.js/);
            const seed = JSON.parse(/<script type="application\/json" id="dd-state">([\s\S]*?)<\/script>/.exec(r.text)[1]);
            assert.deepEqual([seed.stateUrl, seed.state.status, seed.state.captures.length, seed.labels.capture], [`/research/${encodeURIComponent(researchId)}/state`, 'running', 1, 'Capturing']);
            assert.equal(seed.shotUrl, `/research/${encodeURIComponent(researchId)}/crop/`, 'the live strip shows each screenshot through Design');
            assert.match(r.text, /js\/deep-dive-shots\.js/, 'and the viewer opens them');
            assert.match(r.text, /Stop the deep dive/);
            r = await t.get(`/research/${encodeURIComponent(researchId)}/state`, { as: owner });
            assert.equal(r.status, 200);
            assert.equal(r.json().deep_dive.step, 'capture');
            r = await t.get(`/research/${encodeURIComponent(researchId)}/state`, { as: kim });
            assert.equal(r.status, 404, 'someone else\'s dive is not found');
            r = await t.get(`/research/${encodeURIComponent(researchId)}/state`);
            assert.equal(r.status, 401);
        });

        await check('choosing: the candidates with Drop, Add and Start the capture, sent to AI; Stop cancels', async () => {
            dive.state.liveState = { status: 'choosing', step: 'choose', progress: 0.34, steps: [{ key: 'choose', status: 'running' }], site_limit: 15,
                candidates: [{ url: 'https://acme.example/controls', title: 'Acme controls', reason: 'a phone-first panel', source_id: 'src_acme', chosen: true }], captures: [], gaps: [], error: null };
            let r = await t.get(`/research/${encodeURIComponent(researchId)}`, { as: owner });
            assert.match(r.text, /Choose the sites to capture/);
            assert.match(r.text, /name="drop" value="https:\/\/acme\.example\/controls"/);
            assert.match(r.text, /Start the capture/);
            r = await t.get(`/research/${encodeURIComponent(researchId)}/sites`, { as: owner, method: 'POST', origin: ORIGIN, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form({ sites: 'https://beta.example/panel', start: '1' }) });
            assert.equal(r.status, 303);
            const sites = dive.requests.filter((x) => x.method === 'POST' && /\/sites$/.test(x.path)).pop();
            assert.deepEqual(sites.body, { add: ['https://beta.example/panel'], start: true });
            r = await t.get(`/research/${encodeURIComponent(researchId)}/cancel`, { as: owner, method: 'POST', origin: ORIGIN, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: '' });
            assert.equal(r.status, 303);
            assert.ok(dive.requests.some((x) => x.method === 'POST' && /\/cancel$/.test(x.path)), 'AI was asked to cancel');
            r = await t.get(`/research/${encodeURIComponent(researchId)}/cancel`, { as: owner, method: 'POST', origin: 'https://evil.example', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: '' });
            assert.equal(r.status, 403, 'only from openvibe.design');
        });

        await check('when it ends, /research/:id is the report; Your deep dives lists it', async () => {
            dive.state.deepDiveHold = false;
            dive.state.deepDiveStatus = 'succeeded';
            dive.state.liveState = { status: 'succeeded', step: 'report', progress: 1, steps: [], candidates: [], captures: [], gaps: [], error: null };
            const r = await t.get(`/research/${encodeURIComponent(researchId)}`, { as: owner });
            assert.equal(r.status, 200);
            assert.ok(!/data-dd-run/.test(r.text), 'no live view for a finished dive');
            assert.match(r.text, /The research points/);
            // Every screenshot it took, by site, phone and computer, each opening the whole page (11-15).
            assert.match(r.text, /The screenshots <small>2 from 1 site<\/small>/);
            const crop = `/research/${encodeURIComponent(researchId)}/crop/`;
            assert.ok(r.text.includes(`<a class="dds-frame is-phone" href="${crop}cap_1" data-dd-shot="acme.example · Phone · dark"><img src="${crop}crop_1_1"`), 'a phone shot: its top as the picture, the whole page when opened');
            assert.match(r.text, /from the week's cache/);
            assert.ok(!r.text.includes(`${crop}cap_3`), 'a skipped capture has no picture');
            assert.match(r.text, /js\/deep-dive-shots\.js/);
            const home = await t.get('/deep-dive', { as: owner });
            assert.match(home.text, /Your deep dives/);
            assert.match(home.text, new RegExp(`href="/research/${encodeURIComponent(researchId)}"`));
        });
    } finally {
        await t.close();
        await dive.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
