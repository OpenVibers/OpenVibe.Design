'use strict';

/**
 * The Elements and packs gallery beside Design /create (owner correction, 2026-11-11: the gallery lives on
 * OpenVibe.Design; Exchange stays the AI model catalogue and is read only for live AI prices).
 *
 * A listing is a validated ui.element@1 document or a ui.element-pack@1 pack, free, plus who made it and the
 * original it remixes. Installs add the element to the person's Live channel; ratings come only from people who
 * installed it; reports are rows for staff. Nothing here runs an element, calls a robot, or carries a price.
 */
const { isExplicit } = require('openvibe-sdk/no-looks');
const { COMPONENTS, COMPONENT_NAMES, COMPONENT, validateElement } = require('../create/element');

const MAX_DOC_BYTES = 262144;
const MAX_ITEMS = 24;
const MAX_NAME = 120;
const MAX_SUMMARY = 600;
const TEXT = /https?:\/\/|<[a-z!/]/i;

function bad(message, code = 'gallery.invalid', status = 422) {
    const err = new Error(message);
    err.code = code;
    err.status = status;
    return err;
}

const plain = (v) => (typeof v === 'string' ? v.trim() : '');
const stringsIn = (value, out = []) => {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach((v) => stringsIn(v, out));
    else if (value && typeof value === 'object') Object.values(value).forEach((v) => stringsIn(v, out));
    return out;
};

/** Content checks on top of the element runtime's validation: free, no URL or markup, no explicit text. */
function contentReasons(doc, path = 'element') {
    const reasons = [];
    const name = plain(doc.name);
    const summary = plain(doc.description);
    if (name.length < 1 || name.length > 80) reasons.push(`${path} needs a name of 1 to 80 characters.`);
    if (summary.length > 500) reasons.push(`${path}'s description is longer than 500 characters.`);
    if (isExplicit(name, summary)) reasons.push(`${path} carries explicit adult text.`);
    const look = doc.look || {};
    if (!COMPONENT.has(look.component)) reasons.push(`${path}'s look uses a component that is not in the gallery's control set (${COMPONENT_NAMES.join(', ')}).`);
    if (look.label && (String(look.label).length > 40 || TEXT.test(String(look.label)))) reasons.push(`${path}'s label is longer than 40 characters or carries a link.`);
    if (look.style && look.style.tint && !/^[a-z][a-z0-9-]{0,39}$/.test(String(look.style.tint))) reasons.push(`${path}'s tint must be a theme token, never a colour.`);
    for (const text of stringsIn(doc.recipe)) {
        if (text.length > 2000) reasons.push(`${path}'s recipe has a value longer than 2000 characters.`);
        if (TEXT.test(text)) reasons.push(`${path}'s recipe carries a URL or markup.`);
    }
    if (doc.price != null || doc.price_cents != null || doc.price_usd != null) {
        const n = Number(doc.price_cents != null ? doc.price_cents : doc.price_usd != null ? doc.price_usd : doc.price);
        if (Number.isFinite(n) && n > 0) reasons.push('Elements are free: a listing cannot carry a price.');
    }
    return reasons;
}

/** One element document (a draft or a stored one) as a listing: the runtime validates it, then the content. */
function validateElementListing(doc, path = 'element') {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw bad(`${path} must be an object.`);
    const runtime = validateElement(doc);
    const reasons = [...(runtime.ok ? [] : runtime.reasons), ...contentReasons(doc, path)];
    if (reasons.length) throw bad(`The element is not valid: ${[...new Set(reasons)].slice(0, 6).join(' ')}`);
    return { kind: 'element', name: plain(doc.name), summary: plain(doc.description), look: doc.look, doc };
}

/** A pack: a named list of validated element documents. */
function validatePack(doc) {
    if (!Array.isArray(doc.items) || doc.items.length === 0) throw bad('A pack needs at least one element.');
    if (doc.items.length > MAX_ITEMS) throw bad(`A pack has at most ${MAX_ITEMS} elements.`);
    const name = plain(doc.name);
    const summary = plain(doc.description);
    if (name.length < 2 || name.length > MAX_NAME) throw bad(`A pack's name must be 2 to ${MAX_NAME} characters.`);
    if (summary.length > MAX_SUMMARY) throw bad(`A pack's description is longer than ${MAX_SUMMARY} characters.`);
    if (isExplicit(name, summary)) throw bad('A pack carries explicit adult text.');
    const names = new Set();
    for (const [i, item] of doc.items.entries()) {
        const got = validateElementListing(item, `pack item ${i + 1}`);
        if (names.has(got.name.toLowerCase())) throw bad(`A pack cannot hold two elements with the same name: ${got.name}.`);
        names.add(got.name.toLowerCase());
    }
    return { kind: 'pack', name, summary, look: doc.items[0].look, doc };
}

