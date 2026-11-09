'use strict';
// Who draws an icon (owner, 11-09): a guest's draft runs on the cheapest offer that can do the job ("the free one should
// use the cheapest or most cost-effective model if people aren't logged in"); a signed-in person's asks for Claude
// Opus 5.5 ("log in for the maximum tier… Anthropic, which has the best design ability"), on their own key when they
// have one. Before this, every draft (guest or not) went out with the same soft Claude preference and no key behind
// it, and all of them came back from the shared pool's smallest model. And the form's name pattern is a valid
// expression for the browser's v-flag check (an unescaped "-" in a class made Chrome drop it with a console error).
//   node test/glyph-draft-tiers.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createGlyphDrafts } = require('../server/glyphs/drafts');

const LINE = '<path d="M5 12h14"/>';
const SOLID = '<path d="M5 11h14v2H5z"/>';
function fakeDb() {
    const rows = [];
    return {
        rows,
        async maybe(sql) { if (/count\(\*\)/.test(sql)) return { n: 0 }; return null; },
        async exec(sql, args) { if (/INSERT INTO glyph_drafts/.test(sql)) rows.push(args); },
        async many() { return []; },
    };
}
function fakeAi(calls) {
    return {
        enabled: true,
        async text(args) {
            calls.push(args);
            const claude = args.prefer && args.prefer.provider === 'anthropic';
            return { text: JSON.stringify({ candidates: [{ line: LINE, solid: SOLID }, { line: '<path d="M12 5v14"/>', solid: SOLID }] }),
                provider: claude ? 'anthropic' : 'shared', model: claude ? 'claude-opus-5-5' : 'gpt-5-nano' };
        },
    };
}

(async () => {
    // A signed-in person: Claude Opus 5.5, as that person (their own key first), no cost preset.
    {
        const calls = [];
        const db = fakeDb();
        const d = createGlyphDrafts({ db, ai: fakeAi(calls) });
        const out = await d.draft({ subject: 'usr_1', name: 'hot-tub', sentence: 'a round tub with steam' });
        assert.ok(out.kept.length >= 1, 'drafts are kept');
        assert.strictEqual(calls.length, 1);
        assert.deepStrictEqual(calls[0].prefer, { provider: 'anthropic', model: 'claude-opus-5-5' }, 'signed in asks for Claude Opus 5.5');
        assert.strictEqual(calls[0].person, 'usr_1', 'as the person, so their own key is tried first');
        assert.strictEqual(calls[0].preset, undefined, 'no cheapest preset for a signed-in person');
        assert.strictEqual(out.kept[0].model, 'claude-opus-5-5', 'the draft records the model that drew it');
    }
    // A guest: the cheapest offer, on OpenVibe's, never a Claude preference and never as a person.
    {
        const calls = [];
        const db = fakeDb();
        const d = createGlyphDrafts({ db, ai: fakeAi(calls) });
        const out = await d.draft({ subject: null, guest: { id: 'a'.repeat(32), ipHash: 'h1' }, name: 'hot-tub' });
        assert.ok(out.kept.length >= 1, 'a guest gets drafts too');
        assert.deepStrictEqual(calls[0].preset, { name: 'cheapest' }, 'a guest runs on the cheapest offer');
        assert.strictEqual(calls[0].prefer, undefined, 'a guest never asks for Claude');
        assert.strictEqual(calls[0].person, undefined, 'a guest is nobody\'s key');
    }
    // The AI client carries the preset into the run it creates.
    const aiSrc = fs.readFileSync(path.join(__dirname, '..', 'server', 'arena', 'ai.js'), 'utf8');
    assert.match(aiSrc, /async function text\(\{[^}]*preset = null/, 'text() takes a preset');
    assert.match(aiSrc, /\.\.\.\(preset \? \{ preset \} : \{\}\)/, 'and sends it with the run');

    // The name pattern renders as a valid v-flag expression.
    const views = fs.readFileSync(path.join(__dirname, '..', 'server', 'views', 'icons.js'), 'utf8');
    const m = views.match(/<input name="name" required pattern="([^"]*)"/);
    assert.ok(m, 'the name field has a pattern');
    const rendered = m[1].replace(/\\\\/g, '\\');   // the template literal's "\\-" is "\-" in the page
    assert.doesNotThrow(() => new RegExp(`^(?:${rendered})$`, 'v'), `the pattern ${rendered} is valid for the browser`);
    assert.ok(new RegExp(`^(?:${rendered})$`, 'v').test('hot-tub') && !new RegExp(`^(?:${rendered})$`, 'v').test('Hot tub'), 'and still means a lowercase name with dashes');
    console.log('glyph draft tiers: guests on the cheapest offer, signed in on Claude Opus 5.5; the name pattern is valid');
})().catch((e) => { console.error(e); process.exit(1); });
