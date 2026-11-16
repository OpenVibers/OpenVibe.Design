'use strict';
// Design cleans every SVG with openvibe-sdk/svg (SDK 0.176.0). Its own copy, server/vectors/svg.js, is gone (2026-11-16):
// one cleaner for every site, so a fix to it reaches all of them with a pin bump.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
assert.ok(!fs.existsSync(path.join(root, 'server/vectors/svg.js')), 'no second SVG cleaner in Design');
assert.match(fs.readFileSync(path.join(root, 'server/typefaces/service.js'), 'utf8'), /require\('openvibe-sdk\/svg'\)/,
    'the glyph service cleans with the SDK');

const { sanitize } = require('openvibe-sdk/svg');
// A drawing that carries anything runnable is refused whole, with the reason; a plain one is rebuilt from the allowlist.
assert.strictEqual(sanitize('<svg viewBox="0 0 10 10"><script>alert(1)</script><path d="M0 0h10v10z"/></svg>').ok, false, 'a script is refused');
const handler = sanitize('<svg viewBox="0 0 10 10"><path d="M0 0h10v10z" onclick="y()"/></svg>');
assert.deepStrictEqual([handler.ok, /onclick/.test(handler.why)], [false, true], `an event handler is refused and named (${handler.why})`);
const r = sanitize('<svg viewBox="0 0 10 10"><path d="M0 0h10v10z" fill="none" stroke="#000"/></svg>');
assert.ok(r.ok, r.why);
assert.ok(r.svg.includes('<path d="M0 0 L10 0 L10 10 Z" fill="none" stroke="#000"/>'), `the shape stays, its path written out in absolute commands (${r.svg})`);
assert.strictEqual(sanitize('<svg viewBox="0 0 1 1"><path d="M0 0h1"></svg>').ok, false, 'markup that is not well formed is refused');

console.log('svg-from-sdk: the glyph service cleans SVGs with openvibe-sdk/svg; no copy of its own');
