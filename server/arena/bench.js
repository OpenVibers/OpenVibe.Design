'use strict';

/**
 * OpenVibe.Bench client for the Design Arena. Design uses its service token for task creation, reads and boards,
 * and forwards each person's Network token for round creation, blind pairs, votes and reveals.
 *
 *   service token (audience openvibe.bench, bench.task.create / bench.round.read / bench.board.read)
 *   person token  (Network user access token, audience openvibe.network)
 */
const { serviceAuth } = require('openvibe-contracts');
const { ArenaError } = require('./legacy-store');

const BENCH_CAPABILITIES = Object.freeze([
    'bench.task.create',
    'bench.round.create',
    'bench.round.read',
    'bench.judgement.cast',
    'bench.entry.create',
    'bench.board.read',
].join(' '));

class BenchClientError extends Error {
    constructor(status, code, detail) {
        super(detail || code);
        this.name = 'BenchClientError';
        this.status = status;
        this.code = code;
        this.detail = detail || code;
    }
}

function mapBenchProblem(status, body) {
    const code = body && (body.code || body.error) ? String(body.code || body.error) : 'bench.error';
    const detail = body && (body.detail || body.message) ? String(body.detail || body.message) : 'OpenVibe.Bench returned an error.';
    switch (code) {
        case 'bench.limit_person': return new ArenaError(429, 'arena.limit_person', detail);
        case 'bench.limit_site': return new ArenaError(429, 'arena.limit_site', detail);
        case 'bench.kind_not_found': return new ArenaError(400, 'arena.invalid_category', detail);
        case 'bench.prompt_required':
        case 'bench.prompt_too_long': return new ArenaError(422, 'arena.prompt_required', detail);
        case 'bench.round_not_found': return new ArenaError(404, 'arena.round_not_found', detail);
        case 'bench.round_not_ready': return new ArenaError(409, 'arena.round_not_ready', detail);
        case 'bench.creator_cannot_vote': return new ArenaError(403, 'arena.creator_cannot_vote', detail);
        case 'bench.already_judged': return new ArenaError(409, 'arena.already_voted', detail);
        case 'bench.invalid_pair': return new ArenaError(422, 'arena.invalid_pair', detail);
        case 'bench.invalid_outcome': return new ArenaError(422, 'arena.invalid_winner', detail);
        // A vote relayed for someone who has not signed in (plan L51): Bench's caps all answer the same way.
        case 'bench.limit_anon': return new ArenaError(429, 'arena.limit_anon', 'Sign in to keep voting today.');
        case 'bench.anon_disabled': return new ArenaError(403, 'arena.anon_disabled', 'Voting without signing in is off at the moment. Sign in to vote.');
        case 'bench.anon_kind_not_allowed': return new ArenaError(403, 'arena.anon_kind_not_allowed', 'Sign in to judge this kind.');
        default: return new BenchClientError(status, code, detail);
    }
}

function kindForCategory(category) {
    return category === 'logo' ? 'design.component' : 'design.page';
}

