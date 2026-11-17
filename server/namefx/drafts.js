'use strict';
/**
 * "Make me an effect" (plan §AD.15; the owner: "improve the animations and effects of all username effects … remake them
 * all … openvibe.design … AI-generated using openvibe.exchange"). A signed-in person describes a name effect in words;
 * a model on Exchange (AI's routing for design.name_effect, or the one they pick) writes it in the house's shape; the
 * CSS is checked and rebuilt (css.js) and kept as a draft with a live preview; an admin approves or rejects it, and the
 * approved ones are public data for Inventory and openvibe-shared to take in (GET /api/v1/name-effects/drafts).
 *
 *   draft({ subject, words, name?, model? }) → { kept: row | null, why: string | null }
 *   list({ subject? , status?, limit? })      → rows
 *   review({ id, action: approve|reject, reviewer }) → row
 */
const crypto = require('crypto');
const { clean, pascal } = require('./css');

const PER_DAY = 10;
const SYSTEM = `You write one name effect for OpenVibe: how a person's name looks in chat and on a profile. Answer with
JSON only: {"name": "<2-24 lowercase letters, digits or hyphens>", "label": "<2-3 words>", "css": "<the CSS>"}.

The CSS styles only the class .name-fx-<name> (on an inline span holding the name), its ::before and ::after, and the
same under html[data-ov-motion=off] (motion off: hold still, keep the colour), html[data-ov-motion=reduced] (Calm:
slower, smaller) and html[data-theme-mode="light"] (a light page: the same idea at a depth that reads on white, about
4.5:1). Keyframes are named nameFx<Name>… (PascalCase of the name). Allowed properties: color, background,
background-image, background-size, background-position, background-repeat, background-clip, -webkit-background-clip,
-webkit-text-fill-color, text-shadow, filter, opacity, transform, transform-origin, letter-spacing, font-weight,
font-style, animation and its parts, display (inline or inline-block), mix-blend-mode, -webkit-text-stroke,
text-decoration, and on ::before/::after also content (a short quoted string), margin. No url(), no images, no @import,
no positioning, no escapes. One idea and its own motion (a sweep, a flicker, a rise), readable at 14 px in a chat line,
never a seizure-like flash (no more than 3 flashes a second). Keep it under 3000 characters.

An example of the shape (Golden):
.name-fx-golden { background: linear-gradient(100deg, #b8860b 0%, #ffd34d 45%, #fff6c9 50%, #ffd34d 55%, #b8860b 100%);
  background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  animation: nameFxGoldenSweep 4.5s ease-in-out infinite; }
@keyframes nameFxGoldenSweep { 0%, 60% { background-position: 100% 0; } 100% { background-position: 0 0; } }
html[data-theme-mode="light"] .name-fx-golden { background-image: linear-gradient(100deg, #8a6200, #b8860b, #e0a800, #b8860b, #8a6200); }`;

function createNameEffectDrafts({ db, ai, clock = { now: () => Date.now() } }) {
    const id = () => `nfx_${crypto.randomBytes(9).toString('base64url')}`;
    const parse = (text) => {
        const t = String(text || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
        try { return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { return null; }
    };
    async function draft({ subject, words, name = '', model = null }) {
        if (!subject) throw Object.assign(new Error('sign in to make an effect'), { status: 401 });
        if (!ai || !ai.enabled) throw Object.assign(new Error('making effects needs OpenVibe.AI, which is not configured here'), { status: 503 });
        const what = String(words || '').replace(/\s+/g, ' ').trim().slice(0, 300);
        if (what.length < 4) throw Object.assign(new Error('say what the effect looks like, in a few words'), { status: 422 });
        const wanted = String(name || '').trim().toLowerCase();
        if (wanted && !/^[a-z][a-z0-9-]{1,23}$/.test(wanted)) throw Object.assign(new Error('a name is 2 to 24 lowercase letters, digits or hyphens'), { status: 422 });
        const since = new Date(clock.now() - 86400000).toISOString();
        const used = await db.maybe('SELECT count(*)::int AS n FROM name_effect_drafts WHERE subject = $1 AND created_at > $2', [subject, since]);
        if (used && used.n >= PER_DAY) throw Object.assign(new Error(`${PER_DAY} effects a day: more tomorrow`), { status: 429 });
        const answer = await ai.text({
            system: SYSTEM,
            prompt: `The effect: ${what}${wanted ? `\nIts name: ${wanted}` : ''}`,
            maxTokens: 2200,
            target: { service: 'design', type: 'name_effect', id: wanted || 'new' },
            task: 'design.name_effect', person: subject,
            ...(model && model.prefer ? { prefer: model.prefer } : {}), ...(model && model.choice ? { choice: model.choice } : {}),
        });
        const j = parse(answer.text);
        if (!j || typeof j.css !== 'string') return { kept: null, why: 'the model did not answer an effect' };
        const slug = wanted || String(j.name || '').trim().toLowerCase();
        const checked = clean(j.css, slug);
        if (!checked.ok) return { kept: null, why: checked.why };
        const row = {
            id: id(), subject, slug, label: String(j.label || slug).replace(/\s+/g, ' ').trim().slice(0, 40), words: what, css: checked.css,
            provider: answer.provider || null, model: answer.model || null,
        };
        await db.exec(`INSERT INTO name_effect_drafts (id, subject, slug, label, words, css, provider, model)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [row.id, row.subject, row.slug, row.label, row.words, row.css, row.provider, row.model]);
        return { kept: row, why: null };
    }
    async function list({ subject = null, status = null, limit = 24 } = {}) {
        const where = []; const args = [];
        if (subject) { args.push(subject); where.push(`subject = $${args.length}`); }
        if (status) { args.push(status); where.push(`status = $${args.length}`); }
        args.push(Math.min(Math.max(Number(limit) || 24, 1), 100));
        return db.many(`SELECT id, subject, slug, label, words, css, provider, model, status, created_at FROM name_effect_drafts
            ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT $${args.length}`, args);
    }
    async function review({ id: rid, action, reviewer }) {
        const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : null;
        if (!status) throw Object.assign(new Error('approve or reject'), { status: 422 });
        const row = await db.maybe(`UPDATE name_effect_drafts SET status = $2, reviewed_by = $3, reviewed_at = now() WHERE id = $1 AND status = 'draft'
            RETURNING id, slug, status`, [String(rid || ''), status, reviewer]);
        if (!row) throw Object.assign(new Error('no such draft waiting'), { status: 404 });
        return row;
    }
    return { draft, list, review, PER_DAY };
}

module.exports = { createNameEffectDrafts, SYSTEM, pascal };
