'use strict';
// Exact glyph geometry (2026-11-16; the owner, on the settings gear: "looks completely scuffed and weird … the icon
// generation system even more improved … regenerate icons that look fucked up like this, even if it's slight").
//   • the shapes (gear, star, polygon, heart) are exact: every symmetry they mean scores 1, their box on the middle;
//   • the check catches a hand-rounded gear and a heart whose sides differ by a tenth;
//   • the snap makes that heart exact, and leaves an exact drawing alone;
//   • a draft is snapped, checked and kept best first, with its report;
//   • POST /api/v1/glyphs/check and GET /api/v1/glyphs/shapes/:shape answer.
//   node test/glyph-geometry.test.js
const assert = require('assert');
const express = require('express');
const geometry = require('../server/glyphs/geometry');
const shapes = require('../server/glyphs/shapes');
const { createGlyphDrafts } = require('../server/glyphs/drafts');

// openvibe-shared's settings gear before 4.289.0: Lucide's, scaled and rounded to a tenth by hand.
const OLD_GEAR = '<circle cx="12" cy="12.1" r="2.3"/><path d="M17.6 14.3a1.3 1.3 0 0 0 0.2 1.5l0.1 0.1a1.5 1.5 0 1 1-2.4 2.4l-0.1-0.1a1.3 1.3 0 0 0-1.5-0.2a1.3 1.3 0 0 0-0.8 1.3V18.8a1.5 1.5 0 1 1-3.4 0v-0.1a1.3 1.3 0 0 0-0.9-1.3a1.3 1.3 0 0 0-1.5 0.2l-0.1 0.1a1.5 1.5 0 1 1-2.4-2.4l0.1-0.1a1.3 1.3 0 0 0 0.2-1.5a1.3 1.3 0 0 0-1.3-0.8H5.4a1.5 1.5 0 1 1 0-3.4h0.1a1.3 1.3 0 0 0 1.3-0.9a1.3 1.3 0 0 0-0.2-1.5l-0.1-0.1a1.5 1.5 0 1 1 2.4-2.4l0.1 0.1a1.3 1.3 0 0 0 1.5 0.2H9.8a1.3 1.3 0 0 0 0.8-1.3V5.4a1.5 1.5 0 1 1 3.4 0v0.1a1.3 1.3 0 0 0 0.8 1.3a1.3 1.3 0 0 0 1.5-0.2l0.1-0.1a1.5 1.5 0 1 1 2.4 2.4l-0.1 0.1a1.3 1.3 0 0 0-0.2 1.5V9.8a1.3 1.3 0 0 0 1.3 0.8H18.7a1.5 1.5 0 1 1 0 3.4h-0.1a1.3 1.3 0 0 0-1.3 0.8Z"/>';
// The kit's heart before 4.289.0: its middle at 11.9, its right lobe ending at 20 where the left began at 3.8.
const OLD_HEART = '<path d="M11.9 20.3s-8.1-5.1-8.1-11.6a4.6 4.6 0 0 1 8.1-3A4.6 4.6 0 0 1 20 9.2c0 6.5-8.1 11.6-8.1 11.6Z"/>';

