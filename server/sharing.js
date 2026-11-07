'use strict';
/**
 * Sharing for designs (design 2026-11-06, VISIBILITY-EVERYWHERE step 5; openvibe-sdk/share).
 *
 * A design belongs to its signed-in maker and starts Only me. Its Share sheet can name people
 * ("review this before I publish it"), or make it Everyone or Anyone with the link. The guest edit
 * key (an unsigned-in maker's secret link) keeps working exactly as before; a guest design has no
 * share row because there is no canonical subject to own it.
 *
 * The SDK owns the model: shares/share_members/share_transfers/share_access_requests/share_log and
 * the delivery queue. This file supplies Network lookups, the events outbox and notification push.
 */
const { createShares } = require('openvibe-sdk/share');
const { serviceAuth } = require('openvibe-contracts');
const { createServiceOutbox } = require('openvibe-sdk/events');

const SERVICE = 'design';
const KIND = 'design';
const AUDIENCES = ['public', 'link', 'people', 'private'];
const SHARE_EVENTS = [
    'share.granted', 'share.revoked', 'share.transfer.requested',
    'share.transfer.accepted', 'share.transfer.declined',
];
const refOf = (id) => ({ service: SERVICE, kind: KIND, id: String(id) });

/** Design's session viewer as the SDK wants it: a canonical subject object and the staff bit. */
function shareViewer(viewer) {
    if (!viewer || viewer.kind !== 'user' || !viewer.subject) return null;
    const id = String(viewer.subject);
    if (!/^(usr|gst)_[0-9A-HJKMNP-TV-Z]{26}$/.test(id)) return null;
    return { subject: { type: id.startsWith('gst_') ? 'guest' : 'user', id }, staff: false };
}

