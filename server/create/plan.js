'use strict';

/**
 * One plan for both doors: POST /api/create/estimate and POST /api/create.
 *
 * resolvePlan() validates a request against the options the page was given, reads a starting URL through the
 * guarded egress path (server/create/egress.js), loads a starting design through the ordinary access check, and
 * turns the chosen models and takes into the slots the run will use. estimatePlan() prices exactly those slots.
 * The create route calls both; the estimate route calls both and stops. Neither can drift from the other.
 *
 * Every field is optional. No models means today's behaviour (AI's design plan, Claude first, three takes); no
 * look means the first theme in the centre, as the present page does; no frame means the kind's first frame.
 */

const { kindOf, frameOf, instructionFor } = require('./kinds');
const { fetchStartingPage } = require('./egress');
const { publicStart, containsStart, startPrompt } = require('./start');

const MEDIA_ID = /^[A-Za-z0-9][A-Za-z0-9._~/-]{0,300}$/;
const MAX_PROMPT = 4000;
const MAX_START_HTML = 12000;
const ESTIMATE_OUTPUT_TOKENS = 4000;

const fail = (status, code, detail) => Object.assign(new Error(detail), { status, code, detail });
const micro = (value) => Math.ceil(Number(value || 0) * 1e6) / 1e6;

/**
 * Resolve a request body into the plan both routes use.
 * ctx: { options, designs, ai, owner, key, viewer, config }
 */
