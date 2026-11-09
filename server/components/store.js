'use strict';

/**
 * The component registry store: design_components (migration 0020), one row per Shared kit component.
 *
 * The importer (server/components/import.js) builds the design.component@1 document and the default example's HTML
 * from the installed openvibe-shared; this module only persists and reads them. An import never overwrites a row that
 * already exists, so a person who edits a definition (a clearer summary, an organizing decision) keeps it across
 * releases; `importEntries({ force: true })` is the explicit refresh, and the CLI in scripts/import-components.js runs
 * it after a shared release.
 *
 *   list()                              → entries ordered by name
 *   get(name)                           → entry or null
 *   importEntries({ force })            → { imported, total }
 *   count()                             → rows in the table
 */
const { buildEntries } = require('./import');

function toEntry(row) {
    if (!row) return null;
    const definition = typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition;
    const markup = row.example_markup || '';
    const examples = Array.isArray(definition.examples) ? definition.examples.map((example, i) => (
        i === 0 && markup ? { ...example, markup } : example
    )) : [];
    return {
        name: row.name,
        source: row.source,
        definition,
        markup,
        examples,
        importedAt: row.imported_at || null,
    };
}

function createComponentRegistry({ db, log = console } = {}) {
    if (!db) throw new Error('createComponentRegistry: a database is required');

    async function list() {
        const rows = await db.many('SELECT name, source, definition, example_markup, imported_at FROM design_components ORDER BY name');
        return rows.map(toEntry);
    }

    async function get(name) {
        const row = await db.maybe('SELECT name, source, definition, example_markup, imported_at FROM design_components WHERE name = $1', [String(name || '')]);
        return toEntry(row);
    }

    async function count() {
        const row = await db.maybe('SELECT count(*)::int AS n FROM design_components');
        return row ? Number(row.n) : 0;
    }

    async function importEntries({ force = false } = {}) {
        const entries = buildEntries();
        let imported = 0;
        await db.tx(async () => {
            for (const entry of entries) {
                const sql = force
                    ? 'INSERT INTO design_components (name, source, definition, example_markup, imported_at) VALUES ($1, $2, $3::jsonb, $4, now()) ON CONFLICT (name) DO UPDATE SET source = EXCLUDED.source, definition = EXCLUDED.definition, example_markup = EXCLUDED.example_markup, imported_at = now() RETURNING name'
                    : 'INSERT INTO design_components (name, source, definition, example_markup, imported_at) VALUES ($1, $2, $3::jsonb, $4, now()) ON CONFLICT (name) DO NOTHING RETURNING name';
                const inserted = await db.maybe(sql, [entry.name, entry.source, JSON.stringify(entry.definition), entry.markup]);
                if (inserted) imported += 1;
            }
        });
        if (imported && log && typeof log.info === 'function') {
            log.info(`[OpenVibe.Design] component registry: imported ${imported} of ${entries.length}`);
        }
        return { imported, total: entries.length };
    }

    return { list, get, count, importEntries };
}

module.exports = { createComponentRegistry, toEntry };
