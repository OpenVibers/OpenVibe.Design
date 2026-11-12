'use strict';
/**
 * Choosing an icon for a button's words (plan L32 I2): `GET /api/v1/glyphs/suggest?label=&context=`.
 *
 * The first pass is free and instant: every glyph is scored by its own name, the keywords in openvibe-shared's
 * META, its Font Awesome names and Design's synonyms (aliases.js). That is enough for "Deep dive" (compass, search,
 * binoculars), "Add to cart" (cart, plus, store) and most labels a person writes.
 *
 * When the words are new ("hot tub", "throughput benchmark") and the free pass is weak, the caller may ask a small model to
 * rank the shortlist by meaning (`rank=1`). Only names that exist are returned; a model answer that invents one is
 * ignored. A signed-in person's allowance pays (OpenVibe.AI's `on_behalf_of`); signed out, Design's service does,
 * and OpenVibe.AI picks the cheapest route. Answers are cached for half an hour.
 *
 *   suggest(label, { context, limit, rank, ai, person, clock }) →
 *     { label, context, glyphs: [{ name, score, tags, why }], new: bool, ranked: bool, model }
 */
const glyphs = require('openvibe-shared/glyphs');
const aliases = require('./aliases');

const STOP = new Set(('a an the to for of and or in on at by with from into over under my your our their this that these those ' +
    'button btn icon icons action link page tab menu open new add more go start').split(' '));
// Phrases whose meaning is not in a glyph's own words ("deep dive" is explore + research, not a dive), kept short:
// the shared META keywords do the rest once a release carries them.
const CONCEPTS = [
    [/deep[ -]?dive|research|investigat/, ['compass', 'search', 'binoculars', 'telescope', 'microscope']],
    [/hot[ -]?tub|spa\b/, ['hot-tub', 'water', 'drop']],
    [/gpu|graphics card/, ['gpu', 'cpu', 'chip', 'memory']],
    [/benchmark|performance|speed test/, ['gauge', 'chart', 'clock', 'cpu']],
    [/sign[ -]?in|log[ -]?in/, ['enter', 'key', 'user']],
    [/sign[ -]?up|join|register/, ['invite', 'user', 'plus']],
    [/sign[ -]?out|log[ -]?out/, ['leave', 'exit', 'door']],
    [/add to (cart|bag)|buy\b|checkout/, ['cart', 'plus', 'coin']],
    [/watch|live\b|stream/, ['live', 'play', 'eye']],
    [/settings|preferences/, ['gear', 'sliders']],
    [/profile|account/, ['user', 'user-circle']],
    [/notification|alert/, ['bell', 'alert']],
    [/delete|remove|trash/, ['trash', 'minus']],
    [/edit|rename|write/, ['pencil', 'text']],
    [/favorite|like\b|love\b/, ['heart', 'star', 'thumbs-up']],
    [/share|send\b/, ['share', 'open', 'send']],
    [/message|chat|comment/, ['chat', 'mail', 'reply']],
    [/price|cost\b|pay\b/, ['dollar', 'coin', 'wallet', 'money']],
    [/refresh|reload|again/, ['retry', 'history']],
];
const TTL = 30 * 60 * 1000;
const cache = new Map();

