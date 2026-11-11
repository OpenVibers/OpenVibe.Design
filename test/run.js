#!/usr/bin/env node
/**
 * Runs every test/*.test.js in its own process and fails if any fails. Each file boots OpenVibe.Design against an
 * in-process OpenVibe.Network stand-in (test/helpers/network.js); none needs the network or a running site.
 *
 *   npm test                 # everything
 *   npm test -- login        # only files whose name contains one of the words
 *   npm test -- --strict     # a skipped test fails the run too
 *
 * A test that cannot run something here prints `<label>: skipped (<why>)`: that file is listed with ○ and not
 * counted as passed (openvibe-shared/test-runner).
 */
'use strict';
const { run } = require('openvibe-shared/test-runner');

// VERBOSE=1 also prints every file's output, then the summary again.
// 90 s is the suite's budget for the Chrome file (test/changes-chrome.test.js, 24 real page loads): it takes ~26 s
// here and needed ~50 s on a cold CI runner, where the 60 s limit timed it out once (11-11, Design #282). The other
// files finish in seconds; only a stuck test waits this long. Live's runner declares 120 s for its Chrome tests the
// same way.
run({ dir: __dirname, timeoutMs: 90_000, pad: 34, parallel: 1 }).then((r) => {
    if (process.env.VERBOSE) {
        for (const t of r.results) console.log(`\n── ${t.file} ──\n${t.output.trimEnd()}`);
        console.log(`\n${r.summary}`);
    }
    process.exit(r.exitCode);
}, (err) => { console.error(err); process.exit(1); });
