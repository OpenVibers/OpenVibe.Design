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
// The chat and element submit buttons were white on the plain accent (3.7:1). The accent strong pair is text-safe.
assert.ok(
    css.includes('background: var(--accent-strong, var(--accent)); color: var(--on-accent-strong, var(--on-accent));'),
    'the chat and element submit buttons use the accent strong pair'
);
// The /create submit button was white on the plain accent (3.67:1). The accent strong pair is text-safe.
assert.ok(
    css.includes('.dv-create form button { display: block; margin: 0 0 2px auto; border: 0; border-radius: 9px; background: var(--accent-strong, var(--accent)); color: var(--on-accent-strong, #fff);'),
    'the create submit button uses the accent strong pair'
);
// The arena's small lines were muted text on a tint (4.1-4.4:1); the secondary text is the readable pair.
assert.ok(
    css.includes('.ar-kind-t small { font-size: .72rem; line-height: 1.3; color: var(--text-secondary, #96a7c2); }'),
    'the arena kind line uses the secondary text'
);
assert.ok(
    css.includes('.ar-provisional { padding: 0 6px; border-radius: 999px; font-size: .66rem; font-weight: 800; letter-spacing: .04em; vertical-align: 1px; background: color-mix(in srgb, var(--text-muted, #7386a3) 18%, transparent); color: var(--text-secondary, #96a7c2); }'),
    'the arena new badge uses the secondary text'
);
assert.ok(
    !/\.ar-kb-[a-z]+ \{[^\n]*color: var\(--text-muted, #7386a3\)/.test(css),
    'no arena leaderboard line uses the muted text'
);
console.log('contrast: the LIVE badge, the submit buttons and the arena lines read');
