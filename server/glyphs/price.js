'use strict';
/**
 * What a glyph draft costs, before it is drawn (plan L32 I2). A draft is one OpenVibe.AI chat run (a second only when
 * the first answer fails the checks), so the estimate is the cheapest chat offer's price for about 900 input and 1,800
 * output tokens — the same maxTokens drafts.js asks for. Prices are per million tokens, as Exchange publishes them.
 *
 * Nothing here spends: it reads the catalogue and caches the answer for ten minutes. When the catalogue is
 * unavailable the page says the charge is shown on the person's Balance rather than inventing a number.
 *
 *   createGlyphPrice({ ai, log, ttlMs }).get() → { usd, model, provider, tokens, note } | { usd: null, note }
 */
const TTL = 10 * 60 * 1000;
const TOKENS = { in: 900, out: 1800 };

function createGlyphPrice({ ai = null, log = console, now = () => Date.now(), ttlMs = TTL } = {}) {
    let cached = { at: 0, value: null };
    const empty = () => ({ usd: null, model: null, provider: null, tokens: { ...TOKENS }, note: 'The charge is shown on your Balance before the run.' });

    async function get() {
        if (cached.value && now() - cached.at < ttlMs) return cached.value;
        if (!ai || typeof ai.exchangeCatalog !== 'function') return empty();
        let docs;
        try { docs = await ai.exchangeCatalog({ kind: 'chat' }); }
        catch (err) { log.warn('[OpenVibe.Design] glyph price unavailable:', err && err.message); return empty(); }
        const models = Array.isArray(docs && docs.models) ? docs.models.filter((m) => !m.kind || m.kind === 'chat') : [];
        const priced = [];
        for (const doc of models) {
            for (const offer of (Array.isArray(doc.offers) ? doc.offers : [])) {
                const pin = offer && offer.price ? Number(offer.price.in) : NaN;
                const pout = offer && offer.price ? Number(offer.price.out) : NaN;
                if (!Number.isFinite(pin) || !Number.isFinite(pout)) continue;
                priced.push({ usd: (pin * TOKENS.in + pout * TOKENS.out) / 1e6, model: String(doc.name || offer.model || 'a model').slice(0, 80), provider: String(offer.provider_name || offer.provider || '').slice(0, 60), pin, pout });
            }
        }
        priced.sort((a, b) => a.usd - b.usd);
        const best = priced[0];
        const value = best
            ? { usd: best.usd, model: best.model, provider: best.provider || null, tokens: { ...TOKENS }, note: `About ${TOKENS.in.toLocaleString('en-US')} in and ${TOKENS.out.toLocaleString('en-US')} out tokens at the cheapest model. A signed-in person's own key or Balance pays; signed out, the free guest allowance does.` }
            : empty();
        cached = { at: now(), value };
        return value;
    }

    /** The last answer, without fetching: for a suggest response that should not wait on the catalogue. */
    const peek = () => cached.value || null;

    return { get, peek, TOKENS };
}

module.exports = { createGlyphPrice, TOKENS };
