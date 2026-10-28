'use strict';

/**
 * The public theme catalogue from OpenVibe.Network, cached in this process for five minutes.
 *
 * GET /api/themes is public and is asked on every page and by the sitemap, so one answer serves all of them until
 * it is five minutes old. A failure is never cached: the next request asks again, and the page degrades honestly.
 * The API proxy and the pages share this one client (server/app.js puts it in ctx).
 */
function createThemeCatalog({ config, fetchImpl = globalThis.fetch, log = console, now = () => Date.now() }) {
    let cached = null;

    async function request(path, { method = 'GET', token = null, body, timeoutMs = config.timeoutMs || 8000 } = {}) {
        const headers = { Accept: 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        let res;
        try {
            res = await fetchImpl(`${config.networkUrl}/api/themes${path}`, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
                // A person's token is in the header only: it is never logged, and a redirect would not carry it to
                // another origin (fetch drops Authorization across one).
                signal: AbortSignal.timeout(timeoutMs),
            });
        } catch (err) {
            throw Object.assign(new Error('OpenVibe.Network did not answer'), {
                status: 502,
                error: err && err.name === 'TimeoutError' ? 'timeout' : 'unreachable',
            });
        }
        const text = await res.text().catch(() => '');
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch { /* not JSON: passed through as text */ }
        return {
            status: res.status,
            ok: res.ok,
            data,
            text,
            contentType: res.headers.get('content-type') || (data ? 'application/json' : 'text/plain'),
        };
    }

    /** The public catalogue, `{ themes: [...] }`, from memory when it is under five minutes old. */
    async function list({ fresh = false } = {}) {
        const cacheMs = config.themeCacheMs == null ? 5 * 60_000 : config.themeCacheMs;
        if (!fresh && cached && now() - cached.at < cacheMs) return cached.value;
        const r = await request('');
        if (!r.ok) throw Object.assign(new Error(`theme catalogue ${r.status}`), { status: r.status, response: r });
        if (!r.data || !Array.isArray(r.data.themes)) {
            throw Object.assign(new Error('theme catalogue answered without a themes list'), { status: 502 });
        }
        const value = { themes: r.data.themes };
        cached = { at: now(), value };
        return value;
    }

    /** One theme, as Network answers it ({ status, ok, data, text, contentType }). */
    async function get(idOrSlug, { token = null } = {}) {
        return request(`/${encodeURIComponent(String(idOrSlug || ''))}`, { token });
    }

    function clear() { cached = null; }

    return { request, list, get, clear, get cached() { return cached; } };
}

module.exports = { createThemeCatalog };
