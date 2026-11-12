'use strict';
/**
 * The component registry's plumbing: the design_components storage, the import from the installed Shared kit, the read
 * API, and the plain /components list. Design is Opus's; these pages carry data only, with no cards or categories.
 */
const assert = require('assert');
const contracts = require('openvibe-contracts');
const { boot, check, done } = require('./helpers/boot');

(async () => {
    const t = await boot();
    try {
        await check('the registry is stored: one valid design.component@1 entry per Shared kit part, with example markup', async () => {
            const rows = await t.ctx.registry.list();
            const names = new Set(rows.map((row) => row.name));
            assert.ok(rows.length >= 50, `${rows.length} entries imported`);
            for (const name of ['button', 'card', 'page-head', 'head', 'tabs', 'sheet', 'seg', 'segmented', 'empty', 'switch-row', 'home-grid', 'home-edit', 'float']) {
                assert.ok(names.has(name), `${name} is in the registry`);
            }
            for (const row of rows) {
                const checkDoc = contracts.validate('design.component', row.definition);
                assert.ok(checkDoc.valid, `${row.name}: ${JSON.stringify(checkDoc.errors).slice(0, 300)}`);
                assert.ok(row.markup.length > 20, `${row.name} stores its default example's markup`);
                assert.ok(row.definition.states.length && row.definition.tokens.length, `${row.name} states and tokens`);
                assert.ok(row.definition.platforms.web.markup && row.definition.platforms.android.specification && row.definition.platforms.ios.specification, `${row.name} names all three platforms`);
            }
        });

        await check('props and states are read from the Shared kit, not hand-written', async () => {
            const head = await t.ctx.registry.get('page-head');
            assert.ok(Object.keys(head.definition.props).includes('title'));
            assert.ok(Object.keys(head.definition.props).includes('back'));
            assert.deepStrictEqual(head.definition.states, ['default']);

            const sheet = await t.ctx.registry.get('sheet');
            assert.ok(Object.keys(sheet.definition.props).includes('id'));
            assert.ok(sheet.definition.states.includes('closed') && sheet.definition.states.includes('open'));

            const segmented = await t.ctx.registry.get('segmented');
            assert.ok(Object.keys(segmented.definition.props).includes('items'));
            assert.ok(segmented.definition.states.includes('selected'));

            const home = await t.ctx.registry.get('home-grid');
            assert.ok(Object.keys(home.definition.props).includes('apps'));
            assert.ok(home.definition.states.includes('editing'));
            const edit = await t.ctx.registry.get('home-edit');
            assert.ok(edit.definition.states.includes('editing'));
        });

        await check('the chat page is the shared chat, live: messages.js, ov-composer.js and the demo; rule 138 links to it', async () => {
            const res = await t.get('/components/chat');
            assert.strictEqual(res.status, 200);
            const html = res.text;
            ['messages.js', 'ov-composer.js', 'messages.css', 'component-chat.js'].forEach((f) => assert.ok(html.includes(f), `the page loads ${f}`));
            assert.ok(html.includes('id="cr-chat-list"') && html.includes('id="cr-chat-box"'), 'the list and the box');
            const rules = (await t.get('/rules')).text;
            assert.ok(rules.includes('message-actions-at-the-corner') || rules.includes("A message's actions are one cluster at its corner") || rules.includes('A message&#39;s actions are one cluster at its corner'), 'rule 138 is on /rules');
        });
        await check('the API reads the stored registry and returns the example markup', async () => {
            const all = (await t.get('/api/v1/components')).json();
            assert.strictEqual(all.schema, 'design.component@1');
            assert.strictEqual(all.components.length, (await t.ctx.registry.list()).length);
            assert.match(all.examples['page-head'][0].markup, /ovk-page-head/, 'the list carries each example markup too');
            assert.strictEqual((await t.get('/api/v1/components')).headers.get('cache-control'), 'public, max-age=3600');

            const one = (await t.get('/api/v1/components/page-head')).json();
            assert.strictEqual(one.component.name, 'page-head');
            assert.strictEqual(one.examples[0].title, 'Default');
            assert.match(one.examples[0].markup, /ovk-page-head/);
            assert.ok(one.component.platforms.android.material3);
            assert.strictEqual((await t.get('/api/v1/components/no-such-component')).status, 404);

            // A designed interface page from before storage keeps its definition readable.
            const legacy = (await t.get('/api/v1/components/thread-composer')).json();
            assert.strictEqual(legacy.component.name, 'thread-composer');
        });

        await check('/components groups every entry by purpose (Opus organizes the registry), each one a card linking its page', async () => {
            const page = await t.get('/components');
            assert.strictEqual(page.status, 200);
            assert.match(page.text, /<h1>Every part of OpenVibe, defined once<\/h1>/);
            assert.match(page.text, /component-registry\.css/);
            assert.match(page.text, /id="crl-layout"/, 'the layout group');
            assert.match(page.text, /id="crl-home"/, 'the Home group');
            assert.match(page.text, /id="crl-surfaces"/, 'the surfaces group');
            assert.match(page.text, /href="\/components\/float"><b>Floating panel<\/b>/, 'the move engine is in the registry');
            assert.match(page.text, /href="\/components\/page-head"><b>Page head<\/b>/);
            assert.match(page.text, /href="\/components\/home-grid"><b>Home grid<\/b>/);
            assert.match(page.text, /class="crl-jump"/, 'a chip row jumps between groups');
            assert.doesNotMatch(page.text, /&lt;header class=&quot;ovk-page-head&quot;/, 'markup lives on the entry page, not the list');

            const one = await t.get('/components/page-head');
            assert.strictEqual(one.status, 200);
            assert.match(one.text, /<h1>Page head<\/h1>/);
            assert.match(one.text, /kit\.pageHead/);

            // The earlier kit-document and designed interface pages keep their own routes.
            assert.match((await t.get('/components?c=card')).text, /One design system/);
            assert.match((await t.get('/components/sheet')).text, /data-ov-component="sheet"/);

            // The one behaviour page carries a live demo and links the rule it comes from.
            const float = await t.get('/components/float');
            assert.strictEqual(float.status, 200);
            assert.match(float.text, /id="crf-box"/, 'a box to drag');
            assert.match(float.text, /id="crf-frame"/, 'a frame to dock in');
            assert.match(float.text, /js\/ov-float-demo\.js/, 'the demo script');
            assert.match(float.text, /href="\/rules#pip-goes-anywhere"/, 'the rule is linked');
        });

        await check('an import adds new entries and leaves an edited entry alone unless forced', async () => {
            await t.ctx.s.db.exec("UPDATE design_components SET definition = jsonb_set(definition, '{title}', '\"Edited\"') WHERE name = 'button'");
            const first = await t.ctx.registry.importEntries();
            assert.strictEqual(first.imported, 0, 'every entry exists');
            assert.strictEqual((await t.ctx.registry.get('button')).definition.title, 'Edited', 'the edit survives an additive import');
            const forced = await t.ctx.registry.importEntries({ force: true });
            assert.strictEqual(forced.total, first.total);
            assert.strictEqual((await t.ctx.registry.get('button')).definition.title, 'Button', 'the forced import refreshes it');
        });
    } finally { await t.close(); }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