function createSharing({ db, config, log = console, fetchImpl = globalThis.fetch, now = Date.now, networkJson: networkOverride = null }) {
    const base = String(config.networkInternalUrl || config.networkUrl || '').replace(/\/+$/, '');
    const tokens = !networkOverride && config.oauth && config.oauth.clientSecret
        ? serviceAuth.createTokenClient({
            tokenUrl: `${base}/oauth/token`,
            clientId: config.oauth.clientId || 'design',
            clientSecret: config.oauth.clientSecret,
            audience: 'openvibe.network',
            scope: 'identity.subject.resolve network.notifications.push',
            fetchImpl,
        }) : null;

    async function networkJson({ path, method = 'GET', json, query } = {}) {
        if (networkOverride) return await networkOverride({ path, method, json, query });
        if (!tokens) throw new Error('Network is not configured for this service');
        const url = new URL(`${base}${path}`);
        for (const [k, v] of Object.entries(query || {})) if (v != null) url.searchParams.set(k, String(v));
        const headers = { Accept: 'application/json', ...(await tokens.authHeaders()) };
        if (json !== undefined) headers['Content-Type'] = 'application/json';
        const res = await fetchImpl(url, { method, headers, body: json === undefined ? undefined : JSON.stringify(json), signal: AbortSignal.timeout(8000) });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
            const err = new Error(`Network ${method} ${path} ${res.status}: ${(body && (body.detail || body.error)) || 'failed'}`);
            err.status = res.status;
            throw err;
        }
        return body;
    }

    const outbox = createServiceOutbox({
        db, source: SERVICE, eventsUrl: (config.events && config.events.url) || null,
        networkInternalUrl: base, clientId: config.oauth && config.oauth.clientId,
        clientSecret: config.oauth && config.oauth.clientSecret, log, now, eventTypes: SHARE_EVENTS,
    });
    outbox.start();

    /** One notification, addressed by canonical subject; it never carries a prompt or a design's HTML. */
    async function notify(n) {
        const to = n && n.to;
        if (!to || to.type !== 'user') return;
        const words = {
            'share.added': ['A design was shared with you', 'Open it on OpenVibe.Design.'],
            'share.access_requested': ['Someone asked for access to your design', 'Review the request on OpenVibe.Design.'],
            'share.transfer.requested': ['Someone wants to give you a design', 'Accept or decline it on OpenVibe.Design.'],
            'share.transfer.answered': ['A design transfer was answered', 'See what happened on OpenVibe.Design.'],
        }[n.kind] || ['Sharing on OpenVibe.Design', 'There is something new for you.'];
        try {
            await networkJson({
                path: '/internal/notifications/push', method: 'POST',
                json: {
                    subject: to.id, type: 'GENERIC', title: words[0], message: words[1],
                    service: SERVICE, url: n.ref && n.ref.id ? `${config.baseUrl}/d/${encodeURIComponent(n.ref.id)}` : config.baseUrl,
                    category: 'social',
                },
            });
        } catch (err) {
            log.warn('[Sharing] notification not sent:', err.message);
        }
    }

    const shares = createShares({
        db,
        network: { json: networkJson },
        events: {
            async publish(envelope) {
                if (!outbox.enabled) return;
                await db.tx(async (t) => { await outbox.emitIn(t, envelope); });
                await outbox.kick();
            },
        },
        notify,
    });

    async function shareOf(id) {
        return await db.maybe('SELECT * FROM shares WHERE service = $1 AND kind = $2 AND resource_id = $3', [SERVICE, KIND, String(id)]);
    }

    /** Register a signed-in maker's design Only me, in the transaction that inserted it. */
    async function register(id, owner) {
        if (!owner || !/^usr_[0-9A-HJKMNP-TV-Z]{26}$/.test(String(owner))) return null;
        try {
            return await shares.register(refOf(id), { owner_subject: { type: 'user', id: String(owner) }, audience: 'private' });
        } catch (err) {
            if (err.status === 409) return await shareOf(id);
            throw err;
        }
    }

    /** A legacy design, or one made before the sheet opened: register it Only me on first use (owner only). */
    async function ensure(id) {
        if (await shareOf(id)) return;
        const design = await db.maybe('SELECT id, owner FROM designs WHERE id = $1', [String(id)]);
        if (design && design.owner) await register(id, design.owner);
    }

    return {
        shares,
        SERVICE,
        KIND,
        AUDIENCES,
        refOf,
        shareViewer,
        outbox,
        shareOf,
        register,
        ensure,
        canView: async (viewer, id) => await shares.canView(shareViewer(viewer), refOf(id)),
        canEdit: async (viewer, id) => await shares.canEdit(shareViewer(viewer), refOf(id)),
        getWithRevision: async (viewer, id) => { await ensure(id); return await shares.getWithRevision(shareViewer(viewer), refOf(id)); },
        update: async (viewer, id, body, opts) => { await ensure(id); return await shares.update(shareViewer(viewer), refOf(id), body, opts); },
        requestAccess: async (viewer, id) => { await ensure(id); return await shares.requestAccess(shareViewer(viewer), refOf(id)); },
        dismiss: async (viewer, id, requestId) => await shares.dismiss(shareViewer(viewer), refOf(id), requestId),
        transfer: async (viewer, id, input) => await shares.transfer(shareViewer(viewer), refOf(id), input),
        accept: async (viewer, id, transferId) => await shares.accept(shareViewer(viewer), refOf(id), transferId),
        decline: async (viewer, id, transferId) => await shares.decline(shareViewer(viewer), refOf(id), transferId),
        cancel: async (viewer, id, transferId) => await shares.cancel(shareViewer(viewer), refOf(id), transferId),
        lookup: async (viewer, name) => await shares.lookup(shareViewer(viewer), name),
        sharedWithMe: async (viewer, opts) => await shares.sharedWithMe(shareViewer(viewer), { service: SERVICE, ...(opts || {}) }),
        work: async ({ flush = true } = {}) => {
            let expired = 0;
            try { expired = await shares.expireMembers(); } catch (err) { log.warn('[Sharing] expiry sweep:', err.message); }
            let sent = 0;
            if (flush) { try { sent = await shares.flush(); } catch (err) { log.warn('[Sharing] deliveries:', err.message); } }
            return { expired, sent };
        },
    };
}

/** The uniform API's describe(ref): the sheet shows the design's prompt and page to its owner. */
function describeRef(db, config) {
    return async (ref) => {
        if (ref.service !== SERVICE || ref.kind !== KIND) return {};
        const d = await db.maybe('SELECT id, prompt, owner FROM designs WHERE id = $1', [String(ref.id)]);
        if (!d) return {};
        return {
            title: String(d.prompt || 'A design').slice(0, 200),
            link: `${String(config.baseUrl || '').replace(/\/+$/, '')}/d/${encodeURIComponent(d.id)}`,
            roles: ['viewer'],
            audiences: AUDIENCES,
            transferable: !!d.owner,
        };
    };
}

module.exports = { createSharing, describeRef, shareViewer, refOf, AUDIENCES, SERVICE, KIND };
