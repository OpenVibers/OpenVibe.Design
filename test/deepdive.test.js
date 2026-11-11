'use strict';

/**
 * Research first (owner ask, 2026-11-11): a deep dive's synthesis goes into the generation brief, each take
 * records the numbered points it follows, a component page gains "How others do it" only when a finished dive
 * has a finding for it, and the owner alone decides a proposed rule (an approval opens a pull request; nothing
 * is added to the register by itself).
 */

const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');
const { startAi } = require('./helpers/ai');
const kinds = require('../server/create/kinds');

const html = '<!doctype html><html><head><title>A design</title></head><body><h1>A robot panel</h1><button>Stop</button></body></html>';
const ev = (url, site, extra = {}) => ({ claim: 'A captured control panel', url, read_at: '2026-11-11T10:00:00.000Z', source_id: 'src_acme', capture_id: 'cap_acme', ...extra });
const report = {
    id: 'run_01JKLMNPQRSTVWXYZ0123456789',
    schema: 'ai.deep-dive@1',
    status: 'succeeded',
    input: { question: 'A phone-first robot control panel', depth: 'quick', max_sites: 6, sites: [] },
    steps: [
        { key: 'plan', status: 'done' }, { key: 'search', status: 'done' }, { key: 'choose', status: 'skipped' },
        { key: 'capture', status: 'done' }, { key: 'analyse', status: 'done' }, { key: 'synthesise', status: 'done' }, { key: 'report', status: 'done' },
    ],
    sources: [
        { id: 'src_acme', kind: 'web', title: 'Acme controls', url: 'https://acme.example/controls', read_at: '2026-11-11T10:00:00.000Z' },
    ],
    captures: [
        { id: 'cap_acme', source_id: 'src_acme', url: 'https://acme.example/controls', captured_at: '2026-11-11T10:00:00.000Z', viewport: 390, theme: 'dark', full_page: true, crops: [{ id: 'crop_acme', media_id: 'med_01JKLMNPQRSTVWXYZ0123456789', y: 0, height: 640 }] },
    ],
    analysis: [
        { source_id: 'src_acme', url: 'https://acme.example/controls', summary: 'A phone-first panel whose main button sits in the thumb arc and keeps Stop one press away.', strengths: ['The Stop button never moves.'], weaknesses: ['The deck is denser than it needs to be.'], evidence: [ev('https://acme.example/controls', 'acme.example')] },
    ],
    synthesis: {
        patterns: [
            { name: 'One primary button in the thumb arc', what: 'The primary button sits in the thumb arc, with Stop always one press away.', sites: ['src_acme'], usage_count: 2, evidence: [ev('https://acme.example/controls', 'acme.example')] },
            { name: 'State stays on the control', what: 'A second button reads its state in the same place the first one acts.', sites: ['src_acme'], usage_count: 2, evidence: [ev('https://acme.example/controls', 'acme.example')] },
        ],
        comparison: { columns: ['Site', 'Density'], rows: [['acme.example', 'dense']] },
        best: { source_id: 'src_acme', what: 'The Stop disc stays in the same place at every size.', evidence: [ev('https://acme.example/controls', 'acme.example')] },
        mistakes: [{ what: 'A menu hides the emergency stop.', evidence: [ev('https://acme.example/controls', 'acme.example')] }],
        gap: 'No one shows the robot’s state beside the controls.',
        reference_tokens: {
            palettes: [{ source_id: 'src_acme', colours: ['#0b0f19', '#e6edf7', '#e5484d'] }],
            type_scales: [{ source_id: 'src_acme', families: ['Inter'], sizes: ['16/24', '28/32'] }],
            spacing: [{ source_id: 'src_acme', steps: ['4', '8', '12', '16'] }],
        },
        do: ['Name every control with one verb the person already knows.'],
        dont: ['Do not hide Stop in a menu, under a hold or behind a slide.'],
        accessibility: ['The Stop disc has a 48 px target.'],
        speed: ['The panel is under 60 kB.'],
    },
    recommendations: [
        { id: 'rec_stop', what: 'A robot control surface keeps Stop visible at every size.', why: 'Every captured control panel that hid Stop made an emergency cost an extra press.', rule: { id: 'controls-one-family', status: 'follows', text: 'Rule 128: a device’s controls are one family, arranged per person.' }, evidence: [ev('https://acme.example/controls', 'acme.example', { crop_id: 'crop_acme' })] },
        { id: 'rec_pressed', what: 'A control’s pressed state is visible in the same place it acts.', why: 'Two of the three best panels put feedback on the control; the rest made people look away.', rule: { id: null, status: 'would_change', text: 'A control’s pressed state is visible on the control itself.' }, evidence: [ev('https://acme.example/controls', 'acme.example')] },
        { id: 'rec_targets', what: 'A control target is at least 48 px at every size.', why: 'The captured panels that shrink their targets on a phone were harder to hit.', rule: { id: null, status: 'would_change', text: 'A control’s target is at least 48 px.' }, evidence: [ev('https://acme.example/controls', 'acme.example')] },
    ],
    receipt: { price_usd: 0.25, held_usd: 0.25, cost_usd: 0.18, models: [], captures_count: 1, synthetic: false },
    gaps: [],
    created_at: '2026-11-11T09:57:00.000Z', updated_at: '2026-11-11T10:00:00.000Z', finished_at: '2026-11-11T10:00:00.000Z',
};

