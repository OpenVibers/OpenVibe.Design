'use strict';
/**
 * Item icons on openvibe.design (2026-11-16; the owner: item icons drawn as emoji look cheap, so a configurable maker
 * on openvibe.design that draws them, "interconnected with model selection"):
 *   - an item's details (rarity, type, a clue) ride on its prompt's first line and come back out;
 *   - the model is told the house item style: the rarity's badge colours, what the type shows, no text;
 *   - the clue and a note reach the model; the model the person chose goes to AI as its preference;
 *   - the maker page offers Item icon, its fields and the models; the API draws an item from `item`.
 */
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');
const style = require('../server/vectors/item-style');
const { drawingAsked, chosenModel } = require('../server/http/typefaces');

(async () => {
    await check('an item\'s details ride on its prompt and come back out', async () => {
        const p = style.itemPrompt({ name: 'Wizard Hat', description: 'A tall pointed hat with stars', rarity: 'epic', type: 'live.hat', hint: '🧙' });
        assert.strictEqual(p, '[item rarity=epic type=hat hint=🧙] Wizard Hat: A tall pointed hat with stars');
        assert.deepStrictEqual(style.parseItem(p), { rarity: 'epic', type: 'hat', hint: '🧙', text: 'Wizard Hat: A tall pointed hat with stars' });
        assert.deepStrictEqual(style.parseItem('just a bird'), { rarity: 'common', type: 'item', hint: '', text: 'just a bird' });
        assert.strictEqual(style.itemPrompt({ name: 'X', rarity: 'mythic', type: 'spaceship' }), '[item rarity=common type=item] X', 'unknown rarity and type fall back');
        assert.strictEqual(style.parseItem(style.itemPrompt({ name: 'Y', hint: '"><script>' })).hint, 'script', 'a clue is never markup');
    });

    await check('the model is told the house style: the rarity\'s badge, what the type shows, no text', async () => {
        const sys = style.itemSystem({ rarity: 'legendary', type: 'voice' });
        assert.match(sys, /viewBox="0 0 128 128"/);
        assert.match(sys, /#d97706.*#fcd34d/, 'the legendary gradient');
        assert.match(sys, /No text, no letters/);
        assert.match(sys, /the character who speaks/);
        assert.match(style.itemSystem({ rarity: 'common', type: 'hat' }), /#64748b.*hat itself/s);
        const ask = style.itemAsk('[item rarity=rare type=voice hint=👽] Zorp', 'make it greener');
        assert.match(ask, /Draw the item "Zorp"\. It used to be shown as 👽: take it as a clue/);
        assert.match(ask, /never draw that emoji itself/);
        assert.match(ask, /The note on the last drawing: make it greener/);
    });

    await check('a form or the API asks for an item, with the model the person chose', async () => {
        const fromApi = drawingAsked({ kind: 'item', item: { name: 'Hearts', description: 'Heart particles', rarity: 'common', type: 'particle', hint: '💖' }, model: 'deepseek::deepseek-chat' });
        assert.deepStrictEqual(fromApi, { kind: 'item', prefer: { provider: 'deepseek', model: 'deepseek-chat' }, prompt: '[item rarity=common type=particle hint=💖] Hearts: Heart particles' });
        const fromForm = drawingAsked({ kind: 'item', prompt: 'Royal Crown', rarity: 'epic', type: 'hat' });
        assert.strictEqual(fromForm.prompt, '[item rarity=epic type=hat] Royal Crown');
        assert.strictEqual(fromForm.prefer, null, 'no choice: the maker\'s default');
        assert.deepStrictEqual(drawingAsked({ kind: 'item' }), { error: 'Name the item you want drawn.' });
        assert.deepStrictEqual(drawingAsked({ prompt: 'a bird' }), { kind: 'icon', prefer: null, prompt: 'a bird' });
        assert.deepStrictEqual(chosenModel('openai/gpt-5', 'openrouter'), { provider: 'openrouter', model: 'openai/gpt-5' }, 'a model id keeps its own slash');
        assert.deepStrictEqual(chosenModel({ provider: 'local', model: 'qwen3' }), { provider: 'local', model: 'qwen3' });
        assert.strictEqual(chosenModel('default'), null);
    });

    const asked = [];
    const BADGE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect x="0" y="0" width="128" height="128" rx="28" fill="#7c3aed"/><circle cx="64" cy="64" r="30" fill="#fcd34d" stroke="#0f172a" stroke-width="4"/></svg>';
    const ai = {
        enabled: true,
        offeredModels: async () => [{ provider: 'deepseek', model: 'deepseek-chat' }, { provider: 'local', model: 'qwen3-coder' }],
        text: async (o) => { asked.push(o); return { text: `Here it is:\n${BADGE}\n`, provider: o.prefer && o.prefer.provider || 'anthropic', model: o.prefer && o.prefer.model || 'claude-opus-5-5' }; },
    };
    const t = await boot({ ai });
    try {
        const ada = t.network.addUser('ada');
        await check('the maker page offers Item icon, its fields and the models AI offers', async () => {
            const page = await t.get('/vectors/make?kind=item', { as: ada });
            assert.strictEqual(page.status, 200);
            assert.match(page.text, /<option value="item" selected>Item icon<\/option>/);
            assert.match(page.text, /<fieldset class="tv-item"><legend>The item<\/legend>/);
            assert.match(page.text, /<option value="legendary">Legendary<\/option>/);
            assert.match(page.text, /<option value="voice">Voice<\/option>/);
            assert.match(page.text, /<option value="deepseek::deepseek-chat">deepseek-chat · deepseek<\/option>/);
        });
        await check('the API draws an item in the house style with the chosen model, and keeps its details', async () => {
            const r = await t.get('/api/v1/vectors', { as: ada, method: 'POST', json: { kind: 'item', model: 'deepseek::deepseek-chat',
                item: { name: 'Zorp', description: 'An alien voice', rarity: 'uncommon', type: 'live.voice', hint: '👽' } } });
            assert.strictEqual(r.status, 201, r.text);
            const body = r.json();
            assert.strictEqual(body.kind, 'item');
            assert.strictEqual(body.prompt, '[item rarity=uncommon type=voice hint=👽] Zorp: An alien voice');
            assert.match(body.svg, /^<svg[^>]*viewBox="0 0 128 128"/);
            const last = asked[asked.length - 1];
            assert.match(last.system, /#16a34a.*#4ade80/, 'the uncommon badge');
            assert.match(last.prompt, /Draw the item "Zorp: An alien voice"\. It used to be shown as 👽/);
            assert.deepStrictEqual(last.prefer, { provider: 'deepseek', model: 'deepseek-chat' });
            assert.strictEqual(last.maxTokens, 4000);

            const again = await t.get(`/api/v1/vectors/${body.id}/edit`, { as: ada, method: 'POST', json: { note: 'make it greener' } });
            assert.strictEqual(again.status, 200, again.text);
            const redraw = asked[asked.length - 1];
            assert.match(redraw.system, /#16a34a/, 'a redraw keeps the item\'s style');
            assert.match(redraw.prompt, /The note on the last drawing: make it greener/);
        });
    } finally {
        await t.close();
    }
    done();
})().catch((e) => { console.error(e); process.exit(1); });
