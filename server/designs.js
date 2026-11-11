'use strict';

const crypto = require('crypto');
const { sanitizeHtml, MAX_BYTES } = require('./arena/sanitize');
const { validateChange, applyChange } = require('./design-edit');
const { vocabulary } = require('./components/registry');
const { kindOf, instructionFor, categoryFor } = require('./create/kinds');
const { makeThumbnail } = require('./create/thumbnail');
const { publicStart, startPrompt } = require('./create/start');
const elements = require('./create/element');

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


// ── The prompts this service sends (published word for word at openvibe.design/prompts) ──
/** A design drawn in the person's theme: their words, then the theme's colour variables. */
function themePrompt(prompt, variableNames) {
    return `${prompt}\nUse ONLY these theme CSS custom properties for all colors: ${variableNames.join(', ')}. No external requests. Mobile first. Return one complete HTML document.\nBuild the interface from these OpenVibe component definitions. Mark each major component with data-ov-component set to its registry name. Keep the anatomy, state and keyboard behavior described by the definition.\n${vocabulary()}`;
}
/** An edit of a drawn design: the person's instruction, the current document, and the theme's colour variables. */
function editPrompt(instruction, html, names) {
    return [
        'Edit one existing generated design. Return one complete HTML document and nothing else.',
        `The person's instruction: ${instruction}`,
        'The current document is between the markers. Keep its theme, its content and its structure unless the instruction asks otherwise.',
        `<<<CURRENT_DESIGN\n${html}\nCURRENT_DESIGN>>>`,
        `Use ONLY these theme CSS custom properties for every colour: ${names || '(the document already uses them)'}. Do not add scripts, event-handler attributes, links, web fonts, remote images or any external request. Mobile first.`,
        `Keep using the OpenVibe component registry. Mark each major part with data-ov-component set to its registry name.\n${vocabulary()}`,
    ].join('\n\n');
}

