'use strict';
/**
 * Glyph drafts (plan L32 I3): a person names an icon and says what it is for, OpenVibe.AI draws a few candidates in
 * the OpenVibe hand, each is checked and rebuilt (validate.js) before it is kept, and an admin approves or rejects
 * each one. Approved drafts are what openvibe-shared's scripts/pull-glyph-drafts.js takes into the registry; nothing
 * reaches a page without that review and a Shared release.
 *
 * Each candidate comes with its solid twin (plan L50: the drawing the sites show at 18 px and under): filled shapes,
 * evenodd holes, lines kept as class="ln", checked by validate.cleanSolid. A solid that fails is dropped and the line
 * drawing kept without one (solid_svg null), so a weak solid never costs a good drawing.
 *
 *   draft({ subject, name, sentence, guest }) → { kept: [draft…], refused: [why…] }   (at most PER_DAY a person per day)
 *       guest: { id, ipHash } for someone not signed in (L50 step 5): subject is then guest:<id>, and the guest caps
 *       (per guest, per address, all guests, a day; config.glyphGuests) are checked and the attempt recorded first.
 *   list({ status, subject, limit })    → drafts, newest first
 *   review({ id, action: 'approve' | 'reject', reviewer })
 */
const crypto = require('crypto');
const { clean, cleanSolid } = require('./validate');

const PER_DAY = 12;
const CANDIDATES = 4;
const NAME_RE = /^[a-z][a-z0-9-]{1,31}$/;

// The house hand, shown rather than described (plan L49: drafts that look like the set they join). A dozen drawings
// from openvibe-shared/glyphs, picked for range: a frame, a figure, a symbol, an object, a slash variant.
const EXAMPLES = ['user', 'camera', 'bell', 'search', 'heart', 'gear', 'calendar', 'megaphone', 'compass', 'mug', 'thumbs-up', 'link-off'];
function examples() {
    let glyphs = null;
    try { glyphs = require('openvibe-shared/glyphs'); } catch { return ''; }
    const lines = EXAMPLES.map((n) => [n, glyphs.path(n)]).filter(([, d]) => d).map(([n, d]) => `${n}: ${d}`);
    const solids = ['bell', 'user', 'calendar', 'mic', 'info', 'pin'].map((n) => [n, glyphs.solid ? glyphs.solid(n) : '']).filter(([, d]) => d).map(([n, d]) => `${n}: ${d}`);
    return (lines.length ? `\n\nThe set you are drawing for (match this hand: weights, corner radii, how much of the 24 box it fills, how few lines):\n${lines.join('\n')}` : '')
        + (solids.length ? `\n\nTheir solid twins, the way to draw yours (filled shapes, holes cut with fill-rule="evenodd", a part that must stay a line as class="ln"):\n${solids.join('\n')}` : '');
}

const SYSTEM = `You draw icons for OpenVibe's glyph set. Every glyph is the inside of an SVG with viewBox "0 0 24 24":
strokes only (the page draws them 2 units wide, round caps and joins, in the text colour), at most 6 shapes from
path, circle, ellipse, rect, line and polyline, every coordinate between 1 and 23, nothing filled, no transforms.
Simple, centred on (12, 12), filling about 3 to 21 of the box, with at least 2.5 units between parallel lines so it
reads at 16 px, in the hand of a clean line icon set. A dot is a zero-length line ("M12 12h.01"). Each candidate is a
different idea, not the same drawing moved. Each candidate also has its solid twin for small sizes (16 px): the same
idea as filled shapes, a hole cut with fill-rule="evenodd" on a path, a part that has to stay a line (a handle, a
stem, a slash) as class="ln"; no other attributes, at most 6 shapes. Answer with JSON only:
{"candidates": [{"line": "<path d=\\"…\\"/>", "solid": "<path d=\\"…\\"/>"}, …]} with ${CANDIDATES} different candidates.${examples()}`;