/** The words in a label or a context: camelCase split, lower case, no punctuation, no filler. */
function tokens(text) {
    return [...new Set(String(text || '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 1 && !STOP.has(t)))].slice(0, 24);
}

// How much a match is worth: an exact name word beats a keyword, which beats another set's name.
function points(token, words) {
    let best = 0;
    for (const w of words) {
        if (!w) continue;
        if (w === token) best = Math.max(best, 40);
        else if (w.startsWith(token)) best = Math.max(best, 22);
        else if (token.length > 2 && w.includes(token)) best = Math.max(best, 8);
        else if (w.length > 3 && token.includes(w)) best = Math.max(best, 6);
    }
    return best;
}

/** The free score: no model, no network. Exported for the tests and for pages that draw as a person types. */
function score(label, context = '') {
    const raw = String(label || '').toLowerCase();
    const labels = tokens(label);
    const around = tokens(context);
    const joined = labels.join(' ');
    const out = [];
    for (const name of glyphs.NAMES) {
        const nameWords = name.split('-');
        const tags = (glyphs.META[name] && glyphs.META[name].tags || []).flatMap((t) => String(t).split(/[^a-z0-9]+/));
        const fa = Object.entries(glyphs.FA).filter(([, g]) => g === name).flatMap(([f]) => f.split('-'));
        const syn = aliases.words(name).flatMap((w) => String(w).split(/[^a-z0-9]+/));
        const why = [];
        let total = 0;
        for (const t of labels) {
            const p = Math.max(points(t, nameWords) * 1.5, points(t, tags), points(t, syn), points(t, fa) * 0.85);
            if (p) { total += p; why.push(t); }
        }
        for (const t of around) {
            const p = Math.max(points(t, nameWords), points(t, tags), points(t, syn), points(t, fa) * 0.8);
            if (p) total += p * 0.45;
        }
        for (const [re, names] of CONCEPTS) {
            if (!re.test(raw) && !re.test(String(context || '').toLowerCase()) && !re.test(around.join(' '))) continue;
            const at = names.indexOf(name);
            if (at >= 0) { total += Math.max(60 - at * 10, 18); why.push('phrase'); }
        }
        if (joined && (name === joined || name === joined.replace(/\s+/g, '-'))) { total += 90; why.unshift(name); }
        else if (joined && name.includes(joined.replace(/\s+/g, '-'))) { total += 28; }
        if (total > 0) out.push({ name, score: Math.round(total * 10) / 10, tags: ((glyphs.META[name] && glyphs.META[name].tags || []).length ? glyphs.META[name].tags : aliases.words(name)).slice(0, 6), why: [...new Set(why)].slice(0, 4) });
    }
    return out.sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : 1));
}

const KEY = (label, context, person, rank) => `${String(person || '')}|${rank ? 1 : 0}|${String(label || '').toLowerCase().slice(0, 80)}|${String(context || '').toLowerCase().slice(0, 80)}`;

function cached(key, now) {
    const hit = cache.get(key);
    if (!hit) return null;
    if (hit.at + TTL < now) { cache.delete(key); return null; }
    return hit.value;
}
function remember(key, value, now) {
    if (cache.size > 800) cache.clear();
    cache.set(key, { at: now, value });
}

const SYSTEM = 'You choose icons for buttons. You are given a label, optional context and a short list of icon names with their keywords. Reply with JSON only: {"names":["<glyph-name>", …]} of up to six names from the list, best first. Never invent a name; when nothing fits, reply {"names":[]}.';

async function askModel({ label, context, shortlist, ai, person }) {
    const list = shortlist.map((g) => `${g.name}: ${g.tags.concat(g.why).join(', ')}`).join('\n');
    const answer = await ai.text({
        system: SYSTEM,
        prompt: `Label: "${String(label).slice(0, 120)}"${context ? `\nWhere it sits: "${String(context).slice(0, 160)}"` : ''}\n\nThe icons:\n${list}`,
        maxTokens: 220,
        task: 'design.icon_suggest',
        target: { service: 'design', type: 'glyph_suggest', id: String(label).slice(0, 60).replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'suggest' },
        ...(person ? { person } : {}),
    });
    let names = [];
    try {
        const body = String(answer.text || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
        const j = JSON.parse(body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1));
        names = Array.isArray(j.names) ? j.names : Array.isArray(j.glyphs) ? j.glyphs.map((g) => typeof g === 'string' ? g : g && g.name) : [];
    } catch { names = []; }
    const byName = new Map(shortlist.map((g) => [g.name, g]));
    const ranked = [];
    for (const raw of names) {
        const name = String(raw || '').trim().toLowerCase();
        if (byName.has(name) && !ranked.some((g) => g.name === name)) ranked.push(byName.get(name));
    }
    return { ranked, model: [answer.provider, answer.model].filter(Boolean).join(' · ') || null };
}

async function suggest(label, { context = '', limit = 8, rank = false, ai = null, person = null, now = Date.now() } = {}) {
    const clean = String(label || '').trim().slice(0, 120);
    const around = String(context || '').trim().slice(0, 160);
    const n = Math.min(Math.max(Number(limit) || 8, 1), 24);
    const key = KEY(clean, around, person, rank);
    const was = cached(key, now);
    if (was) return { ...was, cached: true };
    const scored = score(clean, around);
    const labelWords = tokens(clean);
    const direct = scored.some((g) => labelWords.some((t) => g.name.split('-').includes(t) || (g.tags || []).some((tag) => String(tag).split(/[^a-z0-9]+/).includes(t))));
    const weak = !scored.length || !direct || scored[0].score < 26;
    let glyphsOut = scored.slice(0, Math.max(n, 12));
    let ranked = false, model = null;
    if (rank && weak && ai && ai.enabled) {
        try {
            const aiOut = await askModel({ label: clean, context: around, shortlist: glyphsOut.slice(0, 20), ai, person });
            if (aiOut.ranked.length) {
                const got = new Map(aiOut.ranked.map((g) => [g.name, g]));
                glyphsOut = aiOut.ranked.map((g) => ({ ...g, why: [...new Set([...(g.why || []), 'model'])], score: g.score + 5 }));
                for (const g of scored) if (!got.has(g.name) && glyphsOut.length < n) glyphsOut.push(g);
                ranked = true;
                model = aiOut.model;
            }
        } catch { /* the free answer is still useful */ }
    }
    const value = { label: clean, context: around, glyphs: glyphsOut.slice(0, n), new: !glyphsOut.length || glyphsOut[0].score < 26, ranked, model };
    remember(key, value, now);
    return value;
}

module.exports = { suggest, score, tokens, SYSTEM };
