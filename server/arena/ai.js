'use strict';

/**
 * The Arena's only model gateway: OpenVibe.AI's `generate` operation, called as the first-party service `design`
 * with a client-credentials token (audience openvibe.ai, scope ai.run.create). Network grants the token, and the
 * `ai.*` namespace lets it run `ai.generate`.
 *
 * AI's routing is the authority. Design reads the chat route's offered providers/models (GET /api/v1/routes) and
 * asks for three slots; each run reports the provider and model that actually answered, and those are what the
 * leaderboard ranks. `DESIGN_ARENA_MODELS` can name explicit `provider:model` slots, but the reported provenance
 * always wins, so a fallback or a pool's choice is never mislabelled.
 */
const { serviceAuth } = require('openvibe-contracts');
const { sanitizeHtml } = require('./sanitize');

class ArenaAiError extends Error {
    constructor(status, code, detail) {
        super(detail || code);
        this.name = 'ArenaAiError';
        this.status = status;
        this.code = code;
        this.detail = detail || code;
    }
}

const CATEGORY_BRIEF = {
    landing: 'A marketing landing page for a product or place: a hero, a clear proof section, and one call to action.',
    dashboard: 'A dense analytics dashboard: navigation, KPI cards, a chart area, a table and useful empty states.',
    mobile_app: 'A phone-first app screen or flow: one clear task, thumb-sized controls, safe areas and a bottom bar if it helps.',
    game_ui: 'A game interface: HUD, inventory or lobby that is readable at a glance and feels like a game.',
    logo: 'A logo and small brand sheet: the mark, a wordmark, a colour palette and a few lockups.',
    slides: 'A short slide deck: a title slide and two or three content slides with a clear visual hierarchy.',
};

