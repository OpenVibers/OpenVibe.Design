'use strict';
/**
 * The model, drawing (plan R1 item 8, Seven Domains §11).
 *
 * Two things are made here: a typeface and a vector. Both are the person's own work, both are attributed
 * to them (on_behalf_of, so their own allowance pays for it), and both are capped per person per day.
 *
 * A typeface is drawn in batches. A face carries about ninety characters, and asking a model for ninety
 * outlines in one answer does not work: it runs long, it repeats itself and it gives up on the tail. So the
 * letters are asked for a batch at a time, with the same style notes carried through every batch, and each
 * outline is checked before it is kept.
 *
 * A vector is drawn in one answer, cleaned, and saved.
 */
const glyph = require('./glyph');
const { compile, CHARSET, FAMILY } = require('./compile');
const { sanitize } = require('../vectors/svg');

/** How many letters are asked for at a time. */
const BATCH = 26;

/** How many model runs a person may make a day, when the config does not say. */
const DEFAULT_PER_DAY = 20;

/** The style notes, carried through every batch so the letters look like one family. */
const STYLE = [
    'You are a type designer drawing the outlines of a typeface.',
    'Answer with JSON only: {"glyphs": {"A": "<path d=\"...\"/>", "B": "<path d=\"...\"/>", ...}}.',
    'Each glyph is ONE <path> element with only a d attribute. Nothing else: no group, no fill, no style, no script, no explanation.',
    'The coordinates are font coordinates: x grows to the right, y grows UP, the baseline is y = 0.',
    'The em box is 1000 units wide: x from 0 to 1000, y from -200 (descenders) to 800 (cap height and ascenders).',
    'Cap height is 700, so an uppercase letter runs from y = 0 to y = 700. Lowercase x-height is 500.',
    'Letters sit on the baseline and start at x = 60, with about 60 units of space on each side.',
    'Every contour must be closed: the last command of each contour is Z.',
    'Curves are C or Q commands. Never use arcs (A). Never use relative commands.',
    'Letters with a hole (o, e, a, b, d, g, p, q, 0, 4, 6, 8, 9) have the hole as a second closed contour inside the first.',
].join('\n');

/** What a vector answer looks like. */
const VECTOR_STYLE = [
    'You are an illustrator drawing one clean SVG.',
    'Answer with the SVG only: <svg viewBox="0 0 512 512"> ... </svg>.',
    'The drawing is made of path, circle, ellipse, line, polyline, polygon and rect elements, and nothing else.',
    'No script, no style element, no image, no use, no foreignObject, no external reference of any kind.',
    'Use fill and stroke for colour; keep the drawing flat and legible at small sizes.',
].join('\n');

function fail(status, code, detail) {
    return Object.assign(new Error(detail), { status, code, detail });
}

/** The letters of the charset, in the batches they are drawn in. */
function batches(charset = CHARSET) {
    const out = [];
    for (let i = 0; i < charset.length; i += BATCH) out.push(charset.slice(i, i + BATCH));
    return out;
}

