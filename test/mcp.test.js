'use strict';
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');
const components = require('openvibe-shared/components');

(async () => {
    const t = await boot({ network: { themes: [
        { id: 'night', slug: 'night', name: 'Night', mode: 'dark', variables: {
            '--bg-primary': '#101010', '--bg-card': '#202020', '--text-primary': '#ffffff', '--accent': '#ff0000',
        } },
    ] } });
    let id = 0;
    const send = async (method, params = {}) => t.get('/mcp', { json: { jsonrpc: '2.0', id: ++id, method, params } });
    const call = async (name, args = {}) => (await send('tools/call', { name, arguments: args })).json().result;
    try {
        await check('MCP initialize, list, CORS, discovery and transport errors', async () => {
            const init = (await send('initialize', { protocolVersion: '2025-06-18' })).json().result;
            assert.strictEqual(init.protocolVersion, '2025-06-18');
            assert.strictEqual(init.serverInfo.name, 'openvibe-design');
            const listed = (await send('tools/list')).json().result.tools;
            assert.deepStrictEqual(listed.map(x => x.name), [
                'openvibe_design_list_themes', 'openvibe_design_get_theme_tokens',
                'openvibe_design_list_components', 'openvibe_design_get_component',
                'openvibe_design_validate_kit_document',
                'openvibe_design_icon_search', 'openvibe_design_icon_svg', 'openvibe_design_icon_code', 'openvibe_design_icon_migrate',
            ]);
            assert.ok(listed.every(x => x.inputSchema && x.annotations.readOnlyHint));
            assert.strictEqual((await t.get('/mcp', { method: 'OPTIONS' })).status, 204);
            assert.strictEqual((await t.get('/mcp')).status, 405);
            assert.strictEqual((await t.get('/mcp', { body: '{', headers: { 'content-type': 'application/json' } })).json().error.code, -32700);
            assert.strictEqual((await t.get('/mcp', { json: { jsonrpc: '2.0', id: 1, method: 'unknown' } })).json().error.code, -32601);
            assert.strictEqual((await t.get('/mcp', { json: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'unknown' } } })).json().error.code, -32602);
            assert.strictEqual((await t.get('/.well-known/agent.json')).json().mcp.url, 'https://openvibe.design/mcp');
            assert.match((await t.get('/llms.txt')).text, /https:\/\/openvibe\.design\/mcp/);
        });
        await check('the icon tools (plan L50 step 6): search by any word or set\'s name, an SVG, code to paste, a migration', async () => {
            const found = (await call('openvibe_design_icon_search', { query: 'settings', limit: 3 })).structuredContent;
            assert.strictEqual(found.icons[0].name, 'gear');
            assert.strictEqual(found.icons[0].svg, 'https://openvibe.design/icons/gear.svg');
            assert.ok(found.icons[0].font_awesome.includes('fa-gear') && found.icons[0].words.includes('settings'));
            assert.match(found.use, /ov-icon\.js/);
            assert.strictEqual((await call('openvibe_design_icon_search', { query: 'lucide:trash-2' })).structuredContent.icons[0].name, 'trash');
            assert.strictEqual((await call('openvibe_design_icon_search', { query: '' })).isError, true);
            assert.strictEqual((await call('openvibe_design_icon_search', { query: 'x', limit: 99 })).isError, true);
            assert.strictEqual((await call('openvibe_design_icon_svg', { name: 'material:mic', size: 16 })).structuredContent.name, 'mic', 'a Material name');
            const mic = (await call('openvibe_design_icon_svg', { name: 'mic', size: 16, color: 'ff0000' })).structuredContent;
            assert.strictEqual(mic.style, 'solid', 'small and auto: the solid drawing');
            assert.ok(mic.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"') && mic.svg.includes('fill="#ff0000"'));
            assert.strictEqual((await call('openvibe_design_icon_svg', { name: 'mic', size: 48 })).structuredContent.style, 'line');
            assert.strictEqual((await call('openvibe_design_icon_svg', { name: 'no-such-icon' })).isError, true);
            assert.strictEqual((await call('openvibe_design_icon_svg', { name: 'mic', color: 'red;}' })).isError, true);
            const jsx = (await call('openvibe_design_icon_code', { name: 'fa-trash-can', format: 'jsx' })).structuredContent;
            assert.strictEqual(jsx.name, 'trash');
            assert.match(jsx.code, /^export function TrashIcon\(props\)/);
            assert.match((await call('openvibe_design_icon_code', { name: 'robot', format: 'android' })).structuredContent.code, /<vector xmlns:android=/);
            assert.match((await call('openvibe_design_icon_code', { name: 'heart', format: 'esm' })).structuredContent.code, /export default \{ name, line, solid \};/);
            assert.strictEqual((await call('openvibe_design_icon_code', { name: 'heart', format: 'png' })).isError, true);
            const moved = (await call('openvibe_design_icon_migrate', { text: '<i data-lucide="settings"></i><i class="fa-solid fa-house fa-fw"></i>' })).structuredContent;
            assert.deepStrictEqual(moved.icons.map((f) => [f.set, f.name, f.glyph]), [['fa', 'house', 'home'], ['lucide', 'settings', 'gear']]);
        });
        await check('list themes good and bad arguments', async () => {
            const good = await call('openvibe_design_list_themes', { query: 'nig', mode: 'dark' });
            assert.strictEqual(good.structuredContent.themes.length, 1);
            assert.deepStrictEqual(good.structuredContent.themes[0].preview, {
                background: '#101010', surface: '#202020', text: '#ffffff', accent: '#ff0000',
            });
            assert.strictEqual((await call('openvibe_design_list_themes', { mode: 'blue' })).isError, true);
        });
        await check('theme tokens good and bad arguments', async () => {
            const output = await call('openvibe_design_get_theme_tokens', { theme: 'night', format: 'css', both: false });
            assert.match(output.content[0].text, /#101010/);
            const json = await call('openvibe_design_get_theme_tokens', { theme: 'night', format: 'json' });
            assert.strictEqual(json.structuredContent.color.bg.base.$value, '#101010');
            assert.strictEqual((await call('openvibe_design_get_theme_tokens', { theme: 'night', format: 'cobol' })).isError, true);
            assert.strictEqual((await call('openvibe_design_get_theme_tokens', { theme: 'missing', format: 'css' })).isError, true);
        });
        await check('component list and detail good and bad arguments', async () => {
            const list = await call('openvibe_design_list_components');
            assert.strictEqual(list.structuredContent.components.length, Object.keys(components.SPECS).length);
            assert.deepStrictEqual(Object.keys(list.structuredContent.components[0]), ['id', 'name', 'summary']);
            assert.strictEqual((await call('openvibe_design_list_components', { extra: true })).isError, true);
            const detail = await call('openvibe_design_get_component', { name: 'button' });
            for (const key of ['anatomy', 'props', 'variants', 'states', 'a11y', 'native']) assert.ok(detail.structuredContent[key], key);
            assert.strictEqual((await call('openvibe_design_get_component', { name: 'missing' })).isError, true);
        });
        await check('kit validation and contract size limits', async () => {
            assert.deepStrictEqual((await call('openvibe_design_validate_kit_document', { doc: { type: 'button', props: { label: 'Go' } } })).structuredContent, { ok: true, errors: [] });
            const invalid = (await call('openvibe_design_validate_kit_document', { doc: { type: 'button', props: { label: '' } } })).structuredContent;
            assert.strictEqual(invalid.ok, false);
            assert.match(invalid.errors.join(' '), /button\.props\.label: required/);
            assert.strictEqual((await call('openvibe_design_validate_kit_document')).isError, true);
            const oversized = (await call('openvibe_design_validate_kit_document', { doc: { type: 'button', props: { label: 'x'.repeat(components.LIMITS.string + 1) } } })).structuredContent;
            assert.strictEqual(oversized.ok, false);
            let deep = { type: 'card', props: { title: 'end' } };
            for (let n = 0; n < components.LIMITS.depth; n++) deep = { type: 'section', children: [deep] };
            assert.strictEqual((await call('openvibe_design_validate_kit_document', { doc: deep })).structuredContent.ok, false);
            const many = { type: 'section', children: Array.from({ length: components.LIMITS.items + 1 }, () => ({ type: 'card', props: { title: 'x' } })) };
            assert.strictEqual((await call('openvibe_design_validate_kit_document', { doc: many })).structuredContent.ok, false);
            const branch = depth => depth ? { type: 'section', children: Array.from({ length: 3 }, () => branch(depth - 1)) } : { type: 'section' };
            const nodes = (await call('openvibe_design_validate_kit_document', { doc: branch(6) })).structuredContent;
            assert.strictEqual(nodes.ok, false);
            assert.match(nodes.errors.join(' '), /more than 400 nodes/);
        });
    } finally { await t.close(); }
    done();
})().catch(err => { console.error(err); process.exitCode = 1; });