(async () => {
    // The shapes are exact.
    for (const [name, make, expect] of [['gear', shapes.gear, ['quarter turn', '8-fold']], ['star', shapes.star, ['mirror ↔', '5-fold']],
        ['polygon', () => shapes.polygon({ sides: 6 }), ['6-fold']], ['heart', shapes.heart, ['mirror ↔']], ['gear 12', () => shapes.gear({ teeth: 12 }), ['12-fold']]]) {
        const r = geometry.check(make(), { expect });
        for (const k of expect) assert.ok(r.scores[k] >= 0.995, `${name} keeps ${k} (${r.scores[k]})`);
        assert.ok(r.offset <= 0.1, `${name} sits on the middle (${r.offset})`);
        assert.deepStrictEqual(r.flags, [], `${name}: nothing flagged`);
    }
    assert.match(shapes.gear(), /<circle cx="12" cy="12" r="2.4"\/>/, "the hole is on the middle");

    // The check catches the hand-rounded gear and the uneven heart.
    const gear = geometry.check(OLD_GEAR, { expect: geometry.expectFor('gear') });
    assert.ok(gear.flags.some((f) => /^n-fold 0\.(8|9)/.test(f)), `the old gear is flagged: no turn of it is exact (${gear.flags})`);
    assert.ok(gear.scores['8-fold'] < 0.9, `its teeth are uneven (${gear.scores['8-fold']})`);
    const heart = geometry.check(OLD_HEART, { expect: ['mirror ↔'] });
    assert.ok(heart.scores['mirror ↔'] < 0.995 && heart.flags.length, `the old heart is a little off (${heart.scores['mirror ↔']})`);

    // The snap makes a heart whose right side is 0.3 wider exact, and leaves an exact drawing alone.
    const NEAR_HEART = '<path d="M12 21.6s-9.3-5.7-9.3-13a5.3 5.3 0 0 1 9.3-3.6a5.3 5.3 0 0 1 9.6 3.6c0 7.3-9.6 13-9.6 13Z"/>';
    assert.ok(geometry.check(NEAR_HEART).scores['mirror ↔'] < 0.995, 'the near heart is measurably off');
    const snapped = geometry.snapMirror(NEAR_HEART);
    assert.ok(snapped.moved >= 1, 'a point moved');
    assert.ok(geometry.check(snapped.svg).scores['mirror ↔'] >= 0.995, `the snapped heart is exact (${snapped.svg})`);
    assert.deepStrictEqual(geometry.snapMirror(shapes.heart()), { svg: shapes.heart(), moved: 0 }, 'an exact heart is left alone');
    assert.strictEqual(geometry.snapMirror('<path d="M4 6h9"/>').moved, 0, 'nothing to pair: nothing moves');

    // A draft: candidates snapped, checked and kept best first, each with its report.
    {
        const rows = [];
        const db = { async maybe() { return { n: 0 }; }, async exec(sql, args) { if (/INSERT INTO glyph_drafts/.test(sql)) rows.push(args); }, async many() { return []; } };
        const ai = { enabled: true, async text() { return { provider: 'stub', model: 'stub', text: JSON.stringify({ candidates: [{ line: NEAR_HEART }, { line: shapes.heart() }] }) }; } };
        const out = await createGlyphDrafts({ db, ai, referenceSearch: async () => [] }).draft({ subject: 'usr_1', name: 'heart', sentence: 'love', method: 'write' });
        assert.ok(out.kept.length >= 1, `kept (${out.refused})`);
        for (const k of out.kept) assert.ok(k.geometry && k.geometry.scores && k.geometry.scores['mirror ↔'] >= 0.995, `every kept heart is exact (${JSON.stringify(k.geometry)})`);
        assert.ok(rows.every((r) => /"scores"/.test(r[12])), 'the report is stored with the draft');
    }

    // The API.
    const { createIconRoutes } = require('../server/http/icons');
    {
        const app = express();
        app.use(createIconRoutes({ config: {}, s: { db: null }, ai: null, glyphDrafts: {}, glyphPrice: {}, referenceSearch: async () => [], log: { warn() {}, log() {} } }));
        const srv = app.listen(0, '127.0.0.1'); await new Promise((r) => srv.once('listening', r));
        const base = `http://127.0.0.1:${srv.address().port}`;
        try {
            const r = await fetch(`${base}/api/v1/glyphs/check`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ svg: OLD_GEAR, name: 'gear' }) });
            const j = await r.json();
            assert.strictEqual(r.status, 200, JSON.stringify(j));
            assert.ok(j.flags.length && j.expect.includes('n-fold'), JSON.stringify(j.flags));
            const bad = await fetch(`${base}/api/v1/glyphs/check`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ svg: '<script/>' }) });
            assert.strictEqual(bad.status, 422);
            const s = await (await fetch(`${base}/api/v1/glyphs/shapes/gear?teeth=6`)).json();
            assert.ok(s.svg.startsWith('<path d="M') && (s.svg.match(/A8\.48 8\.48/g) || []).length === 6, 'six teeth');
            assert.strictEqual((await fetch(`${base}/api/v1/glyphs/shapes/blob`)).status, 404);
        } finally { srv.close(); }
    }
    // The audit over a set: a two-glyph set where only the old gear is off.
    {
        const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glyph-audit-'));
        const file = path.join(dir, 'glyphs.js');
        fs.writeFileSync(file, `const P = { gear: ${JSON.stringify(OLD_GEAR)}, plus: '<path d="M12 5v14M5 12h14"/>' };\nmodule.exports = { NAMES: Object.keys(P), path: (n) => P[n] || '' };\n`);
        const out = JSON.parse(cp.execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'glyph-geometry-audit.js'), file, '--json'], { encoding: 'utf8' }));
        assert.deepStrictEqual([out.checked, out.found.map((f) => f.name)], [2, ['gear']]);
        fs.rmSync(dir, { recursive: true, force: true });
    }
    console.log('glyph-geometry: shapes exact; the old gear and heart caught; the snap evens the heart; drafts kept best first with their report; the check and shapes API');
})().catch((e) => { console.error(e); process.exit(1); });
