'use strict';

/**
 * The choices a create request is asked to make, read from the services that own them.
 *
 *   kinds, frames   server/create/kinds.js (one entry per kind)
 *   looks           OpenVibe.Network's theme centre (public themes) and, signed in, the person's own themes
 *   models          the same catalogue OpenVibe.Exchange shows, through OpenVibe.AI:
 *                     GET /api/v1/exchange/catalog  names, offers, price in/out, 18+ marks
 *                     GET /api/v1/routes            the offers AI can actually run (provider and model)
 *                     GET /api/v1/choices           the person's own keys and machines, and whether AI says
 *                                                   this person may use the 18+ tier
 *
 * Nothing here is a second hand-kept model list or price list. The catalogue is cached for five minutes;
 * the person's own keys and adult answer are read on every signed-in request (private, no-store).
 */

const { KINDS, FRAMES } = require('./kinds');

const MODEL_TTL_MS = 5 * 60_000;
const EXCHANGE_ORIGIN = 'https://openvibe.exchange';

const COLOUR = /^(#[0-9a-f]{3,8}|rgba?\([0-9., %]+\)|hsla?\([0-9., %]+\))$/i;

function swatchOf(variables = {}) {
    const out = [];
    for (const name of ['--bg-primary', '--text-primary', '--accent', '--text-link', '--bg-card', '--border']) {
        const value = variables[name];
        if (typeof value === 'string' && COLOUR.test(value.trim()) && !out.includes(value.trim())) out.push(value.trim());
    }
    for (const value of Object.values(variables)) {
        if (out.length >= 4) break;
        if (typeof value === 'string' && COLOUR.test(value.trim()) && !out.includes(value.trim())) out.push(value.trim());
    }
    return out.slice(0, 4);
}

function priceOf(offer) {
    const price = offer && offer.price;
    return {
        price_in: price && Number.isFinite(Number(price.in)) ? Number(price.in) : null,
        price_out: price && Number.isFinite(Number(price.out)) ? Number(price.out) : null,
    };
}

function noteOf(offer, provider) {
    if (!offer) return 'Managed by OpenVibe.AI';
    const parts = [offer.provider_name || provider];
    if (offer.context) parts.push(`${Math.round(Number(offer.context) / 1000)}k context`);
    if (!offer.price && offer.free) parts.push('prepaid');
    else if (offer.free_tier) parts.push('free to try');
    if (offer.status && offer.status !== 'up') parts.push(String(offer.status));
    return parts.filter(Boolean).join(' · ').slice(0, 160);
}

/** A model doc's best offer: the cheapest priced one, else its first offer. */
function bestOfferOf(doc) {
    const offers = Array.isArray(doc && doc.offers) ? doc.offers : [];
    const priced = offers.filter((o) => o && o.price && Number.isFinite(Number(o.price.in)) && Number.isFinite(Number(o.price.out)));
    priced.sort((a, b) => (Number(a.price.in) + Number(a.price.out)) - (Number(b.price.in) + Number(b.price.out)));
    return priced[0] || offers[0] || null;
}

function createCreateOptions({ config = {}, ai = null, catalog, fetchImpl = globalThis.fetch, log = console, now = () => Date.now(), ttlMs = MODEL_TTL_MS } = {}) {
    let cached = { at: 0, value: null };

    const exchangeCatalog = async () => {
        if (!ai || typeof ai.exchangeCatalog !== 'function') return { models: [] };
        try { return await ai.exchangeCatalog({ kind: 'chat' }); } catch (err) {
            log.warn('[OpenVibe.Design] create catalogue unavailable:', (err && err.message) || err);
            return { models: [] };
        }
    };
    const routeOffers = async () => {
        if (!ai || typeof ai.offeredModels !== 'function') return [];
        try { return await ai.offeredModels(); } catch (err) {
            log.warn('[OpenVibe.Design] create routes unavailable:', (err && err.message) || err);
            return [];
        }
    };

    /**
     * Join the runnable AI offers to the Exchange catalogue: the offer names the provider and model the run
     * can pin, the doc gives the name, the price in and out, the 18+ mark and the public page.
     */
    function join(routes, docs) {
        const models = Array.isArray(docs && docs.models) ? docs.models.filter((m) => !m.kind || m.kind === 'chat') : [];
        const byOffer = new Map();
        const byModel = new Map();
        for (const doc of models) {
            for (const offer of (doc.offers || [])) {
                byOffer.set(`${offer.provider}|${offer.model || ''}`, { doc, offer });
                if (offer.model) byModel.set(String(offer.model), { doc, offer });
            }
        }
        const out = [];
        const seen = new Set();
        const add = (entry) => {
            if (!entry || !entry.id || seen.has(entry.id)) return;
            seen.add(entry.id);
            out.push(entry);
        };
        const list = Array.isArray(routes) ? routes : [];
        if (list.length) {
            for (const route of list) {
                const provider = String((route && route.provider) || '').trim();
                const model = route && route.model != null ? String(route.model).trim() : null;
                if (!provider) continue;
                const match = byOffer.get(`${provider}|${model || ''}`) || (model ? byModel.get(model) : null) || null;
                const doc = match && match.doc;
                const offer = (match && match.offer) || (doc && bestOfferOf(doc)) || null;
                const prices = priceOf(offer);
                add({
                    id: model ? `${provider}:${model}` : provider,
                    name: (doc && doc.name) || model || provider,
                    provider,
                    model,
                    price_in: prices.price_in,
                    price_out: prices.price_out,
                    note: noteOf(offer, provider),
                    exchange_url: doc ? `${EXCHANGE_ORIGIN}/models/${String(doc.slug).split('/').map(encodeURIComponent).join('/')}` : null,
                    adult: Boolean(doc && doc.uncensored),
                    source: 'exchange',
                    pin: true,
                });
            }
        }
        if (!out.length) {
            // AI's route list is the authority; when it cannot be read, the catalogue still gives the page
            // something truthful to show (the run may re-route, and the take records what actually answered).
            for (const doc of models) {
                const offer = bestOfferOf(doc);
                if (!offer) continue;
                const prices = priceOf(offer);
                add({
                    id: `${offer.provider}:${offer.model || ''}`,
                    name: doc.name || offer.model,
                    provider: offer.provider,
                    model: offer.model || null,
                    price_in: prices.price_in,
                    price_out: prices.price_out,
                    note: noteOf(offer, offer.provider),
                    exchange_url: `${EXCHANGE_ORIGIN}/models/${String(doc.slug).split('/').map(encodeURIComponent).join('/')}`,
                    adult: Boolean(doc.uncensored),
                    source: 'exchange',
                    pin: true,
                });
            }
        }
        return out;
    }

    async function modelCatalogue() {
        if (cached.value && now() - cached.at < ttlMs) return cached.value;
        const [routes, docs] = await Promise.all([routeOffers(), exchangeCatalog()]);
        const value = join(routes, docs);
        cached = { at: now(), value };
        return value;
    }

    /** The person's own keys and machines, and whether AI says this person may use the 18+ tier. */
    async function personal(token) {
        if (!token || !ai || typeof ai.choices !== 'function') return { adult: false, models: [] };
        let body;
        try { body = await ai.choices({ token, task: 'ai.generate' }); } catch (err) {
            // A read of their own settings must never stop the page; it simply means the list is the public one.
            log.warn('[OpenVibe.Design] create personal models unavailable:', (err && err.message) || err);
            return { adult: false, models: [] };
        }
        const options = (body && body.options) || {};
        const models = [];
        for (const key of Array.isArray(options.keys) ? options.keys : []) {
            if (!key || !key.model) continue;
            models.push({
                id: `keys:${key.model}`, name: key.name || key.model, provider: 'your key', model: key.model,
                price_in: 0, price_out: 0, note: 'Your own provider key · no charge', exchange_url: null,
                adult: false, source: 'keys', pin: false,
            });
        }
        for (const machine of Array.isArray(options.machines) ? options.machines : []) {
            if (!machine || !machine.model) continue;
            models.push({
                id: `machines:${machine.machine || 'any'}:${machine.model}`,
                name: machine.name || machine.model,
                provider: machine.machine_name || 'your machine',
                model: machine.model,
                machine: machine.machine || null,
                price_in: 0, price_out: 0, note: 'Your own machine · no charge', exchange_url: null,
                adult: false, source: 'machines', pin: false,
            });
        }
        return { adult: body && body.adult === true, models };
    }

    /** The theme centre, a system look, and the person's saved themes. */
    async function fullLooks(token) {
        const out = [];
        let themes = [];
        try { themes = ((await catalog.list()).themes || []); } catch (err) {
            log.warn('[OpenVibe.Design] create looks unavailable:', (err && err.message) || err);
        }
        const defaultTheme = themes.find((t) => t.id === 'vibe') || themes[0] || null;
        out.push({ id: 'system', name: 'System', source: 'system', themeId: (defaultTheme && defaultTheme.id) || null,
            swatch: swatchOf(defaultTheme ? defaultTheme.variables : {}), variables: (defaultTheme && defaultTheme.variables) || {} });
        for (const t of themes) {
            if (!t || !t.id) continue;
            out.push({ id: t.id, name: t.name || t.id, source: 'theme', themeId: t.id, swatch: swatchOf(t.variables || {}), variables: t.variables || {} });
        }
        if (token && catalog) {
            try {
                const subs = await catalog.request('/me/submissions', { token });
                if (subs && subs.ok && subs.data && Array.isArray(subs.data.themes)) {
                    for (const t of subs.data.themes) {
                        if (!t || !t.id) continue;
                        out.push({ id: t.id, name: t.name || 'My theme', source: 'mine', themeId: t.id, swatch: swatchOf(t.variables || {}), variables: t.variables || {} });
                    }
                }
            } catch { /* their saved themes are optional */ }
            try {
                const active = await catalog.request('/me/active', { token });
                const custom = active && active.ok && active.data ? active.data.custom_variables : null;
                if (custom && typeof custom === 'object' && Object.keys(custom).length) {
                    out.push({ id: 'mine:active', name: 'My current theme', source: 'mine',
                        themeId: (active.data && active.data.theme_id) || null, swatch: swatchOf(custom), variables: custom });
                }
            } catch { /* optional */ }
        }
        const seen = new Set();
        return out.filter((look) => (seen.has(look.id) ? false : (seen.add(look.id), true)));
    }

    /** Everything the create page asks for. `token` is the person's Network token, or null. */
    async function options({ token = null } = {}) {
        const [catalogue, mine] = await Promise.all([modelCatalogue(), personal(token)]);
        const models = catalogue
            .filter((model) => !model.adult || mine.adult)
            .map((model) => ({ ...model }))
            .concat(mine.models);
        const looks = await fullLooks(token);
        return {
            kinds: KINDS.map((kind) => ({ id: kind.id, name: kind.name, hint: kind.hint, frames: kind.frames.slice() })),
            frames: FRAMES.map((frame) => ({ ...frame })),
            looks,
            models,
            takes: { min: 1, max: 4, default: 3 },
            limits: { prompt: 4000, models: 4, takes_per_model: 4, takes_total: 8 },
            currency: 'USD',
            adult: mine.adult,
            models_unavailable: models.length === 0,
        };
    }

    /** The public shape the page sees: no internal pin, machine id or theme variables. */
    function publicOptions(all) {
        return {
            kinds: all.kinds,
            frames: all.frames,
            looks: all.looks.map(({ id, name, source, swatch }) => ({ id, name, source, swatch })),
            models: all.models.map(({ id, name, provider, price_in, price_out, note, exchange_url, adult, source }) =>
                ({ id, name, provider, price_in, price_out, note, exchange_url, adult, source })),
            takes: all.takes,
            limits: all.limits,
            currency: all.currency,
            adult: all.adult,
            models_unavailable: all.models_unavailable,
        };
    }

    function clear() { cached = { at: 0, value: null }; }

    return { options, publicOptions, fullLooks, modelCatalogue, personal, clear, get cached() { return cached; } };
}

module.exports = { createCreateOptions, MODEL_TTL_MS, EXCHANGE_ORIGIN };
