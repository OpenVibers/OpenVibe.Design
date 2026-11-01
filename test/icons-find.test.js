'use strict';
// Finding a glyph by any name (plan L50 step 4): the words people search with, Lucide's, Material's and MUI's names;
// the migration page and API that read a pasted page or component and give each icon its OpenVibe twin; and any set's
// name in <ov-icon> and the drawings API.
const assert = require('node:assert/strict');
const { boot, check, done } = require('./helpers/boot');
const glyphs = require('openvibe-shared/glyphs');
const aliases = require('../server/glyphs/aliases');

const ORIGIN = 'https://openvibe.design';
const form = (fields) => ({ body: new URLSearchParams(fields).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
const PASTE = `<i class="fa-solid fa-gear fa-fw"></i> <i class="fa-brands fa-github"></i> <i class="fa-solid fa-gear"></i>
<i data-lucide="trash-2"></i> <span class="material-symbols-outlined">home</span> <mat-icon>settings</mat-icon>
import { Settings, Trash2 as Bin, Wand2 } from "lucide-react";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";`;

(async () => {
    const t = await boot();
    try {
        await check('every name in the tables leads to a glyph that exists; their names resolve, unknown ones do not', async () => {
            for (const [name, g] of Object.entries(aliases.LUCIDE)) assert.ok(glyphs.path(g), `lucide ${name} → ${g}`);
            for (const [name, g] of Object.entries(aliases.MATERIAL)) assert.ok(glyphs.path(g), `material ${name} → ${g}`);
            assert.ok(Object.keys(aliases.LUCIDE).length > 150 && Object.keys(aliases.MATERIAL).length > 200, 'the common names of both sets');
            const cases = { 'lucide:Settings': 'gear', 'lucide:Trash2': 'trash', 'lucide:x': 'close', 'material:delete_outline': 'trash',
                'mui:DeleteOutlined': 'trash', 'fa-gear': 'gear', 'fa:gear': 'gear', settings: 'gear', heart: 'heart', 'material:home': 'home' };
            for (const [n, g] of Object.entries(cases)) assert.equal(aliases.resolve(n), g, n);
            assert.equal(aliases.resolve('no-such-icon'), null);
            assert.ok(aliases.words('gear').includes('settings') && aliases.words('trash').includes('delete'), 'the words people type');
        });

        await check('the scan reads Font Awesome, Lucide, Material and MUI, counts uses, and keeps utility classes out', async () => {
            const found = aliases.scan(PASTE);
            const by = Object.fromEntries(found.map((f) => [`${f.set}:${f.name}`, f]));
            assert.equal(by['fa:gear'].count, 2);
            assert.equal(by['fa:gear'].glyph, 'gear');
            assert.ok(!by['fa:fw'] && !by['fa:solid'], 'fa-fw and fa-solid are not icons');
            assert.equal(by['fa-brands:github'].brand, 'github', 'a brand the drop-in draws');
            assert.equal(by['lucide:trash-2'].count, 2, 'data-lucide and the import');
            assert.equal(by['lucide:settings'].glyph, 'gear');
            assert.equal(by['lucide:wand-2'].glyph, null, 'one with no twin yet');
            assert.equal(by['material:home'].glyph, 'home');
            assert.equal(by['material:settings'].glyph, 'gear');
            assert.equal(by['material:delete'].glyph, 'trash', 'MUI\'s DeleteOutlined');
            assert.equal(found[found.length - 1].glyph || found[found.length - 1].brand, null, 'the ones without a twin come last');
            assert.deepEqual(aliases.scan(''), []);
        });

        await check('the migration page: a form, the twins, how to switch; never a cross-site post', async () => {
            const page = await t.get('/icons/migrate');
            assert.equal(page.status, 200);
            assert.ok(page.text.includes('<form class="mg-form" method="post" action="/icons/migrate#results">'));
            const res = await t.get('/icons/migrate', { method: 'POST', ...form({ text: PASTE }), origin: ORIGIN });
            assert.equal(res.status, 200);
            assert.match(res.text, /<h2 id="mg-res">\d+ of \d+ have a twin<\/h2>/);
            assert.ok(res.text.includes('<code>&lt;ov-icon name="gear"&gt;&lt;/ov-icon&gt;</code>'), 'the line to use');
            assert.ok(res.text.includes('/shared/ov-glyphs.js') && res.text.includes('/ov-icon.js'), 'how to switch, for both kinds');
            assert.ok(res.text.includes('href="/icons?draw=wand-2#draw"'), 'draw a missing one');
            assert.ok(res.text.includes('&lt;i data-lucide=&quot;trash-2&quot;&gt;'), 'the pasted text comes back escaped');
            assert.match(res.headers.get('cache-control'), /no-store/);
            // A signed-in person's post must come from openvibe.design (an anonymous one changes nothing and is only read).
            const ana = t.network.addUser('ana');
            assert.equal((await t.get('/icons/migrate', { method: 'POST', as: ana, ...form({ text: PASTE }), origin: 'https://evil.test' })).status, 403);
            const none = await t.get('/icons/migrate', { method: 'POST', ...form({ text: 'hello' }), origin: ORIGIN });
            assert.ok(none.text.includes('No icons found'));
        });

        await check('the API: the same answer as data, open to any origin; any set\'s name in the drawings API', async () => {
            const pre = await t.get('/api/v1/glyphs/migrate', { method: 'OPTIONS', headers: { origin: 'https://example.com', 'access-control-request-method': 'POST' } });
            assert.equal(pre.status, 204);
            assert.equal(pre.headers.get('access-control-allow-origin'), '*');
            const r = await t.get('/api/v1/glyphs/migrate', { json: { text: PASTE }, headers: { origin: 'https://example.com' } });
            assert.equal(r.status, 200);
            const j = r.json();
            assert.equal(r.headers.get('access-control-allow-origin'), '*');
            assert.ok(j.count === 8 && j.matched === 7 && j.icons.some((f) => f.set === 'lucide' && f.name === 'trash-2' && f.glyph === 'trash'));
            assert.equal((await t.get('/api/v1/glyphs/migrate', { json: { nope: 1 } })).status, 422);
            const names = (await t.get('/api/v1/glyphs?names=lucide:settings,material:delete,settings,fa-gear')).json();
            assert.deepEqual(names.glyphs.map((g) => [g.asked, g.name]), [['lucide:settings', 'gear'], ['material:delete', 'trash'], ['settings', 'gear'], ['fa-gear', 'gear']]);
        });

        await check('the finder searches the words; /icons, the Font Awesome page, the sitemap and llms.txt lead to the page', async () => {
            const icons = (await t.get('/icons')).text;
            assert.match(icons, /data-name="gear" data-fa="[^"]*" data-words="[^"]*settings[^"]*"/);
            assert.ok(icons.includes('href="/icons/migrate"'));
            assert.ok((await t.get('/icons/font-awesome-alternative')).text.includes('href="/icons/migrate"'));
            assert.ok((await t.get('/sitemap.xml')).text.includes('/icons/migrate'));
            assert.ok((await t.get('/llms.txt')).text.includes('/api/v1/glyphs/migrate'));
            assert.ok((await t.get('/ov-icon.js')).text.includes('lucide|material|mui|fa'), '<ov-icon> takes any set\'s name');
        });
    } finally {
        await done(t);
    }
})();
