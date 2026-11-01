'use strict';
/**
 * Nothing on openvibe.design spins (the owner, 2026-10-31: "no spinning rings"; tools/design-lint's `spinner` rule).
 * A loading state breathes, bobs or fills instead. Every stylesheet, page and script under public/ and server/ is read
 * for a keyframe that turns a whole circle; a hue that cycles (hue-rotate) is colour, not motion, and is left alone.
 */
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const files = [];
(function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(css|html|js)$/.test(e.name) && !/\.min\./.test(e.name)) files.push(p);
    }
})(path.join(ROOT, 'public'));
(function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.js$/.test(e.name)) files.push(p);
    }
})(path.join(ROOT, 'server'));

const KEYFRAMES = /@keyframes\s+([\w-]+)\s*\{([^{}]*\{[^{}]*\}\s*)*[^{}]*\}/g;
const TURN = /(?<!hue-)rotate\(\s*(360deg|1turn|-360deg|-1turn)\s*\)/;
const found = [];
for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(KEYFRAMES)) if (TURN.test(m[0])) found.push(`${path.relative(ROOT, f)}: @keyframes ${m[1]}`);
}
assert.ok(files.length > 20, `read the site's files (${files.length})`);
assert.deepEqual(found, [], `nothing spins on openvibe.design:\n${found.join('\n')}`);
console.log(`no-spin: ${files.length} files, no keyframe turns a whole circle`);
