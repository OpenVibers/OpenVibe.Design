'use strict';
// WCAG 2.1 AA: the preview's LIVE badge was white on the live red (3.8:1). The red is now 80% over black,
// which keeps the badge red and lifts the white text.
//   node test/contrast.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'design.css'), 'utf8');
assert.ok(
    css.includes('background: color-mix(in srgb, var(--live-red, #e11d48) 80%, #000); color: #fff; font-size: .68rem; font-weight: 800; }'),
    'the LIVE badge darkens its red under white text'
);
assert.ok(!css.includes('.pv-badge { position: absolute; left: 8px; top: 8px; padding: 1px 7px; border-radius: 5px; background: var(--live-red, #e11d48);'), 'the plain live red is gone from the badge');
console.log('contrast: the LIVE badge reads');
