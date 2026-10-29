'use strict';
// What openvibe.design tells an agent about itself (openvibe-shared/agent-layer): /.well-known/agent.json.
// Every field is something this site really serves: the theme API proxy under /api, the /developers page that
// documents it, and the llms.txt/sitemap map. No OpenAPI document is published, so none is named; the API
// takes no token for the public catalogue and a Network session for the per-person reads.
module.exports = {
    id: 'design',
    name: 'OpenVibe.Design',
    purpose: 'Themes across the OpenVibe network: browse the public catalogue, try any theme on Live, Chat and a shop, edit its colours with contrast and colour-vision checks, and use it everywhere.',
    home: 'https://openvibe.design',
    site: 'openvibe.design',
    api: '/api',
    docs: '/developers',
    policy: {
        auth: ['none', 'Network OIDC'],
    },
};
