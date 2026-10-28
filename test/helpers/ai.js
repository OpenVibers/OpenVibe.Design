'use strict';

/**
 * An in-process stand-in for OpenVibe.AI: the chat route's offers and the `generate` operation, in the shapes
 * server/api/runs.js returns. It verifies the client-credentials token Design got from the Network stub
 * (audience openvibe.ai, capability ai.run.create), records every request, and can fail, delay or answer
 * asynchronously. Tests read state.requests and state.tokenClaims.
 */
const http = require('http');
const crypto = require('crypto');

const DEFAULT_MODELS = [
    { provider: 'acme', model: 'alpha-1' },
    { provider: 'beta', model: 'beta-2' },
    { provider: 'gamma', model: 'gamma-3' },
];

function payload(token) {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    try { return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')); } catch { return null; }
}

function listen(handler) {
    return new Promise((resolve) => {
        const sockets = new Set();
        const server = http.createServer((req, res) => {
            const chunks = [];
            req.on('data', (c) => chunks.push(c));
            req.on('end', () => {
                const raw = Buffer.concat(chunks);
                const json = (status, obj, headers = {}) => {
                    res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
                    res.end(JSON.stringify(obj));
                };
                Promise.resolve(handler(req, raw, json, res)).catch((err) => json(500, { code: 'stub.error', detail: String(err && err.message) }));
            });
        });
        server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
        server.listen(0, '127.0.0.1', () => resolve({
            server,
            url: `http://127.0.0.1:${server.address().port}`,
            close: () => new Promise((r) => { for (const s of sockets) s.destroy(); server.close(r); }),
        }));
    });
}

async function startAi({ models = DEFAULT_MODELS, htmlFor = null, costUsd = 0.0012, ms = 321, tokensIn = 120, tokensOut = 480, failModels = [], asyncMode = false, routesStatus = 200 } = {}) {
    const st = {
        models: models.map((m) => ({ ...m })),
        requests: [], routeRequests: 0, lastAuth: null, tokenClaims: null,
        costUsd, ms, tokensIn, tokensOut,
        failModels: new Set(failModels), asyncMode, routesStatus,
        delayMs: 0, runCount: 0, runs: new Map(), htmlFor: null,
    };

    function routeFor(body) {
        const asked = body && body.route;
        if (!asked || typeof asked !== 'object') return null;
        return st.models.find((x) => x.provider === asked.provider && (asked.model == null || x.model === asked.model)) || false;
    }

    function modelFor(body) {
        const hit = routeFor(body);
        if (hit) return hit;
        const i = st.runCount % st.models.length;
        return st.models[i] || { provider: 'stub', model: 'stub-1' };
    }

    const srv = await listen(async (req, raw, json) => {
        const url = new URL(req.url, 'http://x');
        const text = raw.toString('utf8');
        let body = {};
        try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
        const auth = String(req.headers.authorization || '');
        st.lastAuth = auth || null;
        const claims = auth.startsWith('Bearer ') ? payload(auth.slice(7)) : null;
        if (claims) st.tokenClaims = claims;
        if (!claims || !(claims.aud || []).includes('openvibe.ai') || !(claims.cap || []).includes('ai.run.create')) {
            return json(401, { code: 'token.invalid', detail: 'a Design client-credentials token with ai.run.create is required' });
        }
        if (st.delayMs) await new Promise((r) => setTimeout(r, st.delayMs));

        if (url.pathname === '/api/v1/routes' && req.method === 'GET') {
            st.routeRequests++;
            if (st.routesStatus !== 200) return json(st.routesStatus, { code: 'route.unavailable', detail: 'routes are down' });
            const [first, ...rest] = st.models;
            return json(200, {
                routes: [{
                    key: 'default.chat', version: 3, status: 'active', capability: 'chat',
                    primary: { provider: first.provider, model: first.model },
                    fallbacks: rest.map((m) => ({ provider: m.provider, model: m.model })),
                    pinned: [], constraints: {}, alias_of: null,
                    // AI's routing lists the offers for the operation; Design pins one per slot.
                    offers: st.models.map((m) => ({ provider: m.provider, model: m.model })),
                }],
            });
        }

        if (url.pathname === '/api/v1/generate' && req.method === 'POST') {
            st.requests.push({ method: 'POST', path: url.pathname, query: Object.fromEntries(url.searchParams), body, claims });
            if (body.route && !routeFor(body)) {
                return json(422, { code: 'input.invalid', detail: `route ${body.route.provider}/${body.route.model} is not offered` });
            }
            const pick = modelFor(body);
            st.runCount++;
            const id = `run_${crypto.randomBytes(8).toString('hex')}`;
            if (st.failModels.has(pick.model)) {
                return json(502, { code: 'provider.unavailable', detail: `${pick.model} is down` });
            }
            const make = st.htmlFor || htmlFor;
            const html = make
                ? make(body, pick, st)
                : `<!doctype html><html><head><meta charset="utf-8"><title>A generated design</title></head><body><h1>A page that works</h1><p>${String(body.prompt || '').split('\n')[0].slice(0, 200)}</p><button>Start</button></body></html>`;
            const started = new Date(Date.now() - st.ms).toISOString();
            const finished = new Date().toISOString();
            const run = {
                id, status: 'succeeded', workflow: { key: 'ai.generate', version: 1 },
                provenance: { origin: 'ai', workflow: 'ai.generate', provider: pick.provider, model: pick.model, run_id: id },
                output: { text: html },
                usage: { tokens_in: st.tokensIn, tokens_out: st.tokensOut, cost_usd: st.costUsd, attempts: 1 },
                started_at: started, finished_at: finished, created_at: started,
            };
            st.runs.set(id, run);
            if (st.asyncMode) return json(202, { run: { ...run, status: 'running', output: null, usage: {} } }, { Location: `/api/v1/runs/${id}` });
            return json(201, { run });
        }

        const one = /^\/api\/v1\/runs\/([^/]+)$/.exec(url.pathname);
        if (one && req.method === 'GET') {
            st.requests.push({ method: 'GET', path: url.pathname, claims });
            const run = st.runs.get(decodeURIComponent(one[1]));
            if (!run) return json(404, { code: 'run.not_found' });
            return json(200, { run });
        }
        return json(404, { code: 'not_found', detail: 'not found' });
    });

    return {
        url: srv.url,
        state: st,
        models: st.models,
        requests: st.requests,
        close: srv.close,
    };
}

module.exports = { startAi, DEFAULT_MODELS };
