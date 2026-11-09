#!/usr/bin/env node
'use strict';

/**
 * Import the installed openvibe-shared kit into the design_components registry (server/components/import.js).
 *
 *   node scripts/import-components.js             add components this database has not seen; keep edits
 *   node scripts/import-components.js --force     replace every entry with the current Shared definitions
 *
 * Run it after a shared release; the app also runs the additive import at boot, so a fresh database is never empty.
 * The database is the service's own (DATABASE_URL, or the development PGlite directory).
 */
const { load } = require('../server/config');
const { openStore } = require('../server/db');
const { createComponentRegistry } = require('../server/components/store');

(async () => {
    const store = await openStore(load());
    try {
        const registry = createComponentRegistry({ db: store.db });
        const result = await registry.importEntries({ force: process.argv.includes('--force') });
        console.log(`component registry: ${result.imported} of ${result.total} imported`);
    } finally {
        await store.close();
    }
})().catch((err) => {
    console.error('component registry import failed:', (err && err.stack) || err);
    process.exit(1);
});
