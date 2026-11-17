'use strict';
/**
 * The ways openvibe.design draws an icon (2026-11-16; the owner: "make sure that the icon generator in all of
 * openvibe.design is interconnected with openvibe.exchange and can use all the different model types and harnesses …
 * for different methods of generation", after a hand-rounded gear: "make sure … this doesn't ever happen again").
 *
 *   shape    Exact shape: computed point by point (gears, stars, polygons, hearts). No model; never lopsided.
 *   write    Draw: any text or code model on Exchange writes the drawing in one go.
 *   refine   Draw, measure, fix: the model draws, Design measures every drawing (geometry, centre, the 24 grid,
 *            the house rules) and sends back what is off, up to three rounds, keeping the best.
 *   trace    Picture, then trace: any image model on Exchange paints the icon; Design traces the picture into the
 *            solid drawing and a text model draws its line twin from it.
 *   harness  Coding agent: one of Codes' harnesses (Claude Code, Codex, OpenCode …) draws it in a Codes task, with
 *            the glyph set in OpenVibe.Shared to read and the geometry check (POST /api/v1/glyphs/check) to use.
 *   auto     An exact shape when the name is a regular one (a gear, a star), else Draw, measure, fix.
 *
 * Whatever the method, every drawing goes through the same gate (drafts.js): it is cleaned, fitted, centred on its
 * ink, snapped to exact mirror symmetry where it is nearly there, and measured; a drawing whose name means a regular
 * shape (geometry.EXPECTED) and is not exact is refused. A vision model may judge the survivors (judge), else they are
 * kept best geometry first.
 *
 *   options({ ai, codes, log, token })  → { methods, models: { draw, image, vision }, harnesses }   for the page and the API;
 *                                with the person's token, their own keys and machines join draw and image (AI's choices)
 *   shapesFor(name, sentence)    → exact drawings when the words name a regular shape, else []
 *   METHODS, METHOD_IDS
 */
const shapes = require('./shapes');

const METHODS = [
    { id: 'auto', name: 'Auto', what: 'An exact shape when the name is one (a gear, a star, a heart), else draw, measure and fix.' },
    { id: 'shape', name: 'Exact shape', what: 'Computed point by point. Gears, stars, polygons and hearts; no model, never lopsided.' },
    { id: 'refine', name: 'Draw, measure, fix', what: 'A model draws; every drawing is measured and what is off goes back to it, up to three rounds.', needs: 'draw', signedIn: true },
    { id: 'write', name: 'Draw', what: 'A model writes the drawing in one go.', needs: 'draw' },
    { id: 'trace', name: 'Picture, then trace', what: 'An image model paints it; the picture is traced into the solid drawing, and a model draws the line twin.', needs: 'image', signedIn: true },
    { id: 'harness', name: 'Coding agent', what: 'A coding agent draws it in Codes, with the whole set and the geometry check at hand. It takes a few minutes.', needs: 'harness', signedIn: true },
];
const METHOD_IDS = METHODS.map((m) => m.id);

// Words that name a regular shape, and the exact drawings for them (a few variants, the first the house's own).
const REGULAR = [
    [/\b(gear|gears|cog|cogs|settings|preferences|config|configure|options)\b/, () => [shapes.gear(), shapes.gear({ teeth: 6, root: 6.2, hole: 2.6 })]],
    [/\b(star|stars|favou?rite|rating)\b/, () => [shapes.star(), shapes.star({ inner: 0.42 }), shapes.star({ points: 6, inner: 0.55 })]],
    [/\b(heart|hearts|love|like)\b/, () => [shapes.heart()]],
    [/\bhexagon\b/, () => [shapes.polygon({ sides: 6 })]],
    [/\bpentagon\b/, () => [shapes.polygon({ sides: 5 })]],
    [/\b(octagon|stop sign)\b/, () => [shapes.polygon({ sides: 8 })]],
    [/\btriangle\b/, () => [shapes.polygon({ sides: 3 })]],
];
function shapesFor(name, sentence = '') {
    const words = `${String(name || '').replace(/-/g, ' ')} ${String(sentence || '')}`.toLowerCase();
    const head = String(name || '').toLowerCase().split('-')[0];
    for (const [re, make] of REGULAR) if (re.test(head) || re.test(words.split(/[.,;:]/)[0])) return make();
    return [];
}

/** A catalogue model as a choice: its name, a short note, and the offer a run may prefer. */
function entryOf(doc) {
    const offers = Array.isArray(doc && doc.offers) ? doc.offers.filter(Boolean) : [];
    const priced = offers.filter((o) => o.price && Number.isFinite(Number(o.price.out)));
    priced.sort((a, b) => Number(a.price.in || 0) + Number(a.price.out) - Number(b.price.in || 0) - Number(b.price.out));
    const best = priced[0] || offers[0];
    if (!best || !best.provider) return null;
    const price = best.price && Number.isFinite(Number(best.price.out)) ? `$${Number(best.price.out)} out per 1M` : (best.free_tier ? 'free to try' : '');
    return { id: doc.slug, name: doc.name || doc.slug, note: [best.provider_name || best.provider, price].filter(Boolean).join(' · '), prefer: { provider: best.provider, ...(best.model ? { model: best.model } : {}) } };
}

