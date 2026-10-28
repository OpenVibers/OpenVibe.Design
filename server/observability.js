'use strict';

/**
 * Truthful readiness for GET /api/ready (openvibe-shared/ready). The database is required now that the Arena
 * keeps rounds, outputs and votes; without it the Arena cannot answer and a restart should be visible.
 *
 *   db             required  PostgreSQL/PGlite answers
 *   network        optional  OpenVibe.Network answers its theme catalogue
 *   network_jwks   optional  the Network signing key is loaded; without it nobody can sign in
 *   oauth_client   optional  OV_OAUTH_CLIENT_SECRET is set (sign-in and AI tokens need it)
 *
 * If only an optional check fails the answer is 200 with status "degraded"; a required check failing is 503.
 */
const { createReadiness } = require('openvibe-shared/ready');

function createServiceReadiness({ s, config, catalog, keys = null, release = null }) {
    return createReadiness({
        service: 'design',
        release,
        checks: [
            {
                name: 'db',
                required: true,
                check: async () => {
                    const r = await s.db.ready();
                    return r.ok ? { ok: true, detail: r.detail } : r.error;
                },
            },
            {
                name: 'network',
                required: false,
                check: async () => {
                    const list = await catalog.list({ fresh: true });
                    return list && Array.isArray(list.themes) ? true : 'OpenVibe.Network did not answer';
                },
            },
            {
                name: 'network_jwks',
                required: false,
                check: () => (keys && keys.loaded() ? true : 'Network signing key not loaded yet: sign-in is unavailable'),
            },
            { name: 'oauth_client', required: false, check: () => (config.oauth.clientSecret ? true : 'OV_OAUTH_CLIENT_SECRET unset: sign-in cannot complete') },
        ],
    });
}

module.exports = { createServiceReadiness };
