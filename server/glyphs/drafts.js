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
const { fitDrawing, transform: moveDrawing } = require('./fit');
const geometry = require('./geometry');
const { tracePng } = require('./trace');
const methodsOf = require('./methods');

/** A line drawing at 64 px as a PNG, base64 (what a vision model is shown). */
function renderPng(svg) {
    const { Resvg } = require('@resvg/resvg-js');
    const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64"><rect width="24" height="24" fill="#fff"/><g fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svg}</g></svg>`;
    return Buffer.from(new Resvg(doc).render().asPng()).toString('base64');
}

// The house size: openvibe-shared's icons draw their ink 0.79 of the box on its long side (test/icon-ink).
const HOUSE_LONG = 0.79 * 24;

// The harness way's task (2026-11-16): a Codes coding agent draws in OpenVibe.Shared, where the set lives.
const HARNESS_REPO = 'https://github.com/OpenVibers/OpenVibe.Shared';
const { searchReferences } = require('./references');

const PER_DAY = 12;
const CANDIDATES = 4;
const NAME_RE = /^[a-z][a-z0-9-]{1,31}$/;

// The house hand, shown rather than described (plan L49: drafts that look like the set they join). A dozen drawings
// from openvibe-shared/glyphs, picked for range: a frame, a figure, a symbol, an object, a slash variant.
const EXAMPLES = ['user', 'camera', 'bell', 'search', 'heart', 'sun', 'calendar', 'megaphone', 'compass', 'mug', 'thumbs-up', 'link-off'];
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
reads at 16 px, in the hand of a clean line icon set. Exact geometry: a regular shape is regular (a gear's teeth all
the same width, evenly spaced; a star's points equal; a ring's centre on 12, 12), and anything symmetric is mirror-exact
about x = 12 (the left side's numbers mirror the right side's to the decimal). Use whole or half units where you can,
never a nearly-equal pair like 12 and 12.1. A dot is a zero-length line ("M12 12h.01"). Each candidate is a
different idea, not the same drawing moved. Each candidate also has its solid twin for small sizes (16 px): the same
idea as filled shapes, a hole cut with fill-rule="evenodd" on a path, a part that has to stay a line (a handle, a
stem, a slash) as class="ln"; no other attributes, at most 6 shapes. Answer with JSON only:
{"candidates": [{"line": "<path d=\\"…\\"/>", "solid": "<path d=\\"…\\"/>"}, …]} with ${CANDIDATES} different candidates.${examples()}`;
// The line twin of a traced picture (the "Picture, then trace" way): the solid comes first, the line follows it.
const LINE_SYSTEM = `You draw the line version of an OpenVibe solid icon. The solid drawing is given; draw the same idea and
outer silhouette as strokes only: the inside of an SVG with viewBox "0 0 24 24", 2-unit round strokes drawn by the page,
at most 6 shapes from path, circle, ellipse, rect, line and polyline, coordinates between 1 and 23, nothing filled, no
transforms, centred on (12, 12), about 3 to 21 of the box. Exact geometry: a regular shape regular, a symmetric one
mirror-exact about x = 12. Answer with JSON only: {"candidates": [{"line": "<path d=\\"…\\"/>"}, …]} with 3 candidates.`;
const SOLID_SYSTEM = `You make filled twins for existing OpenVibe line glyphs. Keep the idea and outer silhouette identical to the provided line drawing. Turn closed regions into filled shapes, preserve holes with fill-rule="evenodd", and keep handles, stems, slashes and other open strokes as class="ln". Return JSON only as {"candidates":[{"solid":"<path d=\\"…\\"/>"},…]}. Use only path, circle, ellipse and rect shapes; no transforms, styles, colours or scripts.`;

function createGlyphDrafts({ db, ai, clock = { now: () => Date.now() }, guests = { perGuest: 2, perAddress: 4, daily: 25 }, referenceSearch = searchReferences, codes = null }) {
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

    /** The gate every drawing goes through, whatever drew it (see draft()). → (list) → { passed, why } */
    function gateFor({ n, sourceLine = null }) {
        const lineOf = (c) => (typeof c === 'string' ? c : (c && typeof c.line === 'string' ? c.line : ''));
        // The gate every drawing goes through, whatever drew it (2026-11-16: "make sure … this doesn't ever happen
        // again"): cleaned and rebuilt, fitted to the house box, centred on its drawn ink (the fit measures an arc by its
        // end point and radius, which put a drawn heart 2.4 units low), snapped to exact mirror symmetry where it is
        // nearly there, then measured. A name that means a regular shape (a gear, a star) must come out exact.
        const expect = geometry.expectFor(n);
        return (list) => {
            const passed = [], why = [];
            for (const c of list) {
                const r = sourceLine ? sourceLine : clean(lineOf(c));
                if (!r.ok) { why.push(r.why); continue; }
                let fitted = fitDrawing(r.svg);
                if (!fitted.ok) { why.push(fitted.why); continue; }
                let report = null, snapped = 0;
                if (!sourceLine) {
                    try {
                        report = geometry.check(fitted.svg, { expect });
                        // The house size from the drawn ink (openvibe-shared test/icon-ink: the long side 0.79 of the box,
                        // 18.96 units with the 2-unit stroke); the fit measures control points and aims 19 units without it.
                        const long = report.size ? Math.max(report.size.w, report.size.h) : HOUSE_LONG;
                        const scale = long > 2.5 && Math.abs(long - HOUSE_LONG) > 0.3 ? (HOUSE_LONG - 2) / (long - 2) : 1;
                        if (report.centre && (report.offset > 0.2 || scale !== 1)) {
                            const moved = clean(moveDrawing(fitted.svg, { cx: report.centre.x, cy: report.centre.y, scale }));
                            if (moved.ok) { fitted = { ...fitted, svg: moved.svg }; report = geometry.check(moved.svg, { expect }); }
                        }
                        if (report.scores['mirror ↔'] >= 0.9 && report.scores['mirror ↔'] < 0.995) {
                            const s = geometry.snapMirror(fitted.svg);
                            const again = s.moved ? clean(s.svg) : null;
                            if (again && again.ok) {
                                const after = geometry.check(again.svg, { expect });
                                if (after.scores['mirror ↔'] > report.scores['mirror ↔']) { fitted = { ...fitted, svg: again.svg }; report = after; snapped = s.moved; }
                            }
                        }
                    } catch { report = null; }
                    const missed = report ? expect.filter((k) => !(geometry.scoreOf(report, k) >= 0.995)) : [];
                    if (missed.length) { why.push(`a ${n} has to be exact: ${missed.map((k) => `${k} ${geometry.scoreOf(report, k)}`).join(', ')}`); continue; }
                }
                passed.push({ c, fitted, report, snapped });
            }
            passed.sort((a, b) => geometry.rank(b.report) - geometry.rank(a.report));
            return { passed, why };
        };
    }

    /** Judge (when a vision model is named) and keep what passed the gate, best first. */
    async function settle({ n, what, who, sourceLine = null, requestedStyles, references = [], person = {}, list, answer, notes = [], way, judge = null }) {
        const gate = gateFor({ n, sourceLine });
        const solidOf = (c) => (c && typeof c === 'object' && typeof c.solid === 'string' ? c.solid : '');
        const { passed: prepared, why: refusedWhy } = gate(list);
        const kept = [], refused = refusedWhy.slice();
        // A vision model may judge which drawings read best as the icon at small sizes (any vision model on Exchange).
        if (judge && judge.prefer && ai.vision && prepared.length > 1) {
            try {
                const pngs = prepared.slice(0, 6).map((p) => `data:image/png;base64,${renderPng(p.fitted.svg)}`);
                const verdict = await ai.vision({ prompt: `These ${pngs.length} pictures are candidate icons for "${n}"${what ? ` (${what})` : ''}, each drawn at 64 px. Which read best as that, at 16 px, cleanly and exactly? Answer JSON only: {"order": [indexes from 1, best first]}.`, images: pngs, prefer: judge.prefer, ...person, target: { service: 'design', type: 'glyph_draft', id: n } });
                const j = JSON.parse(String(verdict.text || '').slice(String(verdict.text || '').indexOf('{'), String(verdict.text || '').lastIndexOf('}') + 1));
                const order = Array.isArray(j.order) ? j.order.map((x) => Number(x) - 1).filter((x) => Number.isInteger(x) && x >= 0 && x < prepared.length) : [];
                if (order.length) {
                    const picked = [...new Set(order)].map((i) => prepared[i]);
                    prepared.splice(0, prepared.length, ...picked, ...prepared.filter((p) => !picked.includes(p)));
                    notes.push(`judged by ${verdict.model}`);
                }
            } catch { /* the geometry order stands */ }
        }
        const seen = new Set();
        for (const { c, fitted, report, snapped } of prepared) {
            if (seen.has(fitted.svg)) continue;
            seen.add(fitted.svg);
            let sol = solidOf(c) ? cleanSolid(solidOf(c)) : { ok: false };
            if (sol.ok) {
                // The solid twin has different filled extents from the line drawing (especially where a
                // stem or slash remains class="ln"). Fit it to the same house box independently.
                const solidFit = fitDrawing(sol.svg);
                if (solidFit.ok) sol = solidFit; else { refused.push(`${n} solid: ${solidFit.why}`); sol = { ok: false }; }
            }
            const geo = report ? { scores: report.scores, offset: report.offset, flags: report.flags, snapped, method: way, notes } : { method: way, notes };
            const row = { id: id(), subject: who, name: n, sentence: what, svg: fitted.svg, solid_svg: sol.ok ? sol.svg : null,
                styles: requestedStyles, references, provider: answer.provider, model: answer.model, status: 'draft', created_at: iso(), geometry: geo };
            await db.exec('INSERT INTO glyph_drafts (id, subject, name, sentence, svg, solid_svg, provider, model, status, created_at, styles_json, references_json, geometry_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
                [row.id, row.subject, row.name, row.sentence, row.svg, row.solid_svg, row.provider, row.model, row.status, row.created_at, JSON.stringify(row.styles), JSON.stringify(row.references), JSON.stringify(geo)]);
            kept.push(row);
        }
        if (!list.length) refused.push('the model answered no candidates');
        return { kept, refused, method: way };
    }

    // ── The harness way: a Codes task as the person, finished when the page asks (no token is kept) ──
    const harnessJobs = new Map();   // task id → { subject, n, what, harness, started }
    const codesBase = () => String((codes && codes.url) || '').replace(/\/+$/, '');
    const codesFetch = (codes && codes.fetch) || globalThis.fetch;
    async function startHarness({ subject, token, n, what, harness }) {
        if (!codesBase()) throw Object.assign(new Error('coding agents need OpenVibe.Codes, which is not configured here'), { status: 503 });
        if (!subject || !token) throw Object.assign(new Error('sign in to have a coding agent draw it'), { status: 401 });
        if (!/^[a-z][a-z0-9-]{1,40}$/.test(String(harness || ''))) throw Object.assign(new Error('pick a coding agent'), { status: 422 });
        const prompt = `Draw an original icon for OpenVibe's glyph set: "${n}"${what ? ` (${what})` : ''}. Read glyphs.js and kit.js in this repository for the house hand (24-unit grid, 2-unit round strokes, how much of the box an icon fills, how few lines). Do not change any file.