const slots = [{ provider: 'alpha', model: 'one' }, { provider: 'beta', model: 'two' }, { provider: 'gamma', model: 'three' }];

function fakeAi(state) {
    return {
        designPlan: async () => ({ slots }),
        exchangeCatalog: async () => ({}),
        choices: async () => ({}),
        offeredModels: async () => [],
        generate: async ({ prompt, slot }) => {
            state.prompts.push(prompt);
            return { html, provider: slot.provider, model: slot.model, cost_usd: 0.001, ms: 5 };
        },
    };
}

function createOptions() {
    const allKinds = kinds.KINDS.map((k) => ({ id: k.id, name: k.name, frames: k.frames }));
    return {
        options: async () => ({
            kinds: allKinds,
            frames: kinds.FRAMES,
            looks: [{ id: 'vibe', name: 'Vibe', source: 'theme', variables: { '--bg-primary': '#0b0f19', '--text-primary': '#e6edf7', '--accent': '#3b82f6' }, swatch: [] }],
            models: [], takes: { min: 1, max: 4, default: 3, total: 8 },
            limits: { prompt: 4000, models: 4, takes_per_model: 4, takes_total: 8 },
            currency: 'USD',
        }),
        publicOptions: (all) => all,
    };
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
    const dive = await startAi({ deepDive: {
        options: { depths: [
            { id: 'quick', name: 'Quick', price_usd: 0.25, sites: 6, minutes: 3, line: 'Six sites, about three minutes' },
            { id: 'thorough', name: 'Thorough', price_usd: 0.65, sites: 15, line: 'Fifteen sites' },
            { id: 'expert', name: 'Expert', price_usd: 1.5, sites: 30, line: 'Thirty sites' },
        ] },
        report,
    } });
    const state = { prompts: [] };
    const rulePr = { calls: [], open: async ({ proposal, reportUrl }) => { rulePr.calls.push({ rule: proposal.rule, reportUrl }); return { url: `https://github.com/OpenVibers/OpenVibe.Design/pull/${rulePr.calls.length}`, number: rulePr.calls.length, branch: 'rules/research-test' }; } };
    const t = await boot({ ai: fakeAi(state), createOptions: createOptions(), env: { DESIGN_DEEP_DIVE_URL: dive.url, DESIGN_DEEP_DIVE_POLL_MS: '5' }, rulePr });
    try {
        const owner = t.network.addUser('goosely', { role: 'owner' });
        const kim = t.network.addUser('kim');
        let researchId;

        await check('the contract report becomes numbered points, a brief and proposed rules with no copied code', async () => {
            const { normalizeReport, findsFor } = require('../server/deepdive/report');
            const n = normalizeReport(report, { question: 'A phone-first robot control panel', depth: 'quick' });
            assert.ok(n.points.length >= 9, `points ${n.points.length}`);
            assert.ok(n.points.every((x) => x.n >= 1 && x.text), 'every point has a number and a sentence');
            assert.match(n.brief, /Research first: A phone-first robot control panel/);
            assert.match(n.brief, /What the better sites do/);
            assert.match(n.brief, /Reference tokens, as direction only/);
            assert.match(n.brief, /OpenVibe rules this follows/);
            assert.match(n.brief, /never copy a site/i);
            assert.ok(!/<style|<html|class=/.test(n.brief), 'the brief is words, never a site\'s markup');
            assert.equal(n.proposedRules.length, 2);
            assert.match(n.proposedRules[0].rule, /pressed state|48 px/);
            assert.ok(n.proposedRules.every((p) => p.area), 'a proposed rule keeps one of the register\'s areas');
            assert.match(findsFor(report, 'button')[0].title, /button/i);
            assert.equal(findsFor(report, 'carousel').length, 0);
        });

        await check('the composer offers Research first with its depth and price; a guest is told to sign in', async () => {
            const guest = await t.get('/create');
            assert.equal(guest.status, 200);
            assert.match(guest.text, /Research first/);
            assert.match(guest.text, /Sign in to start a deep dive/);
            const page = await t.get('/create', { as: owner });
            assert.equal(page.status, 200);
            assert.match(page.text, /Research first/);
            assert.match(page.text, /Thorough/);
            assert.match(page.text, /\$0\.65|65¢/);
            assert.match(page.text, /name="research"/);
        });

        await check('the estimate prices the dive exactly as the run will use it', async () => {
            const r = await t.get('/api/create/estimate', { as: owner, origin: 'https://openvibe.design', json: { prompt: 'A phone-first robot control panel', kind: 'page', research: { depth: 'quick' } } });
            assert.equal(r.status, 200, r.text);
            const body = r.json();
            assert.equal(body.research.depth, 'quick');
            assert.equal(body.research.price_usd, 0.25);
            assert.equal(body.total_usd, 0.25);
            assert.equal(body.priced, true);
        });

        await check('a create starts one dive on the person\'s behalf, and its report becomes the brief', async () => {
            const r = await t.get('/api/create', { as: owner, origin: 'https://openvibe.design', json: { prompt: 'A phone-first robot control panel', kind: 'page', research: { depth: 'quick' } } });
            assert.equal(r.status, 201, r.text);
            researchId = r.json().design.researchId;
            assert.ok(researchId, 'the design records its dive');
            assert.equal(dive.state.deepDives.size, 1);
            const [run] = [...dive.state.deepDives.values()];
            assert.deepEqual(run.run.on_behalf_of, { type: 'user', id: owner.subject });
            assert.equal(run.run.input.depth, 'quick');
            assert.equal(run.run.input.question, 'A phone-first robot control panel');

            let data;
            for (let i = 0; i < 120; i++) {
                const got = await t.get(`/api/v1/designs/${r.json().design.id}`, { as: owner });
                data = got.json();
                if (data.design.status === 'done' && data.design.research && data.design.research.status === 'done') break;
                await pause(20);
            }
            assert.equal(data.design.research.status, 'done', JSON.stringify(data.design.research));
            assert.ok(data.design.research.pointsCount >= 9, `points ${data.design.research.pointsCount}`);
            assert.equal(data.variants.filter((v) => v.status === 'done').length, 3);
            for (const v of data.variants) {
                assert.ok(Array.isArray(v.research_points) && v.research_points.length, 'each take says which points it follows');
            }
            assert.ok(state.prompts.length >= 3);
            assert.match(state.prompts[0], /Research first: A phone-first robot control panel/);
            assert.match(state.prompts[0], /This take follows research point/);
            assert.match(state.prompts[0], /Never copy a site/);
            const row = await t.store.db.maybe('SELECT * FROM design_research WHERE id=$1', [researchId]);
            assert.equal(row.status, 'done');
            assert.ok(row.report_url.startsWith('https://openvibe.exchange/deep-dive/'));
            assert.equal((await t.store.db.many('SELECT * FROM rule_proposals WHERE research_id=$1', [researchId])).length, 2);
        });

        await check('the canvas names the dive and links every take to its points', async () => {
            const design = (await t.store.db.many('SELECT id FROM designs WHERE research_id=$1', [researchId]))[0];
            const page = await t.get(`/d/${design.id}`, { as: owner });
            assert.equal(page.status, 200);
            assert.match(page.text, /Research first · its report/);
            assert.match(page.text, /A phone-first robot control panel/);
            assert.match(page.text, /Follows .*research point/);
            assert.match(page.text, new RegExp(`/research/${researchId}`));
        });

        await check('the report page is the owner\'s, with numbered evidence', async () => {
            const page = await t.get(`/research/${researchId}`, { as: owner });
            assert.equal(page.status, 200);
            assert.match(page.text, /The research points/);
            assert.match(page.text, /Stop always one press away/);
            assert.match(page.text, /acme\.example/);
            assert.match(page.text, /read 11 Nov 2026/);
            assert.match(page.text, /Proposed from research/);
            assert.equal((await t.get(`/research/${researchId}`, { as: kim })).status, 404);
            assert.equal((await t.get(`/research/${researchId}`)).status, 303);
        });

        await check('a crop is proxied from the dive, owner only, never a public Media address', async () => {
            const png = await t.get(`/research/${researchId}/crop/crop_acme`, { as: owner });
            assert.equal(png.status, 200, png.text);
            assert.equal(png.headers.get('content-type'), 'image/png');
            assert.equal(png.headers.get('x-content-type-options'), 'nosniff');
            assert.equal((await t.get(`/research/${researchId}/crop/crop_acme`, { as: kim })).status, 404);
            assert.equal((await t.get(`/research/${researchId}/crop/crop_acme`)).status, 401);
        });

        await check('a component page gains How others do it only when a finished dive has a finding', async () => {
            const before = await t.get('/components/button');
            assert.equal(before.status, 200);
            // The report is already finished by now, so the section is there; the empty case is shown by a component
            // no point names (the rule is that the section is absent, not an empty heading).
            const page = await t.get('/components/button', { as: owner });
            assert.equal(page.status, 200);
            assert.match(page.text, /How others do it/);
            assert.match(page.text, /acme\.example/);
            assert.match(page.text, /read 11 Nov 2026/);
            const other = await t.get('/components/table', { as: owner });
            assert.doesNotMatch(other.text, /How others do it/);
            const someoneElse = await t.get('/components/button', { as: kim });
            assert.doesNotMatch(someoneElse.text, /How others do it/);
        });

        await check('Proposed from research is the owner\'s alone', async () => {
            const ownerPage = await t.get('/rules', { as: owner });
            assert.equal(ownerPage.status, 200);
            assert.match(ownerPage.text, /Proposed from research/);
            assert.match(ownerPage.text, /pressed state|48 px/);
            const other = await t.get('/rules', { as: kim });
            assert.equal(other.status, 200);
            assert.doesNotMatch(other.text, /Proposed from research/);
        });

        await check('only the owner approves, and an approval opens a pull request, never a register write', async () => {
            const proposals = (await t.store.db.many('SELECT * FROM rule_proposals WHERE research_id=$1 ORDER BY created_at', [researchId]));
            assert.equal(proposals.length, 2);
            const forbidden = await t.get(`/api/v1/rules/proposals/${proposals[0].id}/approve`, { as: kim, origin: 'https://openvibe.design', json: {} });
            assert.equal(forbidden.status, 403);
            const approved = await t.get(`/api/v1/rules/proposals/${proposals[0].id}/approve`, { as: owner, origin: 'https://openvibe.design', json: {} });
            assert.equal(approved.status, 200, approved.text);
            assert.equal(approved.json().proposal.state, 'approved');
            assert.match(approved.json().proposal.prUrl, /\/pull\/1$/);
            assert.equal(rulePr.calls.length, 1);
            const dismissed = await t.get(`/api/v1/rules/proposals/${proposals[1].id}/dismiss`, { as: owner, origin: 'https://openvibe.design', json: {} });
            assert.equal(dismissed.status, 200);
            assert.equal(dismissed.json().proposal.state, 'dismissed');
            const register = require('fs').readFileSync(require('path').join(__dirname, '..', 'server', 'rules', 'register.js'), 'utf8');
            assert.doesNotMatch(register, /pressed state is visible|48 px/);
        });

        await check('an approval builds the register change on a branch and opens a pull request, never main', async () => {
            const fs = require('fs'), path = require('path');
            const { createRulePr, addRule } = require('../server/deepdive/github');
            const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'rules', 'register.js'), 'utf8');
            const calls = [];
            const fakeFetch = async (url, opts = {}) => {
                calls.push({ url, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null });
                if (url.endsWith('/repos/OpenVibers/OpenVibe.Design')) return { ok: true, status: 200, json: async () => ({ default_branch: 'main' }) };
                if (url.includes('/git/ref/heads/main')) return { ok: true, status: 200, json: async () => ({ object: { sha: 'a'.repeat(40) } }) };
                if (url.includes('/contents/server/rules/register.js')) return { ok: true, status: 200, json: async () => ({ sha: 'file-sha', content: Buffer.from(source, 'utf8').toString('base64') }) };
                if (url.endsWith('/git/refs')) return { ok: true, status: 201, json: async () => ({ ref: 'refs/heads/rules/research-rpp-test' }) };
                if (url.includes('/contents/server/rules/register.js')) return { ok: true, status: 200, json: async () => ({ content: { sha: 'new-sha' } }) };
                if (url.endsWith('/pulls')) return { ok: true, status: 201, json: async () => ({ number: 9, html_url: 'https://github.com/OpenVibers/OpenVibe.Design/pull/9' }) };
                return { ok: false, status: 404, json: async () => ({ message: 'no' }) };
            };
            const rulePr = createRulePr({ config: { deepDive: { githubToken: 'test-token', repo: 'OpenVibers/OpenVibe.Design', registerPath: 'server/rules/register.js', branchPrefix: 'rules/research' } }, fetchImpl: fakeFetch });
            const out = await rulePr.open({ proposal: { id: 'rpp_test', rule: 'A test rule stays one sentence.', detail: 'The detail.', why: 'Because.', area: 'data' }, reportUrl: 'https://openvibe.exchange/deep-dive/run_x', decidedBy: 'goosely' });
            assert.equal(out.url, 'https://github.com/OpenVibers/OpenVibe.Design/pull/9');
            const put = calls.find((c) => c.method === 'PUT');
            assert.ok(put, 'the file is updated on the branch');
            assert.equal(put.body.branch, 'rules/research-rpp-test');
            const written = Buffer.from(put.body.content, 'base64').toString('utf8');
            assert.match(written, /R\('research-rpp-test', 'data', 'A test rule stays one sentence\.'/);
            assert.match(written, /read the deep dive|Read the deep dive/);
            const pull = calls.find((c) => c.url.endsWith('/pulls'));
            assert.equal(pull.body.head, 'rules/research-rpp-test');
            assert.equal(pull.body.base, 'main');
            assert.match(pull.body.body, /https:\/\/openvibe\.exchange\/deep-dive\/run_x/);
            assert.doesNotMatch(pull.body.body, /Generated with|Co-Authored|Claude-Session/);
            const twice = addRule(written, { rule: 'A second rule.', detail: '', why: '' }, { id: 'research-second', area: 'data', decided: '2026-11-11' });
            assert.match(twice, /R\('research-second'/);
            assert.throws(() => addRule(written, { rule: 'x' }, { id: 'research-rpp-test', area: 'data', decided: '2026-11-11' }), /already in the register/);
        });

        await check('a dive the person already ran attaches without a second run or charge', async () => {
            const before = dive.state.deepDives.size;
            const estimate = await t.get('/api/create/estimate', { as: owner, origin: 'https://openvibe.design', json: { prompt: 'Another panel', kind: 'page', research: { id: researchId } } });
            assert.equal(estimate.status, 200, estimate.text);
            assert.equal(estimate.json().research.price_usd, 0);
            const r = await t.get('/api/create', { as: owner, origin: 'https://openvibe.design', json: { prompt: 'Another panel', kind: 'page', research: { id: researchId } } });
            assert.equal(r.status, 201, r.text);
            assert.equal(r.json().design.researchId, researchId);
            assert.equal(dive.state.deepDives.size, before);
            assert.equal((await t.store.db.many('SELECT * FROM design_research WHERE owner=$1', [owner.subject])).length, 1);
        });

        await check('the JSON API offers the depths, the recent dives and a running dive', async () => {
            const options = await t.get('/api/deep-dive/options', { as: owner });
            assert.equal(options.status, 200);
            assert.equal(options.json().depths.length, 3);
            assert.ok(options.json().recent.some((x) => x.id === researchId));
            const one = await t.get(`/api/deep-dive/${researchId}`, { as: owner });
            assert.equal(one.status, 200);
            assert.equal(one.json().deep_dive.status, 'done');
            assert.equal((await t.get(`/api/deep-dive/${researchId}`, { as: kim })).status, 403);
        });

        done();
    } finally {
        await t.close();
        await dive.close();
    }
})().catch((err) => { console.error(err); process.exitCode = 1; });
