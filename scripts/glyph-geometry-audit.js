#!/usr/bin/env node
'use strict';
// The geometry check over a whole glyph set (2026-11-16): every glyph that misses a symmetry it is meant to keep, or
// sits more than 0.6 unit off the middle, with its scores. openvibe-shared's set by default, or a glyphs.js you name.
//   node scripts/glyph-geometry-audit.js [path/to/glyphs.js] [--json]
const path = require('path');
const geometry = require('../server/glyphs/geometry');
const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const glyphs = arg ? require(path.resolve(arg)) : require('openvibe-shared/glyphs');
const json = process.argv.includes('--json');
const found = [];
for (const name of glyphs.NAMES) {
    const svg = glyphs.path(name);
    if (!svg) continue;
    const r = geometry.check(svg, { expect: geometry.expectFor(name) });
    if (r.flags.length) found.push({ name, flags: r.flags, offset: r.offset });
}
if (json) process.stdout.write(JSON.stringify({ checked: glyphs.NAMES.length, found }, null, 2) + '\n');
else {
    console.log(`${glyphs.NAMES.length} glyphs checked; ${found.length} with something off`);
    for (const f of found) console.log(`${f.name.padEnd(18)} ${f.flags.join(' · ')}`);
}
