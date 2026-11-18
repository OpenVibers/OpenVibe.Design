'use strict';
/**
 * Watch mode (plan §AD.25 item 12, design CI; the owner, 2026-11-17: "Interconnect openvibe.vision with openvibe.design
 * … analyze interfaces and designs and improve and critique"). Once a day every OpenVibe site's home page is held to
 * the same page audit the rooms run before their reviewers (server/review/page-audit.js): its markup against the
 * checklist and the register. The latest findings are kept per site, with the high ones that are new since the check
 * before, so a regression shows the day it shipped.
 *
 *   createWatch({ db, networkUrl, fetchImpl?, readPage?, now?, log? })
 *     → { tick(), list(), start(), stop() }
 *   tick(): one claimed pass (a day apart) over the Network frame's sites; list(): the latest row a site, worst first
 *
 * The pages are read through Design's own guarded reader (server/create/egress.js: https, public addresses, checked
 * redirects, capped), one at a time; the site list is the Network frame's (https origins only).
 */
const crypto = require('crypto');
const { auditHtml } = require('./page-audit');

const DAY = 24 * 60 * 60 * 1000;
const CLAIM = 30 * 60 * 1000;
const MAX_SITES = 80;
const RANK = { high: 0, medium: 1, low: 2 };

function createWatch({ db, networkUrl = 'https://openvibe.network', fetchImpl = globalThis.fetch, readPage = null, now = () => Date.now(), log = console } = {}) {
    let timer = null;
    let running = false;
    const read = readPage || ((url) => require('../create/egress').fetchPageHtml(url, { timeoutMs: 15000 }));

    async function sites() {
        const r = await fetchImpl(`${String(networkUrl).replace(/\/+$/, '')}/api/frame`, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(10000) });
        if (!r.ok) throw new Error(`the Network frame answered ${r.status}`);
        const frame = await r.json();
        const origins = new Set();
        for (const x of (frame && frame.nav) || []) {
            try { const u = new URL(x && x.url); if (u.protocol === 'https:') origins.add(u.origin); } catch { /* not a link */ }
        }
        return [...origins].sort().slice(0, MAX_SITES);
    }

    async function checkOne(origin, time) {
        const host = new URL(origin).host;
        const before = await db.maybe('SELECT findings, checked_at FROM design_watch WHERE host = $1', [host]);
        let row;
        try {
            const page = await read(`${origin}/`);
            const a = auditHtml(page.html, { url: page.url });
            const findings = a.findings.map((f) => ({ id: f.id, rule: f.rule, severity: f.severity, count: f.count, says: f.says, fix: f.fix, examples: (f.examples || []).slice(0, 3) }));
            const hadHigh = new Set(((before && before.findings) || []).filter((f) => f.severity === 'high').map((f) => f.id));
            const newHigh = before ? findings.filter((f) => f.severity === 'high' && !hadHigh.has(f.id)).map((f) => f.id) : [];
            const n = (s) => findings.filter((f) => f.severity === s).length;
            row = { url: a.url || `${origin}/`, ok: true, error: null, title: String(a.title || '').slice(0, 200), findings, high: n('high'), medium: n('medium'), low: n('low'), newHigh };
        } catch (err) {
            row = { url: `${origin}/`, ok: false, error: String((err && (err.detail || err.message)) || err).slice(0, 300), title: '', findings: [], high: 0, medium: 0, low: 0, newHigh: [] };
        }
        await db.exec(`INSERT INTO design_watch (host, url, checked_at, ok, error, title, findings, high, medium, low, new_high, previous_at)
            VALUES ($1, $2, $3::timestamptz, $4, $5, $6, $7::jsonb, $8, $9, $10, $11::jsonb, $12::timestamptz)
            ON CONFLICT (host) DO UPDATE SET url = EXCLUDED.url, checked_at = EXCLUDED.checked_at, ok = EXCLUDED.ok, error = EXCLUDED.error, title = EXCLUDED.title,
                findings = EXCLUDED.findings, high = EXCLUDED.high, medium = EXCLUDED.medium, low = EXCLUDED.low, new_high = EXCLUDED.new_high, previous_at = EXCLUDED.previous_at`,
        [host, row.url, new Date(time).toISOString(), row.ok, row.error, row.title, JSON.stringify(row.findings), row.high, row.medium, row.low, JSON.stringify(row.newHigh), before ? new Date(before.checked_at).toISOString() : null]);
        return { host, ...row };
    }

    async function tick() {
        if (running) return false;
        running = true;
        const time = now();
        const claimId = crypto.randomUUID();
        try {
            const claim = await db.maybe(`UPDATE design_watch_state SET claim_id = $1, claimed_until = $2::timestamptz
                WHERE id = 1 AND (claimed_until IS NULL OR claimed_until <= $3::timestamptz)
                AND (last_success_at IS NULL OR last_success_at <= $4::timestamptz) RETURNING id`,
            [claimId, new Date(time + CLAIM).toISOString(), new Date(time).toISOString(), new Date(time - DAY).toISOString()]);
            if (!claim) return false;
            try {
                const out = [];
                for (const origin of await sites()) out.push(await checkOne(origin, time));
                await db.exec('UPDATE design_watch_state SET last_success_at = $1::timestamptz, claimed_until = NULL, claim_id = NULL WHERE id = 1 AND claim_id = $2', [new Date(time).toISOString(), claimId]);
                const regressed = out.filter((x) => x.newHigh.length);
                if (regressed.length && log && log.warn) log.warn(`[OpenVibe.Design] watch: new high findings on ${regressed.map((x) => `${x.host} (${x.newHigh.join(', ')})`).join('; ')}`);
                return out;
            } catch (err) {
                await db.exec('UPDATE design_watch_state SET claimed_until = NULL, claim_id = NULL WHERE id = 1 AND claim_id = $1', [claimId]);
                throw err;
            }
        } finally { running = false; }
    }

    async function list() {
        const rows = await db.many('SELECT host, url, checked_at, ok, error, title, findings, high, medium, low, new_high, previous_at FROM design_watch ORDER BY host');
        return rows.map((r) => ({ host: r.host, url: r.url, checked_at: new Date(r.checked_at).toISOString(), ok: r.ok, error: r.error, title: r.title,
            findings: (r.findings || []).sort((a, b) => (RANK[a.severity] ?? 3) - (RANK[b.severity] ?? 3)), high: r.high, medium: r.medium, low: r.low,
            new_high: r.new_high || [], previous_at: r.previous_at ? new Date(r.previous_at).toISOString() : null }))
            .sort((a, b) => (b.new_high.length - a.new_high.length) || (b.high - a.high) || (b.medium - a.medium) || a.host.localeCompare(b.host));
    }

    function start() {
        if (timer) return;
        const run = () => tick().catch((e) => log.warn('[OpenVibe.Design] watch:', e.message));
        setTimeout(run, 5 * 60 * 1000).unref?.();   // after the boot settles
        timer = setInterval(run, 60 * 60 * 1000);
        timer.unref?.();
    }
    function stop() { if (timer) clearInterval(timer); timer = null; }

    return { tick, list, start, stop };
}

module.exports = { createWatch };