async function resolvePlan(body = {}, ctx = {}) {
    const { options, designs, ai, owner = null, key = null, viewer = null, config = {} } = ctx;
    const raw = body && typeof body === 'object' ? body : {};

    const kind = kindOf(raw.kind || 'page');
    if (!kind) throw fail(422, 'create.kind', 'Choose one of the kinds this page offers.');
    const wantedFrame = raw.frame == null || raw.frame === '' ? kind.frames[0] : String(raw.frame);
    const frame = frameOf(wantedFrame);
    if (!frame || !kind.frames.includes(frame.id)) {
        const allowed = kind.frames.join(', ');
        throw fail(422, 'create.frame', `A ${kind.name.toLowerCase()} can be made at: ${allowed}.`);
    }

    const looks = Array.isArray(options.looks) ? options.looks : [];
    let look;
    if (raw.look != null && raw.look !== '') {
        look = looks.find((item) => item.id === String(raw.look));
        if (!look) throw fail(422, 'create.look', 'Choose a look from the list this page offers.');
    } else {
        look = looks.find((item) => item.source === 'theme') || looks[0] || { id: 'system', name: 'System', source: 'system', variables: {}, swatch: [] };
    }

    const prompt = String(raw.prompt == null ? '' : raw.prompt).trim();
    if (prompt.length > MAX_PROMPT) throw fail(422, 'create.prompt', `Describe the design in ${MAX_PROMPT} characters or fewer.`);

    const start = {};
    const rawStart = raw.start && typeof raw.start === 'object' && !Array.isArray(raw.start) ? raw.start : {};
    if (rawStart.url) {
        let page;
        try { page = await fetchStartingPage(rawStart.url); } catch (err) {
            throw fail(err.status || 422, err.code || 'create.start_url', err.detail || 'That starting page could not be read.');
        }
        start.url = page.url;
        start.title = page.title;
        start.excerpt = page.text;
    }
    if (rawStart.design_id) {
        if (!designs || typeof designs.read !== 'function') throw fail(503, 'create.start_design', 'Starting designs are not available here.');
        const id = String(rawStart.design_id);
        const sourceKey = rawStart.key || key || null;
        let data;
        try { data = await designs.read(id, owner, sourceKey, viewer); } catch (err) {
            throw fail(err.status || 404, err.code || 'create.start_design', err.detail || 'That design could not be opened.');
        }
        const index = data.pick ? Number(data.pick.variantIndex) : data.variants.findIndex((v) => v && v.status === 'done');
        const picked = index >= 0 ? data.variants[index] : null;
        if (!picked || !picked.html) throw fail(409, 'create.start_not_ready', 'That design has no finished frame to start from yet.');
        start.design_id = data.design.id;
        start.source_design_id = data.design.id;
        start.excerpt = String(picked.html).slice(0, MAX_START_HTML);
    }
    const image = rawStart.image || rawStart.image_id || null;
    if (image) {
        const id = String(image);
        if (!MEDIA_ID.test(id)) throw fail(422, 'create.start_image', 'Upload the picture to OpenVibe.Media and send the id it answers.');
        start.image = id;
        const origin = String((config.media && config.media.publicOrigin) || 'https://openvibe.media').replace(/\/+$/, '');
        start.image_url = `${origin}/f/${encodeURIComponent(id)}`;
    }
    if (!prompt && !containsStart(start)) throw fail(422, 'create.prompt', 'Describe the design first.');

    // "Research first": a deep dive's report becomes part of the generation brief. Attaching an existing dive
    // adds nothing to the price; starting one is priced from AI's own depths before the plan is returned.
    let research = null;
    const rawResearch = raw.research;
    if (rawResearch != null && rawResearch !== false && rawResearch !== '' && rawResearch !== 'off') {
        if (!ctx.deepDive) throw fail(503, 'create.research', 'Deep dives are not available here.');
        const value = typeof rawResearch === 'string' ? { ref: rawResearch } : (typeof rawResearch === 'object' ? rawResearch : {});
        const ref = value.id || value.ref || value.run_id || null;
        if (ref) {
            // A dive Design already follows, or one the person ran on OpenVibe Exchange and pasted here. Attaching
            // is a read: it starts no run and adds nothing to the price.
            let row;
            try {
                const attached = await ctx.deepDive.attach({ owner, token: ctx.viewer && ctx.viewer.token, ref: String(ref) });
                row = attached.research;
            } catch (err) {
                if (err.status === 401 || err.status === 403) throw fail(err.status, 'create.research', err.detail || 'That deep dive is not yours to attach.');
                throw fail(err.status || 404, 'create.research', err.detail || 'That deep dive was not found.');
            }
            if (!row) throw fail(404, 'create.research', 'That deep dive was not found.');
            if (['failed', 'cancelled'].includes(row.status)) throw fail(409, 'create.research', 'That deep dive did not finish; attach one with a report.');
            research = { mode: 'attach', id: row.id, runId: row.runId || null, depth: row.depth, question: row.question,
                status: row.status, price_usd: 0, currency: 'USD', points: row.pointsCount || 0 };
        } else {
            const wanted = String(value.depth || value.mode || 'thorough').toLowerCase();
            if (!['quick', 'thorough', 'expert'].includes(wanted)) throw fail(422, 'create.research', 'Choose Quick, Thorough or Expert for the deep dive.');
            let depths = [];
            try { depths = (await ctx.deepDive.options()).depths || []; } catch { depths = []; }
            const chosen = depths.find((d) => d.id === wanted) || null;
            const sites = Array.isArray(value.sites) ? value.sites : String(value.sites || '').split(/\r?\n|,/).map((x) => x.trim()).filter(Boolean);
            research = { mode: 'new', depth: wanted, question: String(value.question || prompt || start.title || 'A design').slice(0, 2000),
                sites: sites.filter((x) => /^https?:\/\//i.test(x)).slice(0, 30),
                price_usd: chosen && chosen.price_usd != null ? Number(chosen.price_usd) : null,
                currency: (chosen && chosen.currency) || 'USD', sites_count: chosen && chosen.sites || null, points: 0 };
        }
    }

    const catalogue = Array.isArray(options.models) ? options.models : [];
    const wanted = Array.isArray(raw.models) ? raw.models.map((id) => String(id == null ? '' : id).trim()).filter(Boolean) : [];
    const ids = [...new Set(wanted)];
    let models = [];
    let takes;
    let legacy = false;
    const slots = [];

    const preferOf = (model) => model.prefer || (model.provider && model.model ? { provider: model.provider, model: model.model } : model.model ? { model: model.model } : null);

    if (ids.length) {
        if (ids.length > options.limits.models) throw fail(422, 'create.models', `Choose at most ${options.limits.models} models.`);
        for (const id of ids) {
            const found = catalogue.find((model) => model.id === id);
            if (!found) throw fail(422, 'create.model', `"${id}" is not one of the models this page offers.`);
            models.push({ ...found, prefer: preferOf(found) });
        }
        takes = raw.takes == null || raw.takes === '' ? (models.length > 1 ? 1 : options.takes.default) : Number(raw.takes);
        if (!Number.isInteger(takes) || takes < options.takes.min || takes > options.takes.max) {
            throw fail(422, 'create.takes', `Choose ${options.takes.min} to ${options.takes.max} takes.`);
        }
        if (models.length * takes > options.limits.takes_total) {
            throw fail(422, 'create.takes', `That is more than ${options.limits.takes_total} takes at once.`);
        }
        for (const model of models) for (let i = 0; i < takes; i++) {
            slots.push({ ...model, take: i, pin: model.pin !== false, prefer: model.prefer });
        }
    } else {
        // Today's behaviour: AI's design plan (Claude first, or the compare three), three takes. The estimate
        // prices the same slots the old create path would run.
        legacy = true;
        takes = 3;
        let plan = { slots: [] };
        if (ai && typeof ai.designPlan === 'function') {
            try { plan = await ai.designPlan(raw.who || 'claude'); } catch { plan = { slots: [] }; }
        }
        const planned = (plan.slots || []).slice(0, 3);
        for (const slot of planned) {
            const found = catalogue.find((model) => model.provider === slot.provider && model.model === slot.model) || null;
            const model = found
                ? { ...found, prefer: preferOf(found) }
                : { id: `${slot.provider}:${slot.model || ''}`, name: slot.model || slot.provider, provider: slot.provider, model: slot.model || null,
                    price_in: null, price_out: null, source: 'exchange', pin: false, prefer: slot.provider ? { provider: slot.provider, ...(slot.model ? { model: slot.model } : {}) } : null };
            slots.push({ ...model, take: 0, pin: false, prefer: model.prefer });
        }
        while (slots.length < 3) slots.push({ id: 'openvibe:auto', name: 'OpenVibe', provider: 'ai', model: null, price_in: null, price_out: null, source: 'exchange', take: slots.length, pin: false, prefer: null });
    }

    const instruction = instructionFor(kind.id, frame.id);
    const lookNames = Object.keys(look.variables || {}).join(', ');
    const startText = startPrompt(start);
    const inputChars = (prompt + instruction + lookNames + startText).length;
    const input_tokens = Math.max(1, Math.ceil(inputChars / 4));
    const output_tokens = ESTIMATE_OUTPUT_TOKENS;

    return {
        prompt, kind: kind.id, kindName: kind.name, instruction,
        frame: frame.id, frameInfo: frame,
        look: look.id, lookName: look.name, lookSource: look.source, lookVariables: look.variables || {},
        themeId: look.themeId || (look.source === 'theme' ? look.id : null),
        start, startText,
        models, takes, slots, legacy, research,
        input_tokens, output_tokens,
    };
}

function slotCost(slot, inputTokens, outputTokens) {
    const input = slot.price_in == null ? null : Number(slot.price_in);
    const output = slot.price_out == null ? null : Number(slot.price_out);
    if (input == null && output == null) return { cost: 0, priced: false };
    const cost = ((Number(inputTokens) || 0) * (Number(input) || 0) + (Number(outputTokens) || 0) * (Number(output) || 0)) / 1_000_000;
    return { cost: micro(cost), priced: true };
}

/** Price the exact slots resolvePlan produced. → per model, total, in USD. */
function estimatePlan(plan) {
    const per = new Map();
    let priced = false;
    for (const slot of plan.slots || []) {
        const { cost, priced: isPriced } = slotCost(slot, plan.input_tokens, plan.output_tokens);
        if (isPriced) priced = true;
        const key = slot.id || `${slot.provider || 'ai'}:${slot.model || ''}`;
        if (!per.has(key)) {
            per.set(key, {
                id: key, name: slot.name || slot.model || slot.provider || 'OpenVibe.Design',
                provider: slot.provider || null, source: slot.source || 'exchange',
                takes: 0, cost_usd: 0, price_in: slot.price_in == null ? null : Number(slot.price_in),
                price_out: slot.price_out == null ? null : Number(slot.price_out), priced: isPriced,
            });
        }
        const entry = per.get(key);
        entry.takes += 1;
        entry.cost_usd = micro(entry.cost_usd + cost);
        entry.priced = entry.priced || isPriced;
    }
    const perModel = [...per.values()];
    const modelTotal = micro(perModel.reduce((sum, entry) => sum + entry.cost_usd, 0));
    const research = plan.research ? {
        mode: plan.research.mode, depth: plan.research.depth, question: plan.research.question,
        id: plan.research.id || null, status: plan.research.status || null,
        price_usd: plan.research.price_usd == null ? null : micro(Number(plan.research.price_usd)),
        currency: plan.research.currency || 'USD', priced: plan.research.price_usd != null,
        sites: plan.research.sites_count || null,
    } : null;
    const researchCost = research && research.price_usd != null ? Number(research.price_usd) : 0;
    const total = micro(modelTotal + researchCost);
    const cost = { currency: 'USD', per_model: perModel, research, total_usd: total, total };
    return {
        currency: 'USD',
        per_model: perModel,
        research,
        total_usd: total,
        cost,
        takes: (plan.slots || []).length,
        models: perModel.length,
        input_tokens: plan.input_tokens,
        output_tokens: plan.output_tokens,
        priced: priced || (research ? research.priced : false),
    };
}

/** Add the person's Balance and whether it covers the estimate. A missing Balance is null, never zero. */
function withBalance(estimate, balance) {
    if (!balance) return { ...estimate, balance: null, covers: null };
    const covers = estimate.total_usd <= Number(balance.available_usd) + 1e-9;
    return { ...estimate, balance: { ...balance, covers }, covers };
}

module.exports = { resolvePlan, estimatePlan, withBalance, publicStart, startPrompt, slotCost, ESTIMATE_OUTPUT_TOKENS, MAX_PROMPT };
