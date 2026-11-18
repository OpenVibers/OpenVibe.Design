'use strict';
/**
 * MCP 2026-07-28 on Design's endpoint (openvibe-sdk/mcp): server/discover, tools/list with ttlMs and cacheScope,
 * tools/call with resultType, the version and method headers checked against the body, an unknown version or method
 * refused; the handshake era still answers on the same endpoint.
 */
const assert = require('assert');
const mcp = require('openvibe-sdk/mcp');
const { boot, check, done } = require('./helpers/boot');

(async () => {
    const t = await boot();
    let id = 0;
    // The boot helper sets content-type itself for a json body; the SDK's own would make it a doubled header.
    const headersOf = (h) => { const out = { ...h }; delete out['Content-Type']; return out; };
    const modern = async (method, params = {}, { headers = {} } = {}) => {
        const req = mcp.modernRequest({ id: ++id, method, params, clientInfo: { name: 'test', version: '1' } });
        return t.get('/mcp', { json: req.body, headers: { ...headersOf(req.headers), ...headers } });
    };
    try {
        await check('2026-07-28: discover, list and call, each said complete', async () => {
            const d = await modern('server/discover');
            assert.strictEqual(d.status, 200, d.text);
            const disc = d.json().result;
            assert.strictEqual(disc.resultType, 'complete');
            assert.ok(disc.supportedVersions.includes('2026-07-28') && disc.supportedVersions.includes('2025-06-18'), 'both eras');
            assert.strictEqual(disc._meta['io.modelcontextprotocol/serverInfo'].name, 'openvibe-design');
            const list = (await modern('tools/list')).json().result;
            assert.strictEqual(list.resultType, 'complete');
            assert.strictEqual(list.cacheScope, 'public');
            assert.ok(list.ttlMs > 0);
            assert.ok(list.tools.some((x) => x.name === 'openvibe_design_list_fonts'));
            const call = (await modern('tools/call', { name: 'openvibe_design_list_themes', arguments: {} })).json().result;
            assert.strictEqual(call.resultType, 'complete');
            assert.ok(Array.isArray(call.content));
        });

        await check('2026-07-28: headers must agree with the body; an unknown version or method is refused', async () => {
            let r = await modern('tools/list', {}, { headers: { 'Mcp-Method': 'tools/call' } });
            assert.deepStrictEqual([r.status, r.json().error.code], [400, -32020], 'Mcp-Method mismatch');
            r = await modern('tools/call', { name: 'openvibe_design_list_themes', arguments: {} }, { headers: { 'Mcp-Name': 'something_else' } });
            assert.deepStrictEqual([r.status, r.json().error.code], [400, -32020], 'Mcp-Name mismatch');
            const req = mcp.modernRequest({ id: 99, method: 'tools/list', version: '2027-01-01' });
            r = await t.get('/mcp', { json: req.body, headers: headersOf(req.headers) });
            assert.strictEqual(r.status, 400, 'an unknown version');
            r = await modern('resources/list');
            assert.deepStrictEqual([r.status, r.json().error.code], [404, -32601]);
            const note = mcp.modernRequest({ method: 'notifications/initialized' });
            r = await t.get('/mcp', { json: note.body, headers: headersOf(note.headers) });
            assert.strictEqual(r.status, 202, 'a notification is taken, with nothing to answer');
        });

        await check('the handshake era still answers on the same endpoint', async () => {
            const r = await t.get('/mcp', { json: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } } });
            assert.strictEqual(r.json().result.protocolVersion, '2025-11-25');
            const old = await t.get('/mcp', { json: { jsonrpc: '2.0', id: 2, method: 'tools/list' }, headers: { 'MCP-Protocol-Version': '2025-06-18' } });
            assert.ok(Array.isArray(old.json().result.tools));
            assert.strictEqual(old.json().result.resultType, undefined, 'the old era has no resultType');
        });
    } finally {
        await t.close();
    }
    done();
})();
