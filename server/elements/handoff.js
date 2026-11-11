'use strict';

/**
 * Adding a made element to the maker's Live channel through Live's own element library. It carries the
 * person's own Network token, never a service token: the action is theirs, and Live checks it as them. The
 * document is already validated and free; nothing here sets a price. Failures are plain text (never a token,
 * never a response body) so the canvas can say what happened. The gallery itself is here on Design.
 */
function createElementHandoff({ config = {}, fetchImpl = globalThis.fetch, log = console } = {}) {
    const live = config.live || {};

    async function call(name, url, token, body, timeoutMs) {
        if (!token) {
            const err = new Error('Sign in to add an element to your channel or publish it.');
            err.status = 401;
            err.code = 'design.sign_in';
            throw err;
        }
        let res;
        try {
            res = await fetchImpl(url, {
                method: 'POST',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(timeoutMs || 15_000),
            });
        } catch (err) {
            const out = new Error(`${name} could not be reached.`);
            out.status = 502;
            out.code = 'design.handoff_unreachable';
            throw out;
        }
        const doc = await res.json().catch(() => null);
        if (!res.ok) {
            const detail = doc && (doc.detail || doc.message || doc.error);
            const out = new Error(`${name} refused it${detail ? `: ${String(detail).slice(0, 240)}` : ` (${res.status})`}.`);
            out.status = res.status === 401 || res.status === 403 ? res.status : 502;
            out.code = 'design.handoff_refused';
            throw out;
        }
        return doc || {};
    }

    /** Add one validated element to the person's own Live element library. */
    async function addToChannel({ element, token }) {
        const base = String(live.url || '').replace(/\/+$/, '');
        if (!base) throw Object.assign(new Error('Live is not configured, so the element cannot be added.'), { status: 503, code: 'design.live_unconfigured' });
        const out = await call('OpenVibe.Live', `${base}${live.elementsPath || '/api/me/elements'}`, token, element, live.timeoutMs);
        const id = out.id || (out.element && out.element.id) || null;
        return { id, url: out.url || (id ? `${base}/elements/${encodeURIComponent(id)}` : `${base}/elements`), name: element.name };
    }

    return { addToChannel };
}

module.exports = { createElementHandoff };