Rules: strokes only, at most 6 shapes (path, circle, ellipse, rect, line, polyline), coordinates between 1 and 23, centred on (12, 12), about 3 to 21 of the box; exact geometry: a regular shape regular, a symmetric one mirror-exact about x = 12.
Check each drawing before you answer: POST https://openvibe.design/api/v1/glyphs/check with JSON {"svg": "<the drawing>", "name": "${n}"}; it answers symmetry scores (an exact drawing scores 1.000), the centre offset and flags. Fix anything flagged.
Your final answer is JSON only, nothing else: {"candidates": [{"line": "<path d=\"…\"/>"}, …]} with 3 different candidates.`;
        const res = await codesFetch(`${codesBase()}/api/v1/me/tasks`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ repo: HARNESS_REPO, prompt, agent: harness, permission: 'review' }), signal: AbortSignal.timeout(15000),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.task || !body.task.id) throw Object.assign(new Error((body && (body.detail || body.title)) || `Codes answered ${res.status}`), { status: res.status === 401 ? 401 : 502 });
        harnessJobs.set(String(body.task.id), { subject, n, what, harness, started: clock.now() });
        return { task: String(body.task.id), harness, url: body.task.url || null, state: body.task.state || 'queued' };
    }
    /** The page asks how a harness draft is going; when the task has answered, its drawings go through the gate. */
    async function finishHarness({ subject, token, task }) {
        const job = harnessJobs.get(String(task));
        if (!job || job.subject !== subject) throw Object.assign(new Error('no such drawing in progress'), { status: 404 });
        if (job.done) return job.done;
        const res = await codesFetch(`${codesBase()}/api/v1/me/tasks/${encodeURIComponent(task)}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
        const body = await res.json().catch(() => ({}));
        const t = body && (body.task || body);
        const state = t && t.state;
        if (!res.ok || !state) throw Object.assign(new Error(`Codes answered ${res.status}`), { status: 502 });
        if (['queued', 'placed', 'running'].includes(state)) return { state, task };
        harnessJobs.delete(String(task));
        if (state !== 'succeeded') return { state, task, kept: [], refused: [`the coding agent ${state}${t.error ? `: ${t.error.message || t.error.code || ''}` : ''}`] };
        const summary = String((t.result && t.result.summary) || '');
        let list = [];
        try { const j = JSON.parse(summary.slice(summary.indexOf('{'), summary.lastIndexOf('}') + 1)); list = Array.isArray(j.candidates) ? j.candidates.slice(0, CANDIDATES) : []; } catch { list = []; }
        const out = await settle({ n: job.n, what: job.what, who: subject, requestedStyles: ['thin', 'light', 'regular', 'bold', 'solid', 'duotone'], list,
            answer: { provider: 'openvibe.codes', model: job.harness }, notes: [`drawn by ${job.harness} in Codes`], way: 'harness' });
        job.done = { state, task, ...out };
        return job.done;
    }

    /**
     * Draw a glyph. method: auto | shape | write | refine | trace | harness (methods.js); model, image, judge: an Exchange
     * catalogue entry ({ prefer }) for the drawing, the picture and the judge; harness: a Codes coding agent's id (with
     * the person's token, the task runs as them). → { kept, refused, method } or, for a harness, { pending }.
     */
    async function draft({ subject, name, sentence = '', guest = null, service = false, styles = null, sourceSvg = '', choice = null,
        method = 'auto', model = null, image: imageModel = null, judge = null, harness = null, token = null }) {
        if (!subject && !guest) throw Object.assign(new Error('sign in to draw an icon'), { status: 401 });
        if (guest && !/^[0-9a-f]{16,64}$/.test(String(guest.id || ''))) throw Object.assign(new Error('this browser cannot draw without signing in'), { status: 400 });
        const who = subject || `guest:${guest.id}`;
        const n = String(name || '').trim().toLowerCase();
        if (!NAME_RE.test(n)) throw Object.assign(new Error('a name is 2 to 32 lowercase letters, digits and dashes, like "hot-tub"'), { status: 422 });
        const what = String(sentence || '').trim().slice(0, 200);
        const sourceLine = sourceSvg ? clean(sourceSvg) : null;
        if (sourceLine && !sourceLine.ok) throw Object.assign(new Error(`sourceSvg: ${sourceLine.why}`), { status: 422 });
        const allowedStyles = new Set(['thin', 'light', 'regular', 'bold', 'solid', 'duotone']);
        const requestedStyles = Array.isArray(styles) ? [...new Set(styles.map((x) => String(x).toLowerCase()).filter((x) => allowedStyles.has(x)))].slice(0, 6) : [...allowedStyles];
        if (!requestedStyles.length) throw Object.assign(new Error('styles must include thin, light, regular, bold, solid or duotone'), { status: 422 });
        if (!methodsOf.METHOD_IDS.includes(String(method || 'auto'))) throw Object.assign(new Error(`method is one of ${methodsOf.METHOD_IDS.join(', ')}`), { status: 422 });
        const regular = sourceLine ? [] : methodsOf.shapesFor(n, what);
        // A guest runs on OpenVibe's cheapest offer, one call a drawing: Auto, an exact shape or Draw, never a picked
        // model, a picture, a judge or a coding agent.
        const way = sourceLine ? 'write' : method === 'auto' || !method ? (regular.length ? 'shape' : guest ? 'write' : 'refine') : method;
        if (guest && !['shape', 'write'].includes(way)) throw Object.assign(new Error('sign in to draw it that way'), { status: 401 });
        if (guest) { model = null; imageModel = null; judge = null; }
        if (way === 'harness' && (!subject || service)) throw Object.assign(new Error('sign in to have a coding agent draw it'), { status: 401 });
        if (way !== 'shape' && way !== 'harness' && (!ai || !ai.enabled)) throw Object.assign(new Error('drawing needs OpenVibe.AI, which is not configured here'), { status: 503 });
        if (subject) {
            const today = await db.maybe("SELECT count(*)::int AS n FROM glyph_drafts WHERE subject = $1 AND created_at > now() - interval '1 day'", [subject]);
            if ((today && today.n) >= PER_DAY) throw Object.assign(new Error(`${PER_DAY} drafts a day: more tomorrow`), { status: 429 });
        } else {
            await admitGuest(guest);
        }
        if (way === 'harness') return { kept: [], refused: [], method: way, pending: await startHarness({ subject, token, n, what, harness }) };
        let references = [];
        if (!sourceLine && way !== 'shape') { try { references = await referenceSearch(`${n.replace(/-/g, ' ')} ${what}`, { limit: 5 }); } catch { references = []; } }
        const referenceWords = references.map((r) => `${r.name.replace(/-/g, ' ')} (${r.setName}; ${r.license})`).join(', ');
        const lineOf = (c) => (typeof c === 'string' ? c : (c && typeof c.line === 'string' ? c.line : ''));
        const solidOf = (c) => (c && typeof c === 'object' && typeof c.solid === 'string' ? c.solid : '');
        const person = subject && !service ? { person: subject } : {};
        const parse = (text) => {
            try {
                const body = String(text || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
                const j = JSON.parse(body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1));
                return Array.isArray(j.candidates) ? j.candidates.slice(0, CANDIDATES) : [];
            } catch { return []; }
        };
        const ask = async (extra = '', { system = null, prompt = null } = {}) => {
            const answer = await ai.text({
                system: system || (sourceLine ? SOLID_SYSTEM : SYSTEM),
                prompt: prompt || `${sourceLine ? `Make a solid twin of this existing line drawing for "${n}": ${sourceLine.svg}` : `The icon: "${n}".`}${what ? ` What it stands for: ${what}` : ''}${referenceWords ? `\nRelated open icon concepts for vocabulary only: ${referenceWords}` : ''}${extra}`,
                maxTokens: 1800,
                target: { service: 'design', type: 'glyph_draft', id: n },
                task: 'design.icon', choice: (model && model.choice) || choice,
                ...(model && model.prefer ? { prefer: model.prefer } : {}),
                ...person,
            });
            return { answer, got: parse(answer.text) };
        };

        const gate = gateFor({ n, sourceLine });
        const flagsSaid = (p) => (p.report && p.report.flags.length ? p.report.flags.join('; ') : 'none');

        let answer = { provider: 'openvibe.design', model: 'exact shapes' };
        let list = [];
        const notes = [];
        if (way === 'shape') {
            list = regular.map((line) => ({ line }));
            if (!list.length) throw Object.assign(new Error(`"${n}" is not a shape Design can compute (gears, stars, hearts, polygons): pick another way to draw it`), { status: 422 });
        } else if (way === 'trace') {
            // An image model paints it; the picture is traced into the solid drawing; a text model draws the line twin.
            if (!ai.image) throw Object.assign(new Error('pictures need OpenVibe.AI image generation, which is not configured here'), { status: 503 });
            const painted = await ai.image({
                prompt: `A single flat icon of ${n.replace(/-/g, ' ')}${what ? ` (${what})` : ''}: pure black shapes on a plain white background, centred, filling most of the square, bold simple forms, no text, no shading, no gradients, no frame, symmetric where the object is.`,
                ...(imageModel && imageModel.prefer ? { prefer: imageModel.prefer } : {}), ...(imageModel && imageModel.choice ? { choice: imageModel.choice } : {}), ...person,
                target: { service: 'design', type: 'glyph_draft', id: n },
            });
            answer = { provider: painted.provider, model: painted.model };
            const first = painted.images[0];
            if (!first || !first.b64) throw Object.assign(new Error('the image model answered no picture'), { status: 502 });
            const traced = tracePng(Buffer.from(first.b64, 'base64'));
            if (!traced.ok) throw Object.assign(new Error(`the picture could not be traced: ${traced.why}`), { status: 502 });
            const solid = cleanSolid(traced.svg);
            const solidFit = solid.ok ? fitDrawing(solid.svg) : null;
            if (!solidFit || !solidFit.ok) throw Object.assign(new Error(`the traced picture is not a usable drawing: ${(solidFit || solid).why}`), { status: 502 });
            const twin = await ask('', { system: LINE_SYSTEM, prompt: `The icon: "${n}".${what ? ` What it stands for: ${what}.` : ''} Its solid drawing, traced from a picture: ${solidFit.svg}` });
            list = twin.got.map((c) => ({ line: lineOf(c), solid: solidFit.svg }));
            notes.push(`traced from ${painted.model}; line twin by ${twin.answer.model}`);
            answer = { provider: twin.answer.provider, model: `${painted.model} + ${twin.answer.model}` };
        } else {
            // write and refine: a model writes the drawing; refine sends back what the gate found, up to three rounds.
            let a = await ask();
            answer = a.answer; list = a.got;
            const rounds = way === 'refine' ? 3 : 1;
            for (let round = 1; round < rounds + 1; round++) {
                const { passed, why } = gate(list);
                const exact = passed.filter((p) => !p.report || !p.report.flags.length);
                if (exact.length >= 2 || (round >= rounds)) break;
                if (way !== 'refine' && passed.length >= 2) break;
                const said = [
                    ...why.slice(0, 4).map((w) => `- refused: ${w}`),
                    ...passed.slice(0, 3).map((p, i) => `- drawing ${i + 1} ${p.fitted.svg} measured: ${flagsSaid(p)}`),
                ].join('\n');
                const again = await ask(`\n\nYour last drawings, measured by openvibe.design (an exact drawing scores 1.000 for every symmetry it has; the centre is the ink's middle):\n${said || '- no drawing passed'}\nDraw them again so each is exact: equal parts equal, mirror sides mirrored to the decimal, centred on (12, 12). Keep strictly to the rules.`).catch(() => null);
                if (!again || !again.got.length) break;
                // Nothing new: the model answered the same drawings again, so another round would only cost.
                const seen = new Set(list.map(lineOf));
                const fresh = again.got.filter((c) => !seen.has(lineOf(c)));
                if (!fresh.length) break;
                list = fresh.concat(list).slice(0, CANDIDATES * 2); answer = again.answer;
                notes.push(`round ${round + 1}`);
            }
        }

        return settle({ n, what, who, sourceLine, requestedStyles, references, person, list, answer, notes, way, judge });
    }

    async function list({ status = null, subject = null, limit = 60 } = {}) {
        const where = [], args = [];
        if (status) { args.push(status); where.push(`status = $${args.length}`); }
        if (subject) { args.push(subject); where.push(`subject = $${args.length}`); }
        args.push(Math.min(Math.max(Number(limit) || 60, 1), 500));
        return db.many(`SELECT id, name, sentence, svg, solid_svg, styles_json, references_json, geometry_json, provider, model, status, created_at, reviewed_at FROM glyph_drafts${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT $${args.length}`, args);
    }

    async function review({ id: draftId, action, reviewer }) {
        if (!['approve', 'reject'].includes(action)) throw Object.assign(new Error('approve or reject'), { status: 422 });
        const status = action === 'approve' ? 'approved' : 'rejected';
        const row = await db.maybe('UPDATE glyph_drafts SET status = $2, reviewed_by = $3, reviewed_at = $4 WHERE id = $1 RETURNING id, name, status', [draftId, status, reviewer, iso()]);
        if (!row) throw Object.assign(new Error('no such draft'), { status: 404 });
        return row;
    }

    return { draft, finishHarness, list, review, PER_DAY };
}

module.exports = { createGlyphDrafts, SYSTEM, PER_DAY };
