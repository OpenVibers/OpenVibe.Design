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

async function startAi({ models = DEFAULT_MODELS, htmlFor = null, costUsd = 0.0012, ms = 321, tokensIn = 120, tokensOut = 480, failModels = [], asyncMode = false, routesStatus = 200, deepDive = null } = {}) {
    const st = {
        models: models.map((m) => ({ ...m })),
        requests: [], routeRequests: 0, lastAuth: null, tokenClaims: null,
        costUsd, ms, tokensIn, tokensOut,
        failModels: new Set(failModels), asyncMode, routesStatus,
        delayMs: 0, runCount: 0, runs: new Map(), htmlFor: null,
        deepDiveReports: [], deepDives: new Map(), deepDiveOptions: deepDive && deepDive.options ? deepDive.options : null, deepDiveReport: deepDive && deepDive.report ? deepDive.report : null,
        deepDiveStatus: deepDive && deepDive.status ? deepDive.status : 'succeeded', deepDiveReads: 0,
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

    const srv = await listen(async (req, raw, json, res) => {
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

        // A deep dive (workflow design.deep_dive): the run API when the client asks there, and the feature's own
        // door as a second path. The report is the run's output; a test can make the first read still running.
        if ((url.pathname === '/api/v1/runs' || url.pathname === '/api/v1/deep-dives') && req.method === 'POST' &&
            (body.workflow === 'design.deep_dive' || url.pathname === '/api/v1/deep-dives')) {
            st.requests.push({ method: 'POST', path: url.pathname, query: Object.fromEntries(url.searchParams), body, claims });
            const id = `run_dd_${crypto.randomBytes(6).toString('hex')}`;
            const input = body.input || body;
            const report = typeof st.deepDiveOptions === 'function' ? st.deepDiveOptions(input) : st.deepDiveReport;
            const run = { id, status: 'running', workflow: { key: 'design.deep_dive', version: 1 }, input,
                on_behalf_of: body.on_behalf_of || null, target: body.target || null, output: null, created_at: new Date().toISOString() };
            st.deepDives.set(id, { run, report });
            st.deepDiveReports.push(report);
            return json(202, { run });
        }
        if (url.pathname === '/api/v1/deep-dives/options' && req.method === 'GET') {
            const options = st.deepDiveOptions && st.deepDiveOptions.depths ? st.deepDiveOptions : { depths: [] };
            return json(200, options);
        }
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

        const shot = /^\/api\/v1\/deep-dives\/([^/]+)\/shots\/([^/]+)$/.exec(url.pathname);
        if (shot && req.method === 'GET') {
            st.requests.push({ method: 'GET', path: url.pathname, claims });
            const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64');
            st.lastShot = { path: url.pathname, status: 200 };
            res.statusCode = 200;
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'private, no-store');
            res.end(png);
            return;
        }
        const one = /^\/api\/v1\/runs\/([^/]+)$/.exec(url.pathname);
        if (one && req.method === 'GET') {
            st.requests.push({ method: 'GET', path: url.pathname, claims });
            const id = decodeURIComponent(one[1]);
            const dive = st.deepDives.get(id);
            if (dive) {
                st.deepDiveReads++;
                const done = st.deepDiveStatus === 'succeeded' || st.deepDiveReads > 1;
                const run = done
                    ? { ...dive.run, status: st.deepDiveStatus, output: dive.report, usage: { cost_usd: 0.25, tokens_in: 100, tokens_out: 200 } }
                    : dive.run;
                return json(200, { run });
            }
            const run = st.runs.get(id);
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