function createBenchClient({ config, fetchImpl = globalThis.fetch, log = console }) {
    const bench = config.bench;
    const enabled = Boolean(bench && bench.url);
    const tokenClient = enabled && config.oauth && config.oauth.clientSecret
        ? serviceAuth.createTokenClient({
            tokenUrl: `${config.networkInternalUrl || config.networkUrl}/oauth/token`,
            clientId: config.oauth.clientId,
            clientSecret: config.oauth.clientSecret,
            audience: bench.audience,
            scope: bench.scope,
            fetchImpl,
        })
        : null;

    async function serviceHeaders() {
        if (!enabled) throw new BenchClientError(503, 'bench.not_configured', 'OpenVibe.Bench is not configured for the Arena.');
        if (!tokenClient) throw new BenchClientError(503, 'bench.not_configured', 'Design has no client secret to talk to Bench.');
        return { Accept: 'application/json', ...(await tokenClient.authHeaders()), 'Content-Type': 'application/json' };
    }

    function personHeaders(token) {
        if (!enabled) throw new BenchClientError(503, 'bench.not_configured', 'OpenVibe.Bench is not configured for the Arena.');
        if (!token) throw new ArenaError(401, 'token.required', 'Sign in to use the Arena.');
        return { Accept: 'application/json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    }

    /**
     * Someone who has not signed in (plan L51): Design's own service token, and the voter id Design derived from its
     * own cookie in X-OV-Voter. Bench keeps only a hash of it, and caps each voter and Design's relay a day.
     */
    async function relayHeaders(voter) {
        const id = String(voter || '');
        if (!/^[A-Za-z0-9._~:-]{6,200}$/.test(id)) throw new ArenaError(401, 'token.required', 'Sign in to vote.');
        return { ...(await serviceHeaders()), 'X-OV-Voter': `anon:${id}` };
    }

    const asViewer = async ({ token = null, voter = null }) => (token ? personHeaders(token) : await relayHeaders(voter));

    async function request(method, path, { body = null, headers = null, token = null } = {}) {
        const h = headers || (token ? personHeaders(token) : await serviceHeaders());
        const url = `${bench.url.replace(/\/+$/, '')}${path}`;
        const opts = { method, headers: h, signal: AbortSignal.timeout(config.timeoutMs || 8000) };
        if (body != null) opts.body = JSON.stringify(body);
        let res;
        try {
            res = await fetchImpl(url, opts);
        } catch (err) {
            throw new BenchClientError(502, 'bench.unreachable', err && err.name === 'TimeoutError' ? 'OpenVibe.Bench did not answer in time.' : 'OpenVibe.Bench could not be reached.');
        }
        const json = await res.json().catch(() => null);
        if (!res.ok) {
            const err = mapBenchProblem(res.status, json);
            throw err;
        }
        return json || {};
    }

    async function createTask({ category, prompt }) {
        const kindId = kindForCategory(category);
        const out = await request('POST', `/api/v1/kinds/${encodeURIComponent(kindId)}/tasks`, {
            body: { prompt, public: true, task_class: category },
        });
        return out.task;
    }

    async function createRound({ category, prompt, token, offers = null }) {
        const task = await createTask({ category, prompt });
        const body = {};
        if (offers) body.offers = offers;
        const out = await request('POST', `/api/v1/tasks/${encodeURIComponent(task.id)}/rounds`, {
            body,
            token,
        });
        return { task, round: { ...out.round, task_class: task.task_class, prompt: task.prompt } };
    }

    /**
     * A round the room fills with its own entries (Bench's POST /rounds/:id/entries). It is created with the
     * service token, so the person who later chooses between the room's entries is not the round's creator and
     * Bench accepts their one vote. The service token needs bench.round.create and bench.entry.create.
     */
    async function createRoomRound({ category, prompt, offers = null }) {
        const task = await createTask({ category, prompt });
        const body = {};
        if (offers) body.offers = offers;
        const out = await request('POST', `/api/v1/tasks/${encodeURIComponent(task.id)}/rounds`, { body });
        return { task, round: { ...out.round, task_class: task.task_class, prompt: task.prompt } };
    }

    async function getTask(id) {
        const out = await request('GET', `/api/v1/tasks/${encodeURIComponent(id)}`);
        return out.task;
    }

    async function getRound(id, { token = null } = {}) {
        const out = await request('GET', `/api/v1/rounds/${encodeURIComponent(id)}`, { token });
        const round = out.round;
        if (round && round.task_id && !round.prompt) {
            try {
                const task = await getTask(round.task_id);
                round.task_class = task.task_class;
                round.prompt = task.prompt;
            } catch { /* keep blind */ }
        }
        return round;
    }

    async function nextPair(kindId, token) {
        const out = await request('GET', `/api/v1/judgements/next?kind=${encodeURIComponent(kindId)}`, { token });
        return out && out.round ? out : null;
    }

    async function castVote({ roundId, token, pair, winner }) {
        const out = await request('POST', `/api/v1/rounds/${encodeURIComponent(roundId)}/judgements`, {
            token,
            body: { pair, outcome: winner },
        });
        return out;
    }

    async function castImportedVote({ roundId, pair, winner }) {
        return await request('POST', `/api/v1/rounds/${encodeURIComponent(roundId)}/judgements`, {
            body: { judge: 'automatic_grader', judge_name: 'design.arena.legacy_vote', pair, outcome: winner },
        });
    }

    /** The next blind pair of a kind for this viewer: a person (their token) or a voter Design relays. Null: none. */
    async function nextJudgement(kindId, { token = null, voter = null } = {}) {
        const out = await request('GET', `/api/v1/judgements/next?kind=${encodeURIComponent(kindId)}`, { headers: await asViewer({ token, voter }) });
        return out && out.round && out.left && out.right ? out : null;
    }

    /** One judgement, as the person or the relayed voter. Bench answers with the two entries revealed. */
    async function castJudgement({ roundId, pair, outcome, token = null, voter = null }) {
        return await request('POST', `/api/v1/rounds/${encodeURIComponent(roundId)}/judgements`, {
            headers: await asViewer({ token, voter }),
            body: { pair, outcome },
        });
    }

    /** A kind's board. voters: null (everyone), 'people' (signed-in votes only) or 'anon'. */
    async function getBoard(kindId, { type = 'elo', token = null, voters = null } = {}) {
        const q = new URLSearchParams({ type });
        if (voters === 'people' || voters === 'anon') q.set('voters', voters);
        const out = await request('GET', `/api/v1/boards/${encodeURIComponent(kindId)}?${q}`, { token });
        return out.board;
    }

    /** Where a model's output is drawn: Bench's cookie-less render origin, framed with sandbox="allow-scripts". */
    function renderUrl(entryId) {
        return `${String((bench && bench.renderOrigin) || 'https://bench-render.openvibe.services').replace(/\/+$/, '')}/render/e/${encodeURIComponent(entryId)}`;
    }

    function datasetUrl(kindId) {
        return `${bench.publicUrl.replace(/\/+$/, '')}/api/v1/datasets/${encodeURIComponent(kindId)}.jsonl`;
    }

    async function addEntry({ roundId, provider, model, route, payload, costUsd, ms, tokens, error, uiCheck, runId }) {
        return await request('POST', `/api/v1/rounds/${encodeURIComponent(roundId)}/entries`, {
            body: {
                provider, model, route, payload,
                cost_usd: costUsd,
                ms,
                tokens,
                error,
                ui_check: uiCheck,
                run_id: runId,
            },
        });
    }

    return {
        enabled,
        kindForCategory,
        createTask,
        createRound,
        createRoomRound,
        getRound,
        nextPair,
        castVote,
        castImportedVote,
        nextJudgement,
        castJudgement,
        getBoard,
        renderUrl,
        datasetUrl,
        addEntry,
    };
}

module.exports = { createBenchClient, BenchClientError, kindForCategory, BENCH_CAPABILITIES };
