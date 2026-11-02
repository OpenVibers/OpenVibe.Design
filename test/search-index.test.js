'use strict';
/**
 * Icon and theme pages in OpenVibe.Search (server/search-index.js): a sweep puts every glyph (/icons/<name>) and every
 * public theme (/t/<slug>) in the outbox as one design.index_document.upserted, exactly the contract (contracts
 * 0.275.0), for pages that answer; a second sweep sends nothing; a theme that left the catalogue becomes a tombstone,
 * once; a Network that does not answer the catalogue stops the sweep instead of tombstoning every theme.
 */
const assert = require('assert');
const contracts = require('openvibe-contracts');
const glyphs = require('openvibe-shared/glyphs');
const { boot, check, done } = require('./helpers/boot');
const { describeIcon, describeTheme } = require('../server/search-index');

(async () => {
    const t = await boot({ env: { DESIGN_THEME_CACHE_MS: '0' } });
    const { s, searchIndex } = t.ctx;
    const outbox = async () => (await s.db.many('SELECT envelope FROM event_outbox ORDER BY id')).map((r) => r.envelope);
    const valid = (env) => {
        assert.ok(contracts.validate('events.event-envelope@1', env).valid, 'envelope');
        const p = contracts.validate(env.event_type, env.payload);
        assert.ok(p.valid, `${env.event_type}: ${JSON.stringify(p.errors)}`);
        assert.strictEqual(env.source, 'design');
        return env;
    };
    try {
        await check('a sweep sends every icon and every public theme once, as the contract says, and their pages answer', async () => {
            const themes = t.network.state.themes.length;
            const res = await searchIndex.sweep();
            assert.deepStrictEqual(res.icon, { seen: glyphs.NAMES.length, sent: glyphs.NAMES.length, removed: 0, failed: 0 });
            assert.deepStrictEqual(res.theme, { seen: themes, sent: themes, removed: 0, failed: 0 });
            const docs = (await outbox()).map(valid).map((e) => e.payload);
            const icon = docs.find((d) => d.type === 'icon' && d.id === 'arrow-down');
            assert.strictEqual(icon.canonical_url, 'https://openvibe.design/icons/arrow-down');
            assert.strictEqual(icon.title, 'Arrow down icon');
            const theme = docs.find((d) => d.type === 'theme' && d.id === 'paper');
            assert.strictEqual(theme.canonical_url, 'https://openvibe.design/t/paper');
            assert.strictEqual(theme.facets.mode, 'light');
            assert.strictEqual((await t.get('/icons/arrow-down')).status, 200);
            assert.strictEqual((await t.get('/t/paper')).status, 200);
            const again = await searchIndex.sweep();
            assert.strictEqual(again.icon.sent + again.theme.sent, 0, 'a second sweep sends nothing');
        });

        await check('a theme that left the catalogue becomes a tombstone, once', async () => {
            t.network.state.themes = t.network.state.themes.filter((x) => x.slug !== 'aurora');
            const before = (await outbox()).length;
            assert.strictEqual((await searchIndex.sweep()).theme.removed, 1);
            const env = valid((await outbox()).slice(before).find((e) => e.event_type === 'design.index_document.deleted'));
            assert.deepStrictEqual([env.payload.type, env.payload.id], ['theme', 'aurora']);
            assert.strictEqual((await searchIndex.sweep()).theme.removed, 0);
        });

        await check('when Network does not answer the catalogue, the sweep stops and tombstones nothing', async () => {
            t.network.state.catalogStatus = 503;
            const before = (await outbox()).length;
            await assert.rejects(() => searchIndex.sweep(), /theme catalogue/);
            assert.strictEqual((await outbox()).length, before);
            t.network.state.catalogStatus = 200;
        });

        await check('the words: an icon\'s Font Awesome names and formats; a theme\'s mode and description', async () => {
            const name = glyphs.NAMES.find((n) => Object.values(glyphs.FA).includes(n));
            const d = describeIcon({ id: name });
            assert.match(d.summary, /A drop-in for Font Awesome's fa-/);
            assert.match(d.body, /SVG, PNG, web font/);
            const th = describeTheme({ slug: 'abyss', name: 'Abyss', mode: 'dark', description: 'Nearly black; the interface is the light.' });
            assert.strictEqual(th.title, 'Abyss: an OpenVibe theme');
            assert.strictEqual(th.summary, 'Nearly black; the interface is the light. A dark theme for every OpenVibe site.');
        });
    } finally {
        await t.close();
        done();
    }
})();