/** The letters a typeface must have to be a typeface at all. */
const CORE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function createService({ db, ai, store, config = {}, log = console, s, sharing = null } = {}) {
    const perDay = Math.max(0, Number((config.aiMake && config.aiMake.perDay) || DEFAULT_PER_DAY) || 0);

    /** The cap: how many runs this person has left today. */
    async function left(owner) {
        if (!owner) return 0;
        const used = await store.runsToday(owner);
        return Math.max(0, perDay - used);
    }

    /** A name for the face: what the person wrote, made into a font name. */
    function nameFrom(prompt, base) {
        const words = String(prompt || '').trim().split(/\s+/).slice(0, 4).join(' ');
        const candidate = (words || base || 'New Face').replace(/[^A-Za-z0-9 .'-]/g, ' ').trim().slice(0, 60);
        return candidate && FAMILY.test(candidate) ? candidate : (base ? String(base).slice(0, 60) : 'New Face');
    }

    /** One model answer, read as JSON. */
    function readJson(text) {
        const body = String(text || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
        const start = body.indexOf('{');
        const end = body.lastIndexOf('}');
        if (start < 0 || end <= start) return null;
        try { return JSON.parse(body.slice(start, end + 1)); } catch { return null; }
    }

    /** The style notes the model is given, with the person's own words and the base they chose. */
    function notesFor({ prompt, baseFamily, baseNote }) {
        return [
            STYLE,
            '',
            'The typeface: ' + String(prompt || 'a plain, legible sans').slice(0, 600),
            baseFamily ? 'It is based on ' + String(baseFamily).slice(0, 80) + ', and keeps that letterform.' : '',
            baseNote ? String(baseNote).slice(0, 400) : '',
            'Draw these characters, and only these: ' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;!?' + '"' + '()-/&@#%+=*',
        ].filter(Boolean).join('\n');
    }

    /**
     * Draw a typeface. The letters are asked for a batch at a time; each outline is checked as it arrives,
     * and a batch that comes back unusable is asked for once more, saying what was wrong with it.
     */
    async function drawTypeface({ owner, prompt, baseFamily = null, baseNote = null, name = null, license = 'OFL-1.1', onProgress = null } = {}) {
        if (!ai || !ai.enabled) throw fail(503, 'ai.not_configured', 'OpenVibe.AI is not configured for OpenVibe.Design.');
        if (!owner) throw fail(401, 'auth.required', 'Sign in to make a typeface on openvibe.design.');
        const remaining = await left(owner);
        if (remaining < 1) throw fail(429, 'ai.capped', 'You have made ' + perDay + ' runs today. More tomorrow.');

        const groups = batches();
        const drawn = new Map();
        let provider = null;
        let model = null;
        let runs = 0;

        for (const group of groups) {
            const ask = async (extra = '') => {
                await store.countRun(owner, 'typeface');
                runs++;
                const answer = await ai.text({
                    system: STYLE,
                    prompt: notesFor({ prompt, baseFamily, baseNote }) + (extra ? '\n\n' + extra : ''),
                    maxTokens: 8000,
                    target: { service: 'design', type: 'typeface', id: String(baseFamily || 'new') },
                    prefer: { provider: 'anthropic', model: 'claude-opus-5-5' },
                    person: String(owner),
                });
                provider = provider || (answer.provider || null);
                model = model || (answer.model || null);
                return answer;
            };
            const keep = (answer) => {
                const json = readJson(answer.text);
                const got = json && json.glyphs && typeof json.glyphs === 'object' ? json.glyphs : {};
                const kept = [];
                const whys = [];
                for (const char of group) {
                    if (drawn.has(char)) continue;
                    const raw = got[char] !== undefined ? got[char] : (got[char.toUpperCase()] !== undefined ? got[char.toUpperCase()] : null);
                    if (raw === null || raw === undefined) { whys.push(char + ' was missing'); continue; }
                    const clean = glyph.clean(typeof raw === 'object' ? (raw.d || raw.path || '') : raw);
                    if (!clean.ok) { whys.push(char + ': ' + clean.why); continue; }
                    drawn.set(char, clean.glyph);
                    kept.push(char);
                }
                return { kept, whys };
            };

            let answer = await ask();
            let result = keep(answer);
            // A batch that came back unusable is asked for once more, saying what was wrong with it.
            if (result.kept.length < group.length * 0.6) {
                const why = result.whys.slice(0, 8).join('; ');
                const again = await ask('The last answer had problems: ' + (why || 'too few usable letters') + '. Draw them again, carefully.');
                const second = keep(again);
                if (second.kept.length > result.kept.length) result = second;
            }
            if (onProgress) onProgress({ drawn: drawn.size, total: CORE.length });
        }

        const glyphs = [...drawn.entries()].map(([char, g]) => ({ char, d: g.d, advance: g.advance, bounds: g.bounds }));
        const have = new Set(glyphs.map((g) => g.char));
        const missing = CORE.split('').filter((c) => !have.has(c));
        if (!glyphs.length) throw fail(502, 'ai.refused', 'The model did not draw any letters. Try again with a clearer description.');

        const face = await compile({
            familyName: name || nameFrom(prompt, baseFamily),
            glyphs,
            license,
            model,
            designer: 'Made on OpenVibe.Design',
        });
        if (!face.ok) throw fail(502, 'ai.refused', face.why);

        return {
            glyphs,
            metrics: { ...face.metrics, missing },
            provider,
            model,
            license,
            runs,
            name: name || nameFrom(prompt, baseFamily),
        };
    }

    /**
     * Draw one vector. The answer is cleaned before it is kept: an SVG is read out of the allowlist and
     * written again from scratch, so nothing the model wrote survives unless it was allowed.
     */
    async function drawVector({ owner, prompt, kind = 'icon', note = null, onBehalf = true } = {}) {
        if (!ai || !ai.enabled) throw fail(503, 'ai.not_configured', 'OpenVibe.AI is not configured for OpenVibe.Design.');
        if (!owner) throw fail(401, 'auth.required', 'Sign in to make a vector on openvibe.design.');
        const remaining = await left(owner);
        if (remaining < 1) throw fail(429, 'ai.capped', 'You have made ' + perDay + ' runs today. More tomorrow.');

        await store.countRun(owner, 'vector');
        const answer = await ai.text({
            system: VECTOR_STYLE,
            prompt: 'Draw: ' + String(prompt || '').slice(0, 800) + (note ? '\n\nThe note on the last drawing: ' + String(note).slice(0, 400) : ''),
            maxTokens: 3000,
            target: { service: 'design', type: 'vector', id: String(kind || 'icon') },
            prefer: { provider: 'anthropic', model: 'claude-opus-5-5' },
            ...(onBehalf ? { person: String(owner) } : {}),
        });

        // The SVG is taken out of the answer, then cleaned.
        const raw = String(answer.text || '');
        const start = raw.indexOf('<svg');
        const end = raw.lastIndexOf('</svg>');
        const markup = start >= 0 && end > start ? raw.slice(start, end + 6) : raw;
        const clean = sanitize(markup);
        if (!clean.ok) throw fail(502, 'ai.refused', 'The model drew something that is not a drawing: ' + clean.why);

        return {
            svg: clean.svg,
            provider: answer.provider || null,
            model: answer.model || null,
            license: 'OFL-1.1',
            kind: String(kind || 'icon'),
        };
    }

    /**
     * Redraw one glyph with a note: "make the a rounder", "the g needs a tail".
     * The face's own style notes go with it, so the letter comes back like the rest of them.
     */
    async function redrawGlyph({ owner, face, char, note } = {}) {
        if (!ai || !ai.enabled) throw fail(503, 'ai.not_configured', 'OpenVibe.AI is not configured for OpenVibe.Design.');
        if (!owner) throw fail(401, 'auth.required', 'Sign in to redraw this on openvibe.design.');
        const remaining = await left(owner);
        if (remaining < 1) throw fail(429, 'ai.capped', 'You have made ' + perDay + ' runs today. More tomorrow.');
        const wanted = String(char || '').slice(0, 4);
        if (!wanted) throw fail(422, 'ai.invalid_input', 'Say which letter to redraw.');
        const what = String(note || '').trim().slice(0, 400);
        if (!what) throw fail(422, 'ai.invalid_input', 'Say what to change about the letter.');

        await store.countRun(owner, 'typeface');
        const answer = await ai.text({
            system: STYLE,
            prompt: [
                notesFor({ prompt: face.prompt, baseFamily: face.baseFamily, baseNote: face.styleNotes && face.styleNotes !== face.prompt ? face.styleNotes : null }),
                '',
                'Now draw ONE letter: "' + wanted + '".',
                'What to change: ' + what,
                'Answer with JSON only: {"glyphs": {"' + wanted + '": "<path d=\"...\"/>"}}.',
            ].join('\n'),
            maxTokens: 1200,
            target: { service: 'design', type: 'typeface_glyph', id: String(face.id || 'new') },
            prefer: { provider: 'anthropic', model: 'claude-opus-5-5' },
            person: String(owner),
        });
        const json = readJson(answer.text);
        const got = json && json.glyphs && typeof json.glyphs === 'object' ? json.glyphs : {};
        const raw = got[wanted] !== undefined ? got[wanted] : (got[wanted.toUpperCase()] !== undefined ? got[wanted.toUpperCase()] : null);
        if (raw === null || raw === undefined) return null;
        const clean = glyph.clean(typeof raw === 'object' ? (raw.d || raw.path || '') : raw);
        if (!clean.ok) return null;
        return { char: wanted, d: clean.glyph.d, advance: clean.glyph.advance, bounds: clean.glyph.bounds, model: answer.model || null };
    }

    /**
     * A drawing as a PNG, for the download. resvg draws the SVG; it is already clean, so it is drawn as it is.
     */
    async function png(svg, size = 512) {
        const pixels = Math.max(16, Math.min(2048, Number(size) || 512));
        const { Resvg } = require('@resvg/resvg-js');
        const rendered = new Resvg(String(svg || ''), { fitTo: { mode: 'width', value: pixels }, background: 'rgba(0,0,0,0)' });
        return rendered.render().asPng();
    }

    return { drawTypeface, drawVector, redrawGlyph, png, left, batches, notesFor, perDay, CORE };
}

module.exports = { createService, batches, fail, DEFAULT_PER_DAY, STYLE, VECTOR_STYLE, CORE, BATCH };
