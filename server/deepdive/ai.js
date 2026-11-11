'use strict';

/**
 * OpenVibe.Design's way to a deep dive (contract ai.deep-dive@1, OpenVibe.AI's workflow design.deep_dive).
 *
 * A dive is an ordinary durable AI run. Design starts it as the first-party service `design`, on the person's
 * behalf (so AI holds their Balance for the depth's price), and reads the run while it works. When the run
 * finishes its output is the report. The run id, not a second copy of the pipeline, is the source of truth.
 *
 * The paths are read from configuration because the AI and Exchange deployments of the feature ship together:
 * `ai.runsPath` is /api/v1/runs, `ai.deepDivesPath` is the feature's own front door when a deployment has one,
 * and the options path gives the depths and their price. A 404 falls through to the next path.
 */

const { serviceAuth } = require('openvibe-contracts');
const { normalizeReport, progressOf } = require('./report');
const { STEP_NAMES } = require('./report');

class DeepDiveError extends Error {
    constructor(status, code, detail) {
        super(detail || code);
        this.name = 'DeepDiveError';
        this.status = status;
        this.code = code;
        this.detail = detail || code;
    }
}

const DEPTH_NAMES = { quick: 'Quick', thorough: 'Thorough', expert: 'Expert' };

function parsePrices(raw) {
    const out = {};
    for (const part of String(raw || '').split(',')) {
        const [key, value] = part.split('=').map((x) => x && x.trim());
        const n = Number(value);
        if (key && Number.isFinite(n) && n >= 0) out[key] = n;
    }
    return out;
}

