'use strict';
/**
 * ADR-033: every table in this service with a person column is either in the account-data map, keyed under the
 * row that owns it, or exempted with a reason. A new table with one fails here until it is answered for.
 */
const assert = require('assert');
const { uncovered } = require('openvibe-sdk/account-data');
const { TABLES } = require('../server/identity/account-data');
const { testDb } = require('./helpers/db');

(async () => {
    const d = await testDb();
    try {
        const missing = await uncovered(d.db, {
            tables: TABLES,
            taskKeyed: ['design_versions'], // versions belong to the design and cascade with it
            exempt: {
                account_data_events: 'the ledger of requests itself: which export and deletion design applied',

            },
        });
        assert.deepStrictEqual(missing, [], `a table with a person column is neither covered nor exempted: ${missing.join(', ')}`);
        console.log('  ✓ every table that names a person is covered or exempted with a reason');
    } finally { await d.close(); }
})();
