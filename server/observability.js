'use strict';

/**
 * Truthful readiness for GET /api/ready (openvibe-shared/ready). There is no database: the service is stateless.
 *
 *   network        optional  OpenVibe.Network answers its theme catalogue
 *   network_jwks   optional  the Network signing key is loaded; without it nobody can sign in
 *   oauth_client   optional  OV_OAUTH_CLIENT_SECRET is set (sign-in needs it)
 *
 * No check is required: if Network does not answer, the process still serves the pages and the crawl artifacts, so
 * the answer is 200 with status "degraded" — never 503 (the same rule OpenVibe.Domains uses for its two upstreams).
 */
const { createReadiness } = require('openvibe-shared/ready');

function createServiceReadiness({ config, catalog, keys = null, release = null }) {
    return createReadiness({
        service: 'design',
        release,
        checks: [
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