function createDeepDiveAi({ config, fetchImpl = globalThis.fetch, log = console }) {
    const ai = config.ai || {};
    const dd = config.deepDive || {};
    const base = String(dd.url || ai.url || '').replace(/\/+$/, '');
    const tokenClient = config.oauth && config.oauth.clientSecret && base
        ? serviceAuth.createTokenClient({
            tokenUrl: `${config.networkInternalUrl || config.networkUrl}/oauth/token`,
            clientId: config.oauth.clientId, clientSecret: config.oauth.clientSecret,
            audience: ai.audience || 'openvibe.ai', scope: ai.scope || 'ai.run.create', fetchImpl,
        })
        : null;
    const enabled = Boolean(base && tokenClient);
    const timeoutMs = Math.max(1000, Number(dd.timeoutMs) || 30_000);
    const pollMs = Math.max(200, Number(dd.pollMs) || 4000);
    const waitMs = Math.max(0, Number(dd.waitMs) || 0);
    const fallbackPrices = parsePrices(dd.prices);
    const publicBase = String(dd.publicReportBase || 'https://openvibe.exchange').replace(/\/+$/, '');
    const reportPath = String(dd.reportPath || '/deep-dive/:id');
    const exchangeBase = String(dd.exchangeUrl || '').replace(/\/+$/, '');

    async function headers({ token = null, retried = false } = {}) {
        if (token) return { Accept: 'application/json', Authorization: `Bearer ${token}` };
        if (!tokenClient) throw new DeepDiveError(503, 'deep_dive.not_configured', 'OpenVibe.AI is not configured for deep dives.');
        try { return { Accept: 'application/json', ...(await tokenClient.authHeaders()) }; } catch {
            if (!retried) return headers({ token, retried: true });
            throw new DeepDiveError(502, 'deep_dive.token_failed', 'OpenVibe.Network did not issue an AI token for a deep dive.');
        }
    }

    async function call(method, path, body, { token = null, retried = false, baseUrl = base } = {}) {
        if (!baseUrl) throw new DeepDiveError(503, 'deep_dive.not_configured', 'OpenVibe.AI is not configured for deep dives.');
        let h;
        try { h = await headers({ token }); } catch (err) { throw err; }
        let res;
        try {
            res = await fetchImpl(`${baseUrl}${path}`, {
                method, headers: { ...h, ...(body ? { 'Content-Type': 'application/json' } : {}) },
                body: body ? JSON.stringify(body) : undefined,
                signal: AbortSignal.timeout(timeoutMs),
            });
        } catch (err) {
            throw new DeepDiveError(502, 'deep_dive.unreachable', err && err.name === 'TimeoutError'
                ? 'OpenVibe.AI did not answer in time.' : 'OpenVibe.AI could not be reached.');
        }
        if (res.status === 401 && !token && !retried) {
            tokenClient.invalidate();
            return call(method, path, body, { token, retried: true, baseUrl });
        }
        const json = await res.json().catch(() => null);
        if (!res.ok) {
            const code = (json && (json.code || json.error)) || `deep_dive.http_${res.status}`;
            const detail = (json && (json.detail || json.message)) || `OpenVibe.AI refused the deep dive (${res.status}).`;
            throw new DeepDiveError(res.status >= 500 ? 502 : res.status, String(code).slice(0, 80), String(detail).slice(0, 500));
        }
        return json;
    }

    /** The depths and what each costs, before a run starts. AI's own answer when it has one. */
    async function options({ token = null } = {}) {
        const seen = new Set();
        const candidates = [];
        if (dd.optionsPath) candidates.push({ baseUrl: base, path: dd.optionsPath });
        candidates.push({ baseUrl: base, path: '/api/v1/deep-dives/options' }, { baseUrl: base, path: '/api/v1/deep-dive/options' },
            { baseUrl: base, path: '/api/v1/deep-dives/prices' }, { baseUrl: base, path: '/api/v1/deep-dives/depths' });
        if (exchangeBase) candidates.push({ baseUrl: exchangeBase, path: '/api/v1/deep-dives/options' }, { baseUrl: exchangeBase, path: '/api/v1/exchange/deep-dives/options' });
        for (const c of candidates) {
            const key = `${c.baseUrl}${c.path}`;
            if (seen.has(key)) continue;
            seen.add(key);
            try {
                const body = await call('GET', c.path, null, { token, baseUrl: c.baseUrl });
                const out = normalizeOptions(body);
                if (out) return { ...out, source: 'ai' };
            } catch (err) {
                if (err.status !== 404 && err.status !== 405) log.warn('[OpenVibe.Design] deep dive options:', err.message);
            }
        }
        return fallbackOptions();
    }

    function fallbackOptions() {
        const depths = ['quick', 'thorough', 'expert'].map((id) => ({
            id, name: DEPTH_NAMES[id], sites: id === 'quick' ? 6 : id === 'thorough' ? 15 : 30,
            minutes: id === 'quick' ? 3 : null, price_usd: fallbackPrices[id] == null ? null : Number(fallbackPrices[id]),
            currency: 'USD',
            line: id === 'quick' ? 'Six sites, about three minutes' : id === 'thorough' ? 'Fifteen sites' : 'Thirty sites, plus interactions, accessibility and speed',
        }));
        return { depths, priced: depths.some((d) => d.price_usd != null), source: 'config', note: depths.some((d) => d.price_usd != null) ? null : 'The price is shown on OpenVibe Exchange before the dive starts.' };
    }

    function normalizeOptions(body) {
        const root = body && (body.deep_dive || body.deepDive) ? (body.deep_dive || body.deepDive) : body;
        const raw = root && (root.depths || root.options || root.depth_options || root.levels);
        if (!Array.isArray(raw) || !raw.length) {
            // A prices-only answer: { prices: { quick: 0.25, … } } or { quick: { price_usd } }.
            const prices = root && (root.prices || root.depth_prices);
            if (prices && typeof prices === 'object' && !Array.isArray(prices)) {
                const depths = ['quick', 'thorough', 'expert'].map((id) => {
                    const v = prices[id];
                    if (v == null) return null;
                    const price = typeof v === 'object' ? (v.price_usd != null ? v.price_usd : v.price) : v;
                    const extra = typeof v === 'object' ? v : {};
                    return { id, name: extra.name || DEPTH_NAMES[id], sites: Number(extra.sites || extra.max_sites) || null,
                        minutes: Number(extra.minutes) || null, price_usd: Number(price) || 0, currency: String(extra.currency || 'USD'), line: extra.line || null };
                }).filter(Boolean);
                if (depths.length) return { depths, priced: true, source: 'ai', note: root.note || null };
            }
            return null;
        }
        const depths = raw.map((d) => {
            const id = String(d.id || d.key || d.depth || d.name || '').toLowerCase();
            const known = ['quick', 'thorough', 'expert'].includes(id) ? id : null;
            if (!known) return null;
            return {
                id: known, name: String(d.name || d.label || DEPTH_NAMES[known]),
                sites: Number(d.sites || d.site_count || d.max_sites) || null,
                minutes: Number(d.minutes || d.minutes_about) || null,
                price_usd: Number(d.price_usd != null ? d.price_usd : d.price) || 0,
                currency: String(d.currency || 'USD'),
                line: String(d.line || d.description || '') || null,
            };
        }).filter(Boolean);
        if (!depths.length) return null;
        return { depths, priced: depths.every((d) => d.price_usd != null), source: 'ai', note: root.note || null };
    }

    /** The run body both doors accept; the report is the run's output. */
    function runBody({ question, sites = [], depth = 'thorough', person = null, target = null }) {
        // ai.deep-dive@1's input: the question, the depth, the depth's site budget and the sites the person named.
        const wanted = ['quick', 'thorough', 'expert'].includes(String(depth)) ? String(depth) : 'thorough';
        const maxSites = wanted === 'quick' ? 6 : wanted === 'thorough' ? 15 : 30;
        const input = { question: String(question || '').slice(0, 500), depth: wanted, max_sites: maxSites,
            sites: sites.map((s) => String(s).slice(0, 2000)).filter((s) => /^https?:\/\//i.test(s)).slice(0, 30) };
        return {
            workflow: dd.workflow || 'design.deep_dive',
            input,
            options: { cache: false },
            ...(person ? { on_behalf_of: { type: 'user', id: String(person) } } : {}),
            ...(target ? { target } : {}),
        };
    }

    /** Start a dive on the person's behalf. The id is kept before any report exists, so a failed run is still a record. */
    async function start({ question, sites = [], depth = 'thorough', person = null, target = null, idempotencyKey = null } = {}) {
        const body = runBody({ question, sites, depth, person, target });
        if (idempotencyKey) body.idempotency_key = String(idempotencyKey).slice(0, 200);
        const paths = [];
        if (dd.startPath) paths.push({ path: dd.startPath, body });
        paths.push({ path: '/api/v1/runs?wait=0', body });
        if (dd.deepDivesPath) paths.push({ path: dd.deepDivesPath, body: body.input });
        paths.push({ path: '/api/v1/deep-dives', body: body.input });
        let last = null;
        for (const p of paths) {
            try {
                const out = await call('POST', p.path, p.body);
                const run = out && (out.run || out.deep_dive || out.deepDive || out);
                const id = run && (run.id || run.run_id || run.deep_dive_id);
                if (!id) throw new DeepDiveError(502, 'deep_dive.bad_answer', 'OpenVibe.AI started a deep dive without an id.');
                return { runId: String(id), run: run.run || run, raw: out };
            } catch (err) {
                last = err;
                if (![403, 404, 405, 422].includes(err.status)) throw err;
            }
        }
        throw last || new DeepDiveError(502, 'deep_dive.start_failed', 'The deep dive could not be started.');
    }

    /** A dive's own document, from the feature's route when its run output is not the report itself. */
    async function deepDiveDoc(runId, { token = null } = {}) {
        const id = String(runId || '');
        const out = await call('GET', `/api/v1/deep-dives/${encodeURIComponent(id)}`, null, { token });
        const doc = out && (out.deep_dive || out.deepDive || out.report || out.run || out);
        if (!doc || typeof doc !== 'object') throw new DeepDiveError(502, 'deep_dive.bad_answer', 'OpenVibe.AI answered without a deep dive.');
        const status = doc.status || (out && out.run && out.run.status) || 'succeeded';
        return { run: { id, status, output: doc.report || doc.output || doc, input: doc.input,
            usage: doc.receipt || null, explain: { deep_dive: { steps: doc.steps || [] } } }, citations: [] };
    }

    /** One run, with the person's own token when attaching a dive they ran on Exchange. */
    async function getRun(runId, { token = null } = {}) {
        const id = String(runId || '');
        if (!/^[A-Za-z0-9._~-]{1,160}$/.test(id)) throw new DeepDiveError(422, 'deep_dive.invalid_id', 'That is not a deep dive id.');
        let out;
        try {
            out = await call('GET', `/api/v1/runs/${encodeURIComponent(id)}`, null, { token });
        } catch (err) {
            if (err.status === 404) return await deepDiveDoc(id, { token });
            throw err;
        }
        const run = out && (out.run || out);
        if (!run || typeof run !== 'object') throw new DeepDiveError(502, 'deep_dive.bad_answer', 'OpenVibe.AI answered without a run.');
        // A deployment that keeps the report beside the run (its own table) answers the run without its output.
        if (run.status === 'succeeded' && (run.output == null || typeof run.output !== 'object')) {
            try { return await deepDiveDoc(id, { token }); } catch { /* the run stays the answer */ }
        }
        return { run, citations: out && out.citations || [] };
    }

    async function cancel(runId) {
        const out = await call('POST', `/api/v1/runs/${encodeURIComponent(runId)}/cancel`, {});
        return out && (out.run || out);
    }

    /**
     * One crop of a capture as bytes: AI serves the private Media object to the service that ran the dive.
     * The path is configuration because the capture endpoint ships with the feature.
     */
    async function crop(runId, cropId) {
        const id = String(runId || '');
        const crop = String(cropId || '');
        if (!/^[A-Za-z0-9._~-]{1,160}$/.test(id) || !/^[A-Za-z0-9._~-]{1,120}$/.test(crop)) throw new DeepDiveError(422, 'deep_dive.invalid_crop', 'That is not a crop of this deep dive.');
        const candidates = [dd.cropPath, '/api/v1/deep-dives/:runId/shots/:cropId', '/api/v1/deep-dives/:runId/crops/:cropId',
            '/api/v1/deep-dives/:runId/capture/:cropId', '/api/v1/deep-dives/:runId/media/:cropId'].filter(Boolean);
        let last = null;
        for (const template of [...new Set(candidates)]) {
            const path = template.replace(':runId', encodeURIComponent(id)).replace(':cropId', encodeURIComponent(crop));
            let h;
            try { h = await headers(); } catch (err) { throw err; }
            let res;
            try {
                res = await fetchImpl(`${base}${path}`, { headers: { ...h, Accept: 'image/*' }, signal: AbortSignal.timeout(timeoutMs) });
            } catch (err) {
                last = new DeepDiveError(502, 'deep_dive.unreachable', 'OpenVibe.AI could not be reached for the crop.');
                continue;
            }
            if (res.status === 404 || res.status === 405) { last = new DeepDiveError(404, 'deep_dive.no_crop', 'That crop is not available.'); continue; }
            if (!res.ok) {
                const body = await res.text().catch(() => '');
                last = new DeepDiveError(res.status >= 500 ? 502 : res.status, `deep_dive.crop_${res.status}`, body.slice(0, 300) || 'The crop could not be read.');
                continue;
            }
            const type = String(res.headers.get('content-type') || 'image/png');
            if (!/^image\//i.test(type)) { last = new DeepDiveError(502, 'deep_dive.crop_type', 'OpenVibe.AI did not answer with an image.'); continue; }
            return { contentType: type, body: Buffer.from(await res.arrayBuffer()) };
        }
        throw last || new DeepDiveError(404, 'deep_dive.no_crop', 'That crop is not available.');
    }

    /** The report once a run has succeeded; the run is the evidence, the report is its output. */
    function reportOf(run, { question = '', depth = 'thorough' } = {}) {
        let output = run && run.output;
        if (output && typeof output === 'object' && output.deep_dive) output = output.deep_dive;
        if (output && typeof output === 'object' && output.report) output = output.report;
        if (!output) return null;
        const normalized = normalizeReport(output, { question, depth });
        const url = (output && (output.report_url || output.url)) || (run && (run.report_url || run.url)) || null;
        return { ...normalized, url: url || `${publicBase}${reportPath.replace(':id', String(run && run.id || ''))}` };
    }

    function statusOf(run) {
        const s = String((run && (run.status || run.state)) || 'running').toLowerCase();
        if (['succeeded', 'success', 'done', 'completed', 'ok', 'cached'].includes(s)) return 'done';
        if (['failed', 'error', 'errored'].includes(s)) return 'failed';
        if (['cancelled', 'canceled', 'stopped'].includes(s)) return 'cancelled';
        if (['queued', 'pending', 'starting'].includes(s)) return 'starting';
        return 'running';
    }

    return { enabled, start, getRun, cancel, crop, options, reportOf, statusOf, progressOf, publicReportUrl: (id) => `${publicBase}${reportPath.replace(':id', String(id || ''))}`, STEP_NAMES, pollMs, waitMs, DEPTH_NAMES };
}

module.exports = { createDeepDiveAi, DeepDiveError, parsePrices, DEPTH_NAMES };
