'use strict';
/**
 * Where the typefaces and vectors a person made live (plan R1 item 8, Seven Domains §11).
 *
 * Two tables, one rule: a row belongs to the person who made it and to nobody else. Nothing here is
 * published, shared or listed by the site; the only way out is the person's own page.
 *
 * The daily cap is measured here too: every model run is counted, and the count is what the cap in the
 * config is compared against.
 */

/** A typeface row, as the pages and the API see it. */
function typefaceRow(row) {
    if (!row) return null;
    return {
        id: String(row.id),
        name: String(row.name),
        prompt: String(row.prompt || ''),
        baseFamily: row.base_family ? String(row.base_family) : null,
        styleNotes: row.style_notes ? String(row.style_notes) : null,
        glyphs: Array.isArray(row.glyphs) ? row.glyphs : [],
        metrics: row.metrics && typeof row.metrics === 'object' ? row.metrics : {},
        provider: row.provider ? String(row.provider) : null,
        model: row.model ? String(row.model) : null,
        license: String(row.license || 'OFL-1.1'),
        state: String(row.state || 'drawing'),
        note: row.note ? String(row.note) : null,
        createdAt: row.created_at,
    };
}

/** A vector row, as the pages and the API see it. */
function vectorRow(row) {
    if (!row) return null;
    return {
        id: String(row.id),
        prompt: String(row.prompt || ''),
        kind: String(row.kind || 'icon'),
        svg: String(row.svg || ''),
        provider: row.provider ? String(row.provider) : null,
        model: row.model ? String(row.model) : null,
        license: String(row.license || 'OFL-1.1'),
        state: String(row.state || 'drawn'),
        note: row.note ? String(row.note) : null,
        createdAt: row.created_at,
    };
}

function createStore({ db, log = console, now = () => new Date() } = {}) {
    /** A typeface of this person's, or null. Another person's typeface is not found, not refused. */
    async function typeface(id, owner) {
        const row = await db.maybe('SELECT * FROM ai_typefaces WHERE id = $1 AND owner = $2', [String(id), String(owner)]);
        return typefaceRow(row);
    }

    /** A vector of this person's, or null. */
    async function vector(id, owner) {
        const row = await db.maybe('SELECT * FROM ai_vectors WHERE id = $1 AND owner = $2', [String(id), String(owner)]);
        return vectorRow(row);
    }

    /** The person's typefaces, newest first. */
    async function typefacesOf(owner, limit = 24) {
        const rows = await db.many('SELECT * FROM ai_typefaces WHERE owner = $1 ORDER BY created_at DESC LIMIT $2', [String(owner), Math.max(1, Math.min(100, Number(limit) || 24))]);
        return rows.map(typefaceRow);
    }

    /** The person's vectors, newest first. */
    async function vectorsOf(owner, limit = 24) {
        const rows = await db.many('SELECT * FROM ai_vectors WHERE owner = $1 ORDER BY created_at DESC LIMIT $2', [String(owner), Math.max(1, Math.min(100, Number(limit) || 24))]);
        return rows.map(vectorRow);
    }

    async function saveTypeface({ id, owner, name, prompt, baseFamily = null, styleNotes = null, glyphs = [], metrics = {}, provider = null, model = null, license = 'OFL-1.1', state = 'drawing', note = null }) {
        await db.exec(
            'INSERT INTO ai_typefaces (id, owner, name, prompt, base_family, style_notes, glyphs, metrics, provider, model, license, state, note) ' +
            'VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13) ' +
            'ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, style_notes = EXCLUDED.style_notes, glyphs = EXCLUDED.glyphs, ' +
            'metrics = EXCLUDED.metrics, provider = EXCLUDED.provider, model = EXCLUDED.model, license = EXCLUDED.license, ' +
            'state = EXCLUDED.state, note = EXCLUDED.note, updated_at = now()',
            [String(id), String(owner), String(name), String(prompt || ''), baseFamily, styleNotes, JSON.stringify(glyphs), JSON.stringify(metrics), provider, model, String(license || 'OFL-1.1'), String(state || 'drawing'), note],
        );
        return await typeface(id, owner);
    }

    async function saveVector({ id, owner, prompt, kind = 'icon', svg, provider = null, model = null, license = 'OFL-1.1', state = 'drawn', note = null }) {
        await db.exec(
            'INSERT INTO ai_vectors (id, owner, prompt, kind, svg, provider, model, license, state, note) ' +
            'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ' +
            'ON CONFLICT (id) DO UPDATE SET prompt = EXCLUDED.prompt, kind = EXCLUDED.kind, svg = EXCLUDED.svg, ' +
            'provider = EXCLUDED.provider, model = EXCLUDED.model, license = EXCLUDED.license, state = EXCLUDED.state, ' +
            'note = EXCLUDED.note, updated_at = now()',
            [String(id), String(owner), String(prompt || ''), String(kind || 'icon'), String(svg || ''), provider, model, String(license || 'OFL-1.1'), String(state || 'drawn'), note],
        );
        return await vector(id, owner);
    }

    /**
     * How many model runs this person has made today. The cap in the config is compared against this.
     * The count is of runs, not of pages: one typeface is several runs, because the letters are drawn
     * a batch at a time.
     */
    async function runsToday(owner, kind = null) {
        const row = kind
            ? await db.maybe('SELECT count(*)::int AS n FROM ai_make_runs WHERE owner = $1 AND kind = $2 AND day = current_date', [String(owner), String(kind)])
            : await db.maybe('SELECT count(*)::int AS n FROM ai_make_runs WHERE owner = $1 AND day = current_date', [String(owner)]);
        return (row && Number(row.n)) || 0;
    }

    /** One model run, counted. */
    async function countRun(owner, kind) {
        await db.exec('INSERT INTO ai_make_runs (owner, kind) VALUES ($1, $2)', [String(owner), String(kind)]);
    }

    return { typeface, vector, typefacesOf, vectorsOf, saveTypeface, saveVector, runsToday, countRun };
}

module.exports = { createStore, typefaceRow, vectorRow };
