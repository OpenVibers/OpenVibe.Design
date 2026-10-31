'use strict';

const crypto = require('crypto');
const { sanitizeHtml, MAX_BYTES } = require('./arena/sanitize');
const { validateChange, applyChange } = require('./design-edit');

const KINDS = ['page', 'screen', 'component'];
const random = () => crypto.randomBytes(24).toString('base64url');
const hash = (key) => crypto.createHash('sha256').update(key).digest();
const fail = (status, code, detail) => Object.assign(new Error(detail), { status, code, detail });
const CHAT_INSTRUCTION_MAX = 1000;
const CHAT_EDITS_DEFAULT = 5;

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
    // Click edits address elements by a `body > …` path, so every stored document has an explicit body.
    if (!/<body\b/i.test(clean)) clean = clean.replace(/<\/head\s*>/i, '</head><body>');
    if (!/<body\b/i.test(clean)) clean = clean.replace(/<html\b[^>]*>/i, '$&<body>');
    if (!/<\/body\s*>/i.test(clean)) {
        clean = /<\/html\s*>/i.test(clean) ? clean.replace(/<\/html\s*>/i, '</body></html>') : `${clean}</body>`;
    }
    clean = clean.replace(/<head\b[^>]*>/i, `$&${tokens}`);
    return `<!doctype html>${clean.replace(/^\s*<!doctype\s+html[^>]*>/i, '')}`;
}

