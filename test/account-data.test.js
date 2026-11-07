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
                design_index_revisions: 'the Search index sequencer: owner is the service (design), the rows are icon and theme pages, never a person',
                share_members: 'who a design is shared with: exported as shared_with_me.json, and erased by extraErase',
                share_access_requests: 'pending access requests: transient, erased by extraErase',
                share_transfers: 'pending ownership transfers: transient, erased by extraErase',
                share_deliveries: 'the delivery queue for share events/notifications; rows carry ids and are delivered once',
                share_log: 'the append-only sharing audit trail; rows carry subject ids, never titles or content',
                shares: 'the share.v1 row of a design: exported as shares.json (owned) or shared_with_me.json, erased by extraErase',

            },
        });
        assert.deepStrictEqual(missing, [], `a table with a person column is neither covered nor exempted: ${missing.join(', ')}`);
        console.log('  ✓ every table that names a person is covered or exempted with a reason');
    } finally { await d.close(); }
})();