function createArenaAi({ config, fetchImpl = globalThis.fetch, log = console }) {
    const ai = config.ai;
    const tokenClient = config.oauth.clientSecret
        ? serviceAuth.createTokenClient({
            tokenUrl: `${config.networkInternalUrl || config.networkUrl}/oauth/token`,
            clientId: config.oauth.clientId,
            clientSecret: config.oauth.clientSecret,
            audience: ai.audience,
            scope: ai.scope,
            fetchImpl,
        })
        : null;
    const enabled = Boolean(ai.url && tokenClient);

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    async function call(method, path, body, { retried = false } = {}) {
        if (!enabled) throw new ArenaAiError(503, 'ai.not_configured', 'OpenVibe.AI is not configured for the Arena.');
        let headers;
        try {
            headers = { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(await tokenClient.authHeaders()) };
        } catch (err) {
            throw new ArenaAiError(502, 'ai.token_failed', 'OpenVibe.Network did not issue an AI token for Design.');
        }
        let res;
        try {
            res = await fetchImpl(`${ai.url.replace(/\/+$/, '')}${path}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: AbortSignal.timeout(ai.timeoutMs),
            });
        } catch (err) {
            throw new ArenaAiError(502, 'ai.unreachable', err && err.name === 'TimeoutError'
                ? 'OpenVibe.AI did not answer in time.'
                : 'OpenVibe.AI could not be reached.');
        }
        if (res.status === 401 && !retried) {
            tokenClient.invalidate();
            return call(method, path, body, { retried: true });
        }
        const json = await res.json().catch(() => null);
        if (!res.ok) {
            const code = (json && (json.code || json.error)) || `ai.http_${res.status}`;
            const detail = (json && (json.detail || json.message)) || `OpenVibe.AI refused the run (${res.status}).`;
            throw new ArenaAiError(res.status >= 500 ? 502 : res.status, String(code).slice(0, 80), String(detail).slice(0, 500));
        }
        return json;
    }

    /**
     * The offers the routing lists for `generate` (GET /api/v1/routes?operation=generate). AI's route
     * response is the source: an `offers` array of { provider, model }. A route that predates offers
     * still answers with primary/fallbacks/pinned, which are read as before. The default.chat route is
     * the one ai.generate uses, so its offers are preferred; distinct providers come first, then a
     * second model of one provider.
     */
    async function offeredModels() {
        let body;
        try { body = await call('GET', '/api/v1/routes?operation=generate'); } catch (err) {
            log.warn('[OpenVibe.Design] AI routes unavailable:', (err && err.message) || err);
            return [];
        }
        let routes = Array.isArray(body) ? body : (body && Array.isArray(body.routes) ? body.routes : []);
        if (!routes.length && body && body.routes && typeof body.routes === 'object' && !Array.isArray(body.routes)) {
            routes = Object.entries(body.routes).map(([key, r]) => ({ key, ...(r || {}) }));
        }
        if (!routes.length && body && body.key) routes = [body];
        if (!routes.length && body && Array.isArray(body.models)) {
            routes = body.models.map((m) => ({ key: 'default.chat', capability: 'chat', primary: { provider: m.provider || m.provider_key, model: m.model || m.model_key } }));
        }
        const chat = routes.filter((r) => r && (r.capability === 'chat' || /chat|generate/i.test(String(r.key || ''))));
        const ordered = [
            ...chat.filter((r) => r.key === 'default.chat'),
            ...chat.filter((r) => r.key !== 'default.chat'),
        ];
        const out = [];
        const seen = new Set();
        const add = (provider, model) => {
            const p = String(provider || '').trim();
            const m = model == null ? null : String(model).trim();
            if (!p) return;
            const key = `${p}|${m || ''}`;
            if (seen.has(key)) return;
            seen.add(key);
            out.push({ provider: p, model: m || null });
        };
        // AI's offers are authoritative when the response carries them. The default.chat route is
        // ai.generate's route; when it has no offers, no other route's offer is a valid pin here.
        const hasOffers = ordered.some((r) => Array.isArray(r.offers));
        if (hasOffers) {
            const preferred = ordered.find((r) => r.key === 'default.chat' && Array.isArray(r.offers));
            const source = preferred ? [preferred] : ordered.filter((r) => Array.isArray(r.offers));
            for (const r of source) for (const o of r.offers) add(o && o.provider, o && o.model);
        } else {
            // An older AI lists definitions only. These are read as offers for compatibility; a pin AI
            // does not list is refused by its 422, which the job records on the output.
            for (const r of ordered) {
                if (r.primary) add(r.primary.provider, r.primary.model);
                const pinned = Array.isArray(r.pinned) ? r.pinned : [];
                for (const p of pinned) add(p && p.provider, p && p.model);
                const fallbacks = Array.isArray(r.fallbacks) ? r.fallbacks : [];
                for (const f of fallbacks) add(f && f.provider, f && f.model);
                if (r.constraints && r.constraints.model && r.primary) add(r.primary.provider, r.constraints.model);
            }
        }
        return rankOffers(out);
    }

    /** Distinct offers, one per provider first, then further models of a provider already seen. */
    function rankOffers(list) {
        const out = [];
        const seen = new Set();
        const providers = new Set();
        const rest = [];
        for (const c of list) {
            const p = String((c && c.provider) || '').trim();
            if (!p) continue;
            const m = c.model == null ? null : String(c.model).trim();
            const key = `${p}|${m || ''}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const offer = { provider: p, model: m || null };
            if (!providers.has(p)) { providers.add(p); out.push(offer); } else rest.push(offer);
        }
        return [...out, ...rest];
    }

    function configuredModels() {
        return (ai.models || []).map((s) => {
            const i = s.indexOf(':');
            return i > 0 ? { provider: s.slice(0, i), model: s.slice(i + 1) || null } : { provider: s, model: null };
        });
    }

    /**
     * Three distinct offers to ask AI for. When the routing offers fewer than three, the remainder is
     * an unpinned slot answered by AI's pool, and the round records that it fell back (`pool_fallback`).
     */
    async function slotPlan() {
        let list = configuredModels();
        if (!list.length) list = await offeredModels();
        const ranked = rankOffers(list);
        const slots = ranked.slice(0, 3);
        const poolFallback = slots.length < 3;
        while (slots.length < 3) slots.push({ provider: 'ai', model: null });
        return { slots, pool_fallback: poolFallback, offered: ranked.length };
    }

    async function slots() { return (await slotPlan()).slots; }

    function systemPrompt(category) {
        return [
            'You are a senior product designer and front-end engineer competing in the OpenVibe Design Arena.',
            'Build the page the person describes as one complete, self-contained HTML document.',
            `Category: ${category}. ${CATEGORY_BRIEF[category] || ''}`,
            'Rules: return only the HTML document, starting with <!doctype html>. Use inline CSS in a <style> tag or style attributes.',
            'No JavaScript, no event-handler attributes, no external stylesheets, fonts, scripts or images. Images may be inline SVG or data: URIs.',
            'Make it responsive enough to be judged at 390 px and 1280 px wide. Use real, plausible content, not lorem ipsum. No explanations outside the HTML.',
        ].join('\n');
    }

    function textOf(output) {
        if (typeof output === 'string') return output;
        if (!output || typeof output !== 'object') return '';
        for (const k of ['text', 'html', 'content', 'body']) if (typeof output[k] === 'string') return output[k];
        if (output.message && typeof output.message.content === 'string') return output.message.content;
        return '';
    }

    function msOf(run, fallback) {
        for (const v of [run && run.ms, run && run.latency_ms, run && run.duration_ms, run && run.usage && run.usage.ms, run && run.usage && run.usage.latency_ms, run && run.usage && run.usage.duration_ms]) {
            if (Number.isFinite(Number(v)) && Number(v) >= 0) return Math.round(Number(v));
        }
        const start = run && (run.started_at || run.created_at);
        const end = run && run.finished_at;
        if (start && end) {
            const d = Date.parse(end) - Date.parse(start);
            if (Number.isFinite(d) && d >= 0) return Math.round(d);
        }
        return Math.max(0, Math.round(fallback));
    }

    async function waitFor(run, startedAt) {
        let r = run;
        const deadline = Date.now() + ai.timeoutMs;
        while (r && ['queued', 'running'].includes(r.status)) {
            if (!r.id) throw new ArenaAiError(502, 'ai.bad_answer', 'OpenVibe.AI answered with a running run that has no id.');
            if (Date.now() > deadline) throw new ArenaAiError(504, 'ai.timeout', `The AI run ${r.id} did not finish in time.`);
            await sleep(ai.pollMs);
            const body = await call('GET', `/api/v1/runs/${encodeURIComponent(r.id)}`);
            r = body && body.run ? body.run : body;
        }
        if (!r) throw new ArenaAiError(502, 'ai.bad_answer', 'OpenVibe.AI answered without a run.');
        const done = ['succeeded', 'cached', 'completed', 'ok'].includes(r.status)
            || (r.status == null && r.output != null && !r.error);
        if (!done) {
            const e = r.error || {};
            throw new ArenaAiError(502, 'ai.run_failed', `The AI run ${r.id || '?'} ${r.status || 'did not finish'}${e.code ? ` (${e.code}: ${e.detail || ''})` : ''}.`);
        }
        return { run: r, ms: msOf(r, Date.now() - startedAt) };
    }

    async function generate({ prompt, category, slot, roundId, index }) {
        if (!enabled) throw new ArenaAiError(503, 'ai.not_configured', 'OpenVibe.AI is not configured for the Arena.');
        // One offer from GET /api/v1/routes: AI runs that provider/model alone, or refuses it in words.
        // A pool slot (fewer than three offered) sends no route and lets the routing choose.
        const pinned = slot && slot.provider && slot.provider !== 'ai' ? { provider: slot.provider, model: slot.model || null } : null;
        const body = {
            prompt: `${prompt}\n\nCategory: ${category}\nReturn one complete HTML document.`,
            system: systemPrompt(category),
            max_tokens: 8000,
            temperature: 0.7,
            options: { cache: false },
            ...(pinned ? { route: pinned } : {}),
            target: { service: 'design', type: 'arena_output', id: `${roundId}_${index}`.slice(0, 128) },
        };
        const startedAt = Date.now();
        const wait = Math.min(ai.waitMs, 60_000);
        let created;
        try {
            created = await call('POST', `/api/v1/generate?wait=${wait}`, body);
        } catch (err) {
            // A deployment that exposes the run API but not the convenience operation: the same run, by workflow.
            if (!err || err.status !== 404) throw err;
            created = await call('POST', `/api/v1/runs?wait=${wait}`, {
                workflow: 'ai.generate',
                input: { prompt: body.prompt, system: body.system, max_tokens: body.max_tokens, temperature: body.temperature },
                options: body.options,
                ...(body.route ? { route: body.route } : {}),
                target: body.target,
            });
        }
        const first = created && created.run ? created.run : created;
        const { run, ms } = await waitFor(first, startedAt);
        const text = textOf(run.output);
        if (!text.trim()) throw new ArenaAiError(502, 'ai.empty', `The AI run ${run.id} returned no HTML.`);
        let html = text.trim().replace(/^\s*```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/, '');
        const doc = /<!doctype\s+html[\s\S]*/i.exec(html) || /<html[\s\S]*/i.exec(html);
        if (doc) html = doc[0];
        const usage = run.usage || {};
        const prov = run.provenance || {};
        const tokens = usage.tokens && typeof usage.tokens === 'object'
            ? (Number(usage.tokens.input) || 0) + (Number(usage.tokens.output) || 0)
            : Number.isFinite(Number(usage.tokens)) ? Number(usage.tokens)
                : (Number(usage.tokens_in) || 0) + (Number(usage.tokens_out) || 0)
                    || (Number(usage.input_tokens) || 0) + (Number(usage.output_tokens) || 0)
                    || (Number(run.tokens) || 0);
        return {
            html: sanitizeHtml(html, { maxBytes: ai.maxHtmlBytes }),
            cost_usd: Number(usage.cost_usd != null ? usage.cost_usd
                : usage.cost != null ? usage.cost
                    : run.cost_usd != null ? run.cost_usd
                        : run.cost != null ? run.cost : 0) || 0,
            ms,
            tokens: Math.max(0, Math.round(tokens)),
            model: String(prov.model || run.model || (run.output && run.output.model) || (slot && slot.model) || 'unknown').slice(0, 120),
            provider: String(prov.provider || run.provider || (slot && slot.provider) || 'ai').slice(0, 80),
            ui_check: run.ui_check || (run.output && run.output.ui_check) || null,
            run_id: run.id || null,
        };
    }

    return { enabled, slots, slotPlan, offeredModels, rankOffers, generate, systemPrompt, CATEGORY_BRIEF };
}

module.exports = { createArenaAi, ArenaAiError, CATEGORY_BRIEF };