function createGlyphDrafts({ db, ai, clock = { now: () => Date.now() }, guests = { perGuest: 2, perAddress: 4, daily: 25 } }) {
    const id = () => `gd_${crypto.randomBytes(8).toString('hex')}`;
    const iso = () => new Date(clock.now()).toISOString();

    /** A guest's three caps, then their attempt recorded (before any model is asked, so a failure counts too). */
    async function admitGuest(guest) {
        const count = async (where, args) => Number(((await db.maybe(`SELECT count(*)::int AS n FROM glyph_guest_draws WHERE ${where} AND created_at > now() - interval '1 day'`, args)) || {}).n || 0);
        const busy = (msg) => Object.assign(new Error(msg), { status: 429 });
        if (!guests.daily || await count('true', []) >= guests.daily) throw busy('Guests have drawn all the icons they can today. Sign in to draw more, or come back tomorrow.');
        if (!guests.perAddress || await count('ip_hash = $1', [guest.ipHash]) >= guests.perAddress) throw busy('That is all the icons this connection can draw today without signing in. Sign in to draw more.');
        if (!guests.perGuest || await count('guest = $1', [guest.id]) >= guests.perGuest) throw busy(`Without signing in you can draw ${guests.perGuest} icon${guests.perGuest === 1 ? '' : 's'} a day. Sign in to draw more.`);
        await db.exec('INSERT INTO glyph_guest_draws (guest, ip_hash) VALUES ($1, $2)', [guest.id, guest.ipHash]);
        // Two days is enough to count a day; older rows go.
        db.exec("DELETE FROM glyph_guest_draws WHERE created_at < now() - interval '2 days'").catch(() => {});
    }

    async function draft({ subject, name, sentence = '', guest = null }) {
        if (!subject && !guest) throw Object.assign(new Error('sign in to draw an icon'), { status: 401 });
        if (guest && !/^[0-9a-f]{16,64}$/.test(String(guest.id || ''))) throw Object.assign(new Error('this browser cannot draw without signing in'), { status: 400 });
        const who = subject || `guest:${guest.id}`;
        const n = String(name || '').trim().toLowerCase();
        if (!NAME_RE.test(n)) throw Object.assign(new Error('a name is 2 to 32 lowercase letters, digits and dashes, like "hot-tub"'), { status: 422 });
        const what = String(sentence || '').trim().slice(0, 200);
        if (!ai || !ai.enabled) throw Object.assign(new Error('drawing needs OpenVibe.AI, which is not configured here'), { status: 503 });
        if (subject) {
            const today = await db.maybe("SELECT count(*)::int AS n FROM glyph_drafts WHERE subject = $1 AND created_at > now() - interval '1 day'", [subject]);
            if ((today && today.n) >= PER_DAY) throw Object.assign(new Error(`${PER_DAY} drafts a day: more tomorrow`), { status: 429 });
        } else {
            await admitGuest(guest);
        }
        const ask = async (extra = '') => {
            const answer = await ai.text({
                system: SYSTEM,
                prompt: `The icon: "${n}".${what ? ` What it stands for: ${what}` : ''}${extra}`,
                maxTokens: 1800,
                target: { service: 'design', type: 'glyph_draft', id: n },
                prefer: { provider: 'anthropic', model: 'claude-opus-5-5' },   // Claude first, soft, on the person's key (L37)
                // A person's own key when they have one (L37); a guest runs on OpenVibe's, inside the caps above.
                ...(subject ? { person: subject } : {}),
            });
            let got = [];
            try {
                const body = String(answer.text || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
                const j = JSON.parse(body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1));
                got = Array.isArray(j.candidates) ? j.candidates.slice(0, CANDIDATES) : [];
            } catch { got = []; }
            return { answer, got };
        };
        let { answer, got: list } = await ask();
        // Fewer than two that pass the checks: ask once more, saying why the last ones failed (more reliable drafts).
        const lineOf = (c) => (typeof c === 'string' ? c : (c && typeof c.line === 'string' ? c.line : ''));
        const solidOf = (c) => (c && typeof c === 'object' && typeof c.solid === 'string' ? c.solid : '');
        const passing = list.filter((c) => clean(lineOf(c)).ok).length;
        if (passing < 2) {
            const whys = list.map((c) => clean(lineOf(c))).filter((r) => !r.ok).map((r) => r.why).slice(0, 4);
            const again = await ask(`\nThe last answer ${list.length ? `failed the checks: ${whys.join('; ') || 'too few usable drawings'}` : 'had no candidates'}. Keep strictly to the rules.`).catch(() => null);
            if (again && again.got.length) { list = list.concat(again.got).slice(0, CANDIDATES * 2); answer = again.answer; }
        }
        const kept = [], refused = [];
        const seen = new Set();
        for (const c of list) {
            const r = clean(lineOf(c));
            if (!r.ok) { refused.push(r.why); continue; }
            if (seen.has(r.svg)) continue;
            seen.add(r.svg);
            const sol = solidOf(c) ? cleanSolid(solidOf(c)) : { ok: false };
            const row = { id: id(), subject: who, name: n, sentence: what, svg: r.svg, solid_svg: sol.ok ? sol.svg : null, provider: answer.provider, model: answer.model, status: 'draft', created_at: iso() };
            await db.exec('INSERT INTO glyph_drafts (id, subject, name, sentence, svg, solid_svg, provider, model, status, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
                [row.id, row.subject, row.name, row.sentence, row.svg, row.solid_svg, row.provider, row.model, row.status, row.created_at]);
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
        return db.many(`SELECT id, name, sentence, svg, solid_svg, provider, model, status, created_at, reviewed_at FROM glyph_drafts${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT $${args.length}`, args);
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
