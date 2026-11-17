'use strict';
// "Make me an effect" (plan §AD.15): a signed-in person describes a name effect, a model on Exchange writes it, Design
// checks every line (server/namefx/css.js) before it is kept or drawn, the person sees it live on /components/name-effects,
// an admin approves or rejects it, and only approved effects are public data.
//   node test/name-effect-maker.test.js
const assert = require('node:assert/strict');
const { boot, check, done } = require('./helpers/boot');
const { clean } = require('../server/namefx/css');

const ORIGIN = 'https://openvibe.design';
const asked = [];
let answer = '';
const ai = {
    enabled: true,
    text: async (req) => { asked.push(req); return { text: answer, provider: 'fake', model: 'fake-fx-1', run_id: 'run_1' }; },
    slotPlan: async () => ({ slots: [] }),
};
const form = (fields) => ({ body: new URLSearchParams(fields).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' } });
const EMBER = '.name-fx-ember { color: #ff7a1f; text-shadow: 0 0 6px #f97316; animation: nameFxEmberGlow 2.4s ease-in-out infinite; }\n'
    + '@keyframes nameFxEmberGlow { 0%, 100% { text-shadow: 0 0 4px #f97316; } 50% { text-shadow: 0 0 10px #fb923c; } }\n'
    + 'html[data-theme-mode="light"] .name-fx-ember { color: #c2410c; }';

(async () => {
    await check('the checker keeps one effect in the house shape and refuses anything else', () => {
        const ok = clean(EMBER, 'ember');
        assert.ok(ok.ok, ok.why);
        assert.match(ok.css, /html\[data-ov-motion=off\] \.name-fx-ember,[\s\S]*animation: none;/, 'motion off holds still when the effect says nothing for it');
        for (const [css, what] of [
            ['.name-fx-ember { background: url(https://evil.test/x.png); }', 'an image'],
            ['body { color: red; } .name-fx-ember { color: red; }', 'another selector'],
            ['.name-fx-ember { position: fixed; inset: 0; }', 'positioning'],
            ['@import "x.css"; .name-fx-ember { color: red; }', 'an import'],
            ['.name-fx-ember { color: red; } @keyframes spin { to { opacity: 0; } }', 'a keyframe outside its name'],
            ['.name-fx-ember::after { content: "\\41"; }', 'an escape'],
            ['.name-fx-other { color: red; }', 'another effect\'s class'],
            ['.name-fx-ember { color: red; </style><script>x</script> }', 'markup'],
        ]) assert.equal(clean(css, 'ember').ok, false, what);
    });

    const t = await boot({ ai });
    const ana = t.network.addUser('ana');
    const boss = t.network.addUser('boss', { role: 'admin' });
    try {
        await check('signed out: the effects and a sign-in; no form', async () => {
            const res = await t.get('/components/name-effects');
            assert.equal(res.status, 200);
            assert.match(res.text, /<span class="name-fx-golden">Juniper<\/span>/, 'the fifteen effects');
            assert.match(res.text, /Sign in to make one/);
            assert.doesNotMatch(res.text, /action="\/components\/name-effects\/make"/);
        });

        await check('a person makes one: the model is asked as them, its CSS is checked, and the draft is drawn live', async () => {
            answer = JSON.stringify({ name: 'ember', label: 'Ember', css: EMBER });
            const res = await t.get('/components/name-effects/make', { method: 'POST', as: ana, ...form({ words: 'a slow ember glow' }), origin: ORIGIN });
            assert.equal(res.status, 303);
            assert.match(res.headers.get('location'), /made=ember/);
            const last = asked[asked.length - 1];
            assert.equal(last.task, 'design.name_effect');
            assert.match(last.prompt, /a slow ember glow/);
            assert.ok(last.person, 'on the person\'s own account');
            const page = await t.get('/components/name-effects?made=ember', { as: ana });
            assert.match(page.text, /<style>\.name-fx-ember \{/, 'its checked CSS, live');
            assert.match(page.text, /<span class="name-fx-ember">Juniper<\/span>/);
            assert.match(page.text, /waiting for review/);
            assert.doesNotMatch(page.text, /value="approve"/, 'not a reviewer');
        });

        await check('what does not pass the checks is not kept, and says why', async () => {
            answer = JSON.stringify({ name: 'evil', css: '.name-fx-evil { background: url(https://evil.test/x.png); }' });
            const res = await t.get('/components/name-effects/make', { method: 'POST', as: ana, ...form({ words: 'something sneaky' }), origin: ORIGIN });
            assert.match(new URLSearchParams(res.headers.get('location').split('?')[1].split('#')[0]).get('error'), /^Not kept: background: that value is not allowed/);
            const n = await t.store.db.maybe("SELECT count(*)::int AS n FROM name_effect_drafts WHERE slug = 'evil'");
            assert.equal(n.n, 0);
            const cross = await t.get('/components/name-effects/make', { method: 'POST', as: ana, ...form({ words: 'x y z w' }), origin: 'https://evil.test' });
            assert.equal(cross.status, 403, 'only from this site');
        });

        await check('an admin approves; approved effects are public data, drafts are not', async () => {
            const before = await (await t.get('/api/v1/name-effects/drafts')).json();
            assert.deepEqual(before.effects, [], 'nothing approved yet');
            const page = await t.get('/components/name-effects', { as: boss });
            const id = (page.text.match(/action="\/components\/name-effects\/drafts\/(nfx_[A-Za-z0-9_-]+)\/review"/) || [])[1];
            assert.ok(id, 'the admin sees the waiting draft with its buttons');
            assert.equal((await t.get(`/components/name-effects/drafts/${id}/review`, { method: 'POST', as: ana, ...form({ action: 'approve' }), origin: ORIGIN })).status, 403, 'not anyone');
            const ok = await t.get(`/components/name-effects/drafts/${id}/review`, { method: 'POST', as: boss, ...form({ action: 'approve' }), origin: ORIGIN });
            assert.equal(ok.status, 303);
            const after = await (await t.get('/api/v1/name-effects/drafts')).json();
            assert.deepEqual(after.effects.map((e) => e.name), ['ember']);
            assert.match(after.effects[0].css, /^\.name-fx-ember \{/);
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
