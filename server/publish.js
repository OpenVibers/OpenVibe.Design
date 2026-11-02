'use strict';

/**
 * Publish a design on openvibe.space (open item D8): the working frame becomes a static site at
 * <name>.openvibe.space, in the person's own Space project "Designs", deployed and live.
 *
 * Design calls Space's API with its own Network client-credentials token (audience openvibe.space; Network grants
 * space.site.manage and space.deploy.create) and names the person it acts for with X-OV-Subject, so the project and the
 * site are the person's, under their own Space quotas and visible on their Space dashboard. Publishing again uploads
 * the frame as it is now to the same site (a new deploy; Space keeps the earlier ones for a rollback).
 *
 *   publish({ design, html, subject, name }) → { url, siteId, deployId, created }
 *   NAME_RE, slugFor(prompt)
 *
 * The page is exactly the frame's document (designs.js wrap(): sanitized, no scripts, the theme's tokens inlined), as
 * index.html. Nothing else is uploaded.
 */

const { serviceAuth } = require('openvibe-contracts');

// Space's site names: 3–40 of a–z, 0–9 and single hyphens (Space server/domain/sites.js NAME_RE).
const NAME_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,39}$/;
const PROJECT_NAME = 'Designs';

class PublishError extends Error {
    constructor(status, code, detail) { super(detail); this.status = status; this.code = code; this.detail = detail; }
}

/** A site name from the design's prompt: its first words, lowercased, hyphenated, then a short tail so it is free. */
function slugFor(prompt, tail = '') {
    const words = String(prompt || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 4).join('-').slice(0, 30).replace(/-+$/, '');
    const base = words.length >= 3 ? words : `design${words ? `-${words}` : ''}`;
    return tail ? `${base}-${tail}`.slice(0, 40).replace(/-+$/, '') : base;
}

function createPublisher({ config, fetchImpl = globalThis.fetch, log = console } = {}) {
    const space = config.space || {};
    const tokenClient = config.oauth && config.oauth.clientSecret && space.url
        ? serviceAuth.createTokenClient({
            tokenUrl: `${config.networkInternalUrl || config.networkUrl}/oauth/token`,
            clientId: config.oauth.clientId,
            clientSecret: config.oauth.clientSecret,
            audience: space.audience || 'openvibe.space',
            scope: space.scope || 'space.site.manage space.deploy.create',
            fetchImpl,
        })
        : null;
    const enabled = Boolean(tokenClient);

    async function call(subject, method, path, { json, form } = {}) {
        const headers = { Accept: 'application/json', 'X-OV-Subject': subject, ...(await tokenClient.authHeaders()) };
        if (json !== undefined) headers['Content-Type'] = 'application/json';
        let res;
        try {
            res = await fetchImpl(`${space.url.replace(/\/+$/, '')}/api/v1${path}`, {
                method, headers, body: json !== undefined ? JSON.stringify(json) : form, signal: AbortSignal.timeout(space.timeoutMs || 30_000),
            });
        } catch (err) {
            throw new PublishError(503, 'publish.unavailable', 'openvibe.space did not answer. Try again in a moment.');
        }
        const body = await res.json().catch(() => ({}));
        if (res.status === 401) tokenClient.invalidate();
        return { status: res.status, body };
    }
    const problem = (r, what) => {
        const detail = (r.body && (r.body.detail || r.body.title || r.body.message)) || `openvibe.space answered ${r.status}`;
        log.warn(`[Design] publish: ${what} ${r.status} ${r.body && r.body.code ? r.body.code : ''}`);
        return new PublishError(r.status >= 500 ? 502 : r.status, (r.body && r.body.code) || 'publish.refused', `${what}: ${detail}`);
    };

    /** The person's "Designs" project on Space, made the first time. */
    async function project(subject) {
        const list = await call(subject, 'GET', '/projects');
        if (list.status !== 200) throw problem(list, 'Reading your Space projects');
        const found = (list.body.projects || []).find((p) => p && p.name === PROJECT_NAME && p.owner === subject && p.environment !== 'sandbox');
        if (found) return found;
        const made = await call(subject, 'POST', '/projects', { json: { name: PROJECT_NAME } });
        if (made.status !== 201) throw problem(made, 'Making your Designs project on Space');
        return made.body.project;
    }

    /** The design's site: the one it was published to before, or a new one (the name asked for, else from the prompt). */
    async function site(subject, design, name) {
        if (design.space_site_id) {
            const had = await call(subject, 'GET', `/sites/${encodeURIComponent(design.space_site_id)}`);
            if (had.status === 200 && had.body.site) return { site: had.body.site, created: false };
        }
        const p = await project(subject);
        const wanted = name ? String(name).trim().toLowerCase() : '';
        if (wanted && !NAME_RE.test(wanted)) throw new PublishError(422, 'publish.invalid_name', 'A site name is 3–40 of a–z, 0–9 and single hyphens.');
        const tries = wanted ? [wanted] : [slugFor(design.prompt), slugFor(design.prompt, design.id.slice(-4).toLowerCase().replace(/[^a-z0-9]/g, 'x')), slugFor(design.prompt, Math.random().toString(36).slice(2, 6))];
        for (const n of tries) {
            const made = await call(subject, 'POST', `/projects/${encodeURIComponent(p.id)}/sites`, { json: { name: n } });
            if (made.status === 201) return { site: made.body.site, created: true };
            if (made.status === 409 && !wanted) continue;
            if (made.status === 409) throw new PublishError(409, 'publish.name_taken', `${wanted}.openvibe.space is taken. Pick another name.`);
            throw problem(made, 'Making the site on Space');
        }
        throw new PublishError(409, 'publish.name_taken', 'Every name tried was taken. Type a name for the site.');
    }

    async function publish({ design, html, subject, name = '' }) {
        if (!enabled) throw new PublishError(503, 'publish.off', 'Publishing to openvibe.space is not set up on this server.');
        if (!subject || !/^usr_/.test(String(subject))) throw new PublishError(401, 'auth.required', 'Sign in to publish a design on openvibe.space.');
        if (!html) throw new PublishError(409, 'publish.no_frame', 'Pick a frame first: the working frame is what gets published.');
        const { site: s, created } = await site(subject, design, name);
        const form = new FormData();
        form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
        form.append('activate', '1');
        const dep = await call(subject, 'POST', `/sites/${encodeURIComponent(s.id)}/deploys?activate=1`, { form });
        if (dep.status !== 201) throw problem(dep, 'Uploading the page to Space');
        return { url: dep.body.url || `https://${s.name}.openvibe.space`, siteId: s.id, siteName: s.name, deployId: dep.body.deploy && dep.body.deploy.id, created };
    }

    return { publish, enabled };
}

module.exports = { createPublisher, slugFor, NAME_RE, PublishError, PROJECT_NAME };
