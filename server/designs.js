'use strict';

const crypto = require('crypto');
const { sanitizeHtml, MAX_BYTES } = require('./arena/sanitize');

const KINDS = ['page', 'screen', 'component'];
const random = () => crypto.randomBytes(24).toString('base64url');
const hash = (key) => crypto.createHash('sha256').update(key).digest();
const fail = (status, code, detail) => Object.assign(new Error(detail), { status, code, detail });

function tokenCss(variables = {}) {
    return Object.entries(variables)
        .filter(([name, value]) => /^--[a-z][a-z0-9-]{1,40}$/.test(name) && /^(#[0-9a-f]{3,8}|rgba?\([0-9., %]+\)|[0-9., %]+|light|dark)$/i.test(String(value)))
        .map(([name, value]) => `${name}:${value}`).join(';');
}

function themeCss(variables) {
    // The aliases let a sparse Network theme cover the usual surfaces without introducing a second palette.
    const aliases = { '--bg-card': 'var(--bg-primary)', '--bg-secondary': 'var(--bg-primary)',
        '--text-muted': 'var(--text-primary)', '--accent': 'var(--text-primary)',
        '--on-accent': 'var(--bg-primary)', '--border': 'var(--text-primary)' };
    const fallbacks = Object.entries(aliases).filter(([name]) => !(name in variables))
        .map(([name, value]) => `${name}:${value}`).join(';');
    return `:root{${tokenCss(variables)};${fallbacks}}html{color-scheme:var(--color-scheme,light)}body{background:var(--bg-primary);color:var(--text-primary)}`;
}

function tokenizeColors(html, variables) {
    const colors = Object.entries(variables).filter(([, v]) => /^#[0-9a-f]{6}$/i.test(String(v)))
        .map(([name, hex]) => ({ name, rgb: [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) }));
    function nearest(raw) {
        let rgb;
        if (raw.startsWith('#')) {
            let hex = raw.slice(1);
            if (hex.length === 3) hex = [...hex].map(c => c + c).join('');
            if (hex.length !== 6) return 'var(--accent)';
            rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
        } else {
            const numbers = raw.match(/\d+(?:\.\d+)?/g);
            if (!numbers || numbers.length < 3) return 'var(--accent)';
            rgb = numbers.slice(0, 3).map(Number);
        }
        if (!colors.length) return 'var(--accent)';
        const best = colors.reduce((a, b) =>
            b.rgb.reduce((sum, x, i) => sum + (x - rgb[i]) ** 2, 0) < a.rgb.reduce((sum, x, i) => sum + (x - rgb[i]) ** 2, 0) ? b : a);
        return `var(${best.name})`;
    }
    const replace = css => css
        .replace(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi, nearest)
        .replace(/((?:color|background|border-color|fill|stroke)\s*:\s*)(white|black|red|blue|green|gray|grey)\b/gi, '$1var(--accent)')
        .replace(/@import\s+[^;]+;?/gi, '')
        .replace(/url\s*\([^)]*\)/gi, 'none');
    return html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => match.replace(css, replace(css)))
        .replace(/\sstyle=(['"])(.*?)\1/gi, (match, quote, css) => ` style=${quote}${replace(css)}${quote}`);
}

function wrap(html, variables) {
    let clean = sanitizeHtml(html, { maxBytes: MAX_BYTES - 4096 })
        .replace(/<style\b[^>]*id=["']design-tokens["'][^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<link\b[^>]*>/gi, '')
        .replace(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');
    clean = tokenizeColors(clean, variables);
    const tokens = `<style id="design-tokens">${themeCss(variables)}</style>`;
    if (!/<html\b/i.test(clean)) clean = `<html><head></head><body>${clean}</body></html>`;
    if (!/<head\b/i.test(clean)) clean = clean.replace(/<html\b[^>]*>/i, '$&<head></head>');
    clean = clean.replace(/<head\b[^>]*>/i, `$&${tokens}`);
    return `<!doctype html>${clean.replace(/^\s*<!doctype\s+html[^>]*>/i, '')}`;
}

function createDesigns({ s, ai, catalog, log = console, now = () => Date.now() }) {
    const db = s.db;
    const publicRow = d => ({ id: d.id, prompt: d.prompt, kind: d.kind, themeId: d.theme_id,
        status: d.variants.every(v => v.status === 'done' || v.status === 'failed')
            ? d.variants.some(v => v.status === 'done') ? 'done' : 'failed' : 'running',
        createdAt: d.created_at, updatedAt: d.updated_at });
    function allowed(d, owner, key) {
        if (d.owner && owner === d.owner) return true;
        if (!d.guest_hash || !key) return false;
        return crypto.timingSafeEqual(Buffer.from(d.guest_hash, 'hex'), hash(String(key)));
    }
    async function row(id, owner, key) {
        const d = await db.maybe('SELECT * FROM designs WHERE id=$1', [id]);
        if (!d) throw fail(404, 'design.not_found', 'Design not found.');
        if (!allowed(d, owner, key)) throw fail(403, 'design.forbidden', 'Use the private link for this design.');
        return d;
    }
    async function theme(id) {
        const list = await catalog.list();
        const selected = id ? list.themes.find(t => t.id === id) : list.themes[0];
        if (!selected) throw fail(422, 'design.invalid_theme', 'Choose a theme from the catalog.');
        return selected;
    }
    async function create({ prompt, kind = 'page', themeId, owner = null, ip = '' }) {
        prompt = String(prompt || '').trim();
        if (!prompt || prompt.length > 4000 || !KINDS.includes(kind))
            throw fail(422, 'design.invalid_input', 'Provide a prompt up to 4000 characters and a valid kind.');
        const cutoff = new Date(now() - 86400000).toISOString();
        const count = Number(await db.value(`SELECT COUNT(*) FROM designs WHERE ${owner ? 'owner' : 'guest_ip'}=$1 AND created_at >= $2::timestamptz`, [owner || ip, cutoff]));
        if (count >= (owner ? 10 : 2)) throw fail(429, 'design.daily_limit', 'Daily design limit reached.');
        const selected = await theme(themeId);
        const plan = await ai.slotPlan();
        const slots = plan.slots.slice(0, 3);
        const variants = slots.map((slot, index) => ({ id: s.newId('dva'), slot: index, provider: slot.provider,
            model: slot.model, status: 'pending', html: '', ms: 0, costUsd: 0, error: null }));
        const id = s.newId('dsn'), editKey = owner ? null : random();
        await db.exec('INSERT INTO designs(id,prompt,kind,theme_id,variants,owner,guest_hash,guest_ip,created_at,updated_at) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9::timestamptz,$9::timestamptz)',
            [id, prompt, kind, selected.id, JSON.stringify(variants), owner, editKey ? hash(editKey).toString('hex') : null, owner ? null : ip, s.iso()]);
        run(id).catch(err => log.warn('[OpenVibe.Design] generation:', err.message));
        return { design: publicRow({ id, prompt, kind, theme_id: selected.id, variants, created_at: s.iso(), updated_at: s.iso() }),
            editKey, editUrl: editKey ? `/d/${id}?key=${encodeURIComponent(editKey)}` : null };
    }
    async function updateVariant(id, index, variant) {
        await db.exec('UPDATE designs SET variants=jsonb_set(variants, ARRAY[$2::text], $3::jsonb, false), updated_at=$4::timestamptz WHERE id=$1',
            [id, String(index), JSON.stringify(variant), s.iso()]);
    }
    async function run(id) {
        const d = await db.maybe('SELECT * FROM designs WHERE id=$1', [id]);
        if (!d) return;
        await Promise.allSettled(d.variants.map(async (v, index) => {
            if (v.status === 'done') return;
            const running = { ...v, status: 'running', error: null };
            await updateVariant(id, index, running);
            try {
                const t = await theme(d.theme_id);
                const prompt = `${d.prompt}\nUse ONLY these theme CSS custom properties for all colors: ${Object.keys(t.variables || {}).join(', ')}. No external requests. Mobile first. Return one complete HTML document.`;
                const out = await ai.generate({ prompt, category: d.kind === 'component' ? 'logo' : d.kind === 'screen' ? 'mobile_app' : 'landing',
                    slot: { provider: v.provider, model: v.model }, roundId: id, index });
                const current = await db.maybe('SELECT theme_id FROM designs WHERE id=$1', [id]);
                const currentTheme = await theme(current.theme_id);
                await updateVariant(id, index, { ...running, status: 'done', html: wrap(out.html, currentTheme.variables || {}),
                    provider: out.provider, model: out.model, ms: out.ms, costUsd: out.cost_usd, error: null });
            } catch (err) {
                await updateVariant(id, index, { ...running, status: 'failed', error: String(err.message).slice(0, 300) });
            }
        }));
    }
    async function read(id, owner, key) {
        const d = await row(id, owner, key), selected = await theme(d.theme_id);
        return { design: publicRow(d), variants: d.variants.map(v => v.status === 'done'
            ? { ...v, html: wrap(v.html, selected.variables || {}) } : v) };
    }
    async function setTheme(id, themeId, owner, key) {
        await row(id, owner, key);
        const selected = await theme(themeId);
        await db.exec('UPDATE designs SET theme_id=$1,updated_at=$2::timestamptz WHERE id=$3', [selected.id, s.iso(), id]);
        return { themeId: selected.id, variables: selected.variables || {} };
    }
    async function recent(owner, guestLinks = []) {
        if (owner) return (await db.many('SELECT * FROM designs WHERE owner=$1 ORDER BY created_at DESC LIMIT 3', [owner]))
            .map(d => ({ ...publicRow(d), url: `/d/${d.id}` }));
        const result = [];
        for (const item of guestLinks.slice(0, 3)) {
            try { const d = await row(item.id, null, item.key); result.push({ ...publicRow(d), url: `/d/${d.id}?key=${encodeURIComponent(item.key)}` }); } catch { /* stale draft */ }
        }
        return result;
    }
    async function resume() {
        const pending = await db.many("SELECT id FROM designs WHERE variants @> '[{\"status\":\"pending\"}]'::jsonb OR variants @> '[{\"status\":\"running\"}]'::jsonb ORDER BY created_at LIMIT 20");
        for (const d of pending) run(d.id).catch(err => log.warn('[OpenVibe.Design] resume:', err.message));
    }
    return { create, read, setTheme, recent, resume, theme };
}

module.exports = { createDesigns, wrap, tokenCss, themeCss };
