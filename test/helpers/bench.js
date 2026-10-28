'use strict';

/**
 * A focused fake OpenVibe.Bench for Design's Arena tests. It implements just the routes Design needs,
 * verifies tokens against the shared fake Network public key, keeps state in memory, and can generate
 * AI entries when tick() is called.
 */
const http = require('http');
const crypto = require('crypto');
const { serviceAuth, ids } = require('openvibe-contracts');

const K = 32;
const BASE_ELO = 1000;
const PROVISIONAL_GAMES = 10;

function b64url(o) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }
function signJwt(claims, privateKey) {
    const input = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(claims)}`;
    return `${input}.${crypto.sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
}

function shuffle(list, random = Math.random) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function num(v, d = 0) { return v == null || v === '' || Number.isNaN(Number(v)) ? d : Number(v); }

function wilson(wins, games) {
    if (!games) return { lower: 0, upper: 1 };
    const z = 1.96;
    const p = wins / games;
    const denom = 1 + (z * z) / games;
    const centre = (p + (z * z) / (2 * games)) / denom;
    const width = (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * games)) / games)) / denom;
    return { lower: Math.max(0, centre - width), upper: Math.min(1, centre + width) };
}

function eloDelta(p) {
    if (!(p > 0)) return -400;
    if (p >= 1) return 400;
    return 400 * Math.log10(p / (1 - p));
}

function ratingCi(elo, wins, losses, ties) {
    const games = wins + losses + ties;
    if (!games) return { ci_lower: null, ci_upper: null };
    const p = (wins + ties * 0.5) / games;
    const w = wilson(wins + ties * 0.5, games);
    const delta = eloDelta(p);
    return {
        ci_lower: Math.round((elo + (eloDelta(w.lower) - delta)) * 100) / 100,
        ci_upper: Math.round((elo + (eloDelta(w.upper) - delta)) * 100) / 100,
    };
}