/** A person's own key or machine (AI's choices) as a pick: it runs as a per-run choice, at no charge. */
function choiceEntry(c, source) {
    if (!c || !c.model) return null;
    const machine = source === 'machines' ? (c.machine || null) : null;
    return {
        id: source === 'machines' ? `machines:${machine || 'any'}:${c.model}` : `keys:${c.model}`,
        name: String(c.name || c.model).slice(0, 80),
        note: source === 'machines' ? `${c.machine_name || 'Your machine'} · no charge` : 'Your own key · no charge',
        choice: { model: c.model, source, ...(machine ? { machine } : {}) },
    };
}

/** The person's own keys and machines for drawing (design.icon) and for pictures (image.generate). Never cached. */
async function personal({ ai, token, log = console }) {
    if (!token || !ai || typeof ai.choices !== 'function') return { draw: [], image: [] };
    const read = async (task) => {
        try {
            const body = await ai.choices({ token, task });
            const o = (body && body.options) || {};
            return ['keys', 'machines'].flatMap((src) => (Array.isArray(o[src]) ? o[src] : []).map((c) => choiceEntry(c, src))).filter(Boolean).slice(0, 60);
        } catch (err) { log.warn(`[OpenVibe.Design] your models (${task}) unavailable:`, (err && err.message) || err); return []; }
    };
    const [draw, image] = await Promise.all([read('design.icon'), read('image.generate')]);
    return { draw, image };
}

const TTL_MS = 5 * 60_000;
let cache = { at: 0, value: null };

/** The methods and what each can run on: Exchange's models by kind and Codes' coding agents. */
async function options({ ai = null, codes = null, log = console, now = () => Date.now(), token = null } = {}) {
    const pub = await publicOptions({ ai, codes, log, now });
    if (!token) return available(pub);
    const mine = await personal({ ai, token, log });
    return available({ ...pub, models: { ...pub.models, draw: mine.draw.concat(pub.models.draw), image: mine.image.concat(pub.models.image) } });
}

/** A way that has nothing to run on says so (available: false) and the page leaves it out: a picture needs an image
 *  model (OpenVibe's or the person's own key), a coding agent needs Codes' agents. */
function available(o) {
    const can = { image: o.models.image.length > 0, harness: o.harnesses.length > 0 };
    return { ...o, methods: o.methods.map((m) => ({ ...m, available: m.needs && m.needs in can ? can[m.needs] : true })) };
}

/** What anyone can draw with: Exchange's resold models by kind and Codes' agents (cached five minutes). */
async function publicOptions({ ai, codes, log, now }) {
    if (cache.value && now() - cache.at < TTL_MS) return cache.value;
    const read = async (kind) => {
        if (!ai || typeof ai.exchangeCatalog !== 'function') return [];
        try { const c = await ai.exchangeCatalog({ kind }); return Array.isArray(c && c.models) ? c.models : []; }
        catch (err) { log.warn(`[OpenVibe.Design] icon models (${kind}) unavailable:`, (err && err.message) || err); return []; }
    };
    const [chat, image] = await Promise.all([read('chat'), read('image')]);
    const draw = chat.map(entryOf).filter(Boolean).slice(0, 200);
    const vision = chat.filter((m) => m.capabilities && m.capabilities.vision).map(entryOf).filter(Boolean).slice(0, 100);
    const images = image.map(entryOf).filter(Boolean).slice(0, 100);
    let harnesses = [];
    if (codes && codes.url) {
        try {
            const res = await (codes.fetch || globalThis.fetch)(`${String(codes.url).replace(/\/+$/, '')}/api/v1/harnesses`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(4000) });
            const body = res.ok ? await res.json() : null;
            harnesses = (body && Array.isArray(body.harnesses) ? body.harnesses : []).filter((h) => h && /^[a-z][a-z0-9-]{1,40}$/.test(String(h.id || '')) && !h.off)
                .map((h) => ({ id: h.id, name: String(h.name || h.id).slice(0, 60), provider: h.provider || null })).slice(0, 60);
        } catch (err) { log.warn('[OpenVibe.Design] Codes harnesses unavailable:', (err && err.message) || err); }
    }
    const value = { methods: METHODS, models: { draw, image: images, vision }, harnesses };
    cache = { at: now(), value };
    return value;
}
options.reset = () => { cache = { at: 0, value: null }; };

module.exports = { METHODS, METHOD_IDS, shapesFor, options, entryOf, choiceEntry };
