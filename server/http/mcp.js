'use strict';

// Stateless MCP Streamable HTTP endpoint. Every tool reads public Design data only.
const express = require('express');
const components = require('openvibe-shared/components');
const themeTokens = require('../tokens');
const glyphs = require('openvibe-shared/glyphs');
const aliases = require('../glyphs/aliases');
const ex = require('../glyphs/export');
const formats = require('../glyphs/formats');

const BASE = 'https://openvibe.design';
const FORMATS = { svg: null, inline_svg: 'inlineSvg', jsx: 'jsx', data_uri: 'dataUri', css_mask: 'cssMask', android: 'vectorDrawable', esm: 'esModule' };
const { version } = require('../../package.json');

const PROTOCOL = '2025-06-18';
const VERSIONS = new Set([PROTOCOL, '2025-03-26']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const schema = (required, properties) => ({ type: 'object', required, properties, additionalProperties: false });
const TOOLS = [
    { name: 'openvibe_design_list_themes', description: 'List public Network themes with their four preview colours.', inputSchema: schema([], {
        query: { type: 'string', maxLength: 200 }, mode: { type: 'string', enum: ['light', 'dark'] },
    }) },
    { name: 'openvibe_design_get_theme_tokens', description: 'Export one public theme as OpenVibe Tokens, as in /api/v1/tokens.', inputSchema: schema(['theme', 'format'], {
        theme: { type: 'string', minLength: 1, maxLength: 200 },
        format: { type: 'string', enum: themeTokens.TARGETS.map(t => t.id) },
        both: { type: 'boolean', default: true },
    }) },
    { name: 'openvibe_design_list_components', description: 'List the 11 OpenVibe component specifications in short form.', inputSchema: schema([], {}) },
    { name: 'openvibe_design_get_component', description: 'Read a complete component specification, including anatomy, props, variants, states, accessibility and native snippets.', inputSchema: schema(['name'], {
        name: { type: 'string', minLength: 1, maxLength: 100 },
    }) },
    { name: 'openvibe_design_validate_kit_document', description: 'Validate a kit document against the component contract and its size limits.', inputSchema: schema(['doc'], {
        doc: { type: 'object', description: 'A kit component document.' },
    }) },
    // The OpenVibe glyphs (plan L50 step 6): the same answers as openvibe.design/icons, for agents.
    { name: 'openvibe_design_icon_search', description: 'Find OpenVibe icons (free, MIT) by a word ("settings", "delete"), our name, or a Font Awesome, Lucide or Material name. Best match first, with each icon\'s page and SVG address.', inputSchema: schema(['query'], {
        query: { type: 'string', minLength: 1, maxLength: 100 },
        limit: { type: 'integer', minimum: 1, maximum: 60, default: 12 },
    }) },
    { name: 'openvibe_design_icon_svg', description: 'One OpenVibe icon as a standalone SVG. name may be ours or a Font Awesome (fa-gear), Lucide (lucide:settings) or Material (material:delete) name. style auto draws the solid drawing at 18 px and under.', inputSchema: schema(['name'], {
        name: { type: 'string', minLength: 1, maxLength: 60 },
        size: { type: 'integer', minimum: 16, maximum: 1024, default: 24 },
        color: { type: 'string', pattern: '^(mark|[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$', description: 'Hex without #, or mark for the two OpenVibe colours. Default 0f172a.' },
        style: { type: 'string', enum: ['auto', 'line', 'solid'], default: 'auto' },
    }) },
    { name: 'openvibe_design_icon_code', description: 'One OpenVibe icon as code to paste: inline_svg (HTML, Vue, Svelte, Solid; currentColor), jsx (a React component), data_uri, css_mask (a class painted in the text colour), android (VectorDrawable XML), esm (an ES module with the drawings) or svg.', inputSchema: schema(['name', 'format'], {
        name: { type: 'string', minLength: 1, maxLength: 60 },
        format: { type: 'string', enum: Object.keys(FORMATS) },
        size: { type: 'integer', minimum: 16, maximum: 1024, default: 24 },
        style: { type: 'string', enum: ['auto', 'line', 'solid'], default: 'auto' },
    }) },
    { name: 'openvibe_design_icon_migrate', description: 'Read HTML or code and list every Font Awesome, Lucide, Material or MUI icon it uses, with its OpenVibe twin and how often it appears. Read only.', inputSchema: schema(['text'], {
        text: { type: 'string', minLength: 1, maxLength: 400000 },
    }) },
].map(tool => ({ ...tool, annotations: { readOnlyHint: true, openWorldHint: false } }));

const rpc = (id, result) => ({ jsonrpc: '2.0', id, result });
const error = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const toolError = message => ({ content: [{ type: 'text', text: message }], isError: true });
function toolResult(value) {
    return {
        content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) }],
        ...(object(value) ? { structuredContent: value } : {}),
        isError: false,
    };
}

