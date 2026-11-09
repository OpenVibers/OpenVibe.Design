'use strict';
const assert = require('node:assert/strict');
const { fitDrawing, measure } = require('../server/glyphs/fit');

const cases = [
    '<path d="M5 12h14"/>',
    '<path d="m6 15 6-6 6 6"/>',
    '<circle cx="8" cy="10" r="3"/><path d="M10 10h5"/>',
];
for (const svg of cases) {
    const result = fitDrawing(svg);
    assert.equal(result.ok, true, result.why);
    const box = measure(result.svg);
    assert.ok(Math.abs(box.cx - 12) <= 0.75 && Math.abs(box.cy - 12) <= 0.75, 'the fitted geometry is centered');
    assert.ok(Math.max(box.width, box.height) >= 18 && Math.max(box.width, box.height) <= 20, 'the long side fits the target');
}
const fit = fitDrawing(cases[0]);
assert.equal(fitDrawing('<path d="M12 12"/>').ok, false, 'a dot without measurable area is refused');
assert.equal(fitDrawing('<path d="M5 12h14"/>', fit.transform).ok, true, 'the solid twin reuses its line transform');
console.log('glyph fit: candidates are normalized to centre and 18–20 units before review');
