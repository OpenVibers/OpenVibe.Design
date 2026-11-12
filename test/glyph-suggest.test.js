'use strict';
// Choosing an icon for a button's words (plan L32 I2): GET /api/v1/glyphs/suggest scores the registry's names and
// keywords for free, and ?rank=1 lets a small model order the shortlist when the words are new. The icons page and
// each glyph page carry the box, and the draft price is shown before a draft.
const assert = require('node:assert/strict');
const { boot, check, done } = require('./helpers/boot');

const ai = {
    enabled: true,
    text: async () => ({ text: '{"names":["gauge","chart"]}', provider: 'fake', model: 'small-1', run_id: 'run_1' }),
    exchangeCatalog: async () => ({ models: [{ name: 'Cheap', offers: [{ provider: 'fake', price: { in: 1, out: 2 } }] }] }),
};

(async () => {
    const t = await boot({ ai });
    try {
        await check('Deep dive suggests the compass and the search, with CORS and no model', async () => {
            const r = await t.get('/api/v1/glyphs/suggest?label=Deep%20dive');
            assert.equal(r.status, 200, r.text);
            assert.equal(r.headers.get('access-control-allow-origin'), '*');
            const j = r.json();
            assert.equal(j.label, 'Deep dive');
            assert.equal(j.glyphs[0].name, 'compass', JSON.stringify(j.glyphs));
            assert.ok(j.glyphs.some((g) => g.name === 'search'));
            assert.equal(j.new, false);
            assert.equal(j.ranked, false);
            assert.ok(j.glyphs[0].tags.length, 'the answer carries keywords');
        });

        await check('new words ask a small model to rank the shortlist', async () => {
            // A label the registry has no glyph for: shared v4.223.0 added a gpu glyph, so this must stay unclaimed.
            const r = await t.get('/api/v1/glyphs/suggest?label=throughput%20benchmark&rank=1', { headers: { 'sec-fetch-site': 'same-origin' } });
            assert.equal(r.status, 200, r.text);
            const j = r.json();
            assert.equal(j.ranked, true);
            assert.equal(j.model, 'fake · small-1');
            assert.deepEqual(j.glyphs.slice(0, 2).map((g) => g.name), ['gauge', 'chart']);
        });

        await check('a missing label is a 422; the page carries the box and the price before a draft', async () => {
            assert.equal((await t.get('/api/v1/glyphs/suggest')).status, 422);
            const page = await t.get('/icons');
            assert.equal(page.status, 200);
            assert.ok(page.text.includes('data-ic-suggest-form') && page.text.includes('Choose an icon for a button'));
            assert.ok(page.text.includes('About $0.0045 a draft'), 'the estimate is on the page');
            assert.ok(page.text.includes('names and keywords answer first'));
        });

        await check('a glyph page shows every style, its keywords, a search box and the suggest box', async () => {
            const page = await t.get('/icons/compass');
            assert.equal(page.status, 200, page.text);
            for (const word of ['gp-styles', 'Names and keywords', 'Suggest one for a button', 'data-gp-suggest', 'action="/icons"']) assert.ok(page.text.includes(word), word);
            assert.ok(page.text.includes('data-el-icon') === false, 'the element picker is not on the glyph page');
        });
        done();
    } catch (err) {
        done(err);
    }
})();
