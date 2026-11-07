'use strict';

/**
 * Account export and deletion → Design (ADR-033; openvibe-sdk/account-data). The rows a person owns are the rounds
 * they started, the votes they cast, their designs and their icon drafts. A round's outputs are exported with it; deleting the round
 * cascades its outputs and every vote on it (including other people's votes on that round, which is the right
 * outcome: the round is gone). Ratings are aggregate and name no person, so they stay.
 *
 * A vote's voter_subject is never exported or shown in the open dataset.
 */
const { createAccountData, TOPICS } = require('openvibe-sdk/account-data');

const TABLES = [
    { table: 'arena_rounds', subject: 'created_by', file: 'arena_rounds.json', erase: 'delete' },
    { table: 'arena_votes', subject: 'voter_subject', file: 'arena_votes.json', erase: 'delete' },
    // The designs a signed-in person asked for; a guest's design has no owner and matches nobody. Versions cascade.
    { table: 'designs', subject: 'owner', file: 'designs.json', order: 'created_at', columns: ['id', 'kind', 'prompt', 'theme_id', 'variants', 'space_url', 'published_at', 'created_at', 'updated_at'] },
    // The icons a person asked OpenVibe.AI to draw (/icons). Who reviewed one is not theirs to export. An approved
    // drawing already taken into openvibe-shared stays there: it is a drawing, it names nobody.
    // The marks a signed-in person picked on /brand/explore (a guest's picks name nobody).
    { table: 'brand_picks', subject: 'voter', file: 'brand_picks.json', order: 'created_at', columns: ['code', 'created_at'], erase: 'delete' },
    { table: 'glyph_drafts', subject: 'subject', file: 'glyph_drafts.json', order: 'created_at', columns: ['id', 'name', 'sentence', 'svg', 'model', 'status', 'created_at', 'reviewed_at'], erase: 'delete' },
];

async function extraExport(db, subject) {
    // The share.v1 rows the person owns or is on: the design itself is exported above; this is who it was
    // shared with and who shared what with them (subjects as the ids they are).
    const files = [];
    const owned = await db.many('SELECT service, kind, resource_id, audience, lock, revision FROM shares WHERE owner_subject->>\'id\' = $1 ORDER BY resource_id DESC LIMIT 5000', [subject]);
    if (owned.length) files.push({ name: 'shares.json', content: owned });
    const memberships = await db.many(`SELECT s.service, s.kind, s.resource_id, s.audience, m.role, m.added_at, m.expires_at
        FROM share_members m JOIN shares s ON s.service=m.service AND s.kind=m.kind AND s.resource_id=m.resource_id
        WHERE m.subject->>\'id\' = $1 ORDER BY m.added_at DESC LIMIT 5000`, [subject]);
    if (memberships.length) files.push({ name: 'shared_with_me.json', content: memberships });
    const rows = await db.many(
        `SELECT o.* FROM arena_outputs o
         JOIN arena_rounds r ON r.id = o."round"
         WHERE r.created_by = $1
         ORDER BY o.created_at DESC LIMIT 5000`,
        [subject],
    );
    if (rows.length) files.push({ name: 'arena_outputs.json', content: rows });
    return files;
}

/**
 * Deleting an account removes the share rows that named it: ownership of its designs (which the designs
 * table above deletes), memberships in other people's, pending requests and transfers. share_log is the
 * append-only audit trail and is kept (its rows carry ids, no titles or content).
 */
async function extraErase(t, subjects) {
    const ids = [...subjects];
    await t.exec('DELETE FROM share_members WHERE subject->>\'id\' = ANY($1::text[])', [ids]);
    await t.exec('DELETE FROM share_access_requests WHERE subject->>\'id\' = ANY($1::text[])', [ids]);
    await t.exec('DELETE FROM share_transfers WHERE from_subject->>\'id\' = ANY($1::text[]) OR to_subject->>\'id\' = ANY($1::text[])', [ids]);
    await t.exec('DELETE FROM shares WHERE owner_subject->>\'id\' = ANY($1::text[])', [ids]);
    // A member's slot is gone with their membership; the service's own projections follow the design deleted above.
}

function create({ db, log = console } = {}) {
    return createAccountData({
        db,
        service: 'design',
        tables: TABLES,
        extraExport,
        extraErase,
        note: 'Arena votes are exported without another voter\'s identity; outputs travel with the round that made them.',
        log,
    });
}

module.exports = { create, TABLES, TOPICS, extraExport, extraErase };
