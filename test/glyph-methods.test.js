'use strict';
// The ways Design draws an icon (2026-11-16; the owner: "make sure … this doesn't ever happen again … the icon generator
// … interconnected with openvibe.exchange and can use all the different model types and harnesses … for different
// methods of generation"):
//   • Auto computes an exact shape when the name is a regular one, with no model at all;
//   • Draw, measure, fix refuses a lopsided gear, sends back what was off, and keeps the exact one it draws next;
//   • Picture, then trace: an image model's picture is traced into the solid drawing and a model draws its line twin;
//   • a vision model may judge the order;
//   • a coding agent draws it in a Codes task as the person, finished when the page asks;
//   • the options are Exchange's models by kind and Codes' agents.
//   node test/glyph-methods.test.js
const assert = require('assert');
const { Resvg } = require('@resvg/resvg-js');
const { createGlyphDrafts } = require('../server/glyphs/drafts');
const methods = require('../server/glyphs/methods');
const shapes = require('../server/glyphs/shapes');
const geometry = require('../server/glyphs/geometry');

const OLD_GEAR = '<circle cx="12" cy="12.1" r="2.3"/><path d="M17.6 14.3a1.3 1.3 0 0 0 0.2 1.5l0.1 0.1a1.5 1.5 0 1 1-2.4 2.4l-0.1-0.1a1.3 1.3 0 0 0-1.5-0.2a1.3 1.3 0 0 0-0.8 1.3V18.8a1.5 1.5 0 1 1-3.4 0v-0.1a1.3 1.3 0 0 0-0.9-1.3a1.3 1.3 0 0 0-1.5 0.2l-0.1 0.1a1.5 1.5 0 1 1-2.4-2.4l0.1-0.1a1.3 1.3 0 0 0 0.2-1.5a1.3 1.3 0 0 0-1.3-0.8H5.4a1.5 1.5 0 1 1 0-3.4h0.1a1.3 1.3 0 0 0 1.3-0.9a1.3 1.3 0 0 0-0.2-1.5l-0.1-0.1a1.5 1.5 0 1 1 2.4-2.4l0.1 0.1a1.3 1.3 0 0 0 1.5 0.2H9.8a1.3 1.3 0 0 0 0.8-1.3V5.4a1.5 1.5 0 1 1 3.4 0v0.1a1.3 1.3 0 0 0 0.8 1.3a1.3 1.3 0 0 0 1.5-0.2l0.1-0.1a1.5 1.5 0 1 1 2.4 2.4l-0.1 0.1a1.3 1.3 0 0 0-0.2 1.5V9.8a1.3 1.3 0 0 0 1.3 0.8H18.7a1.5 1.5 0 1 1 0 3.4h-0.1a1.3 1.3 0 0 0-1.3 0.8Z"/>';
const fakeDb = () => { const rows = []; return { rows, async maybe() { return { n: 0 }; }, async exec(sql, args) { if (/INSERT INTO glyph_drafts/.test(sql)) rows.push(args); }, async many() { return []; } }; };
const answer = (candidates) => ({ provider: 'stub', model: 'stub-model', text: JSON.stringify({ candidates }) });