function createDesigns({ s, ai, bench = null, catalog, config = {}, log = console, now = () => Date.now(), sharing = null, deepDive = null }) {
    const db = s.db;
    const chatEditLimit = Math.max(1, Number(config.studio && config.studio.chatEditsPerDesign) || CHAT_EDITS_DEFAULT);
    const publicRow = d => {
        const names = [...new Set((d.variants || []).map(v => v.name || v.model).filter(Boolean))];
        return {
            id: d.id, prompt: d.prompt, kind: d.kind, themeId: d.theme_id,
            frame: d.frame || null, look: d.look || d.theme_id || null,
            model: names[0] || null, models: names,
            start: publicStart(d.start || {}), sourceDesignId: d.source_design_id || null, researchId: d.research_id || null,
            estimate: d.estimate || null,
            status: d.variants.every(v => v.status === 'done' || v.status === 'failed')
                ? d.variants.some(v => v.status === 'done') ? 'done' : 'failed' : 'running',
            createdAt: d.created_at, updatedAt: d.updated_at,
            published: d.space_url ? { url: d.space_url, at: d.published_at || null } : null,
            elementChannel: d.element_channel || null,
            elementListing: d.element_listing || null,
            elementRemixOf: d.element_remix_of || null,
        };
    };
    function allowed(d, owner, key) {
        if (d.owner && owner === d.owner) return true;
        if (!d.guest_hash || !key) return false;
        return crypto.timingSafeEqual(Buffer.from(d.guest_hash, 'hex'), hash(String(key)));
    }
    /**
     * A design the viewer may open: its owner, a guest with the secret edit key, or somebody the share
     * row names (Everyone, Anyone with the link, Specific people). The guest link keeps working exactly
     * as before; a share row never widens its own guest key.
     */
    async function row(id, owner, key, viewer = null, edit = false) {
        const d = await db.maybe('SELECT * FROM designs WHERE id=$1', [id]);
        if (!d) throw fail(404, 'design.not_found', 'Design not found.');
        if (allowed(d, owner, key)) return d;
        if (sharing) {
            const share = await sharing.shareOf(id).catch(() => null);
            if (share) {
                if (!edit && ['public', 'link'].includes(share.audience)) return d;
                if (await (edit ? sharing.canEdit(viewer, id) : sharing.canView(viewer, id)).catch(() => false)) return d;
                // A shares row is the authority: a person not on it is refused before the prompt, a
                // variant or a version is read. The page turns this into the gate; the API keeps its
                // long-standing 403 shape ("use the private link").
                throw fail(403, 'design.forbidden', 'Use the private link for this design.');
            }
        }
        throw fail(403, 'design.forbidden', 'Use the private link for this design.');
    }
    async function theme(id) {
        const list = await catalog.list();
        const selected = id ? list.themes.find(t => t.id === id) : list.themes[0];
        if (!selected) throw fail(422, 'design.invalid_theme', 'Choose a theme from the catalog.');
        return selected;
    }
    /**
     * The look a design was made in: the theme's variables as they were resolved when it was created (a
     * person's own theme is not always in the public catalogue), else the public theme it names.
     */
    async function lookTheme(d) {
        if (d && d.look_variables && typeof d.look_variables === 'object' && Object.keys(d.look_variables).length) {
            return { id: d.look || d.theme_id, name: d.look || d.theme_id, variables: d.look_variables };
        }
        return await theme(d && d.theme_id);
    }
    async function create({ prompt, kind = 'page', themeId, look = null, lookVariables = null, frame: frameId = null,
        models = null, takes = null, start = null, sourceDesignId = null, estimate = null, research = null,
        owner = null, ip = '', who = 'claude' }) {
        prompt = String(prompt || '').trim();
        const kindEntry = kindOf(kind);
        if (!prompt || prompt.length > 4000 || !kindEntry)
            throw fail(422, 'design.invalid_input', 'Provide a prompt up to 4000 characters and a valid kind.');
        const cutoff = new Date(now() - 86400000).toISOString();
        const count = Number(await db.value(`SELECT COUNT(*) FROM designs WHERE ${owner ? 'owner' : 'guest_ip'}=$1 AND created_at >= $2::timestamptz`, [owner || ip, cutoff]));
        if (count >= (owner ? 10 : 2)) throw fail(429, 'design.daily_limit', 'Daily design limit reached.');

        // The look: the resolved theme variables when the caller read them from the theme centre or the
        // person's own themes, else the public theme (today's behaviour).
        let selected, lookId = null;
        if (look && lookVariables && typeof lookVariables === 'object' && Object.keys(lookVariables).length) {
            selected = { id: themeId || look, name: look, variables: lookVariables };
            lookId = look;
        } else {
            const wanted = look && look !== 'system' ? look : themeId;
            selected = await theme(wanted);
            lookId = look === 'system' ? 'system' : (look || selected.id);
        }
        const frame = frameId && kindEntry.frames.includes(frameId) ? frameId : kindEntry.frames[0];

        // The takes: one per chosen model (several models side by side), or today's design plan when no
        // models were named. Each take records the model it was asked for before the run answers.
        let slots = [], planPrefer = null, planPin = false, requested = null;
        if (Array.isArray(models) && models.length) {
            const per = Math.max(1, Math.min(Number(takes) || 1, 4));
            requested = models.map((model) => ({
                id: model.id, name: model.name || null, provider: model.provider || null, model: model.model || null,
                price_in: model.price_in == null ? null : Number(model.price_in),
                price_out: model.price_out == null ? null : Number(model.price_out),
                source: model.source || 'exchange',
            }));
            slots = [];
            for (const model of models) for (let i = 0; i < per; i++) {
                slots.push({
                    provider: model.provider || null, model: model.model || null,
                    model_id: model.id || null, name: model.name || null,
                    price_in: model.price_in == null ? null : Number(model.price_in),
                    price_out: model.price_out == null ? null : Number(model.price_out),
                    source: model.source || 'exchange',
                    prefer: model.prefer || (model.provider && model.model ? { provider: model.provider, model: model.model } : model.model ? { model: model.model } : null),
                    pin: model.pin !== false,
                });
            }
        } else {
            const plan = ai.designPlan ? await ai.designPlan(who) : await ai.slotPlan();
            planPrefer = plan.prefer || null;
            planPin = plan.pin === true;
            slots = plan.slots.slice(0, 3).map((slot) => ({
                provider: slot.provider, model: slot.model, model_id: null, name: null, price_in: null, price_out: null,
                source: 'exchange', prefer: planPrefer ? { ...planPrefer } : null, pin: planPin,
            }));
        }

        const variants = slots.map((slot, index) => ({ id: s.newId('dva'), slot: index, provider: slot.provider,
            model: slot.model, model_id: slot.model_id || null, name: slot.name || null,
            price_in: slot.price_in == null ? null : Number(slot.price_in), price_out: slot.price_out == null ? null : Number(slot.price_out),
            source: slot.source || null, status: 'pending', html: '', ms: 0, costUsd: 0, error: null,
            paid_by: null, prefer: slot.prefer || null, pin: slot.pin === true,
            element: null, element_error: null, element_price: null, tweaks: null }));
        const id = s.newId('dsn'), editKey = owner ? null : random();
        // "Research first": start the dive now, on the person's behalf, and point the design at it. The takes
        // wait for the report in run(); an attached dive is not run or charged again.
        let researchId = null;
        if (research) {
            if (!deepDive) throw fail(503, 'design.research_unavailable', 'Deep dives are not available here.');
            if (research.mode === 'attach' && research.id) {
                researchId = String(research.id);
            } else if (owner) {
                const started = await deepDive.create({ owner, question: research.question || prompt, depth: research.depth,
                    sites: research.sites || [], targetId: id });
                researchId = started.research.id;
            } else {
                throw fail(401, 'design.research_sign_in', 'Sign in to start a deep dive for this design.');
            }
        }
        const startRecord = start && typeof start === 'object' && !Array.isArray(start) ? start : {};
        const thumbnail = makeThumbnail({ kind, kindName: kindEntry.name, prompt,
            model: variants[0] ? (variants[0].name || variants[0].model) : null, variables: selected.variables || {} });
        await db.exec(`INSERT INTO designs(id,prompt,kind,theme_id,variants,owner,guest_hash,guest_ip,created_at,updated_at,
                frame,look,look_variables,models,start,source_design_id,estimate,thumbnail_svg,research_id)
            VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9::timestamptz,$9::timestamptz,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16::jsonb,$17,$18)`,
        [id, prompt, kind, selected.id, JSON.stringify(variants), owner, editKey ? hash(editKey).toString('hex') : null,
            owner ? null : ip, s.iso(), frame, lookId || selected.id, JSON.stringify(selected.variables || {}),
            requested ? JSON.stringify(requested) : null, JSON.stringify(startRecord), sourceDesignId || null,
            estimate ? JSON.stringify(estimate) : null, thumbnail, researchId]);
        // A signed-in maker's new design is Only me until its Share sheet says otherwise (a guest's is its key).
        if (sharing && owner) await sharing.register(id, owner).catch((err) => log.warn('[OpenVibe.Design] share row not registered:', err.message));
        run(id).catch(err => log.warn('[OpenVibe.Design] generation:', err.message));
        return { design: publicRow({ id, prompt, kind, theme_id: selected.id, frame, look: lookId || selected.id,
            look_variables: selected.variables || {}, models: requested, start: startRecord, source_design_id: sourceDesignId || null, research_id: researchId || null,
            estimate, variants, created_at: s.iso(), updated_at: s.iso() }),
        takes: variants.map(v => ({ id: v.id, slot: v.slot, provider: v.provider, model: v.model, modelId: v.model_id, name: v.name, status: v.status })),
        editKey, editUrl: editKey ? `/d/${id}?key=${encodeURIComponent(editKey)}` : null };
    }
    async function updateVariant(id, index, variant) {
        await db.exec('UPDATE designs SET variants=jsonb_set(variants, ARRAY[$2::text], $3::jsonb, false), updated_at=$4::timestamptz WHERE id=$1',
            [id, String(index), JSON.stringify(variant), s.iso()]);
    }
    /**
     * One Element take: the AI writes the look and the recipe together as JSON. The SDK (or, before the release
     * that carries it, the contracts schema) validates it; one refusal is sent back with its reasons and asked
     * once more. A second refusal marks the take failed with those reasons in plain words.
     */
    async function runElement(d, running, index, theme) {
        const variables = theme.variables || {};
        const base = elements.elementPrompt({ prompt: d.prompt, variables });
        const system = elements.elementSystemPrompt();
        let lastReasons = [];
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const prompt = attempt === 0 ? base
                : `${base}\n\nYour previous answer was refused for these reasons:\n- ${lastReasons.join('\n- ')}\nReturn the whole JSON object again with every one of them fixed.`;
            const out = await ai.text({
                prompt, system, maxTokens: 3000,
                target: { service: 'design', type: 'element_output', id: `${d.id}_${index}_${attempt}`.slice(0, 128) },
                prefer: running.prefer || null, person: d.owner || null,
            });
            let doc;
            try { doc = elements.prepareElement(elements.parseElement(out.text), { authorName: 'A maker' }); }
            catch (err) { lastReasons = [err.message]; continue; }
            delete doc.id;
            delete doc.revision;
            const check = elements.validateElement(doc);
            if (!check.ok) { lastReasons = check.reasons; continue; }
            let price = null;
            try { price = await elements.priceOf(doc, ai); } catch (err) { log.warn('[OpenVibe.Design] element price:', err.message); }
            return {
                ...running, status: 'done', html: JSON.stringify(doc), element: doc, element_error: null, element_price: price,
                tweaks: elements.tweaksFor(doc, variables), provider: out.provider || running.provider, model: out.model || running.model,
                ms: out.ms || 0, costUsd: Number(out.cost_usd || 0), error: null, paid_by: out.paid_by || null, prefer: out.prefer || running.prefer || null,
            };
        }
        throw fail(422, 'design.element_invalid', `The AI's element was refused: ${lastReasons.join('; ')}`);
    }

    async function run(id) {
        const d = await db.maybe('SELECT * FROM designs WHERE id=$1', [id]);
        if (!d) return;
        await Promise.allSettled(d.variants.map(async (v, index) => {
            if (v.status === 'done') return;
            const running = { ...v, status: 'running', error: null };
            await updateVariant(id, index, running);
            try {
                const t = await lookTheme(d);
                if (d.kind === 'element') {
                    const done = await runElement(d, running, index, t);
                    await updateVariant(id, index, done);
                    return;
                }
                // The dive's report is part of the brief for every take. A dive that is still running or failed
                // does not hold the design forever: the takes are drawn without it and the canvas says so.
                let report = null;
                if (d.research_id && deepDive) {
                    try {
                        const research = await deepDive.wait(d.research_id, { timeoutMs: Number(config.deepDive && config.deepDive.maxWaitMs) || 15 * 60_000 });
                        if (research && research.status === 'done') {
                            report = { brief: String(research.brief || '').slice(0, 12000), points: Array.isArray(research.points) ? research.points : [], url: research.report_url || null };
                        }
                    } catch (err) { log.warn('[OpenVibe.Design] design research:', err.message); }
                }
                const points = report && deepDive ? deepDive.pointsForTake(report.points, index, d.variants.length) : [];
                const withResearch = report && report.brief ? `${d.prompt}\n\n${report.brief}` : d.prompt;
                const prompt = [themePrompt(withResearch, Object.keys(t.variables || {})),
                    report && deepDive ? deepDive.pointLine(points, report) : '',
                    instructionFor(d.kind, d.frame), startPrompt(d.start || {})].filter(Boolean).join('\n\n');
                const out = await ai.generate({ prompt, category: categoryFor(d.kind),
                    slot: { provider: v.provider, model: v.model }, roundId: id, index,
                    prefer: v.prefer || null, person: d.owner || null, pin: v.pin === true });
                const current = await db.maybe('SELECT * FROM designs WHERE id=$1', [id]);
                const currentTheme = await lookTheme(current);
                await updateVariant(id, index, { ...running, status: 'done', html: wrap(out.html, currentTheme.variables || {}),
                    provider: out.provider, model: out.model, ms: out.ms, costUsd: out.cost_usd, error: null,
                    research_points: points, paid_by: out.paid_by || null, prefer: out.prefer || v.prefer || null });
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
    // Bench's board categories: the closest kind it knows for the new create kinds.
    const categoryOf = (kind) => kind === 'component' || kind === 'mark' ? 'logo'
        : kind === 'screen' ? 'mobile_app'
            : kind === 'slide' ? 'slides'
                : kind === 'social-card' ? 'logo' : 'landing';
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

    async function read(id, owner, key, viewer = null) {
        const d = await row(id, owner, key, viewer), selected = await lookTheme(d);
        const research = d.research_id && deepDive
            ? await (owner && d.owner === owner ? deepDive.get(d.research_id, owner) : deepDive.summary(d.research_id)).catch(() => null)
            : null;
        const p = await pickRow(id);
        const versions = p ? await db.many('SELECT * FROM design_versions WHERE design_id=$1 ORDER BY seq', [id]) : [];
        const current = p ? versions.find(v => Number(v.seq) === Number(p.current_seq)) : null;
        const variants = d.variants.map((full, index) => {
            // `pin` is how the run was asked to route, not part of the frame; `prefer` is the request before the run
            // and the run's explain (with `honoured`) after it.
            const { pin, ...v } = full;
            if (d.kind === 'element') {
                // An element is stored as a JSON document, not a document to wrap. Its look is drawn from the
                // component and the theme's tokens; the sliders are generated from its own look.
                const doc = full.element || null;
                return { ...v, html: '', element: doc, element_error: full.element_error || null,
                    element_price: full.element_price || null, look: doc ? elements.renderLook(doc) : null,
                    tweaks: doc ? elements.tweaksFor(doc, selected.variables || {}) : null,
                    currentSeq: p && index === Number(p.variant_index) && current ? Number(current.seq) : null };
            }
            if (p && index === Number(p.variant_index) && current) {
                return { ...v, html: wrap(current.html, selected.variables || {}), currentSeq: Number(current.seq), edited: current.kind !== 'generated' };
            }
            return v.status === 'done' ? { ...v, html: wrap(v.html, selected.variables || {}) } : v;
        });
        return { design: { ...publicRow(d), research }, variants, pick: pickPublic(p, current), versions: versions.map(v => versionPublic(v, p ? p.current_seq : 1)) };
    }

    async function pick({ id, variantIndex, variantId, owner, key, subject = null, token = null, viewer = null }) {
        const d = await row(id, owner, key, viewer, true);
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
            const data = await read(id, owner, key, viewer);
            return { ...data, vote, idempotent: true };
        }
        const inserted = await db.maybe(`INSERT INTO design_picks(design_id,variant_index,variant_id,voter_subject,created_at,updated_at)
            VALUES($1,$2,$3,$4,$5::timestamptz,$5::timestamptz) ON CONFLICT (design_id) DO NOTHING RETURNING *`,
        [id, index, variant.id, subject || null, s.iso()]);
        const p = inserted || await pickRow(id);
        if (!p || Number(p.variant_index) !== index) throw fail(409, 'design.already_picked', 'This design already has a working frame.');
        await ensureBaseVersion(d, p, variant);
        const vote = await recordPickVote(d, subject, token);
        const data = await read(id, owner, key, viewer);
        return { ...data, vote, idempotent: !inserted };
    }

    async function currentForEdit(id, owner, key, viewer = null) {
        const d = await row(id, owner, key, viewer, true);
        const p = await pickRow(id);
        if (!p) throw fail(409, 'design.no_pick', 'Pick a working frame before editing it.');
        const selected = await lookTheme(d);
        const variant = d.variants[Number(p.variant_index)];
        if (!variant || variant.status !== 'done') throw fail(409, 'design.variant_not_ready', 'The working frame is not ready yet.');
        let current = await versionRow(id, p.current_seq);
        if (!current) {
            await ensureBaseVersion(d, p, variant);
            current = await versionRow(id, p.current_seq);
        }
        return { d, p, selected, variant, current };
    }

    async function chatEdit({ id, instruction, owner, key, subject = null, viewer = null }) {
        instruction = String(instruction == null ? '' : instruction).trim();
        if (!instruction || instruction.length > CHAT_INSTRUCTION_MAX)
            throw fail(422, 'design.invalid_instruction', `Write an instruction up to ${CHAT_INSTRUCTION_MAX} characters.`);
        const { d, p, selected, variant } = await currentForEdit(id, owner, key, viewer);
        if (d.kind === 'element') throw fail(409, 'design.element_no_chat', 'An element is changed with its sliders, not a chat edit.');
        const used = await db.maybe('UPDATE design_picks SET chat_edits=chat_edits+1, updated_at=$2 WHERE design_id=$1 AND chat_edits < $3 RETURNING chat_edits',
            [d.id, s.iso(), chatEditLimit]);
        if (!used) throw fail(429, 'design.edit_limit', `This design has used its ${chatEditLimit} AI edits. Click edits and undo still work.`);
        const current = await versionRow(id, p.current_seq);
        const variables = selected.variables || {};
        const names = Object.keys(variables).join(', ');
        const prompt = editPrompt(instruction, String(current.html || variant.html || '').slice(0, 80000), names);
        // An edit stays on the model that drew the frame, as a soft preference (the person's own key first), never a pin.
        const asked = variant.prefer && variant.prefer.provider ? variant.prefer : null;
        const prefer = asked && asked.provider && !String(asked.provider).startsWith('byo:self:')
            ? { provider: asked.provider, model: asked.model || null }
            : variant.provider && variant.provider !== 'ai' && !String(variant.provider).startsWith('byo:self:') && variant.model
                ? { provider: variant.provider, model: variant.model } : null;
        const out = await ai.generate({ prompt, category: categoryFor(d.kind), slot: { provider: variant.provider, model: variant.model },
            roundId: d.id, index: variant.slot, prefer, person: subject || d.owner || null, pin: false });
        const html = wrap(out.html, variables);
        const version = await addVersion(d, p, { kind: 'chat', html, instruction, model: out.model || variant.model,
            provider: out.provider || variant.provider, costUsd: out.cost_usd, ms: out.ms, createdBy: subject || (d.owner ? 'owner' : 'guest') });
        const fresh = await pickRow(id);
        const data = await read(id, owner, key, viewer);
        return { version: versionPublic(version, fresh.current_seq), html, pick: data.pick, versions: data.versions };
    }

    async function clickEdit({ id, path, text, color, spacing, align, owner, key, subject = null, viewer = null }) {
        const { d, p, selected, variant } = await currentForEdit(id, owner, key, viewer);
        if (d.kind === 'element') throw fail(409, 'design.element_no_click', 'An element is changed with its sliders, not a click edit.');
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
        const data = await read(id, owner, key, viewer);
        return { version: versionPublic(version, fresh.current_seq), html, pick: data.pick, versions: data.versions };
    }

    async function versions(id, owner, key, viewer = null) {
        const d = await row(id, owner, key, viewer);
        const p = await pickRow(id);
        const list = p ? await db.many('SELECT * FROM design_versions WHERE design_id=$1 ORDER BY seq', [id]) : [];
        return { designId: d.id, currentSeq: p ? Number(p.current_seq) : null, versions: list.map(v => versionPublic(v, p ? p.current_seq : 1)) };
    }

    async function undo(id, owner, key, viewer = null) {
        const d = await row(id, owner, key, viewer, true);
        const p = await pickRow(id);
        if (!p) throw fail(409, 'design.no_pick', 'Pick a working frame before undoing an edit.');
        const current = await versionRow(id, p.current_seq);
        if (!current || current.parent_seq == null) {
            return { changed: false, ...(await read(id, owner, key, viewer)) };
        }
        const stack = Array.isArray(p.redo_stack) ? p.redo_stack.slice() : [];
        stack.push(Number(current.seq));
        await db.exec('UPDATE design_picks SET current_seq=$2, redo_stack=$3::jsonb, updated_at=$4 WHERE design_id=$1',
            [d.id, Number(current.parent_seq), JSON.stringify(stack.slice(-100)), s.iso()]);
        return { changed: true, ...(await read(id, owner, key, viewer)) };
    }

    async function redo(id, owner, key, viewer = null) {
        const d = await row(id, owner, key, viewer, true);
        const p = await pickRow(id);
        if (!p) throw fail(409, 'design.no_pick', 'Pick a working frame before redoing an edit.');
        const stack = Array.isArray(p.redo_stack) ? p.redo_stack.slice() : [];
        if (!stack.length) return { changed: false, ...(await read(id, owner, key, viewer)) };
        const seq = Number(stack.pop());
        const target = await versionRow(id, seq);
        if (!target) return { changed: false, ...(await read(id, owner, key, viewer)) };
        await db.exec('UPDATE design_picks SET current_seq=$2, redo_stack=$3::jsonb, updated_at=$4 WHERE design_id=$1',
            [d.id, seq, JSON.stringify(stack), s.iso()]);
        return { changed: true, ...(await read(id, owner, key, viewer)) };
    }

    async function setTheme(id, themeId, owner, key, viewer = null) {
        await row(id, owner, key, viewer, true);
        const selected = await theme(themeId);
        await db.exec('UPDATE designs SET theme_id=$1,look=$1,look_variables=$4::jsonb,updated_at=$2::timestamptz WHERE id=$3',
            [selected.id, s.iso(), id, JSON.stringify(selected.variables || {})]);
        return { themeId: selected.id, variables: selected.variables || {} };
    }
    function recentItem(d, key = null) {
        const suffix = key ? `?key=${encodeURIComponent(key)}` : '';
        const thumb = `/api/create/designs/${encodeURIComponent(d.id)}/thumb.svg${suffix}`;
        return { ...publicRow(d), url: `/d/${d.id}${suffix}`, thumbnail: thumb };
    }
    /**
     * The person's designs, newest first. The present page asks for three (its own list); the create API passes
     * { limit, before } and pages with the last createdAt. A guest's designs are the ones their draft cookie names.
     */
    async function recent(owner, guestLinks = [], { limit = 3, before = null } = {}) {
        const size = Math.max(1, Math.min(48, Number(limit) || 3));
        const cursor = before && !Number.isNaN(Date.parse(before)) ? before : null;
        if (owner) {
            const rows = await db.many(`SELECT * FROM designs WHERE owner=$1
                AND ($2::timestamptz IS NULL OR created_at < $2::timestamptz)
                ORDER BY created_at DESC, id DESC LIMIT $3`, [owner, cursor, size]);
            return rows.map(d => recentItem(d));
        }
        const result = [];
        for (const item of Array.isArray(guestLinks) ? guestLinks : []) {
            try {
                const d = await row(item.id, null, item.key);
                if (cursor && new Date(d.created_at).getTime() >= new Date(cursor).getTime()) continue;
                result.push(recentItem(d, item.key));
            } catch { /* stale draft */ }
        }
        result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return result.slice(0, size);
    }

    /** The recent list's card for one design, with the same access check every read uses. */
    async function thumbnail(id, owner, key, viewer = null) {
        const d = await row(id, owner, key, viewer);
        let svg = d.thumbnail_svg;
        if (!svg) {
            const kindEntry = kindOf(d.kind);
            const selected = await lookTheme(d).catch(() => ({ variables: {} }));
            svg = makeThumbnail({ kind: d.kind, kindName: (kindEntry && kindEntry.name) || 'Design', prompt: d.prompt,
                model: (d.variants[0] && (d.variants[0].name || d.variants[0].model)) || null, variables: selected.variables || {} });
        }
        return { svg, design: publicRow(d) };
    }
    async function resume() {
        const pending = await db.many("SELECT id FROM designs WHERE variants @> '[{\"status\":\"pending\"}]'::jsonb OR variants @> '[{\"status\":\"running\"}]'::jsonb ORDER BY created_at LIMIT 20");
        for (const d of pending) run(d.id).catch(err => log.warn('[OpenVibe.Design] resume:', err.message));
    }
    /** The picked element of an element design, through the same access check every read uses. */
    async function elementDraft({ id, owner, key, viewer = null }) {
        const { d, p, selected, variant } = await currentForEdit(id, owner, key, viewer);
        if (d.kind !== 'element') throw fail(409, 'design.not_element', 'This design is not an element.');
        if (!variant || !variant.element) throw fail(409, 'design.element_not_ready', 'The element is not ready yet.');
        return { d, p, selected, variant, element: variant.element };
    }

    /** Move the generated tweak sliders: size, tint and label, applied to the look only. */
    async function tweakElement({ id, values = {}, owner, key, viewer = null }) {
        const { d, p, selected, variant } = await elementDraft({ id, owner, key, viewer });
        let doc;
        try { doc = elements.applyTweaks(variant.element, values || {}, selected.variables || {}); }
        catch (err) { throw fail(err.status || 422, err.code || 'design.invalid_tweak', err.detail || err.message); }
        const check = elements.validateElement(doc);
        if (!check.ok) throw fail(422, 'design.element_invalid', `The change was refused: ${check.reasons.join('; ')}`);
        let price = variant.element_price || null;
        try { price = await elements.priceOf(doc, ai); } catch { /* the price line says unknown */ }
        await updateVariant(d.id, Number(p.variant_index), { ...variant, element: doc, html: JSON.stringify(doc),
            element_price: price, tweaks: elements.tweaksFor(doc, selected.variables || {}) });
        return read(id, owner, key, viewer);
    }

    /** The element to hand to Live or Exchange: the picked document with the maker's own display name. */
    async function elementOf({ id, owner, key, viewer = null, authorName = null, sharing = 'gallery' }) {
        const { d, variant } = await elementDraft({ id, owner, key, viewer });
        const doc = JSON.parse(JSON.stringify(variant.element));
        if (authorName) doc.author = { name: String(authorName).slice(0, 80) };
        doc.sharing = sharing;
        return { design: publicRow(d), element: doc };
    }

    /** Run the picked element on sample data: fake presses of every role, a fake chat, and no robot or AI call. */
    async function simulate(id, { owner, key, viewer = null } = {}) {
        const { d, variant } = await elementDraft({ id, owner, key, viewer });
        let price = variant.element_price || null;
        try { price = await elements.priceOf(variant.element, ai); } catch { /* said as unknown */ }
        return { designId: d.id, prompt: d.prompt, element: variant.element, price, ...elements.simulateElement(variant.element, { price }) };
    }

    /**
     * A remix opens as an editable copy: a Design of kind Element whose one take is the gallery listing's
     * document, credited to the original. It runs no AI and spends nothing; the person tweaks and publishes.
     */
    async function importElement({ element, owner, listing, remixOf = null } = {}) {
        if (!owner) throw fail(401, 'auth.required', 'Sign in to remix an element.');
        if (!element || typeof element !== 'object') throw fail(422, 'design.invalid_element', 'The listing does not carry an element document.');
        const selected = await theme(null);
        const variables = selected.variables || {};
        const id = s.newId('dsn');
        const doc = JSON.parse(JSON.stringify(element));
        if (doc.name && !/\(remix\)$/i.test(doc.name)) doc.name = `${doc.name} (remix)`;
        const variant = {
            id: s.newId('dva'), slot: 0, provider: 'gallery', model: (listing && listing.author && listing.author.name) || 'gallery',
            model_id: null, name: null, price_in: null, price_out: null, source: 'gallery', status: 'done', html: JSON.stringify(doc),
            ms: 0, costUsd: 0, error: null, paid_by: null, prefer: null, pin: false,
            element: doc, element_error: null, element_price: null, tweaks: elements.tweaksFor(doc, variables),
        };
        const prompt = `Remix of ${listing.name}`;
        const thumbnail = makeThumbnail({ kind: 'element', kindName: 'Element', prompt, model: variant.model, variables });
        await db.exec(`INSERT INTO designs(id,prompt,kind,theme_id,variants,owner,guest_hash,guest_ip,created_at,updated_at,
                frame,look,look_variables,models,start,source_design_id,estimate,thumbnail_svg,element_remix_of)
            VALUES($1,$2,$3,$4,$5::jsonb,$6,NULL,NULL,$7::timestamptz,$7::timestamptz,$8,$9,$10::jsonb,NULL,$11::jsonb,NULL,NULL,$12,$13)`,
        [id, prompt, 'element', selected.id, JSON.stringify([variant]), owner, s.iso(), 'phone', selected.id,
            JSON.stringify(variables), JSON.stringify({ from_listing: listing.id, by: listing.author && listing.author.name || null }),
            thumbnail, remixOf || listing.id]);
        await db.exec(`INSERT INTO design_picks(design_id,variant_index,variant_id,created_at,updated_at)
            VALUES($1,0,$2,$3::timestamptz,$3::timestamptz) ON CONFLICT (design_id) DO NOTHING`, [id, variant.id, s.iso()]);
        if (sharing) await sharing.register(id, owner).catch((err) => log.warn('[OpenVibe.Design] share row not registered:', err.message));
        return { design: { id, prompt, kind: 'element' }, editUrl: `/d/${id}` };
    }

    /** Remember a hand-off's outcome beside the element, so the canvas can say what happened after a reload. */
    async function rememberHandoff({ id, owner, key, viewer = null, kind, value }) {
        if (!['channel', 'listing'].includes(kind)) throw fail(422, 'design.invalid_handoff', 'Choose channel or listing.');
        await row(id, owner, key, viewer, true);
        const column = kind === 'channel' ? 'element_channel' : 'element_listing';
        await db.exec(`UPDATE designs SET ${column}=$2::jsonb, updated_at=$3::timestamptz WHERE id=$1`, [id, JSON.stringify(value || null), s.iso()]);
        return read(id, owner, key, viewer);
    }

    /**
     * Publish the working frame on openvibe.space (publish.js): its owner only (a guest's private link cannot), and
     * only once a frame is picked. The site is remembered, so publishing again updates the same address.
     */
    async function publish({ id, owner, name = '', publisher, viewer = null }) {
        if (!owner) throw fail(401, 'auth.required', 'Sign in to publish a design on openvibe.space.');
        const d = await row(id, owner, null, viewer, true);
        if (d.kind === 'element') throw fail(409, 'design.element_not_site', 'An element is added to your Live channel or published to the Elements and packs gallery, not to a Space site.');
        if (d.owner !== owner) throw fail(403, 'design.forbidden', 'Only the person who made this design can publish it.');
        const data = await read(id, owner, null);
        const index = data.pick ? Number(data.pick.variantIndex) : -1;
        const variant = index >= 0 ? data.variants[index] : null;
        const out = await publisher.publish({ design: d, html: variant && variant.html, subject: owner, name });
        await db.exec('UPDATE designs SET space_site_id = $2, space_url = $3, published_at = now(), updated_at = now() WHERE id = $1', [id, out.siteId, out.url]);
        return out;
    }

    return { create, read, setTheme, recent, thumbnail, resume, theme, pick, chatEdit, clickEdit, versions, undo, redo, chatEditLimit, publish,
        elementDraft, tweakElement, elementOf, simulate, rememberHandoff, importElement };
}

module.exports = { createDesigns, wrap, tokenCss, themeCss, themePrompt, editPrompt };
