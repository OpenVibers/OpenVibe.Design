'use strict';

/**
 * "Research first": one place that starts a deep dive, follows it, and hands its evidence to a design.
 *
 * A dive starts as an AI run on the person's behalf and is followed by the service in the background, never by
 * the request that created it (a dive takes minutes). While it runs, a design's takes wait; when it finishes,
 * the report's numbered points become the generation brief and each take records the points it follows. A failed
 * dive does not lose its design: the takes are drawn without it and the canvas says what happened.
 */

const { createDeepDiveAi, DeepDiveError } = require('./ai');
const { findsFor, normalizeReport, proposedRulesOf, progressOf } = require('./report');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REF = /(?:runs?|deep[-_ ]?dives?|research)\/([A-Za-z0-9._~-]{1,160})/i;

function createDeepDiveService({ s, config, fetchImpl = globalThis.fetch, log = console, store, ai, now = () => Date.now() }) {
    const db = store;
    const client = ai || createDeepDiveAi({ config, fetchImpl, log });
    const running = new Map();     // research id → the promise following it
    const maxWaitMs = Math.max(30_000, Number(config.deepDive && config.deepDive.maxWaitMs) || 15 * 60_000);
    const pollMs = Math.max(200, Number(config.deepDive && config.deepDive.pollMs) || 4000);

    let optionsCache = { at: 0, value: null };
    async function options() {
        // The depths and their prices change rarely; a page and its estimate ask once, not once per keystroke.
        if (optionsCache.value && Date.now() - optionsCache.at < 60_000) return optionsCache.value;
        const out = await client.options().catch((err) => {
            log.warn('[OpenVibe.Design] deep dive options:', err.message);
            return { depths: [], priced: false, source: 'none', note: 'The depths could not be read; try again in a moment.' };
        });
        optionsCache = { at: Date.now(), value: out };
        return out;
    }

    function depthOf(optionsOut, wanted) {
        const list = (optionsOut && optionsOut.depths) || [];
        return list.find((d) => d.id === wanted) || list.find((d) => d.id === 'thorough') || list[0] || null;
    }

    async function create({ owner, question, depth = 'thorough', sites = [], targetId = null, token = null }) {
        if (!owner) throw Object.assign(new Error('Sign in to start a deep dive.'), { status: 401, code: 'deep_dive.sign_in', detail: 'Sign in to start a deep dive.' });
        const opts = await options();
        const chosen = depthOf(opts, depth);
        if (!chosen) throw Object.assign(new Error('The deep dive depths are not available right now.'), { status: 503, code: 'deep_dive.depths', detail: 'The deep dive depths are not available right now.' });
        const estimate = { depth: chosen.id, price_usd: chosen.price_usd, currency: chosen.currency || 'USD', priced: chosen.price_usd != null, sites: chosen.sites || null };
        const research = await db.create({ owner, question: String(question || '').slice(0, 500), depth: chosen.id, sites, estimate, status: 'starting' });
        let run;
        try {
            run = await client.start({
                question, sites, depth: chosen.id, person: owner, idempotencyKey: research.id,
                target: { service: 'design', type: 'design_research', id: research.id },
            });
        } catch (err) {
            await db.patch(research.id, { status: 'failed', error: err.detail || err.message });
            throw err;
        }
        const status = client.statusOf(run.run) || 'running';
        const updated = await db.patch(research.id, { runId: run.runId, status, progress: progressOf(run.run) });
        follow(research.id);
        return { research: db.publicRow(updated || research), options: opts, estimate, tokenUsed: Boolean(token) };
    }

    /** Follow a running dive to its end and keep what it says. One follower per dive in this process. */
    function follow(id) {
        if (running.has(id)) return running.get(id);
        const promise = (async () => {
            let warned = false;
            while (true) {
                const row = await db.get(id);
                if (!row || ['done', 'failed', 'cancelled'].includes(row.status)) return row;
                if (!row.run_id) { await db.patch(id, { status: 'failed', error: 'The deep dive did not start.' }); return await db.get(id); }
                if (Date.now() - new Date(row.created_at).getTime() > maxWaitMs) {
                    await db.patch(id, { status: 'failed', error: 'The deep dive did not finish in time. Its report may still appear on OpenVibe Exchange.' });
                    return await db.get(id);
                }
                let got;
                try { got = await client.getRun(row.run_id); } catch (err) {
                    // A transient read error is retried; an authorisation failure is final.
                    if ([401, 403, 404].includes(err.status)) {
                        await db.patch(id, { status: 'failed', error: err.detail || err.message });
                        return await db.get(id);
                    }
                    if (!warned) { log.warn('[OpenVibe.Design] deep dive read:', err.message); warned = true; }
                    await sleep(pollMs);
                    continue;
                }
                const status = client.statusOf(got.run);
                if (status === 'done') {
                    const report = client.reportOf(got.run, { question: row.question, depth: row.depth });
                    if (!report) {
                        await db.patch(id, { status: 'failed', progress: progressOf(got.run), error: 'The deep dive finished without a report.' });
                        return await db.get(id);
                    }
                    const saved = await db.patch(id, { status: 'done', progress: progressOf(got.run), report: report.report,
                        points: report.points, brief: report.brief, reportUrl: report.url, error: null });
                    try { await db.addProposals(saved, proposedRulesOf(report.report)); } catch (err) { log.warn('[OpenVibe.Design] rule proposals:', err.message); }
                    return saved;
                }
                if (status === 'failed' || status === 'cancelled') {
                    const err = got.run && (got.run.error || got.run.detail);
                    await db.patch(id, { status, progress: progressOf(got.run), error: String((err && (err.detail || err.message || err.code)) || (status === 'cancelled' ? 'The deep dive was cancelled.' : 'The deep dive did not finish.')).slice(0, 500) });
                    return await db.get(id);
                }
                await db.patch(id, { status, progress: progressOf(got.run) });
                await sleep(pollMs);
            }
        })().catch(async (err) => {
            log.warn('[OpenVibe.Design] deep dive follower:', err.message);
            await db.patch(id, { status: 'failed', error: String(err.message || err).slice(0, 500) }).catch(() => {});
            return await db.get(id).catch(() => null);
        }).finally(() => { running.delete(id); });
        running.set(id, promise);
        return promise;
    }

    /** Wait for a dive's report, or its failure, for a design's takes (bounded by the design's own run). */
    async function wait(id, { timeoutMs = maxWaitMs } = {}) {
        const started = Date.now();
        const follower = follow(id);
        let row = await Promise.race([
            follower,
            (async () => { while (Date.now() - started < timeoutMs) { const r = await db.get(id); if (r && ['done', 'failed', 'cancelled'].includes(r.status)) return r; await sleep(Math.min(pollMs, 1000)); } return await db.get(id); })(),
        ]).catch(() => null);
        if (!row) row = await db.get(id);
        return row;
    }

    async function get(id, owner) {
        const row = owner ? await db.owned(id, owner) : await db.get(id);
        if (!row) return null;
        const data = db.publicRow(row, { points: true });
        if (row.status === 'done') {
            const proposals = await db.proposalsFor(id).catch(() => []);
            data.proposals = (await Promise.all(proposals.map((p) => db.publicProposal(p)))).filter(Boolean);
        }
        return data;
    }

    /** The part of a dive a design's canvas may show to whoever can open the design: no report, no proposals. */
    async function summary(id) {
        const row = await db.get(id);
        return row ? db.publicRow(row, { points: true }) : null;
    }

    async function list(owner, { limit = 8 } = {}) {
        const rows = await db.list(owner, { limit });
        return rows.map((r) => db.publicRow(r));
    }

    /** Attach a dive the person already ran: paste its report address or its run id. */
    async function attach({ owner, token, ref }) {
        if (!owner) throw Object.assign(new Error('Sign in to attach a deep dive.'), { status: 401, code: 'deep_dive.sign_in', detail: 'Sign in to attach a deep dive.' });
        const value = String(ref || '').trim();
        if (!value) throw Object.assign(new Error('Paste the deep dive report link or its id.'), { status: 422, code: 'deep_dive.ref', detail: 'Paste the deep dive report link or its id.' });
        const m = REF.exec(value);
        const runId = (m ? m[1] : value).replace(/[?#].*$/, '');
        if (!/^[A-Za-z0-9._~-]{1,160}$/.test(runId)) throw Object.assign(new Error('That is not a deep dive link or id.'), { status: 422, code: 'deep_dive.ref', detail: 'That is not a deep dive link or id.' });
        // A dive Design already follows is named by its own id (rsr_...), not an AI run id: attach is a read.
        const own = await db.get(runId);
        if (own) {
            if (own.owner !== owner) throw Object.assign(new Error('That deep dive belongs to someone else.'), { status: 403, code: 'deep_dive.forbidden', detail: 'That deep dive belongs to someone else.' });
            if (own.status === 'failed' || own.status === 'cancelled') throw Object.assign(new Error('That deep dive did not finish; attach one with a report.'), { status: 409, code: 'deep_dive.failed', detail: 'That deep dive did not finish; attach one with a report.' });
            return { research: db.publicRow(own, { points: true }), existing: true };
        }
        const existing = await db.byRun(runId);
        if (existing && existing.owner === owner) return { research: db.publicRow(existing, { points: true }), existing: true };
        if (existing && existing.owner !== owner) throw Object.assign(new Error('That deep dive belongs to someone else.'), { status: 403, code: 'deep_dive.forbidden', detail: 'That deep dive belongs to someone else.' });
        if (!token) throw Object.assign(new Error('Sign in to attach a deep dive you ran on OpenVibe Exchange.'), { status: 401, code: 'deep_dive.sign_in', detail: 'Sign in to attach a deep dive you ran on OpenVibe Exchange.' });
        const got = await client.getRun(runId, { token });
        const run = got.run || {};
        const output = run.output && typeof run.output === 'object' ? run.output : {};
        const input = run.input && typeof run.input === 'object' ? run.input : (output.input && typeof output.input === 'object' ? output.input : {});
        const question = input.question || input.query || output.question || output.query || 'A deep dive';
        const depth = input.depth || output.depth || 'thorough';
        const status = client.statusOf(run);
        const report = status === 'done' ? client.reportOf(run, { question, depth }) : null;
        const row = await db.create({ owner, question, depth, sites: Array.isArray(input.sites) ? input.sites : [], runId, status: status === 'done' ? 'done' : status,
            estimate: { depth, price_usd: null, currency: 'USD', priced: false, attached: true } });
        if (report) {
            const saved = await db.patch(row.id, { status: 'done', progress: progressOf(run), report: report.report, points: report.points,
                brief: report.brief, reportUrl: report.url, error: null });
            await db.addProposals(saved, proposedRulesOf(report.report)).catch((err) => log.warn('[OpenVibe.Design] rule proposals:', err.message));
            return { research: (await get(row.id, owner)), existing: false };
        }
        if (status === 'running' || status === 'starting') {
            const updated = await db.patch(row.id, { progress: progressOf(run) });
            follow(row.id);
            return { research: db.publicRow(updated || row, { points: true }), existing: false };
        }
        const failed = await db.patch(row.id, { status: status === 'failed' ? 'failed' : 'failed', error: 'That deep dive did not finish.' });
        return { research: db.publicRow(failed || row), existing: false };
    }

    /** Read one point list for a design's take: patterns, do, don't and tokens rotate per take. */
    function pointsForTake(points, index, total = 1) {
        const list = Array.isArray(points) ? points : [];
        if (!list.length) return [];
        const groups = ['pattern', 'do', "don't", 'reference token', 'rule', 'recommendation', 'point'];
        const out = [];
        const count = Math.max(2, Math.min(5, Math.ceil(list.length / Math.max(1, total)) + 1));
        for (let i = 0; i < count; i++) {
            const pool = list.filter((p) => p.group === groups[(i + Number(index || 0)) % groups.length]);
            const source = pool.length ? pool : list;
            const pick = source[(Number(index || 0) + i) % source.length];
            if (pick && !out.some((p) => p.n === pick.n)) out.push({ n: pick.n, group: pick.group, text: String(pick.text || '').slice(0, 300) });
        }
        return out.slice(0, 5);
    }

    function pointLine(points, research) {
        if (!Array.isArray(points) || !points.length) return '';
        const links = points.map((p) => `point ${p.n}`).join(', ');
        return `\nThis take follows research ${links}${research && research.reportUrl ? ` (${research.reportUrl})` : ''}. Use them as direction; never copy a site's assets, code or exact palette.`;
    }

    /** "How others do it": crops and points across every finished report this service holds. */
    async function finds(component, { limit = 6, owner = null } = {}) {
        // A deep dive is the person's. A component page shows the findings of the person looking at it, never
        // another person's research or crops.
        if (!owner) return { component, count: 0, finds: [], reports: 0 };
        const reports = await db.allDone({ limit: 60, owner });
        const out = [];
        for (const row of reports) {
            const found = findsFor(row.report, component, limit);
            for (const find of found) {
                const key = `${find.n || ''}|${find.title}|${find.crop || find.url || ''}`;
                if (out.some((x) => x.key === key)) continue;
                out.push({ ...find, key, researchId: row.id, runId: row.run_id || null, researchUrl: `/research/${encodeURIComponent(row.id)}`,
                    reportUrl: row.report_url || null, depth: row.depth, readAt: row.updated_at });
            }
        }
        return { component, count: out.length, finds: out.slice(0, limit), reports: reports.length };
    }

    async function resume() {
        const rows = await s.db.many("SELECT id FROM design_research WHERE status IN ('starting','running') AND run_id IS NOT NULL ORDER BY created_at LIMIT 20");
        for (const r of rows) follow(r.id);
        return rows.length;
    }

    return { options, create, follow, wait, get, summary, list, attach, pointsForTake, pointLine, finds, resume, client };
}

module.exports = { createDeepDiveService, REF };
