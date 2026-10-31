'use strict';
/**
 * Glyph drafts (plan L32 I3): a person names an icon and says what it is for, OpenVibe.AI draws a few candidates in
 * the OpenVibe hand, each is checked and rebuilt (validate.js) before it is kept, and an admin approves or rejects
 * each one. Approved drafts are what openvibe-shared's scripts/pull-glyph-drafts.js takes into the registry; nothing
 * reaches a page without that review and a Shared release.
 *
 *   draft({ subject, name, sentence }) → { kept: [draft…], refused: [why…] }   (at most PER_DAY a person per day)
 *   list({ status, subject, limit })    → drafts, newest first
 *   review({ id, action: 'approve' | 'reject', reviewer })
 */
const crypto = require('crypto');
const { clean } = require('./validate');

const PER_DAY = 12;
const CANDIDATES = 4;
const NAME_RE = /^[a-z][a-z0-9-]{1,31}$/;

const SYSTEM = `You draw icons for OpenVibe's glyph set. Every glyph is the inside of an SVG with viewBox "0 0 24 24":
strokes only (the page draws them 2 units wide, round caps and joins, in the text colour), at most 6 shapes from
path, circle, ellipse, rect, line and polyline, every coordinate between 1 and 23, nothing filled, no transforms.
Simple, centred, readable at 16 px, in the hand of a clean line icon set. Answer with JSON only:
{"candidates": ["<path d=\\"…\\"/>", …]} with ${CANDIDATES} different candidates.`;

function createGlyphDrafts({ db, ai, clock = { now: () => Date.now() } }) {
    const id = () => `gd_${crypto.randomBytes(8).toString('hex')}`;
    const iso = () => new Date(clock.now()).toISOString();

    async function draft({ subject, name, sentence = '' }) {
        if (!subject) throw Object.assign(new Error('sign in to draw an icon'), { status: 401 });
        const n = String(name || '').trim().toLowerCase();
        if (!NAME_RE.test(n)) throw Object.assign(new Error('a name is 2 to 32 lowercase letters, digits and dashes, like "hot-tub"'), { status: 422 });
        const what = String(sentence || '').trim().slice(0, 200);
        const today = await db.maybe("SELECT count(*)::int AS n FROM glyph_drafts WHERE subject = $1 AND created_at > now() - interval '1 day'", [subject]);
        if ((today && today.n) >= PER_DAY) throw Object.assign(new Error(`${PER_DAY} drafts a day: more tomorrow`), { status: 429 });
        if (!ai || !ai.enabled) throw Object.assign(new Error('drawing needs OpenVibe.AI, which is not configured here'), { status: 503 });
        const answer = await ai.text({
            system: SYSTEM,
            prompt: `The icon: "${n}".${what ? ` What it stands for: ${what}` : ''}`,
            maxTokens: 1800,
            target: { service: 'design', type: 'glyph_draft', id: n },
        });
        let list = [];
        try {
            const body = String(answer.text || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
            const j = JSON.parse(body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1));
            list = Array.isArray(j.candidates) ? j.candidates.slice(0, CANDIDATES) : [];
        } catch { list = []; }
        const kept = [], refused = [];
        const seen = new Set();
        for (const c of list) {
            const r = clean(typeof c === 'string' ? c : '');
            if (!r.ok) { refused.push(r.why); continue; }
            if (seen.has(r.svg)) continue;
            seen.add(r.svg);
            const row = { id: id(), subject, name: n, sentence: what, svg: r.svg, provider: answer.provider, model: answer.model, status: 'draft', created_at: iso() };
            await db.exec('INSERT INTO glyph_drafts (id, subject, name, sentence, svg, provider, model, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
                [row.id, row.subject, row.name, row.sentence, row.svg, row.provider, row.model, row.status, row.created_at]);
            kept.push(row);
        }
        if (!list.length) refused.push('the model answered no candidates');
        return { kept, refused };
    }

    async function list({ status = null, subject = null, limit = 60 } = {}) {
        const where = [], args = [];
        if (status) { args.push(status); where.push(`status = $${args.length}`); }
        if (subject) { args.push(subject); where.push(`subject = $${args.length}`); }
        args.push(Math.min(Math.max(Number(limit) || 60, 1), 500));
        return db.many(`SELECT id, name, sentence, svg, provider, model, status, created_at, reviewed_at FROM glyph_drafts${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT $${args.length}`, args);
    }

    async function review({ id: draftId, action, reviewer }) {
        if (!['approve', 'reject'].includes(action)) throw Object.assign(new Error('approve or reject'), { status: 422 });
        const status = action === 'approve' ? 'approved' : 'rejected';
        const row = await db.maybe('UPDATE glyph_drafts SET status = $2, reviewed_by = $3, reviewed_at = $4 WHERE id = $1 RETURNING id, name, status', [draftId, status, reviewer, iso()]);
        if (!row) throw Object.assign(new Error('no such draft'), { status: 404 });
        return row;
    }

    return { draft, list, review, PER_DAY };
}

module.exports = { createGlyphDrafts, SYSTEM, PER_DAY };
