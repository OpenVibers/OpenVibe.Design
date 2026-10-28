'use strict';
/**
 * An in-process stand-in for OpenVibe.Network: a real RS256 key pair and JWKS, /oauth/token with PKCE S256,
 * /oauth/revoke, the public theme catalogue and the person's theme routes. Every request is recorded so a test can
 * assert what was (and was not) called. setDown(true) makes every answer a 503, which is how the proxy sees a
 * Network failure without closing the socket under a test.
 */
const http = require('http');
const crypto = require('crypto');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function signJwt(claims, privateKey) {
    const input = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(claims)}`;
    return `${input}.${crypto.sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
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
                Promise.resolve(handler(req, raw, json, res)).catch((err) => json(500, { error: String(err && err.message) }));
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

const DEFAULT_THEMES = [
    { id: 'vibe', name: 'Vibe', slug: 'vibe', description: 'The default OpenVibe theme.', mode: 'dark', variables: { '--bg-primary': '#0b0f1a', '--text-primary': '#e6edf7' }, tags: ['default'], is_builtin: 1 },
    { id: 'aurora', name: 'Aurora', slug: 'aurora', description: 'A cold light over the network.', mode: 'dark', variables: { '--bg-primary': '#07131f', '--text-primary': '#dff3ff' }, tags: ['cool'] },
    { id: 'paper', name: 'Paper', slug: 'paper', description: 'A quiet light theme.', mode: 'light', variables: { '--bg-primary': '#fbfaf7', '--text-primary': '#22201d' }, tags: ['light'] },
];

async function startNetwork({ themes = DEFAULT_THEMES } = {}) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
    const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const st = {
        themes: themes.map((t) => ({ ...t })),
        users: new Map(), codes: new Map(), refresh: new Map(),
        down: false, catalogRequests: 0, requests: [], tokenRequests: [],
        catalogStatus: 200, submitStatus: 201, delayMs: 0,
    };
    let issuer = null;
    let nextUserId = 1;

    function addUser(username, { role = 'user' } = {}) {
        const u = { id: nextUserId++, subject: `usr_${crypto.randomBytes(12).toString('hex')}`, username, display_name: username, role };
        st.users.set(u.id, u);
        return u;
    }
    function userToken(u, { ttl = 3600 } = {}) {
        const now = Math.floor(Date.now() / 1000);
        return signJwt({ iss: issuer, sub: u.id, subject_id: u.subject, username: u.username, display_name: u.display_name, role: u.role, aud: ['openvibe.network'], iat: now, exp: now + ttl }, privatePem);
    }
    const bearer = (req) => {
        const h = String(req.headers.authorization || '');
        return h.startsWith('Bearer ') ? h.slice(7) : null;
    };

    const srv = await listen(async (req, raw, json) => {
        const url = new URL(req.url, 'http://x');
        const text = raw.toString('utf8');
        let body = {};
        try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
        st.requests.push({ method: req.method, path: url.pathname, authorization: req.headers.authorization || null, body: text });
        if (st.delayMs) await new Promise((r) => setTimeout(r, st.delayMs));
        if (st.down) return json(503, { error: 'Network is restarting' });

        if (url.pathname === '/api/.well-known/jwks') return json(200, { public_key: publicPem, algorithm: 'RS256' });
        if (url.pathname === '/oauth/revoke') return json(200, {});
        if (url.pathname === '/oauth/token' && req.method === 'POST') {
            const form = Object.fromEntries(new URLSearchParams(text));
            st.tokenRequests.push(form);
            if (form.client_id !== 'design' || form.client_secret !== 'design-secret') return json(401, { error: 'invalid_client', error_description: 'bad client secret' });
            if (form.grant_type === 'authorization_code') {
                const c = st.codes.get(form.code);
                if (!c) return json(400, { error: 'invalid_grant', error_description: 'unknown code' });
                st.codes.delete(form.code);
                const challenge = crypto.createHash('sha256').update(String(form.code_verifier || '')).digest('base64url');
                if (challenge !== c.challenge) return json(400, { error: 'invalid_grant', error_description: 'PKCE verification failed' });
                const rt = `rt_${crypto.randomBytes(12).toString('hex')}`;
                st.refresh.set(rt, c.user);
                return json(200, { access_token: userToken(c.user), refresh_token: rt, token_type: 'Bearer' });
            }
            if (form.grant_type === 'refresh_token') {
                const u = st.refresh.get(form.refresh_token);
                if (!u) return json(400, { error: 'invalid_grant', error_description: 'refresh token rejected' });
                st.refresh.delete(form.refresh_token);
                const rt = `rt_${crypto.randomBytes(12).toString('hex')}`;
                st.refresh.set(rt, u);
                return json(200, { access_token: userToken(u), refresh_token: rt, token_type: 'Bearer' });
            }
            if (form.grant_type === 'client_credentials') {
                // A first-party service token: audience openvibe.ai, capability ai.run.create, namespace ai.*.
                const scope = String(form.scope || '');
                const now = Math.floor(Date.now() / 1000);
                const access = signJwt({
                    iss: issuer, sub: 'svc:design', actor_type: 'service', aud: [form.audience || 'openvibe.ai'],
                    cap: scope.split(/\s+/).filter(Boolean), ns: ['ai.*'], iat: now, exp: now + 300,
                }, privatePem);
                return json(200, { access_token: access, token_type: 'Bearer', expires_in: 300, scope });
            }
            return json(400, { error: 'unsupported_grant_type' });
        }

        if (url.pathname === '/api/themes' && req.method === 'GET') {
            st.catalogRequests++;
            if (st.catalogStatus !== 200) return json(st.catalogStatus, { error: 'catalogue unavailable' });
            return json(200, { themes: st.themes });
        }
        if (url.pathname === '/api/themes/me/active' && req.method === 'GET') {
            if (!bearer(req)) return json(401, { error: 'Authentication required' });
            return json(200, { theme_id: 'vibe', custom_variables: { '--bg-primary': '#0b0f1a' }, display: null });
        }
        if (url.pathname === '/api/themes/me' && req.method === 'PUT') {
            if (!bearer(req)) return json(401, { error: 'Authentication required' });
            return json(200, { success: true, theme_id: body.theme_id, custom_variables: body.custom_variables || null, source: body.source });
        }
        if (url.pathname === '/api/themes/me/history' && req.method === 'GET') {
            if (!bearer(req)) return json(401, { error: 'Authentication required' });
            return json(200, { history: [{ id: 2, theme_id: 'aurora', created_at: '2026-10-28T00:00:00.000Z' }, { id: 1, theme_id: 'vibe', created_at: '2026-10-27T00:00:00.000Z' }] });
        }
        const restore = /^\/api\/themes\/me\/history\/(\d+)\/restore$/.exec(url.pathname);
        if (restore && req.method === 'POST') {
            if (!bearer(req)) return json(401, { error: 'Authentication required' });
            return json(200, { success: true, id: Number(restore[1]), theme_id: 'vibe' });
        }
        if (url.pathname === '/api/themes' && req.method === 'POST') {
            if (!bearer(req)) return json(401, { error: 'Authentication required' });
            const status = body.slug === 'taken' ? 422 : st.submitStatus;
            if (status !== 201) return json(status, { error: 'Theme rejected', code: 'theme.invalid_variables', errors: ['--bg-primary must be a colour'] });
            return json(201, { theme: { id: `community-${body.slug}`, ...body }, review: 'pending' });
        }
        const one = /^\/api\/themes\/([^/]+)$/.exec(url.pathname);
        if (one && req.method === 'GET') {
            const t = st.themes.find((x) => x.id === decodeURIComponent(one[1]) || x.slug === decodeURIComponent(one[1]));
            if (!t) return json(404, { error: 'Theme not found' });
            return json(200, { theme: t });
        }
        return json(404, { error: 'not found' });
    });
    issuer = srv.url;

    return {
        url: srv.url, publicPem, privatePem, state: st,
        themes: st.themes, requests: st.requests, tokenRequests: st.tokenRequests,
        addUser, userToken,
        issueCode(user, challenge) { const code = `code_${crypto.randomBytes(8).toString('hex')}`; st.codes.set(code, { user, challenge }); return code; },
        setDown(v) { st.down = Boolean(v); },
        setCatalogStatus(v) { st.catalogStatus = v; },
        setDelay(ms) { st.delayMs = ms; },
        close: srv.close,
    };
}

module.exports = { startNetwork, signJwt, DEFAULT_THEMES };
