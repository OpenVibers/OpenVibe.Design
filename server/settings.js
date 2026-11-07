'use strict';

/**
 * Owner settings (D11) for OpenVibe.Design: the publishing accounts in `design.publishing`.
 *
 * The Figma token is read through figmaToken() when a Figma import is made: the value the owner
 * entered in the admin panel wins, FIGMA_TOKEN is the fallback. The token is sealed by the shared
 * store under OV_CONFIG_KEKS and is write-only through
 * /internal/config/design.publishing/secrets/figma_token; summaries, history and logs carry markers.
 * Network's admin proxy reaches this namespace with `design.config.manage`, acting for the owner
 * (X-OV-Subject); a secret change needs X-OV-Fresh: 1. The test route makes one cheap authenticated
 * Figma read and answers ok or failed in one line, never echoing the token.
 */
const { createConfigStore, adminRoutes } = require('openvibe-shared/config');

const SERVICE = 'design';
const NAMESPACE = 'design.publishing';
const BASE_PATH = '/internal/config';
const GROUP = 'Design and publishing';

const SCHEMA = Object.freeze({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'Design and publishing',
    description: 'The accounts Design publishes and imports with. A token that is not set turns its feature off; the rest of Design keeps working.',
    type: 'object',
    additionalProperties: false,
    properties: {
        figma_token: {
            type: 'string', title: 'Figma personal access token', 'x-group': GROUP,
            description: 'A Figma personal access token with read access to the files Design imports. It lets a person bring a Figma design into Design; without it the Figma import stays hidden.',
            'x-owner-input': {
                group: 'design-publishing',
                unlocks: 'Figma files can be imported into Design and their components and tokens read.',
                get_it_at: 'https://www.figma.com/settings',
                get_it_how: 'Open Settings, Security, Personal access tokens, create a token with read access to the files, then paste it here.',
                test: true,
            },
            'x-required-for': 'Figma import',
        },
    },
});

const SECRETS = new Set(['figma_token']);
const ACTIVE = { settings: null };

function createSettings({ db, env = process.env, log = console, fetchImpl = globalThis.fetch, probes = null } = {}) {
    let store = null;
    const ready = createConfigStore({
        db, service: SERVICE, namespace: NAMESPACE, schema: SCHEMA,
        classify: (key) => (SECRETS.has(key) ? 'secret' : 'internal'),
        env, log,
    }).then((s) => { store = s; return s; });

    const values = () => (store ? store.get() : {});

    function valueOf(key, envName, fallback = '') {
        const v = values()[key];
        if (v !== undefined && v !== null && v !== '') return v;
        const e = envName ? env[envName] : undefined;
        return e !== undefined && e !== null && e !== '' ? e : fallback;
    }

    /** The Figma token, read when a Figma import is made. */
    function figmaToken() { return valueOf('figma_token', 'FIGMA_TOKEN', ''); }

    async function test(key) {
        if (key !== 'figma_token') return { ok: false, detail: 'That setting has no test.' };
        const token = figmaToken();
        if (!token) return { ok: false, detail: 'Figma is not configured: paste the personal access token first.' };
        const probe = probes && typeof probes.figma === 'function'
            ? probes.figma
            : async ({ token: value }) => {
                const r = await fetchImpl('https://api.figma.com/v1/me', { headers: { accept: 'application/json', 'x-figma-token': value } });
                let body = {};
                try { body = await r.json(); } catch { /* not JSON */ }
                if (!r.ok) throw new Error(`HTTP ${r.status}${body && body.message ? `: ${body.message}` : ''}`);
            };
        try {
            await probe({ token });
            return { ok: true, detail: 'ok — Figma answered the account read with this token.' };
        } catch (err) {
            const words = String((err && err.message) || 'the request failed').split(/\s+/).join(' ').slice(0, 160);
            return { ok: false, detail: `failed — Figma said: ${words.split(token).join('[redacted]')}` };
        }
    }

    function mount(app, { guard, log: appLog = log } = {}) {
        if (!store) throw new Error('createSettings: await ready before mount()');
        const routes = adminRoutes([store], {
            basePath: BASE_PATH,
            requireAdmin: guard,
            actor: (req) => {
                const id = String(req.get('x-ov-subject') || '').trim();
                return /^usr_[0-9A-HJKMNP-TV-Z]{26}$/.test(id) ? { type: 'user', id } : null;
            },
            requireFresh: (req) => String(req.get('x-ov-fresh') || '') === '1',
            log: appLog,
        });
        // The owner's test route is mounted in front of the store's dispatcher: openvibe-shared 4.125.0 gave
        // adminRoutes a test route of its own, and the dispatcher answers it first (it wants an acting subject,
        // this one the service-token capability). 2026-11-07, the openvibe-shared v4.126.0 pin round.
        app.post(`${BASE_PATH}/:namespace/test/:key`, guard, async (req, res) => {
            if (req.params.namespace !== NAMESPACE) return res.status(404).json({ error: 'no such configuration namespace' });
            let key = String(req.params.key || '');
            try { key = decodeURIComponent(key); } catch { /* keep it as it is */ }
            if (!SCHEMA.properties[key]) return res.status(404).json({ error: 'no such setting' });
            try {
                const out = await test(key);
                return res.status(200).json({ ok: Boolean(out.ok), detail: String(out.detail).replace(/\s+/g, ' ').slice(0, 200) });
            } catch (err) {
                appLog.warn(`[config] ${NAMESPACE}: the test for ${key} failed: ${String((err && err.message) || err).slice(0, 160)}`);
                return res.status(200).json({ ok: false, detail: 'failed — the test did not finish. The service log has the reason.' });
            }
        });
        app.use(routes.handle);
        return routes;
    }

    return { namespace: NAMESPACE, schema: SCHEMA, ready, value: valueOf, get: values, figmaToken, test, mount };
}

function activate(settings) { ACTIVE.settings = settings; return settings; }
function figmaToken() {
    if (ACTIVE.settings) return ACTIVE.settings.figmaToken();
    return process.env.FIGMA_TOKEN || '';
}

module.exports = { SERVICE, NAMESPACE, SCHEMA, SECRETS, createSettings, activate, figmaToken };
