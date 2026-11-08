'use strict';

const crypto = require('node:crypto');
const seed = require('./seed.json');

const WEEK = 7 * 24 * 60 * 60 * 1000;
const CLAIM = 10 * 60 * 1000;
const ALLOWED = new Set(['OFL-1.1', 'Apache-2.0', 'UFL-1.0']);
const CDN = /^https:\/\/cdn\.jsdelivr\.net\/fontsource\/fonts\/[a-z0-9-]+@[0-9][a-z0-9.-]*\/[a-z0-9-]+\.woff2$/;
const IDS = seed.map(f => f.id);

function validFont(f) {
    return f && /^[a-z0-9-]+$/.test(f.id) && typeof f.family === 'string' && /^[A-Za-z0-9 .'-]{1,100}$/.test(f.family)
        && typeof f.designer === 'string' && f.designer.length > 0
        && ALLOWED.has(f.license) && /^https:\/\/github\.com\/google\/fonts\/tree\/main\/(ofl|apache|ufl)\/[a-z0-9]+$/.test(f.license_url)
        && /^https:\/\//.test(f.source) && typeof f.version === 'string'
        && Array.isArray(f.weights) && f.weights.every(w => Number.isInteger(w) && w >= 100 && w <= 900)
        && Array.isArray(f.styles) && f.styles.every(s => ['normal', 'italic'].includes(s))
        && Array.isArray(f.subsets) && f.subsets.every(s => /^[a-z0-9-]+$/.test(s))
        && f.files && Object.keys(f.files).length > 0 && Object.values(f.files).every(url => CDN.test(url));
}

function due(state, now) {
    if (state.claimed_until && new Date(state.claimed_until).getTime() > now) return false;
    return !state.last_success_at || now - new Date(state.last_success_at).getTime() >= WEEK;
}

function profile(f) {
    const classic = ['serif', 'display', 'handwriting'].includes(f.category) || ['lato', 'oswald', 'josefin-sans', 'ubuntu'].includes(f.id);
    const short = ['serif', 'display', 'handwriting'].includes(f.category) || ['raleway', 'oswald', 'abril-fatface'].includes(f.id);
    return { era: classic ? 'classic' : 'modern', xHeight: short ? 'low' : 'high' };
}

function pairings(f, all) {
    const a = profile(f);
    const candidates = all.filter(g => g.id !== f.id).map(g => {
        const b = profile(g);
        const category = f.category !== g.category;
        const height = a.xHeight !== b.xHeight;
        const era = a.era !== b.era;
        return { family: g.family, id: g.id, category: g.category, score: (category ? 4 : 0) + (height ? 2 : 0) + (era ? 1 : 0),
            reason: [category && `contrasting ${g.category} and ${f.category} forms`, height && 'different x-height', era && 'classic and modern character'].filter(Boolean).join('; ') || 'a quieter companion' };
    }).sort((x, y) => y.score - x.score || x.family.localeCompare(y.family));
    const chosen = [];
    for (const candidate of candidates) if (!chosen.some(p => p.category === candidate.category)) {
        chosen.push(candidate);
        if (chosen.length === 3) break;
    }
    for (const candidate of candidates) if (chosen.length < 3 && !chosen.includes(candidate)) chosen.push(candidate);
    return chosen.map(({ score, category, ...p }) => p);
}

function createFontCatalog({ db, fetchImpl = fetch, now = () => Date.now(), log = console } = {}) {
    let timer = null;
    let running = false;
    async function seedMissing() {
        // A completed refresh may have removed a family whose licence changed. Never restore it on restart.
        const state = await db.maybe('SELECT last_success_at FROM font_catalog_state WHERE id = 1');
        if (state?.last_success_at) return;
        for (const f of seed) {
            if (!validFont(f)) throw new Error(`Invalid font seed: ${f.id}`);
            await db.exec('INSERT INTO font_families (id, metadata) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING', [f.id, JSON.stringify(f)]);
        }
    }
    async function list(filters = {}) {
        const rows = await db.many('SELECT metadata FROM font_families ORDER BY id');
        const q = String(filters.q || '').trim().toLowerCase().slice(0, 100);
        const weight = filters.weight ? Number(filters.weight) : null;
        const fonts = rows.map(r => r.metadata).filter(validFont).filter(f =>
            (!q || `${f.family} ${f.designer}`.toLowerCase().includes(q))
            && (!filters.category || f.category === filters.category)
            && (!filters.script || f.subsets.includes(filters.script))
            && (!weight || f.weights.includes(weight)));
        return fonts;
    }
    async function get(id) {
        if (!/^[a-z0-9-]{1,100}$/.test(id)) return null;
        const row = await db.maybe('SELECT metadata FROM font_families WHERE id = $1', [id]);
        if (!row || !validFont(row.metadata)) return null;
        return { ...row.metadata, pairings: pairings(row.metadata, await list()) };
    }
    async function fetchFont(old) {
        const response = await fetchImpl(`https://api.fontsource.org/v1/fonts/${old.id}`, { signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error(`Fontsource ${old.id}: HTTP ${response.status}`);
        const f = await response.json();
        if (!ALLOWED.has(f.license)) return null;
        const dir = f.license === 'Apache-2.0' ? 'apache' : f.license === 'UFL-1.0' ? 'ufl' : 'ofl';
        const licenseUrl = `https://github.com/google/fonts/tree/main/${dir}/${old.id.replace(/-/g, '')}`;
        const metaUrl = `${licenseUrl.replace('https://github.com/google/fonts/tree/main/', 'https://raw.githubusercontent.com/google/fonts/main/')}/METADATA.pb`;
        const metadata = await fetchImpl(metaUrl, { signal: AbortSignal.timeout(15_000) });
        if (!metadata.ok) throw new Error(`Font metadata ${old.id}: HTTP ${metadata.status}`);
        const designer = (String(await metadata.text()).match(/^designer: "([^"]+)"/m) || [])[1];
        const files = {};
        for (const weight of f.weights || []) for (const style of f.styles || []) {
            const url = f.variants?.[weight]?.[style]?.[f.defSubset]?.url?.woff2;
            if (url) files[`${weight}-${style}`] = url;
        }
        const result = { id: f.id, family: f.family, designer, category: f.category,
            weights: f.weights, styles: f.styles, subsets: f.subsets, license: f.license,
            version: f.version, source: f.source, license_url: licenseUrl, files };
        if (!validFont(result)) throw new Error(`Invalid metadata for ${old.id}`);
        const preview = result.files['400-normal'] || Object.values(result.files)[0];
        const asset = await fetchImpl(preview, { signal: AbortSignal.timeout(15_000) });
        if (asset.ok) result.sri = `sha384-${crypto.createHash('sha384').update(Buffer.from(await asset.arrayBuffer())).digest('base64')}`;
        return result;
    }
    async function tick() {
        if (running) return false;
        running = true;
        const time = now();
        const claimId = crypto.randomUUID();
        try {
            const claim = await db.maybe(`UPDATE font_catalog_state SET claim_id = $1, claimed_until = $2::timestamptz
                WHERE id = 1 AND (claimed_until IS NULL OR claimed_until <= $3::timestamptz)
                AND (last_success_at IS NULL OR last_success_at <= $4::timestamptz) RETURNING id`,
            [claimId, new Date(time + CLAIM).toISOString(), new Date(time).toISOString(), new Date(time - WEEK).toISOString()]);
            if (!claim) return false;
            try {
                const results = [];
                // Keep the remote request rate modest; the claim spans the whole refresh.
                for (const id of IDS) {
                    const old = seed.find(f => f.id === id);
                    const result = await fetchFont(old);
                    if (result) results.push(result);
                }
                await db.tx(async () => {
                    const held = await db.maybe('SELECT id FROM font_catalog_state WHERE id = 1 AND claim_id = $1 FOR UPDATE', [claimId]);
                    if (!held) return;
                    for (const f of results) await db.exec(`INSERT INTO font_families (id, metadata, updated_at) VALUES ($1, $2::jsonb, $3::timestamptz)
                        ON CONFLICT (id) DO UPDATE SET metadata = EXCLUDED.metadata, updated_at = EXCLUDED.updated_at`,
                    [f.id, JSON.stringify(f), new Date(time).toISOString()]);
                    await db.exec('DELETE FROM font_families WHERE id <> ALL($1::text[])', [results.map(f => f.id)]);
                    await db.exec('UPDATE font_catalog_state SET last_success_at = $1::timestamptz, claimed_until = NULL, claim_id = NULL WHERE id = 1 AND claim_id = $2', [new Date(time).toISOString(), claimId]);
                });
                return true;
            } catch (err) {
                await db.exec('UPDATE font_catalog_state SET claimed_until = NULL, claim_id = NULL WHERE id = 1 AND claim_id = $1', [claimId]);
                throw err;
            }
        } finally { running = false; }
    }
    function start() {
        if (timer) return;
        const run = () => tick().catch(e => log.warn('[OpenVibe.Design] font refresh:', e.message));
        run();
        timer = setInterval(run, 60 * 60 * 1000);
        timer.unref?.();
    }
    function stop() { if (timer) clearInterval(timer); timer = null; }
    return { seedMissing, list, get, tick, start, stop };
}

module.exports = { createFontCatalog, validFont, due, pairings, WEEK };