async function startBench({ network } = {}) {
    const publicKey = network.publicPem;
    const state = {
        tasks: new Map(),
        rounds: new Map(),
        entries: new Map(),
        judgements: [],
        ratings: new Map(),
        requests: [],
    };
    let nextId = 1;
    const id = (prefix) => `${prefix}_${String(nextId++).padStart(6, '0')}`;

    function verify(token) {
        const r = serviceAuth.verifyServiceToken(token, { publicKey, issuer: network.url, audience: 'openvibe.bench' });
        if (r.ok) return { kind: 'service', sub: r.claims.sub, cap: r.claims.cap || [] };
        // try user token
        const parts = String(token || '').split('.');
        if (parts.length === 3) {
            const ok = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], 'base64url'));
            if (ok) {
                const c = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
                if (c.exp * 1000 > Date.now() && ids.isSubjectId('user', c.subject_id) &&
                    (c.aud === 'openvibe.network' || (Array.isArray(c.aud) && c.aud.includes('openvibe.network')))) {
                    return { kind: 'user', subject: c.subject_id, username: c.username };
                }
            }
        }
        return null;
    }

    function requireService(req) {
        const v = verify(getAuth(req));
        if (!v || v.kind !== 'service') throw problem(401, 'token.required', 'Send a service token.');
        return v;
    }

    function requireCapability(req, cap) {
        const v = requireService(req);
        if (!v.cap.includes(cap)) throw problem(403, 'bench.capability_required', `Need ${cap}.`);
        return v;
    }

    function requirePerson(req) {
        const v = verify(getAuth(req));
        if (!v || v.kind !== 'user') throw problem(401, 'bench.sign_in_required', 'Sign in.');
        return v;
    }

    function getAuth(req) {
        const h = String(req.headers.authorization || '');
        return h.startsWith('Bearer ') ? h.slice(7) : null;
    }

    function problem(status, code, detail) {
        const err = new Error(detail);
        err.status = status;
        err.code = code;
        err.detail = detail;
        return err;
    }

    const kinds = new Map([
        ['design.page', { id: 'design.page', room: 'design', entry: 'html_page', judge: 'human_pairwise', name: 'Design page arena', metrics: ['elo', 'cost_usd', 'ms'], schema: { entry: 'html_page', payload: { html: 'string' } } }],
        ['design.component', { id: 'design.component', room: 'design', entry: 'html_page', judge: 'human_pairwise', name: 'Design component arena', metrics: ['elo', 'cost_usd', 'ms'], schema: { entry: 'html_page', payload: { html: 'string' } } }],
    ]);

    function defaultHtml(prompt) {
        const p = String(prompt || '').split('\n')[0].slice(0, 200);
        return `<!doctype html><html><head><meta charset="utf-8"><title>A generated design</title></head><body><h1>A page that works</h1><p>${p}</p><button>Start</button></body></html>`;
    }

    async function generateEntries(round) {
        const pool = [
            { provider: 'acme', model: 'alpha-1' },
            { provider: 'beta', model: 'beta-2' },
            { provider: 'gamma', model: 'gamma-3' },
        ];
        const offers = round.offers && round.offers.length ? round.offers : pool;
        for (let i = 0; i < 3; i++) {
            const offer = offers[i] && offers[i].model ? offers[i] : pool[i];
            const model = offer.model;
            const provider = offer.provider;
            addEntry(round.id, {
                provider,
                model,
                route: offer,
                payload: { html: defaultHtml(round.prompt) },
                cost_usd: 0.0012,
                ms: 321,
                tokens: 600,
            });
        }
    }

    function addEntry(roundId, entry) {
        const round = state.rounds.get(roundId);
        if (!round) throw problem(404, 'bench.round_not_found', 'No such round.');
        const e = {
            id: id('bte'),
            round_id: roundId,
            provider: entry.provider || 'ai',
            model: entry.model || 'unknown',
            route: entry.route || {},
            payload: entry.payload || {},
            cost_usd: num(entry.cost_usd),
            ms: num(entry.ms),
            tokens: num(entry.tokens),
            error: entry.error || null,
            ui_check: entry.ui_check || null,
            run_id: entry.run_id || null,
            created_at: new Date().toISOString(),
        };
        state.entries.set(e.id, e);
        const usable = [...state.entries.values()].filter((x) => x.round_id === roundId && !x.error).length;
        if (usable >= 2 && (round.status === 'queued' || round.status === 'running')) {
            round.status = 'finished';
            round.finished_at = new Date().toISOString();
        }
        return e;
    }

    function ratingKey(kindId, subject) { return `${kindId}|${subject}`; }

    function updateRating(kindId, left, right, outcome) {
        if (outcome === 'both_bad') return;
        if (!left || !right || left.model === right.model) return;
        const models = [left.model, right.model];
        for (const m of models) {
            const key = ratingKey(kindId, m);
            if (!state.ratings.has(key)) {
                state.ratings.set(key, { kind_id: kindId, category: 'all', subject: m, elo: BASE_ELO, games: 0, wins: 0, losses: 0, ties: 0, win_rate: 0, ci_lower: null, ci_upper: null });
            }
        }
        const a = state.ratings.get(ratingKey(kindId, left.model));
        const b = state.ratings.get(ratingKey(kindId, right.model));
        const sa = outcome === 'left' ? 1 : (outcome === 'right' ? 0 : 0.5);
        const sb = 1 - sa;
        const ea = 1 / (1 + 10 ** ((b.elo - a.elo) / 400));
        const eb = 1 - ea;
        const nextA = Math.round((a.elo + K * (sa - ea)) * 100) / 100;
        const nextB = Math.round((b.elo + K * (sb - eb)) * 100) / 100;
        for (const [row, elo, score, opp] of [[a, nextA, sa, sb], [b, nextB, sb, sa]]) {
            const games = row.games + 1;
            const wins = row.wins + (score > opp ? 1 : 0);
            const losses = row.losses + (score < opp ? 1 : 0);
            const ties = row.ties + (score === opp ? 1 : 0);
            const wr = games ? Math.round(((wins + ties * 0.5) / games) * 10000) / 10000 : 0;
            const ci = ratingCi(elo, wins, losses, ties);
            row.elo = elo;
            row.games = games;
            row.wins = wins;
            row.losses = losses;
            row.ties = ties;
            row.win_rate = wr;
            row.ci_lower = ci.ci_lower;
            row.ci_upper = ci.ci_upper;
        }
    }

    function blindEntry(e) {
        return {
            id: e.id,
            round_id: e.round_id,
            payload: e.payload,
            error: e.error,
            ui_check: e.ui_check,
            run_id: e.run_id,
            created_at: e.created_at,
        };
    }

    function fullEntry(e) {
        return { ...e, route: e.route || {} };
    }

    function revealed(round, subject) {
        if (!subject) return false;
        if (round.created_by === subject) return true;
        return state.judgements.some((j) => j.round_id === round.id && j.subject === subject);
    }

    function wireRound(round, viewerSubject) {
        const entries = [...state.entries.values()].filter((e) => e.round_id === round.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
        const isRevealed = revealed(round, viewerSubject);
        const out = {
            id: round.id,
            task_id: round.task_id,
            kind_id: round.kind_id,
            offers: round.offers,
            status: round.status,
            seed: round.seed,
            pool_fallback: round.pool_fallback,
            receipt: round.receipt,
            params: {},
            created_by: round.created_by,
            created_at: round.created_at,
            finished_at: round.finished_at || null,
            task_class: round.task_class,
            prompt: round.prompt,
            entries: entries.map((e) => isRevealed ? fullEntry(e) : blindEntry(e)),
            votes: state.judgements.filter((j) => j.round_id === round.id).length,
        };
        if (!isRevealed) out.blind = true;
        return out;
    }

    function subjectsFor(kindId) {
        const set = new Set();
        for (const e of state.entries.values()) {
            const round = state.rounds.get(e.round_id);
            if (round && round.kind_id === kindId && !e.error) set.add(e.model);
        }
        return [...set].sort();
    }

    function costRows(kindId) {
        const byModel = new Map();
        for (const e of state.entries.values()) {
            const round = state.rounds.get(e.round_id);
            if (!round || round.kind_id !== kindId || e.error) continue;
            if (!byModel.has(e.model)) byModel.set(e.model, { model: e.model, entries: 0, usable: 0, total_cost: 0, costs: [], mss: [] });
            const b = byModel.get(e.model);
            b.entries++;
            b.usable++;
            b.total_cost += e.cost_usd;
            b.costs.push(e.cost_usd);
            b.mss.push(e.ms);
        }
        return [...byModel.values()].map((r) => {
            const sortedCosts = r.costs.slice().sort((a, b) => a - b);
            const sortedMs = r.mss.slice().sort((a, b) => a - b);
            const median = (arr) => arr.length % 2 ? arr[Math.floor(arr.length / 2)] : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2;
            const solved = r.usable;
            return {
                subject: r.model,
                entries: r.entries,
                usable: r.usable,
                total_cost_usd: Math.round(r.total_cost * 1e6) / 1e6,
                solved,
                cost_per_solved: solved ? Math.round((r.total_cost / solved) * 1e6) / 1e6 : null,
                median_cost_usd: median(sortedCosts),
                median_ms: Math.round(median(sortedMs)),
            };
        }).sort((a, b) => (a.cost_per_solved == null ? Infinity : a.cost_per_solved) - (b.cost_per_solved == null ? Infinity : b.cost_per_solved) || a.subject.localeCompare(b.subject));
    }

    function board(kindId, type) {
        if (!kinds.has(kindId)) return null;
        const subjects = subjectsFor(kindId);
        if (type === 'elo') {
            const rows = subjects.map((subject) => {
                const r = state.ratings.get(ratingKey(kindId, subject));
                const games = r ? r.games : 0;
                return {
                    kind_id: kindId, category: 'all', subject,
                    elo: r ? r.elo : BASE_ELO,
                    games, wins: r ? r.wins : 0, losses: r ? r.losses : 0, ties: r ? r.ties : 0,
                    win_rate: r ? r.win_rate : 0,
                    ci_lower: r ? r.ci_lower : null,
                    ci_upper: r ? r.ci_upper : null,
                    provisional: games < PROVISIONAL_GAMES,
                    median_cost_usd: null,
                    median_ms: null,
                };
            });
            rows.sort((a, b) => b.elo - a.elo || a.subject.localeCompare(b.subject));
            // Add median cost/time from cost rows
            const cost = costRows(kindId);
            for (const row of rows) {
                const c = cost.find((x) => x.subject === row.subject);
                if (c) { row.median_cost_usd = c.median_cost_usd; row.median_ms = c.median_ms; }
            }
            return { kind_id: kindId, category: 'all', period: 'all', type: 'elo', rows };
        }
        if (type === 'cost') {
            return { kind_id: kindId, category: 'all', period: 'all', type: 'cost', rows: costRows(kindId) };
        }
        return null;
    }

    function datasetJsonl(kindId) {
        if (!kinds.has(kindId)) return null;
        const lines = [];
        for (const t of state.tasks.values()) {
            if (t.kind_id === kindId && t.public) lines.push(JSON.stringify({ type: 'task', id: t.id, kind_id: t.kind_id, prompt: t.prompt, task_class: t.task_class, public: t.public, created_at: t.created_at }));
        }
        for (const r of state.rounds.values()) {
            if (r.kind_id === kindId && r.status === 'finished') {
                lines.push(JSON.stringify({ type: 'round', id: r.id, task_id: r.task_id, kind_id: r.kind_id, offers: r.offers, status: r.status, seed: r.seed, pool_fallback: r.pool_fallback, receipt: r.receipt, created_at: r.created_at, finished_at: r.finished_at }));
            }
        }
        for (const e of state.entries.values()) {
            const r = state.rounds.get(e.round_id);
            if (r && r.kind_id === kindId && r.status === 'finished') lines.push(JSON.stringify({ type: 'entry', ...fullEntry(e) }));
        }
        for (const j of state.judgements) {
            const r = state.rounds.get(j.round_id);
            if (r && r.kind_id === kindId && r.status === 'finished') {
                lines.push(JSON.stringify({ type: 'judgement', id: j.id, round_id: j.round_id, kind_id: j.kind_id, judge: j.judge, method: j.method, pair: j.pair, outcome: j.outcome, score: j.score, at: j.at }));
            }
        }
        for (const r of state.ratings.values()) {
            if (r.kind_id === kindId) lines.push(JSON.stringify({ type: 'rating', ...r }));
        }
        return lines.length ? `${lines.join('\n')}\n` : '';
    }

    const server = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', async () => {
            const raw = Buffer.concat(chunks);
            const text = raw.toString('utf8');
            let body = {};
            try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
            const url = new URL(req.url, 'http://x');
            state.requests.push({ method: req.method, path: url.pathname, query: url.search, authorization: req.headers.authorization || null, body: text });

            const json = (status, obj, headers = {}) => {
                res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
                res.end(JSON.stringify(obj));
            };
            const sendProblem = (status, code, detail) => {
                res.writeHead(status, { 'Content-Type': 'application/problem+json' });
                res.end(JSON.stringify({ type: `https://openvibe.network/problems/${code}`, title: 'Error', status, code, detail }));
            };

            try {
                if (url.pathname === '/api/.well-known/jwks') return json(200, { public_key: publicKey, algorithm: 'RS256' });

                if (req.method === 'GET' && url.pathname === '/api/v1/kinds') return json(200, { count: kinds.size, kinds: [...kinds.values()] });
                if (req.method === 'GET' && /^\/api\/v1\/kinds\/([^/]+)$/.test(url.pathname)) {
                    const kindId = decodeURIComponent(url.pathname.split('/').pop());
                    const k = kinds.get(kindId);
                    if (!k) return sendProblem(404, 'bench.kind_not_found', 'No such kind.');
                    return json(200, { kind: k });
                }

                if (req.method === 'POST' && /^\/api\/v1\/kinds\/([^/]+)\/tasks$/.test(url.pathname)) {
                    requireCapability(req, 'bench.task.create');
                    const kindId = decodeURIComponent(url.pathname.split('/').slice(-2)[0]);
                    if (!kinds.has(kindId)) return sendProblem(404, 'bench.kind_not_found', 'No such kind.');
                    const prompt = String(body.prompt || '').trim();
                    if (!prompt) return sendProblem(422, 'bench.prompt_required', 'A task needs a prompt.');
                    const task = {
                        id: id('btk'),
                        kind_id: kindId,
                        prompt,
                        task_class: body.task_class || null,
                        public: body.public !== false,
                        created_by: 'service:design',
                        created_at: new Date().toISOString(),
                    };
                    state.tasks.set(task.id, task);
                    res.setHeader('Location', `/api/v1/tasks/${task.id}`);
                    return json(201, { task });
                }

                if (req.method === 'GET' && /^\/api\/v1\/tasks\/([^/]+)$/.test(url.pathname)) {
                    const taskId = decodeURIComponent(url.pathname.split('/').pop());
                    const task = state.tasks.get(taskId);
                    if (!task) return sendProblem(404, 'bench.task_not_found', 'No such task.');
                    return json(200, { task });
                }

                if (req.method === 'POST' && /^\/api\/v1\/tasks\/([^/]+)\/rounds$/.test(url.pathname)) {
                    const actor = verify(getAuth(req));
                    if (!actor) return sendProblem(401, 'token.required', 'Send a token.');
                    if (actor.kind === 'service' && !actor.cap.includes('bench.round.create')) return sendProblem(403, 'bench.capability_denied', 'Need bench.round.create.');
                    const taskId = decodeURIComponent(url.pathname.split('/').slice(-2)[0]);
                    const task = state.tasks.get(taskId);
                    if (!task) return sendProblem(404, 'bench.task_not_found', 'No such task.');
                    const offers = Array.isArray(body.offers) ? body.offers.slice(0, 3).map((o) => ({ provider: String(o.provider || ''), model: o.model == null ? null : String(o.model) })).filter((o) => o.provider) : [];
                    const poolFallback = offers.length < 3;
                    while (offers.length < 3) offers.push({ provider: 'ai', model: null });
                    const round = {
                        id: id('brd'),
                        task_id: task.id,
                        kind_id: task.kind_id,
                        offers,
                        status: 'queued',
                        seed: 0,
                        pool_fallback: poolFallback,
                        receipt: null,
                        params: {},
                        created_by: actor.kind === 'user' ? actor.subject : 'service:design',
                        created_at: new Date().toISOString(),
                        finished_at: null,
                        task_class: task.task_class,
                        prompt: task.prompt,
                    };
                    state.rounds.set(round.id, round);
                    res.setHeader('Location', `/api/v1/rounds/${round.id}`);
                    return json(201, { round: wireRound(round, null) });
                }

                if (req.method === 'GET' && /^\/api\/v1\/rounds\/([^/]+)$/.test(url.pathname)) {
                    const roundId = decodeURIComponent(url.pathname.split('/').pop());
                    const round = state.rounds.get(roundId);
                    if (!round) return sendProblem(404, 'bench.round_not_found', 'No such round.');
                    const viewer = verify(getAuth(req));
                    return json(200, { round: wireRound(round, viewer && viewer.kind === 'user' ? viewer.subject : null) });
                }

                if (req.method === 'POST' && /^\/api\/v1\/rounds\/([^/]+)\/entries$/.test(url.pathname)) {
                    requireCapability(req, 'bench.entry.create');
                    const roundId = decodeURIComponent(url.pathname.split('/').slice(-2)[0]);
                    const entry = addEntry(roundId, body);
                    res.setHeader('Location', `/api/v1/rounds/${roundId}`);
                    return json(201, { entry: fullEntry(entry) });
                }

                if (req.method === 'GET' && url.pathname === '/api/v1/judgements/next') {
                    const person = requirePerson(req);
                    const kindId = url.searchParams.get('kind') || 'design.page';
                    const candidates = [...state.rounds.values()].filter((r) =>
                        r.kind_id === kindId && r.status === 'finished' && r.created_by !== person.subject
                        && !state.judgements.some((j) => j.round_id === r.id && j.subject === person.subject)
                    );
                    const usableRounds = candidates.filter((r) => [...state.entries.values()].filter((e) => e.round_id === r.id && !e.error).length >= 2);
                    if (!usableRounds.length) return json(200, { pair: null, detail: 'There is no round waiting for your judgement right now.' });
                    const round = usableRounds[0];
                    const entries = shuffle([...state.entries.values()].filter((e) => e.round_id === round.id && !e.error));
                    const [left, right] = entries.slice(0, 2);
                    return json(200, {
                        round: { id: round.id, kind_id: round.kind_id, prompt: round.prompt, task_class: round.task_class },
                        left: blindEntry(left),
                        right: blindEntry(right),
                    });
                }

                if (req.method === 'POST' && /^\/api\/v1\/rounds\/([^/]+)\/judgements$/.test(url.pathname)) {
                    const person = requirePerson(req);
                    const roundId = decodeURIComponent(url.pathname.split('/').slice(-2)[0]);
                    const round = state.rounds.get(roundId);
                    if (!round) return sendProblem(404, 'bench.round_not_found', 'No such round.');
                    if (round.status !== 'finished') return sendProblem(409, 'bench.round_not_ready', 'Round not ready.');
                    if (round.created_by === person.subject) return sendProblem(403, 'bench.creator_cannot_vote', 'You cannot judge a round you started.');
                    const pair = body.pair || {};
                    if (!pair.left || !pair.right || pair.left === pair.right) return sendProblem(422, 'bench.invalid_pair', 'Invalid pair.');
                    if (state.judgements.some((j) => j.round_id === round.id && j.subject === person.subject)) return sendProblem(409, 'bench.already_judged', 'Already judged.');
                    const entries = [...state.entries.values()].filter((e) => e.round_id === round.id && !e.error && (e.id === pair.left || e.id === pair.right));
                    if (entries.length !== 2) return sendProblem(422, 'bench.invalid_pair', 'Entries not in round.');
                    const outcome = body.outcome;
                    if (!['left', 'right', 'tie', 'both_bad'].includes(outcome)) return sendProblem(422, 'bench.invalid_outcome', 'Invalid outcome.');
                    const judgement = {
                        id: id('bju'),
                        round_id: round.id,
                        kind_id: round.kind_id,
                        judge: 'human_pairwise',
                        method: 'human_pairwise',
                        pair,
                        outcome,
                        score: null,
                        subject: person.subject,
                        at: new Date().toISOString(),
                    };
                    state.judgements.push(judgement);
                    updateRating(round.kind_id, entries.find((e) => e.id === pair.left), entries.find((e) => e.id === pair.right), outcome);
                    return json(201, { judgement, revealed: { left: fullEntry(entries.find((e) => e.id === pair.left)), right: fullEntry(entries.find((e) => e.id === pair.right)) } });
                }

                if (req.method === 'GET' && /^\/api\/v1\/boards\/([^/]+)$/.test(url.pathname)) {
                    const kindId = decodeURIComponent(url.pathname.split('/').pop());
                    const type = url.searchParams.get('type') || 'elo';
                    const b = board(kindId, type);
                    if (!b) return sendProblem(404, 'bench.kind_not_found', 'No such kind.');
                    return json(200, { board: b });
                }

                if (req.method === 'GET' && /^\/api\/v1\/datasets\/([^/]+)\.jsonl$/.test(url.pathname)) {
                    const kindId = decodeURIComponent(url.pathname.split('/').pop().replace(/\.jsonl$/, ''));
                    const text = datasetJsonl(kindId);
                    if (text == null) return sendProblem(404, 'bench.kind_not_found', 'No such kind.');
                    res.setHeader('Cache-Control', 'public, max-age=60');
                    res.setHeader('Content-Disposition', `attachment; filename="${kindId}-dataset.jsonl"`);
                    res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
                    return res.end(text);
                }

                return sendProblem(404, 'route.not_found', 'No such route.');
            } catch (err) {
                if (err && err.status) return sendProblem(err.status, err.code, err.detail);
                sendProblem(500, 'internal.error', 'Bench fake failed.');
            }
        });
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    async function tick() {
        for (const round of state.rounds.values()) {
            if (round.status === 'queued') {
                round.status = 'running';
                await generateEntries(round);
            }
        }
    }

    async function close() {
        await new Promise((r) => server.close(r));
    }

    return { base, url: base, state, tick, close, addEntry };
}

module.exports = { startBench };
