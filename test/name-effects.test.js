'use strict';
// /components/name-effects (plan §AD.15): every name effect live, from the openvibe-shared items.css this site pins,
// with its words; the two one-of-a-kind ones marked; listed with the other components.
//   node test/name-effects.test.js
const assert = require('assert');
const notes = require('../server/views/component-notes');

const html = notes.notePage('name-effects');
assert.ok(html, 'the page exists');
const classes = [...html.matchAll(/<span class="name-fx-([a-z]+)">Juniper<\/span>/g)].map((m) => m[1]);
assert.deepStrictEqual(classes.slice(0, 15), ['rainbow', 'golden', 'neon', 'fire', 'ice', 'galaxy', 'glitch', 'hologram', 'toxic', 'blood', 'divine', 'shadow', 'void', 'vegas', 'twofat'], 'each effect on a sample name');
assert.strictEqual((html.match(/One of a kind · /g) || []).length, 2, 'Vegas and Bass Drop are each one person\'s');
assert.match(html, /<link rel="stylesheet" href="[^"]*items\.css[^"]*">/, 'drawn by openvibe-shared\'s items.css');
assert.ok(notes.list().some((n) => n.name === 'name-effects' && n.title === 'Name effects'), 'listed with the components');
console.log('name-effects: 15 effects live from openvibe-shared items.css, the two one-of-a-kind marked, listed');
