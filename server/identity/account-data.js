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
    { table: 'designs', subject: 'owner', file: 'designs.json', order: 'created_at', columns: ['id', 'kind', 'prompt', 'theme_id', 'variants', 'created_at', 'updated_at'] },
    // The icons a person asked OpenVibe.AI to draw (/icons). Who reviewed one is not theirs to export. An approved
    // drawing already taken into openvibe-shared stays there: it is a drawing, it names nobody.
    { table: 'glyph_drafts', subject: 'subject', file: 'glyph_drafts.json', order: 'created_at', columns: ['id', 'name', 'sentence', 'svg', 'model', 'status', 'created_at', 'reviewed_at'], erase: 'delete' },
];

async function extraExport(db, subject) {
    const rows = await db.many(
        `SELECT o.* FROM arena_outputs o
         JOIN arena_rounds r ON r.id = o."round"
         WHERE r.created_by = $1
         ORDER BY o.created_at DESC LIMIT 5000`,
        [subject],
    );
    return rows.length ? [{ name: 'arena_outputs.json', content: rows }] : [];
}

function create({ db, log = console } = {}) {
    return createAccountData({
        db,
        service: 'design',
        tables: TABLES,
        extraExport,
        note: 'Arena votes are exported without another voter\'s identity; outputs travel with the round that made them.',
        log,
    });
}

module.exports = { create, TABLES, TOPICS, extraExport };
