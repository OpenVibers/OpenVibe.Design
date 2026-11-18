'use strict';
/**
 * A box that scrolls sideways says what it does up and down (rule scrollers-state-both-axes, 11-15; the owner: "update
 * openvibe.design so this doesn't happen ever again"). openvibe-shared checks the library the same way; this checks the
 * site's own styles: every overflow-x: auto | scroll states overflow-y in the same rule (hidden for a row of controls,
 * auto for code and tables).
 *   node test/scroll-axis.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', '.git', 'test', 'vendor', 'dist']);
const files = [];
function walk(dir, pattern) {
    fs.readdirSync(dir).forEach((name) => {
        if (SKIP.has(name)) return;
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p, pattern);
        else if (pattern.test(name) && st.size < 3e6) files.push(p);
    });
}
walk(path.join(ROOT, 'public'), /\.(css|js)$/);
walk(path.join(ROOT, 'server'), /\.js$/);

const bad = [];
let sideways = 0;
files.forEach((file) => {
    const src = fs.readFileSync(file, 'utf8');
    const rule = /([^{}]*)\{([^{}]*)\}/g;
    let m = rule.exec(src);
    while (m) {
        if (/overflow-x\s*:\s*(auto|scroll)/.test(m[2])) {
            sideways++;
            if (!/overflow-y\s*:\s*(hidden|clip|auto|scroll)/.test(m[2])) bad.push(`${path.relative(ROOT, file)}: ${m[1].trim().split('\n').pop().slice(-70)}`);
        }
        m = rule.exec(src);
    }
});
assert.ok(sideways >= 1, `the scan sees the site's sideways scrollers (${sideways})`);
assert.deepStrictEqual(bad, [], `a sideways scroller must say overflow-y:\n${bad.join('\n')}`);
const { RULES } = require('../server/rules/register');
assert.ok(RULES.some((r) => r.id === 'scrollers-state-both-axes'), 'the register carries the rule');
console.log(`scroll axis: ${sideways} sideways scrollers on openvibe.design, each says what it does up and down`);