(async () => {
    // Words that name a regular shape.
    assert.ok(methods.shapesFor('settings').length >= 1 && methods.shapesFor('gear').length >= 1 && methods.shapesFor('star').length >= 1);
    assert.deepStrictEqual(methods.shapesFor('hot-tub', 'a tub with steam'), []);

    // Auto on a regular name: exact shapes, no model.
    {
        const calls = [];
        const ai = { enabled: true, async text(a) { calls.push(a); return answer([]); } };
        const out = await createGlyphDrafts({ db: fakeDb(), ai, referenceSearch: async () => [] }).draft({ subject: 'usr_1', name: 'settings', sentence: 'your settings' });
        assert.strictEqual(out.method, 'shape');
        assert.strictEqual(calls.length, 0, 'no model drew it');
        assert.ok(out.kept.length >= 2, `kept (${out.refused})`);
        for (const k of out.kept) assert.ok(geometry.scoreOf(k.geometry, 'n-fold') >= 0.995 && !k.geometry.flags.length, `exact (${JSON.stringify(k.geometry)})`);
    }
    await assert.rejects(createGlyphDrafts({ db: fakeDb(), ai: { enabled: true }, referenceSearch: async () => [] }).draft({ subject: 'usr_1', name: 'hot-tub', method: 'shape' }), /not a shape/);

    // Draw, measure, fix: the lopsided gear is refused and its measures go back; the exact one drawn next is kept.
    {
        const calls = [];
        const ai = { enabled: true, async text(a) { calls.push(a); return calls.length === 1 ? answer([{ line: OLD_GEAR }]) : answer([{ line: shapes.gear({ tip: 9.6, root: 7.3, hole: 2.7 }) }, { line: shapes.gear({ teeth: 6, tip: 9.6, root: 7, hole: 3 }) }]); } };
        const out = await createGlyphDrafts({ db: fakeDb(), ai, referenceSearch: async () => [] }).draft({ subject: 'usr_1', name: 'gear', method: 'refine', model: { prefer: { provider: 'openai', model: 'gpt-5' } } });
        assert.strictEqual(calls.length, 2, 'drew twice');
        assert.match(calls[1].prompt, /refused: a gear has to be exact: n-fold 0\.\d+/, 'the measures went back to the model');
        assert.deepStrictEqual(calls[0].prefer, { provider: 'openai', model: 'gpt-5' }, 'on the Exchange model picked');
        assert.ok(out.kept.length >= 1 && out.kept.every((k) => k.geometry.scores['8-fold'] >= 0.995 || k.geometry.scores['6-fold'] >= 0.995), 'only exact gears are kept');
        assert.ok(out.refused.some((r) => /a gear has to be exact/.test(r)), 'the lopsided one is refused, with why');
    }

    // Picture, then trace: a painted heart becomes the solid; a model draws the line twin.
    {
        const painted = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="512" height="512"><rect width="24" height="24" fill="#fff"/>${shapes.heart({ width: 10, lobe: 5.7, dip: 3.87, drop: 13.98 }).replace('<path', '<path fill="#000"')}</svg>`).render().asPng();
        const calls = [];
        const ai = {
            enabled: true,
            async image(a) { calls.push(['image', a]); return { images: [{ b64: Buffer.from(painted).toString('base64') }], model: 'gpt-image-1', provider: 'openai' }; },
            async text(a) { calls.push(['text', a]); return answer([{ line: shapes.heart() }]); },
        };
        const out = await createGlyphDrafts({ db: fakeDb(), ai, referenceSearch: async () => [] }).draft({ subject: 'usr_1', name: 'heart', method: 'trace', image: { prefer: { provider: 'openai', model: 'gpt-image-1' } } });
        assert.deepStrictEqual(calls.map((c) => c[0]), ['image', 'text']);
        assert.deepStrictEqual(calls[0][1].prefer, { provider: 'openai', model: 'gpt-image-1' }, 'on the image model picked');
        assert.match(calls[1][1].prompt, /Its solid drawing, traced from a picture: <path [^>]*fill-rule="evenodd"/);
        assert.ok(out.kept.length === 1 && out.kept[0].solid_svg && /evenodd/.test(out.kept[0].solid_svg), 'the traced solid is the twin');
        assert.match(out.kept[0].model, /gpt-image-1 \+ stub-model/);
    }

    // A vision model judges the order.
    {
        const lines = [shapes.star(), shapes.star({ inner: 0.42 })];
        const ai = { enabled: true, async text() { return answer(lines.map((line) => ({ line }))); }, async vision(a) { assert.strictEqual(a.images.length, 2); assert.match(a.images[0], /^data:image\/png;base64,/); return { text: '{"order": [2, 1]}', model: 'vision-stub' }; } };
        const out = await createGlyphDrafts({ db: fakeDb(), ai, referenceSearch: async () => [] }).draft({ subject: 'usr_1', name: 'star', method: 'write', judge: { prefer: { model: 'vision-stub' } } });
        assert.strictEqual(out.kept.length, 2);
        assert.ok(out.kept[0].geometry.notes.some((x) => /judged by vision-stub/.test(x)));
    }

    // A coding agent: a Codes task as the person; the page asks until it answers.
    {
        const seen = [];
        let state = 'running';
        const fetch = async (url, o = {}) => {
            seen.push([o.method || 'GET', String(url), (o.headers || {}).Authorization]);
            if (o.method === 'POST') return { ok: true, status: 201, json: async () => ({ task: { id: 'tsk_1', state: 'queued', url: 'https://openvibe.codes/t/tsk_1' } }) };
            return { ok: true, status: 200, json: async () => ({ task: { id: 'tsk_1', state, result: state === 'succeeded' ? { ok: true, summary: `Done.\n${JSON.stringify({ candidates: [{ line: shapes.gear({ tip: 9.6, root: 7.3, hole: 2.7 }) }, { line: OLD_GEAR }] })}` } : undefined } }) };
        };
        const d = createGlyphDrafts({ db: fakeDb(), ai: { enabled: true }, referenceSearch: async () => [], codes: { url: 'https://openvibe.codes', fetch } });
        const started = await d.draft({ subject: 'usr_1', name: 'gear', method: 'harness', harness: 'claude-code', token: 'tok_person' });
        assert.deepStrictEqual(started.pending && [started.pending.task, started.pending.harness], ['tsk_1', 'claude-code']);
        const post = JSON.parse(String(seen[0][1]) && (await (async () => '{}')()));
        void post;
        assert.deepStrictEqual([seen[0][0], seen[0][1], seen[0][2]], ['POST', 'https://openvibe.codes/api/v1/me/tasks', 'Bearer tok_person'], 'as the person');
        assert.deepStrictEqual(await d.finishHarness({ subject: 'usr_1', token: 'tok_person', task: 'tsk_1' }), { state: 'running', task: 'tsk_1' });
        await assert.rejects(d.finishHarness({ subject: 'usr_2', token: 'x', task: 'tsk_1' }), /no such drawing/, 'only its person asks');
        state = 'succeeded';
        const done = await d.finishHarness({ subject: 'usr_1', token: 'tok_person', task: 'tsk_1' });
        assert.strictEqual(done.kept.length, 1, 'the exact gear is kept');
        assert.strictEqual(done.kept[0].model, 'claude-code');
        assert.ok(done.refused.some((r) => /a gear has to be exact/.test(r)), 'the lopsided one is refused');
        await assert.rejects(createGlyphDrafts({ db: fakeDb(), ai: { enabled: true }, referenceSearch: async () => [], codes: { url: 'https://openvibe.codes', fetch } }).draft({ guest: { id: 'a'.repeat(32) }, name: 'gear', method: 'harness', harness: 'codex' }), /sign in/);
    }

    // A guest: one call a drawing on OpenVibe's cheapest offer; no picked model, no rounds, no picture, no agent.
    {
        const calls = [];
        const ai = { enabled: true, async text(a) { calls.push(a); return answer([{ line: '<rect x="4" y="10" width="16" height="8" rx="2"/>' }]); }, async image() { throw new Error('no picture for a guest'); } };
        const d = createGlyphDrafts({ db: fakeDb(), ai, referenceSearch: async () => [] });
        const guest = { id: 'b'.repeat(32), address: '203.0.113.9' };
        await d.draft({ guest, name: 'kettle', model: { prefer: { provider: 'anthropic', model: 'claude-opus-5-5' } } }).catch(() => null);
        assert.strictEqual(calls.length, 1, 'one call');
        assert.strictEqual(calls[0].prefer, undefined, 'never a model the guest picked');
        for (const method of ['refine', 'trace']) await assert.rejects(d.draft({ guest, name: 'kettle', method }), /sign in/, method);
    }

    // The options: Exchange's models by kind (vision ones from the chat list) and Codes' agents that are on.
    {
        methods.options.reset();
        const doc = (slug, extra = {}) => ({ slug, name: slug, offers: [{ provider: 'p', model: slug, price: { in: 1, out: 2 } }], ...extra });
        const ai = { async exchangeCatalog({ kind }) { return { models: kind === 'image' ? [doc('gpt-image-1')] : [doc('gpt-5', { capabilities: { vision: true } }), doc('deepseek-chat')] }; } };
        const fetch = async () => ({ ok: true, json: async () => ({ harnesses: [{ id: 'claude-code', name: 'Claude Code' }, { id: 'codex', name: 'Codex', off: true }] }) });
        const o = await methods.options({ ai, codes: { url: 'https://openvibe.codes', fetch } });
        assert.deepStrictEqual(o.methods.map((m) => m.id), ['auto', 'shape', 'refine', 'write', 'trace', 'harness']);
        assert.deepStrictEqual([o.models.draw.map((m) => m.id), o.models.vision.map((m) => m.id), o.models.image.map((m) => m.id)], [['gpt-5', 'deepseek-chat'], ['gpt-5'], ['gpt-image-1']]);
        assert.deepStrictEqual(o.models.draw[0].prefer, { provider: 'p', model: 'gpt-5' });
        assert.deepStrictEqual(o.harnesses.map((h) => h.id), ['claude-code'], 'an agent that is off is not offered');
    }
    void geometry;
    console.log('glyph-methods: Auto exact with no model; refine refuses a lopsided gear and keeps the exact; picture traced to the solid; judged by a vision model; a coding agent in Codes; Exchange models by kind and Codes agents');
})().catch((e) => { console.error(e); process.exit(1); });
