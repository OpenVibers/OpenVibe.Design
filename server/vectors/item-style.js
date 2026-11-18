'use strict';
/**
 * Item icons (2026-11-16; the owner: item icons drawn as emoji look cheap. "a customized, configurable OpenVibe.design
 * AI-based system that generates these type of icons … item icon generation", and "emoji's fine … but there was use
 * cases where you had like item icons and stuff as emojis or buttons").
 *
 * One house style for every item the network gives or sells (Inventory's definitions: Live's voices, name effects,
 * hats and particles, Workshop badges, quest rewards), so a wallet of them reads as one set:
 *   - a rounded-square badge filling the canvas, in its rarity's colours (a soft vertical gradient, a faint inner ring);
 *   - one subject, centred, about 70% of the badge, bold simple shapes with a dark outline, flat colour with one
 *     highlight and one shadow tone, friendly and readable at 32 px;
 *   - never text or letters; the type of item decides what is shown (a voice is its speaker, a hat is the hat).
 *
 * An item keeps its details in the first line of its prompt, so a saved drawing (vectors store: prompt + kind) is drawn
 * again, or changed with a note, exactly as it was asked for:
 *
 *   [item rarity=epic type=hat hint=🧙] Wizard Hat: a tall pointed hat with stars
 *
 *   itemPrompt({ name, description, rarity, type, hint })   that line and the words
 *   parseItem(prompt)        → { rarity, type, hint, text }
 *   itemSystem(item)         the system words for the model
 *   itemAsk(item, note)      the request
 */

/** Each rarity's badge: the gradient's top and bottom, the inner ring's colour. */
const RARITIES = {
    common: { from: '#64748b', to: '#94a3b8', ring: '#cbd5e1', name: 'Common' },
    uncommon: { from: '#16a34a', to: '#4ade80', ring: '#bbf7d0', name: 'Uncommon' },
    rare: { from: '#2563eb', to: '#60a5fa', ring: '#bfdbfe', name: 'Rare' },
    epic: { from: '#7c3aed', to: '#c084fc', ring: '#e9d5ff', name: 'Epic' },
    legendary: { from: '#d97706', to: '#fcd34d', ring: '#fef3c7', name: 'Legendary' },
};

/** What each type of item shows. The keys are Inventory kinds without their service (live.hat → hat). */
const TYPES = {
    item: { name: 'Any item', show: 'Show the item itself, as the thing a person would hold or wear.' },
    voice: { name: 'Voice', show: 'It is a chat voice: show the character who speaks (a face or a figure, with its personality), with a small sound wave or microphone accent.' },
    name_effect: { name: 'Name effect', show: 'It is an effect on a person\'s name: show a short rounded name plate (a pill shape with no letters on it) wrapped in the effect.' },
    hat: { name: 'Hat', show: 'It is a hat worn on a profile picture: show the hat itself, in a three-quarter view.' },
    particle: { name: 'Particles', show: 'It is a burst of particles around a profile picture: show a round avatar silhouette with a few of the particles flying outward from it.' },
    badge: { name: 'Badge', show: 'It is a badge a person wears beside their name: show its emblem.' },
    reward: { name: 'Reward', show: 'It is a reward for finishing something: show the prize itself.' },
};

const clean = (s, n) => String(s == null ? '' : s).replace(/[\r\n\]]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const rarityOf = (r) => (RARITIES[String(r || '').toLowerCase()] ? String(r).toLowerCase() : 'common');
const typeOf = (t) => {
    const k = String(t || '').toLowerCase().replace(/^[a-z]+\./, '');
    return TYPES[k] ? k : 'item';
};
// A hint is a few characters: an emoji the item used to be drawn with, or a word. Never markup.
const hintOf = (h) => Array.from(clean(h, 40).replace(/[<>"'=&]/g, '')).slice(0, 8).join('');

/** The prompt a saved item drawing keeps: its details on the first line, then its words. */
function itemPrompt({ name = '', description = '', rarity, type, hint } = {}) {
    const words = [clean(name, 80), clean(description, 400)].filter(Boolean).join(': ');
    const h = hintOf(hint);
    return `[item rarity=${rarityOf(rarity)} type=${typeOf(type)}${h ? ` hint=${h}` : ''}] ${words}`.trim();
}

/** The details back out of a saved prompt (a prompt without the line is an item of any type, common). */
function parseItem(prompt) {
    const s = String(prompt || '');
    const m = /^\[item ([^\]]*)\]\s*/.exec(s);
    const out = { rarity: 'common', type: 'item', hint: '', text: m ? s.slice(m[0].length) : s };
    if (!m) return out;
    for (const pair of m[1].split(/\s+/)) {
        const at = pair.indexOf('=');
        if (at < 1) continue;
        const k = pair.slice(0, at), v = pair.slice(at + 1);
        if (k === 'rarity') out.rarity = rarityOf(v);
        else if (k === 'type') out.type = typeOf(v);
        else if (k === 'hint') out.hint = hintOf(v);
    }
    return out;
}

/** The system words: the house style, the rarity's badge and what this type of item shows. */
function itemSystem({ rarity, type } = {}) {
    const r = RARITIES[rarityOf(rarity)];
    const t = TYPES[typeOf(type)];
    return [
        'You draw one game item icon as SVG, in OpenVibe\'s house item style.',
        'Answer with the SVG only: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"> … </svg>.',
        'Use only path, circle, ellipse, line, polyline, polygon, rect, g, defs, linearGradient, radialGradient, stop, clipPath and mask. No text, no letters, no image, no style element, no script, no external reference.',
        `The background is a rounded square badge filling the canvas (x 0, y 0, width 128, height 128, rx 28) with a soft vertical gradient from ${r.from} at the top to ${r.to} at the bottom, and a faint ${r.ring} inner ring 6 units inside its edge.`,
        'One subject, centred, filling about 70% of the badge. Bold simple shapes with a dark outline (stroke #0f172a, width 3 to 4, round caps and joins), flat colour with one highlight tone and one shadow tone. Friendly, playful, readable at 32 px.',
        t.show,
    ].join('\n');
}

/** The request: the item's words, its hint as a clue, and the note on the last drawing. */
function itemAsk(item = {}, note = null) {
    const p = typeof item === 'string' ? parseItem(item) : item;
    const text = clean(p.text || [p.name, p.description].filter(Boolean).join(': '), 600) || 'an item';
    const hint = hintOf(p.hint);
    return `Draw the item "${text}".`
        + (hint ? ` It used to be shown as ${hint}: take it as a clue to who or what it is, and never draw that emoji itself.` : '')
        + (note ? `\n\nThe note on the last drawing: ${clean(note, 400)}` : '');
}

module.exports = { RARITIES, TYPES, itemPrompt, parseItem, itemSystem, itemAsk, rarityOf, typeOf };