/** Check one listing document. `ui.element-pack@1` is a pack; anything else is one element. */
function validateDocument(doc) {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw bad('The listing has no element document.');
    let json;
    try { json = JSON.stringify(doc); } catch { throw bad('The document is not valid JSON.'); }
    if (Buffer.byteLength(json, 'utf8') > MAX_DOC_BYTES) throw bad(`The document is larger than ${Math.round(MAX_DOC_BYTES / 1024)} KB.`);
    const got = doc.pack === 'ui.element-pack@1' ? validatePack(doc) : validateElementListing(doc);
    return { ...got, bytes: Buffer.byteLength(json, 'utf8') };
}

function slugOf(name) {
    return String(name || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'element';
}

function createGallery({ s, now = () => Date.now(), log = console } = {}) {
    const iso = () => new Date(now()).toISOString();
    function wire(row, extra = {}) {
        if (!row) return null;
        return {
            id: row.id, slug: row.slug, kind: row.kind, name: row.name, summary: row.summary,
            document: row.document, look: row.look,
            author: { subject: row.author_subject, name: row.author_name, username: row.author_username },
            source: row.source, source_id: row.source_id, remix_of: row.remix_of, official: row.official === true,
            status: row.status, installs: Number(row.installs) || 0,
            rating: { count: Number(row.rating_count) || 0, average: row.rating_count ? Math.round((Number(row.rating_sum) / Number(row.rating_count)) * 10) / 10 : null },
            created_at: row.created_at, updated_at: row.updated_at, ...extra,
        };
    }
    async function uniqueSlug(name) {
        const base = slugOf(name);
        for (let n = 1; n < 50; n += 1) {
            const slug = n === 1 ? base : `${base}-${n}`;
            if (!(await s.db.maybe('SELECT 1 FROM design_element_listings WHERE slug = $1', [slug]))) return slug;
        }
        return `${base}-${now().toString(36)}`;
    }
    async function get(idOrSlug) {
        const key = String(idOrSlug || '').slice(0, 120);
        if (!key) return null;
        return wire(await s.db.maybe('SELECT * FROM design_element_listings WHERE id = $1 OR slug = $1', [key]));
    }
    async function publish({ subject, authorName, authorUsername, document: doc, source = 'design', sourceId = null, remixOf = null, official = false } = {}) {
        if (!official && !subject) throw bad('Publishing is a person\'s own action: sign in first.', 'gallery.sign_in', 401);
        let document = doc;
        if (remixOf) {
            const original = await get(remixOf);
            if (!original || original.status !== 'published') throw bad('The element you are remixing is not available.', 'gallery.remix_missing', 404);
            if (original.author.subject === subject && subject) throw bad('That is already your element.', 'gallery.remix_own');
            document = JSON.parse(JSON.stringify(original.document));
            const newName = plain(doc && doc.name) || `${original.name} (remix)`;
            document.name = newName;
            if (doc && doc.description) document.description = plain(doc.description);
            source = 'remix';
            sourceId = original.id;
        }
        const checked = validateDocument(document);
        const author = official ? 'OpenVibe' : (plain(authorName) || (authorUsername ? `@${authorUsername}` : 'A maker'));
        const id = s.newId('del');
        const row = await s.db.maybe(
            `INSERT INTO design_element_listings
               (id, slug, kind, name, summary, document, look, author_subject, author_name, author_username,
                source, source_id, remix_of, official, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, 'published', $15::timestamptz, $15::timestamptz)
             RETURNING *`,
            [id, await uniqueSlug(checked.name), checked.kind, checked.name, checked.summary || null, JSON.stringify(checked.doc),
                JSON.stringify(checked.look || null), official ? null : subject, author, official ? null : (authorUsername || null),
                source, sourceId, remixOf || null, official, iso()],
        );
        return wire(row);
    }
    async function list({ q = '', kind = null, sort = 'new', limit = 48, offset = 0 } = {}) {
        const where = ["status = 'published'"];
        const args = [];
        const needle = plain(q).slice(0, 120);
        if (needle) {
            args.push(`%${needle.replace(/[%_]/g, (c) => `\\${c}`)}%`);
            where.push(`(name ILIKE $${args.length} ESCAPE '\\' OR COALESCE(summary, '') ILIKE $${args.length} ESCAPE '\\')`);
        }
        if (kind === 'element' || kind === 'pack') { args.push(kind); where.push(`kind = $${args.length}`); }
        const order = sort === 'installs' ? 'installs DESC, created_at DESC'
            : sort === 'rating' ? 'CASE WHEN rating_count > 0 THEN rating_sum::float8 / rating_count ELSE 0 END DESC, rating_count DESC, created_at DESC'
                : 'created_at DESC';
        args.push(Math.max(1, Math.min(96, Number(limit) || 48)), Math.max(0, Number(offset) || 0));
        const rows = await s.db.many(`SELECT * FROM design_element_listings WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT $${args.length - 1} OFFSET $${args.length}`, args);
        return rows.map((r) => wire(r));
    }
    async function count({ q = '', kind = null } = {}) {
        const where = ["status = 'published'"];
        const args = [];
        const needle = plain(q).slice(0, 120);
        if (needle) {
            args.push(`%${needle.replace(/[%_]/g, (c) => `\\${c}`)}%`);
            where.push(`(name ILIKE $${args.length} ESCAPE '\\' OR COALESCE(summary, '') ILIKE $${args.length} ESCAPE '\\')`);
        }
        if (kind === 'element' || kind === 'pack') { args.push(kind); where.push(`kind = $${args.length}`); }
        const row = await s.db.maybe(`SELECT COUNT(*)::int AS n FROM design_element_listings WHERE ${where.join(' AND ')}`, args);
        return Number(row && row.n) || 0;
    }
    async function installedBy(listingId, subject) {
        if (!subject) return null;
        const row = await s.db.maybe('SELECT * FROM design_element_installs WHERE listing_id = $1 AND subject = $2', [String(listingId), String(subject)]);
        return row ? { channel: row.channel, library: row.library, created_at: row.created_at } : null;
    }
    async function ratingBy(listingId, subject) {
        if (!subject) return null;
        const row = await s.db.maybe('SELECT stars, note, updated_at FROM design_element_ratings WHERE listing_id = $1 AND subject = $2', [String(listingId), String(subject)]);
        return row ? { stars: row.stars, note: row.note, updated_at: row.updated_at } : null;
    }
    async function install({ listingId, subject, channel = null, library = null } = {}) {
        if (!subject) throw bad('Sign in to install an element.', 'gallery.sign_in', 401);
        const row = await get(listingId);
        if (!row || row.status !== 'published') throw bad('That element is not available.', 'gallery.missing', 404);
        const id = s.newId('dei');
        const inserted = await s.db.maybe(
            `INSERT INTO design_element_installs (id, listing_id, subject, channel, library, created_at)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz) ON CONFLICT (listing_id, subject) DO NOTHING RETURNING id`,
            [id, row.id, subject, plain(channel).slice(0, 64) || null, JSON.stringify(library || null), iso()],
        );
        if (inserted) await s.db.maybe('UPDATE design_element_listings SET installs = installs + 1 WHERE id = $1 RETURNING installs', [row.id]);
        const fresh = await get(row.id);
        return { listing: fresh, first: Boolean(inserted) };
    }
    async function rate({ listingId, subject, stars, note = null } = {}) {
        if (!subject) throw bad('Sign in to rate an element.', 'gallery.sign_in', 401);
        const n = Number(stars);
        if (!Number.isInteger(n) || n < 1 || n > 5) throw bad('Choose one to five stars.', 'gallery.rating');
        const row = await get(listingId);
        if (!row || row.status !== 'published') throw bad('That element is not available.', 'gallery.missing', 404);
        if (!(await installedBy(row.id, subject))) throw bad('Only people who installed an element can rate it.', 'gallery.not_installed', 403);
        await s.db.maybe(
            `INSERT INTO design_element_ratings (id, listing_id, subject, stars, note, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $6::timestamptz)
             ON CONFLICT (listing_id, subject) DO UPDATE SET stars = EXCLUDED.stars, note = EXCLUDED.note, updated_at = EXCLUDED.updated_at`,
            [s.newId('der'), row.id, subject, n, plain(note).slice(0, 400) || null, iso()],
        );
        await s.db.maybe(
            `UPDATE design_element_listings SET rating_sum = (SELECT COALESCE(SUM(stars), 0)::int FROM design_element_ratings WHERE listing_id = $1),
                    rating_count = (SELECT COUNT(*)::int FROM design_element_ratings WHERE listing_id = $1) WHERE id = $1`, [row.id],
        );
        return get(row.id);
    }
    async function report({ listingId, subject = null, reason = 'other', detail = null } = {}) {
        const row = await get(listingId);
        if (!row || row.status !== 'published') throw bad('That element is not available.', 'gallery.missing', 404);
        const why = String(reason || 'other');
        if (!['unsafe', 'broken', 'spam', 'other'].includes(why)) throw bad('Choose a reason from the list.', 'gallery.reason');
        const text = plain(detail).slice(0, 1000);
        if (text && isExplicit(text)) throw bad('Keep the report to the problem itself.', 'gallery.report_text');
        const saved = await s.db.maybe(
            `INSERT INTO design_element_reports (id, listing_id, subject, reason, detail, status, created_at)
             VALUES ($1, $2, $3, $4, $5, 'pending', $6::timestamptz) RETURNING *`,
            [s.newId('dep'), row.id, subject || null, why, text || null, iso()],
        );
        return { id: saved.id, status: saved.status, created_at: saved.created_at };
    }
    async function reports({ status = 'pending', limit = 100 } = {}) {
        const rows = await s.db.many(
            `SELECT r.*, e.slug, e.name, e.status AS listing_status FROM design_element_reports r
               JOIN design_element_listings e ON e.id = r.listing_id
              WHERE r.status = $1 ORDER BY r.created_at DESC, r.id DESC LIMIT $2`,
            [status, Math.max(1, Math.min(200, Number(limit) || 100))],
        );
        return rows.map((r) => ({ id: r.id, listing_id: r.listing_id, slug: r.slug, name: r.name, listing_status: r.listing_status,
            subject: r.subject, reason: r.reason, detail: r.detail, status: r.status, created_at: r.created_at }));
    }
    async function reviewReport({ id, decision, note = null, reviewer = null } = {}) {
        if (!['accepted', 'rejected'].includes(decision)) throw bad('Choose accepted or rejected.', 'gallery.decision');
        const row = await s.db.maybe(
            `UPDATE design_element_reports SET status = $1, reviewer_note = $2, reviewed_by = $3, reviewed_at = $4::timestamptz
              WHERE id = $5 AND status = 'pending' RETURNING *`,
            [decision, plain(note).slice(0, 500) || null, reviewer || null, iso(), String(id || '')],
        );
        if (!row) return null;
        if (decision === 'accepted') await setStatus({ id: row.listing_id, status: 'hidden', reviewer });
        return { id: row.id, listing_id: row.listing_id, status: row.status };
    }
    async function setStatus({ id, status, reviewer = null } = {}) {
        if (!['published', 'hidden'].includes(status)) throw bad('Choose published or hidden.', 'gallery.status');
        const row = await s.db.maybe('UPDATE design_element_listings SET status = $1, updated_at = $2::timestamptz WHERE id = $3 RETURNING *', [status, iso(), String(id || '')]);
        if (!row) return null;
        if (reviewer) log.log(`[OpenVibe.Design] gallery listing ${row.slug} set ${status} by ${reviewer}`);
        return wire(row);
    }
    async function ensureOfficial({ slug, document: doc }) {
        const existing = await s.db.maybe('SELECT * FROM design_element_listings WHERE slug = $1', [slug]);
        if (existing) return wire(existing);
        const checked = validateDocument(doc);
        const row = await s.db.maybe(
            `INSERT INTO design_element_listings
               (id, slug, kind, name, summary, document, look, author_subject, author_name, author_username,
                source, source_id, remix_of, official, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, NULL, 'OpenVibe', NULL, 'official', NULL, NULL, true, 'published', $8::timestamptz, $8::timestamptz)
             ON CONFLICT (slug) DO NOTHING RETURNING *`,
            [s.newId('del'), slugOf(slug), checked.kind, checked.name, checked.summary || null, JSON.stringify(checked.doc),
                JSON.stringify(checked.look || null), iso()],
        );
        return wire(row) || wire(await s.db.maybe('SELECT * FROM design_element_listings WHERE slug = $1', [slugOf(slug)]));
    }
    return { publish, list, count, get, installedBy, ratingBy, install, rate, report, reports, reviewReport, setStatus, ensureOfficial, validateDocument, slugOf };
}

module.exports = { createGallery, validateDocument, validateElementListing, contentReasons, slugOf, COMPONENTS };
