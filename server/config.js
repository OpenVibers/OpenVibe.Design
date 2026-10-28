'use strict';

/**
 * OpenVibe.Design configuration. Every value comes from the environment (production:
 * /etc/openvibe/design.env, see .env.example). Only environment variable NAMES appear in code and docs; secrets are
 * never logged.
 *
 * load(env) is pure so tests can build a config without touching process.env.
 */
require('dotenv').config();

const trim = (s) => String(s || '').replace(/\/+$/, '');
const int = (v, def) => (Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : def);

function load(env = process.env) {
    const nodeEnv = env.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    const port = int(env.PORT, 5090);
    const baseUrl = trim(env.BASE_URL || (isProduction ? 'https://openvibe.design' : `http://localhost:${port}`));
    // The Network's public origin is where a browser is sent to authorize. Its internal origin is where this
    // service exchanges the code, fetches the JWKS and proxies the theme API; neither a person's browser nor their
    // token ever talks to it directly.
    const networkPublicUrl = trim(env.OV_NETWORK_URL || 'https://openvibe.network');
    const networkInternalUrl = trim(env.OV_NETWORK_INTERNAL_URL || 'http://127.0.0.1:4000');

    return {
        service: 'design',
        name: 'OpenVibe.Design',
        port,
        host: env.HOST || '127.0.0.1',
        nodeEnv,
        isProduction,
        baseUrl,
        trustProxy: env.TRUST_PROXY != null ? Number(env.TRUST_PROXY) : 2,

        // The theme API proxy (server/http/api.js): every call goes to the Network's /api/themes. `networkUrl`
        // is the internal origin the proxy and the token exchange use; `networkPublicUrl` is the browser's.
        networkUrl: networkInternalUrl,
        networkPublicUrl,
        networkInternalUrl,
        networkIssuer: trim(env.OV_NETWORK_ISSUER || networkPublicUrl),
        themeCacheMs: Math.max(0, int(env.DESIGN_THEME_CACHE_MS, 5 * 60_000)),
        timeoutMs: Math.max(200, int(env.DESIGN_UPSTREAM_TIMEOUT_MS, 8000)),

        // OpenVibe.Network: SSO (OAuth2 authorization server with PKCE) and its JWKS.
        oauth: {
            clientId: env.OV_OAUTH_CLIENT_ID || 'design',
            clientSecret: env.OV_OAUTH_CLIENT_SECRET || '',
            redirectUri: env.OV_OAUTH_REDIRECT_URI || `${baseUrl}/auth/callback`,
            scope: 'profile',
            sessionAudience: env.OV_SESSION_AUDIENCE || 'openvibe.network',
        },
        cookies: { secure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProduction },

        // One per-IP budget for /api and /auth (express-rate-limit, one 60 s window).
        rateLimitPerMinute: Math.max(1, int(env.DESIGN_RATE_LIMIT_PER_MIN, 120)),
    };
}

module.exports = { load };