async function callTool(name, args, { catalog }) {
    if (!object(args)) return toolError('Arguments must be an object.');
    switch (name) {
        case 'openvibe_design_list_themes': {
            if (args.query !== undefined && (typeof args.query !== 'string' || args.query.length > 200)) return toolError('query must be a string of at most 200 characters.');
            if (args.mode !== undefined && !['light', 'dark'].includes(args.mode)) return toolError('mode must be light or dark.');
            const list = (await catalog.list()).themes;
            const query = (args.query || '').toLowerCase();
            return toolResult({ themes: list.filter(t => t && (!args.mode || t.mode === args.mode)
                && (!query || [t.id, t.slug, t.name].some(v => String(v || '').toLowerCase().includes(query))))
                .map(t => ({ id: t.id, name: t.name, mode: t.mode, preview: {
                    background: t.variables && t.variables['--bg-primary'],
                    surface: t.variables && t.variables['--bg-card'],
                    text: t.variables && t.variables['--text-primary'],
                    accent: t.variables && t.variables['--accent'],
                } })) });
        }
        case 'openvibe_design_get_theme_tokens': {
            if (typeof args.theme !== 'string' || !args.theme || args.theme.length > 200) return toolError('theme must be a nonempty string of at most 200 characters.');
            if (!themeTokens.TARGETS.some(t => t.id === args.format)) return toolError(`format must be one of ${themeTokens.TARGETS.map(t => t.id).join(', ')}.`);
            if (args.both !== undefined && typeof args.both !== 'boolean') return toolError('both must be a boolean.');
            const found = themeTokens.resolve((await catalog.list()).themes, args.theme, { both: args.both !== false });
            if (!found) return toolError('No public theme by that name.');
            const output = themeTokens.compile(found.docs.length > 1 ? found.docs : found.docs[0], args.format);
            return toolResult(['json', 'figma'].includes(args.format) ? JSON.parse(output) : output);
        }
        case 'openvibe_design_list_components':
            if (Object.keys(args).length) return toolError('This tool takes no arguments.');
            return toolResult({ components: components.SPECS.map(({ id, name: label, summary }) => ({ id, name: label, summary })) });
        case 'openvibe_design_get_component': {
            if (typeof args.name !== 'string' || !args.name || args.name.length > 100) return toolError('name must be a nonempty string of at most 100 characters.');
            const spec = components.SPECS.find(s => s.id.toLowerCase() === args.name.toLowerCase() || s.name.toLowerCase() === args.name.toLowerCase());
            return spec ? toolResult(spec) : toolError('No component by that name.');
        }
        case 'openvibe_design_validate_kit_document':
            if (!Object.prototype.hasOwnProperty.call(args, 'doc')) return toolError('doc is required.');
            return toolResult(components.validate(args.doc));
        case 'openvibe_design_icon_search': {
            if (typeof args.query !== 'string' || !args.query.trim() || args.query.length > 100) return toolError('query must be a nonempty string of at most 100 characters.');
            const limit = args.limit === undefined ? 12 : args.limit;
            if (!Number.isInteger(limit) || limit < 1 || limit > 60) return toolError('limit must be a whole number from 1 to 60.');
            const fa = (g) => Object.entries(glyphs.FA).filter(([, x]) => x === g).map(([f]) => `fa-${f}`);
            return toolResult({ icons: aliases.search(args.query, limit).map((g) => ({
                name: g, page: `${BASE}/icons/${g}`, svg: `${BASE}/icons/${g}.svg`, solid: !!glyphs.solid(g),
                font_awesome: fa(g).slice(0, 6), words: aliases.words(g).slice(0, 8),
            })), use: `<script src="${BASE}/ov-icon.js" defer></script> then <ov-icon name="…"></ov-icon>` });
        }
        case 'openvibe_design_icon_svg':
        case 'openvibe_design_icon_code': {
            const g = typeof args.name === 'string' && args.name.length <= 60 ? aliases.resolve(args.name) : null;
            if (!g) return toolError('No OpenVibe icon by that name. Try openvibe_design_icon_search.');
            if (args.size !== undefined && (!Number.isInteger(args.size) || args.size < 16 || args.size > 1024)) return toolError('size must be a whole number from 16 to 1024.');
            if (args.style !== undefined && !['auto', 'line', 'solid'].includes(args.style)) return toolError('style is auto, line or solid.');
            if (args.color !== undefined && (typeof args.color !== 'string' || !/^(mark|[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(args.color))) return toolError('color is a hex colour without # (0f172a), or mark.');
            const opts = ex.options({ size: args.size || 24, style: args.style || 'auto', ...(args.color ? { color: args.color } : {}) });
            if (name === 'openvibe_design_icon_svg') return toolResult({ name: g, style: ex.drawnAs(g, opts), svg: ex.svg(g, opts), page: `${BASE}/icons/${g}` });
            if (!Object.prototype.hasOwnProperty.call(FORMATS, args.format)) return toolError(`format is one of ${Object.keys(FORMATS).join(', ')}.`);
            const fn = FORMATS[args.format];
            const code = fn === null ? ex.svg(g, opts) : fn === 'esModule' ? formats.esModule(g) : formats[fn](g, opts);
            return toolResult({ name: g, format: args.format, code });
        }
        case 'openvibe_design_icon_migrate':
            if (typeof args.text !== 'string' || !args.text || args.text.length > 400000) return toolError('text must be a nonempty string of at most 400,000 characters.');
            return toolResult({ icons: aliases.scan(args.text), page: `${BASE}/icons/migrate` });
        default:
            return null;
    }
}

function createMcpRoutes(ctx) {
    const r = express.Router();
    const json = express.json({ limit: '1mb', type: ['application/json', 'application/*+json'], strict: false });
    r.use('/mcp', (_req, res, next) => { res.set('Access-Control-Allow-Origin', '*'); res.set('Cache-Control', 'no-store'); next(); });
    r.options('/mcp', (_req, res) => res.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
        .set('Access-Control-Allow-Headers', 'Content-Type, Mcp-Protocol-Version')
        .set('Access-Control-Max-Age', '600').status(204).end());
    r.post('/mcp', json, async (req, res, next) => {
        try {
            if (req.get('mcp-protocol-version') && !VERSIONS.has(req.get('mcp-protocol-version')))
                return res.status(400).json(error(null, -32600, 'Unsupported protocol version'));
            const input = req.body;
            if (!object(input) && (!Array.isArray(input) || !input.length)) return res.json(error(null, -32600, 'Invalid Request'));
            const batch = Array.isArray(input);
            const replies = [];
            for (const msg of batch ? input : [input]) {
                if (!object(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string'
                    || (Object.prototype.hasOwnProperty.call(msg, 'id') && msg.id !== null && typeof msg.id !== 'string' && !(typeof msg.id === 'number' && Number.isFinite(msg.id)))) {
                    replies.push(error(null, -32600, 'Invalid Request')); continue;
                }
                if (!Object.prototype.hasOwnProperty.call(msg, 'id') || msg.method.startsWith('notifications/')) continue;
                const id = msg.id;
                const params = object(msg.params) ? msg.params : {};
                if (msg.method === 'initialize') replies.push(rpc(id, { protocolVersion: VERSIONS.has(params.protocolVersion) ? params.protocolVersion : PROTOCOL,
                    capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'openvibe-design', title: 'OpenVibe Design', version } }));
                else if (msg.method === 'ping') replies.push(rpc(id, {}));
                else if (msg.method === 'tools/list') replies.push(rpc(id, { tools: TOOLS }));
                else if (msg.method === 'tools/call') {
                    const result = await callTool(params.name, params.arguments || {}, ctx);
                    replies.push(result ? rpc(id, result) : error(id, -32602, 'Unknown tool'));
                } else replies.push(error(id, -32601, 'Method not found'));
            }
            return replies.length ? res.json(batch ? replies : replies[0]) : res.status(202).end();
        } catch (err) { return next(err); }
    });
    r.all('/mcp', (_req, res) => res.set('Allow', 'POST').status(405).json(error(null, -32600, 'Method Not Allowed')));
    r.use((err, _req, res, next) => {
        if (err && err.type === 'entity.parse.failed') return res.status(400).json(error(null, -32700, 'Parse error'));
        if (err && err.type === 'entity.too.large') return res.status(413).json(error(null, -32600, 'Request body too large'));
        return next(err);
    });
    return r;
}

module.exports = { createMcpRoutes, TOOLS, PROTOCOL };