function createDesigns({ s, ai, bench = null, catalog, config = {}, log = console, now = () => Date.now() }) {
    const db = s.db;
    const chatEditLimit = Math.max(1, Number(config.studio && config.studio.chatEditsPerDesign) || CHAT_EDITS_DEFAULT);
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
    async function create({ prompt, kind = 'page', themeId, owner = null, ip = '', who = 'claude' }) {
        prompt = String(prompt || '').trim();
        if (!prompt || prompt.length > 4000 || !KINDS.includes(kind))
            throw fail(422, 'design.invalid_input', 'Provide a prompt up to 4000 characters and a valid kind.');
        const cutoff = new Date(now() - 86400000).toISOString();
        const count = Number(await db.value(`SELECT COUNT(*) FROM designs WHERE ${owner ? 'owner' : 'guest_ip'}=$1 AND created_at >= $2::timestamptz`, [owner || ip, cutoff]));
        if (count >= (owner ? 10 : 2)) throw fail(429, 'design.daily_limit', 'Daily design limit reached.');
        const selected = await theme(themeId);
        // Claude first (L37); `compare` asks the Arena's three. An AI client without designPlan (tests, older) uses slots.
        const plan = ai.designPlan ? await ai.designPlan(who === 'compare' ? 'compare' : 'claude') : await ai.slotPlan();
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

    // ── The working frame, its versions and the Arena vote ──────────────────
    const pickRow = (id) => db.maybe('SELECT * FROM design_picks WHERE design_id=$1', [id]);
    const versionRow = (id, seq) => db.maybe('SELECT * FROM design_versions WHERE design_id=$1 AND seq=$2', [id, seq]);
    const versionPublic = (v, currentSeq) => ({
        seq: Number(v.seq), kind: v.kind, instruction: v.instruction || null,
        change: v.change && typeof v.change === 'object' ? v.change : null,
        model: v.model || null, provider: v.provider || null,
        costUsd: Number(v.cost_usd || 0), ms: Number(v.ms || 0),
        parentSeq: v.parent_seq == null ? null : Number(v.parent_seq),
        createdAt: v.created_at, current: Number(v.seq) === Number(currentSeq),
    });
    function pickPublic(p, current) {
        if (!p) return null;
        const working = current ? versionPublic(current, p.current_seq) : null;
        return {
            variantIndex: Number(p.variant_index), variantId: p.variant_id,
            currentSeq: Number(p.current_seq), chatEdits: Number(p.chat_edits || 0), chatEditLimit,
            vote: { state: p.vote_state, roundId: p.bench_round_id || null, judgementId: p.bench_judgement_id || null,
                error: p.vote_error || null },
            working, createdAt: p.created_at, updatedAt: p.updated_at,
            canUndo: Boolean(current && current.parent_seq != null),
            canRedo: Array.isArray(p.redo_stack) && p.redo_stack.length > 0,
        };
    }
    const categoryOf = (kind) => kind === 'component' ? 'logo' : kind === 'screen' ? 'mobile_app' : 'landing';
    const pickRunId = (v) => `dsp_${v.id}`;

    /** Record the pick once: create the Arena round, submit the variants as room entries and cast one vote. */
    async function recordPickVote(d, subject, token) {
        let p = await pickRow(d.id);
        if (!p) return { state: 'none' };
        if (p.vote_state === 'recorded') return { state: 'recorded', roundId: p.bench_round_id, judgementId: p.bench_judgement_id };
        if (!subject || !token) {
            await db.exec("UPDATE design_picks SET vote_state='guest', updated_at=$2 WHERE design_id=$1 AND vote_state<>'recorded'", [d.id, s.iso()]);
            return { state: 'guest', detail: 'Sign in to count this pick as one Arena vote.' };
        }
        if (!bench || !bench.enabled || typeof bench.createRoomRound !== 'function') {
            await db.exec("UPDATE design_picks SET vote_state='unavailable', updated_at=$2 WHERE design_id=$1 AND vote_state<>'recorded'", [d.id, s.iso()]);
            return { state: 'unavailable', detail: 'The Arena is not configured; the working frame is still saved.' };
        }
        // One in-flight vote per design: a double click must not create two Bench rounds. A pending claim older
        // than five minutes is retried, so a process that stopped halfway does not lose the vote forever.
        const claimed = await db.maybe(`UPDATE design_picks SET vote_state='pending', updated_at=$2
            WHERE design_id=$1 AND (vote_state IN ('none','guest','unavailable','failed')
                OR (vote_state='pending' AND updated_at < $2::timestamptz - interval '5 minutes'))
            RETURNING *`, [d.id, s.iso()]);
        if (!claimed) {
            const now = await pickRow(d.id);
            if (now && now.vote_state === 'recorded') return { state: 'recorded', roundId: now.bench_round_id, judgementId: now.bench_judgement_id };
            return { state: 'pending', detail: 'The Arena vote is being recorded.' };
        }
        p = claimed;
        try {
            let roundId = p.bench_round_id;
            if (!roundId) {
                const out = await bench.createRoomRound({ category: categoryOf(d.kind), prompt: d.prompt });
                roundId = out && out.round && out.round.id;
                if (!roundId) throw new Error('OpenVibe.Bench did not return a round.');
                await db.exec("UPDATE design_picks SET bench_round_id=$2, vote_state='pending', vote_error=NULL, updated_at=$3 WHERE design_id=$1", [d.id, roundId, s.iso()]);
                p = await pickRow(d.id);
            }
            if (!p.bench_left_output || !p.bench_right_output) {
                const round = await bench.getRound(roundId);
                const seen = new Map(((round && round.entries) || []).map((e) => [e.run_id, e.id]));
                const done = d.variants.map((v, index) => ({ v, index })).filter((x) => x.v.status === 'done');
                const entries = [];
                for (const { v, index } of done) {
                    let entryId = seen.get(pickRunId(v));
                    if (!entryId) {
                        const added = await bench.addEntry({ roundId, provider: v.provider, model: v.model,
                            route: { provider: v.provider, model: v.model }, payload: { html: v.html },
                            costUsd: Number(v.costUsd || 0), ms: Number(v.ms || 0), tokens: Number(v.tokens || 0), runId: pickRunId(v) });
                        entryId = added && added.entry ? added.entry.id : (added && added.id);
                    }
                    if (entryId) entries.push({ index, id: entryId });
                }
                const chosen = entries.find((e) => e.index === Number(p.variant_index));
                const other = entries.find((e) => e.index !== Number(p.variant_index));
                if (!chosen || !other) {
                    await db.exec("UPDATE design_picks SET vote_state='unavailable', vote_error='A pick vote needs two finished variants.', updated_at=$2 WHERE design_id=$1", [d.id, s.iso()]);
                    return { state: 'unavailable', detail: 'A pick vote needs two finished variants.' };
                }
                await db.exec("UPDATE design_picks SET bench_left_output=$2, bench_right_output=$3, vote_state='pending', vote_error=NULL, updated_at=$4 WHERE design_id=$1", [d.id, chosen.id, other.id, s.iso()]);
                p = await pickRow(d.id);
            }
            if (!p.bench_judgement_id) {
                const out = await bench.castVote({ roundId, token, pair: { left: p.bench_left_output, right: p.bench_right_output }, winner: 'left' });
                const judgementId = out && out.judgement ? out.judgement.id : null;
                await db.exec("UPDATE design_picks SET vote_state='recorded', bench_judgement_id=$2, vote_error=NULL, updated_at=$3 WHERE design_id=$1", [d.id, judgementId, s.iso()]);
                return { state: 'recorded', roundId, judgementId };
            }
            await db.exec("UPDATE design_picks SET vote_state='recorded', vote_error=NULL, updated_at=$2 WHERE design_id=$1", [d.id, s.iso()]);
            return { state: 'recorded', roundId, judgementId: p.bench_judgement_id };
        } catch (err) {
            if (err && err.code === 'arena.already_voted') {
                await db.exec("UPDATE design_picks SET vote_state='recorded', vote_error=NULL, updated_at=$2 WHERE design_id=$1", [d.id, s.iso()]);
                return { state: 'recorded', roundId: p.bench_round_id || null, detail: 'This pick was already counted.' };
            }
            const detail = String((err && (err.detail || err.message)) || err).slice(0, 300);
            await db.exec("UPDATE design_picks SET vote_state='failed', vote_error=$2, updated_at=$3 WHERE design_id=$1", [d.id, detail, s.iso()]);
            log.warn('[OpenVibe.Design] pick vote:', detail);
            return { state: 'failed', detail: 'The working frame is saved; the Arena vote could not be recorded.' };
        }
    }

    async function ensureBaseVersion(d, p, variant) {
        const count = Number(await db.value('SELECT COUNT(*) FROM design_versions WHERE design_id=$1', [d.id]));
        if (count > 0) return;
        await db.exec(`INSERT INTO design_versions(design_id,seq,variant_index,variant_id,kind,html,model,provider,cost_usd,ms,parent_seq,created_by,created_at)
            VALUES($1,1,$2,$3,'generated',$4,$5,$6,$7,$8,NULL,$9,$10::timestamptz) ON CONFLICT (design_id,seq) DO NOTHING`,
        [d.id, Number(p.variant_index), p.variant_id, variant.html || '', variant.model || null, variant.provider || null,
            Number(variant.costUsd || 0), Number(variant.ms || 0), d.owner || 'guest', s.iso()]);
        await db.exec('UPDATE design_picks SET current_seq=1, updated_at=$2 WHERE design_id=$1', [d.id, s.iso()]);
    }

    async function addVersion(d, p, data) {
        // The sequence is allocated inside the INSERT, so two accepted edits at once cannot pick the same seq.
        const row = await db.maybe(`INSERT INTO design_versions(design_id,seq,variant_index,variant_id,kind,html,instruction,change,model,provider,cost_usd,ms,parent_seq,created_by,created_at)
            SELECT $1, COALESCE(MAX(seq),0)+1, $2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14::timestamptz
            FROM design_versions WHERE design_id=$1 RETURNING *`,
        [d.id, Number(p.variant_index), p.variant_id, data.kind, data.html, data.instruction || null,
            data.change ? JSON.stringify(data.change) : null, data.model || null, data.provider || null,
            Number(data.costUsd || 0), Number(data.ms || 0), Number(p.current_seq), data.createdBy || (d.owner || 'guest'), s.iso()]);
        await db.exec("UPDATE design_picks SET current_seq=$2, redo_stack='[]'::jsonb, updated_at=$3 WHERE design_id=$1", [d.id, Number(row.seq), s.iso()]);
        return row;
    }

    async function read(id, owner, key) {
        const d = await row(id, owner, key), selected = await theme(d.theme_id);
        const p = await pickRow(id);
        const versions = p ? await db.many('SELECT * FROM design_versions WHERE design_id=$1 ORDER BY seq', [id]) : [];
        const current = p ? versions.find(v => Number(v.seq) === Number(p.current_seq)) : null;
        const variants = d.variants.map((v, index) => {
            if (p && index === Number(p.variant_index) && current) {
                return { ...v, html: wrap(current.html, selected.variables || {}), currentSeq: Number(current.seq), edited: current.kind !== 'generated' };
            }
            return v.status === 'done' ? { ...v, html: wrap(v.html, selected.variables || {}) } : v;
        });
        return { design: publicRow(d), variants, pick: pickPublic(p, current), versions: versions.map(v => versionPublic(v, p ? p.current_seq : 1)) };
    }

    async function pick({ id, variantIndex, variantId, owner, key, subject = null, token = null }) {
        const d = await row(id, owner, key);
        let index = variantIndex == null || variantIndex === '' ? null : Number(variantIndex);
        if (variantId) {
            const found = d.variants.findIndex(v => String(v.id) === String(variantId));
            if (found === -1) throw fail(422, 'design.invalid_variant', 'That variant is not part of this design.');
            if (index != null && index !== found) throw fail(422, 'design.invalid_variant', 'That variant is not part of this design.');
            index = found;
        }
        if (index == null || !Number.isInteger(index) || index < 0 || index >= d.variants.length)
            throw fail(422, 'design.invalid_variant', 'Pick one of the generated variants.');
        const variant = d.variants[index];
        if (!variant || variant.status !== 'done') throw fail(409, 'design.variant_not_ready', 'That frame is not ready yet.');
        const existing = await pickRow(id);
        if (existing) {
            if (Number(existing.variant_index) !== index) throw fail(409, 'design.already_picked', 'This design already has a working frame.');
            const vote = await recordPickVote(d, subject, token);
            const data = await read(id, owner, key);
            return { ...data, vote, idempotent: true };
        }
        const inserted = await db.maybe(`INSERT INTO design_picks(design_id,variant_index,variant_id,voter_subject,created_at,updated_at)
            VALUES($1,$2,$3,$4,$5::timestamptz,$5::timestamptz) ON CONFLICT (design_id) DO NOTHING RETURNING *`,
        [id, index, variant.id, subject || null, s.iso()]);
        const p = inserted || await pickRow(id);
        if (!p || Number(p.variant_index) !== index) throw fail(409, 'design.already_picked', 'This design already has a working frame.');
        await ensureBaseVersion(d, p, variant);
        const vote = await recordPickVote(d, subject, token);
        const data = await read(id, owner, key);
        return { ...data, vote, idempotent: !inserted };
    }

    async function currentForEdit(id, owner, key) {
        const d = await row(id, owner, key);
        const p = await pickRow(id);
        if (!p) throw fail(409, 'design.no_pick', 'Pick a working frame before editing it.');
        const selected = await theme(d.theme_id);
        const variant = d.variants[Number(p.variant_index)];
        if (!variant || variant.status !== 'done') throw fail(409, 'design.variant_not_ready', 'The working frame is not ready yet.');
        let current = await versionRow(id, p.current_seq);
        if (!current) {
            await ensureBaseVersion(d, p, variant);
            current = await versionRow(id, p.current_seq);
        }
        return { d, p, selected, variant, current };
    }

    async function chatEdit({ id, instruction, owner, key, subject = null }) {
        instruction = String(instruction == null ? '' : instruction).trim();
        if (!instruction || instruction.length > CHAT_INSTRUCTION_MAX)
            throw fail(422, 'design.invalid_instruction', `Write an instruction up to ${CHAT_INSTRUCTION_MAX} characters.`);
        const { d, p, selected, variant } = await currentForEdit(id, owner, key);
        const used = await db.maybe('UPDATE design_picks SET chat_edits=chat_edits+1, updated_at=$2 WHERE design_id=$1 AND chat_edits < $3 RETURNING chat_edits',
            [d.id, s.iso(), chatEditLimit]);
        if (!used) throw fail(429, 'design.edit_limit', `This design has used its ${chatEditLimit} AI edits. Click edits and undo still work.`);
        const current = await versionRow(id, p.current_seq);
        const variables = selected.variables || {};
        const names = Object.keys(variables).join(', ');
        const prompt = [
            'Edit one existing generated design. Return one complete HTML document and nothing else.',
            `The person's instruction: ${instruction}`,
            'The current document is between the markers. Keep its theme, its content and its structure unless the instruction asks otherwise.',
            `<<<CURRENT_DESIGN\n${String(current.html || variant.html || '').slice(0, 80000)}\nCURRENT_DESIGN>>>`,
            `Use ONLY these theme CSS custom properties for every colour: ${names || '(the document already uses them)'}. Do not add scripts, event-handler attributes, links, web fonts, remote images or any external request. Mobile first.`,
        ].join('\n\n');
        const out = await ai.generate({ prompt, category: categoryOf(d.kind), slot: { provider: variant.provider, model: variant.model }, roundId: d.id, index: variant.slot });
        const html = wrap(out.html, variables);
        const version = await addVersion(d, p, { kind: 'chat', html, instruction, model: out.model || variant.model,
            provider: out.provider || variant.provider, costUsd: out.cost_usd, ms: out.ms, createdBy: subject || (d.owner ? 'owner' : 'guest') });
        const fresh = await pickRow(id);
        const data = await read(id, owner, key);
        return { version: versionPublic(version, fresh.current_seq), html, pick: data.pick, versions: data.versions };
    }

    async function clickEdit({ id, path, text, color, spacing, align, owner, key, subject = null }) {
        const { d, p, selected, variant } = await currentForEdit(id, owner, key);
        const current = await versionRow(id, p.current_seq);
        let change;
        try {
            change = validateChange({ path, text, color, spacing, align }, selected.variables || {});
        } catch (err) {
            throw fail(err.status || 422, err.code || 'design.invalid_change', err.detail || err.message);
        }
        let modified;
        try {
            // Normalise older part A rows (and any row without an explicit body) before addressing elements.
            modified = applyChange(wrap(current.html, selected.variables || {}), change);
        } catch (err) {
            throw fail(err.status || 422, err.code || 'design.invalid_change', err.detail || err.message);
        }
        const html = wrap(modified, selected.variables || {});
        const record = { path: change.path };
        if (change.changes.text !== undefined) record.text = change.changes.text;
        if (change.changes.color !== undefined) record.color = color;
        if (change.changes.padding !== undefined) record.spacing = spacing;
        if (change.changes['text-align'] !== undefined) record.align = align;
        const version = await addVersion(d, p, { kind: 'click', html, change: record, model: variant.model,
            provider: variant.provider, costUsd: 0, ms: 0, createdBy: subject || (d.owner ? 'owner' : 'guest') });
        const fresh = await pickRow(id);
        const data = await read(id, owner, key);
        return { version: versionPublic(version, fresh.current_seq), html, pick: data.pick, versions: data.versions };
    }

    async function versions(id, owner, key) {
        const d = await row(id, owner, key);
        const p = await pickRow(id);
        const list = p ? await db.many('SELECT * FROM design_versions WHERE design_id=$1 ORDER BY seq', [id]) : [];
        return { designId: d.id, currentSeq: p ? Number(p.current_seq) : null, versions: list.map(v => versionPublic(v, p ? p.current_seq : 1)) };
    }

    async function undo(id, owner, key) {
        const d = await row(id, owner, key);
        const p = await pickRow(id);
        if (!p) throw fail(409, 'design.no_pick', 'Pick a working frame before undoing an edit.');
        const current = await versionRow(id, p.current_seq);
        if (!current || current.parent_seq == null) {
            return { changed: false, ...(await read(id, owner, key)) };
        }
        const stack = Array.isArray(p.redo_stack) ? p.redo_stack.slice() : [];
        stack.push(Number(current.seq));
        await db.exec('UPDATE design_picks SET current_seq=$2, redo_stack=$3::jsonb, updated_at=$4 WHERE design_id=$1',
            [d.id, Number(current.parent_seq), JSON.stringify(stack.slice(-100)), s.iso()]);
        return { changed: true, ...(await read(id, owner, key)) };
    }

    async function redo(id, owner, key) {
        const d = await row(id, owner, key);
        const p = await pickRow(id);
        if (!p) throw fail(409, 'design.no_pick', 'Pick a working frame before redoing an edit.');
        const stack = Array.isArray(p.redo_stack) ? p.redo_stack.slice() : [];
        if (!stack.length) return { changed: false, ...(await read(id, owner, key)) };
        const seq = Number(stack.pop());
        const target = await versionRow(id, seq);
        if (!target) return { changed: false, ...(await read(id, owner, key)) };
        await db.exec('UPDATE design_picks SET current_seq=$2, redo_stack=$3::jsonb, updated_at=$4 WHERE design_id=$1',
            [d.id, seq, JSON.stringify(stack), s.iso()]);
        return { changed: true, ...(await read(id, owner, key)) };
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
    return { create, read, setTheme, recent, resume, theme, pick, chatEdit, clickEdit, versions, undo, redo, chatEditLimit };
}

module.exports = { createDesigns, wrap, tokenCss, themeCss };
