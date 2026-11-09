'use strict';

/**
 * Import the Shared kit into the public component registry.
 *
 * A registry entry is a design.component@1 document (Contracts) plus the HTML its default example draws. The definition
 * is not written by hand: the props are read from the builder's own destructured parameters, the states from the
 * component contract where openvibe-shared/components has one and otherwise from the attributes and state classes the
 * builder writes, and the example is the /kit part's sample rendered against the installed kit. Every entry is checked
 * against design.component@1 before it is stored.
 *
 *   buildEntries()  → [{ name, source, definition, markup }]
 *
 * The editor's own kit parts (server/kit/parts.js) are the source of truth for which builders exist: the /kit page
 * fails when a new builder has no part, so the registry cannot silently miss one. The menu's Home grid and its Edit
 * button are browser components in openvibe-shared/ov-home.js; their options and states are read from that file too.
 */
const fs = require('fs');
const contracts = require('openvibe-contracts');
const kit = require('openvibe-shared/kit');
const components = require('openvibe-shared/components');
const { PARTS, render } = require('../kit/parts');

const MAX = { title: 120, summary: 500, part: 80, role: 300, a11y: 300 };
const GENERIC_REDUCED = 'Remove movement; keep the state change.';
const GENERIC_TARGET = 'At least 44 × 44 px on touch';
const GENERIC_FOCUS = 'Visible keyboard focus; follow reading order';

const HOME_MODULE = 'openvibe-shared/ov-home';
const KIT_MODULE = 'openvibe-shared/kit';

/** A contract-sized string: one line, no control characters, never empty. */
function text(value, max) {
    const s = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    return (s || 'Component').slice(0, max);
}

/** A type name for a destructured default: what a reader of the builder sees. */
function typeOf(value) {
    const s = String(value == null ? '' : value).trim();
    if (!s || s === 'null' || s === 'undefined') return 'any';
    if (/^(true|false)$/.test(s)) return 'boolean';
    if (/^-?\d+(?:\.\d+)?$/.test(s)) return 'number';
    if (/^['"`]/.test(s)) return 'string';
    if (/^\[/.test(s)) return 'list';
    if (/^\{/.test(s)) return 'object';
    if (/^[A-Za-z_$][\w$]*$/.test(s)) return 'any';
    return 'any';
}

/** The parameter list of a builder, without its wrapping parentheses (strings and nesting respected). */
function paramsOf(fn) {
    const src = String(fn);
    const start = src.indexOf('(');
    if (start < 0) return '';
    let depth = 0;
    let quote = '';
    for (let i = start; i < src.length; i += 1) {
        const c = src[i];
        if (quote) {
            if (c === '\\') i += 1;
            else if (c === quote) quote = '';
            continue;
        }
        if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
        if (c === '(') depth += 1;
        else if (c === ')') {
            depth -= 1;
            if (depth === 0) return src.slice(start + 1, i);
        }
    }
    return '';
}

/** Split on a delimiter at the top level of a parameter list (braces, brackets, parentheses and strings respected). */
function splitTop(input, delimiter = ',') {
    const out = [];
    let depth = 0;
    let quote = '';
    let last = 0;
    for (let i = 0; i < input.length; i += 1) {
        const c = input[i];
        if (quote) {
            if (c === '\\') i += 1;
            else if (c === quote) quote = '';
            continue;
        }
        if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
        if (c === '{' || c === '[' || c === '(') depth += 1;
        else if (c === '}' || c === ']' || c === ')') depth -= 1;
        else if (c === delimiter && depth === 0) { out.push(input.slice(last, i)); last = i + 1; }
    }
    out.push(input.slice(last));
    return out;
}

/** The top-level `=` of a parameter: its default expression, or '' when it has none. */
function splitDefault(param) {
    let depth = 0;
    let quote = '';
    for (let i = 0; i < param.length; i += 1) {
        const c = param[i];
        if (quote) {
            if (c === '\\') i += 1;
            else if (c === quote) quote = '';
            continue;
        }
        if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
        if (c === '{' || c === '[' || c === '(') depth += 1;
        else if (c === '}' || c === ']' || c === ')') depth -= 1;
        else if (c === '=' && depth === 0) return [param.slice(0, i), param.slice(i + 1)];
    }
    return [param, ''];
}

/** The props a builder reads: its destructured keys (and positional arguments), typed from their defaults. */
function propsOf(fn, rest = null) {
    const props = rest ? { ...propsOf(rest) } : {};
    for (const raw of splitTop(paramsOf(fn))) {
        const param = raw.trim();
        if (!param) continue;
        if (param.startsWith('...')) continue;
        if (param.startsWith('{')) {
            const close = param.lastIndexOf('}');
            if (close < 0) continue;
            for (const rawKey of splitTop(param.slice(1, close))) {
                const item = rawKey.trim();
                if (!item || item.startsWith('...')) continue;
                const [head, value] = splitDefault(item);
                const colon = head.indexOf(':');
                const key = (colon >= 0 ? head.slice(0, colon) : head).trim();
                if (!/^[a-z][a-zA-Z0-9]{0,39}$/.test(key)) continue;
                if (Object.keys(props).length >= 60) break;
                props[key] = value.trim() ? `${typeOf(value)}?` : typeOf('');
            }
            continue;
        }
        const [head, value] = splitDefault(param);
        const key = head.trim();
        if (!/^[a-z][a-zA-Z0-9]{0,39}$/.test(key)) continue;
        if (Object.keys(props).length >= 60) break;
        props[key] = value.trim() ? `${typeOf(value)}?` : 'any';
    }
    return Object.freeze(props);
}

/** States the builder's markup and attributes expose (when openvibe-shared/components has no contract for it). */
function statesOf(part, source, markup) {
    const spec = components.get(part.id);
    if (spec && Array.isArray(spec.states) && spec.states.length) return [...new Set(spec.states)].slice(0, 30);
    const out = new Set(['default']);
    const add = (state) => {
        const s = String(state || '').trim();
        if (/^[a-z][a-z0-9 +-]{0,39}$/i.test(s) && out.size < 30) out.add(s);
    };
    // The builder's own source, not its sample: a sheet's sample contains a chips control whose states are not
    // the sheet's. The element and the attributes are what the builder writes.
    if (/<dialog|showModal|aria-haspopup="dialog"/i.test(source)) { add('closed'); add('open'); }
    if (/<details|aria-expanded/i.test(source)) { add('closed'); add('open'); }
    if (/type="radio"/i.test(source)) { add('selected'); add('focused'); }
    if (/type="checkbox"|aria-pressed/i.test(source)) { add('on'); add('off'); }
    if (/disabled/i.test(source)) add('disabled');
    if (/aria-current/i.test(source)) add('current');
    if (/unread/i.test(source)) add('unread');
    if (/aria-busy|busy/i.test(source)) add('busy');
    if (/<progress|aria-valuenow/i.test(source)) { add('uploading'); add('complete'); }
    if (/is-live/i.test(source)) add('live');
    if (/is-edit/i.test(source)) add('editing');
    if (/focus|tabindex/i.test(source)) add('focused');
    if (/ovk-empty|empty-title/i.test(source)) add('empty');
    return [...out].slice(0, 30);
}

/** The anatomy openvibe-shared/components gives, or the builder and what it draws. */
function anatomyOf(part, spec) {
    if (spec && Array.isArray(spec.anatomy) && spec.anatomy.length) {
        return spec.anatomy.slice(0, 32).map((a) => ({
            part: text(a.part, MAX.part),
            role: text([a.note, ...Object.entries(a.tokens || {}).map(([k, v]) => `${k} ${v}`)].filter(Boolean).join('; ') || a.part, MAX.role),
        }));
    }
    return [{ part: text(part.fn, MAX.part), role: text(part.line || part.name, MAX.role) }];
}

/** Token paths the component contract names, or the one role a plain builder always wears. */
function tokensOf(part, spec) {
    if (spec) {
        const named = components.tokensOf(spec);
        if (named.length) return [...new Set(named)].slice(0, 50);
    }
    const byGroup = {
        actions: ['color.accent.strong', 'size.tap'],
        content: ['color.bg.raised', 'color.text.primary'],
        layout: ['color.text.primary', 'size.tap'],
        forms: ['color.bg.raised', 'size.tap'],
        data: ['color.accent.base', 'color.text.primary'],
        tools: ['color.bg.raised', 'color.text.primary'],
        feedback: ['color.text.muted', 'color.status.bad.base'],
    };
    return (byGroup[part.group] || ['color.text.primary']).slice(0, 50);
}

function behavioursOf(part, source, spec) {
    const both = `${source}\n${part.code || ''}`;
    const layout = spec && spec.layout ? `${spec.layout.phone || ''} ${spec.layout.computer || ''}` : '';
    return {
        keyboardAware: /input|textarea|select|contenteditable|dialog/i.test(both) || /focus|keyboard/i.test(layout),
        outsideTapCloses: /dialog|data-ovk-close|scrim|outside/i.test(both),
        scrollLock: /dialog|sidebar|drawer|scrim/i.test(both),
        reducedMotion: part.id.includes('motion') || part.id === 'chart'
            ? 'Durations become zero; the state change stays.'
            : GENERIC_REDUCED,
    };
}

function accessibilityOf(part, spec) {
    const a = spec && spec.a11y ? spec.a11y : {};
    return {
        name: text(a.name || part.name, MAX.a11y),
        target: text(a.minTarget || GENERIC_TARGET, MAX.a11y),
        focus: text(a.keys || GENERIC_FOCUS, MAX.a11y),
    };
}

/** The Material 3 container a Compose reference view uses, read from its own code. */
function material3Of(spec, part) {
    if (spec && spec.native && spec.native.compose) {
        const m = /(ModalBottomSheet|NavigationBar|NavigationDrawer|TopAppBar|Scaffold|SingleChoiceSegmentedButtonRow|ScrollableTabRow|LazyVerticalGrid|LazyColumn|Column|Row|ListItem|OutlinedTextField|TextField|Card|Button|OutlinedButton|Surface|Switch|Tab)\b/.exec(spec.native.compose);
        if (m) return m[1];
    }
    return `Material 3 ${part.name}`;
}

const NATIVE = {
    'page-head': {
        material3: 'TopAppBar',
        android: 'Use a TopAppBar with a navigationIcon for back, the page title, and actions; the icon and lede sit below it.',
        ios: 'Use .navigationTitle with a leading back ToolbarItem, trailing actions and .toolbarTitleDisplayMode.',
    },
    head: {
        material3: 'TopAppBar',
        android: 'Use a TopAppBar for the title and actions; put the tabs in a ScrollableTabRow below it.',
        ios: 'Use .navigationTitle, .toolbar for actions, and a Picker or a horizontal ScrollView for the tabs.',
    },
    sheet: {
        material3: 'ModalBottomSheet',
        android: 'Use ModalBottomSheet with sheetState; a close action and the scrim or Escape dismiss it, then return focus to the trigger.',
        ios: 'Use .sheet with a NavigationStack, a title and a Done toolbar item; respect accessibilityReduceMotion.',
    },
    'switch-row': {
        material3: 'ListItem',
        android: 'Use a ListItem with a trailing Material 3 Switch and supporting text.',
        ios: 'Use Toggle with a supporting Text label; the whole row is one accessible control.',
    },
    segmented: {
        material3: 'SingleChoiceSegmentedButtonRow',
        android: 'Use SingleChoiceSegmentedButtonRow with SegmentedButton items; the selected one is the current value.',
        ios: 'Use Picker with .segmented style; announce the selected value.',
    },
    seg: {
        material3: 'SingleChoiceSegmentedButtonRow',
        android: 'Use SingleChoiceSegmentedButtonRow with SegmentedButton items, or a radio row when space is tight.',
        ios: 'Use Picker with .segmented style.',
    },
    dock: {
        material3: 'Scaffold',
        android: 'Use Scaffold.bottomBar with imePadding; the field grows and the send action stays in reach.',
        ios: 'Use safeAreaInset(edge: .bottom) with keyboard avoidance and a send Button.',
    },
    find: {
        material3: 'OutlinedTextField',
        android: 'Use an OutlinedTextField with a search leading icon and a trailing submit Button.',
        ios: 'Use .searchable or a TextField with a submit Button.',
    },
    'home-grid': {
        material3: 'LazyVerticalGrid',
        android: 'Use a LazyVerticalGrid of app tiles with long-press drag (ItemTouchHelper or a drag-and-drop grid); folders are tiles with four previews.',
        ios: 'Use a LazyVGrid of app tiles with .onDrag/.onDrop and a jiggle-free Edit mode; folders open a sheet.',
    },
    'home-edit': {
        material3: 'IconButton',
        android: 'Use a TextButton or IconButton in the grid header that toggles edit mode; Done replaces Edit while arranging.',
        ios: 'Use a Button in the header that toggles Edit; Done replaces it and focus returns to it.',
    },
};

function platformsOf(part, spec, sourceModule) {
    const native = NATIVE[part.id] || {};
    const compose = spec && spec.native ? spec.native.compose : '';
    const swift = spec && spec.native ? spec.native.swiftui : '';
    return {
        web: { module: sourceModule, markup: String(part.code || `kit.${part.fn}(…)`).trim().slice(0, 1000), demo: `/components/${part.id}` },
        android: {
            toolkit: 'Jetpack Compose',
            material3: text(native.material3 || material3Of(spec, part), 120),
            specification: compose || text(native.android || `Use ${part.name} in Jetpack Compose with the shared tokens.`, 500),
        },
        ios: {
            toolkit: 'SwiftUI',
            specification: swift || text(native.ios || `Use ${part.name} in SwiftUI with the shared tokens.`, 500),
        },
    };
}

/** One /kit part as a registry entry. */
function buildPart(part) {
    const fn = kit[part.fn];
    if (typeof fn !== 'function') throw new Error(`component registry: kit.${part.fn} is missing for ${part.id}`);
    const source = String(fn);
    const markup = render(part);
    if (!markup) throw new Error(`component registry: ${part.id} draws no example (${part.error || 'empty'})`);
    const spec = components.get(part.id);
    const definition = {
        schema: 'design.component@1',
        name: part.id,
        title: text(part.name, MAX.title),
        summary: text(part.line || part.name, MAX.summary),
        anatomy: anatomyOf(part, spec),
        // action() forwards its button props (...btn) to kit.button(); merge the builder it forwards to.
        props: part.fn === 'action' ? propsOf(fn, kit.button) : propsOf(fn),
        states: statesOf(part, source, markup),
        tokens: tokensOf(part, spec),
        behaviors: behavioursOf(part, source, spec),
        accessibility: accessibilityOf(part, spec),
        platforms: platformsOf(part, spec, KIT_MODULE),
        examples: [{ title: 'Default', props: { code: part.code } }],
    };
    return { name: part.id, source: `${KIT_MODULE}#${part.fn}`, definition, markup };
}

/** The menu's Home grid: read from the browser component's option object and state classes. */
function buildHomeGrid() {
    const source = fs.readFileSync(require.resolve(HOME_MODULE), 'utf8');
    const dom = new Set(['addEventListener', 'append', 'close', 'setAttribute', 'href']);
    const options = [...new Set([...source.matchAll(/\bo\.([a-zA-Z][a-zA-Z0-9]*)/g)].map((m) => m[1]))]
        .filter((key) => !dom.has(key));
    const props = {};
    for (const key of options) {
        if (Object.keys(props).length >= 60) break;
        if (!/^[a-z][a-zA-Z0-9]*$/.test(key)) continue;
        props[key] = key === 'token' ? 'string?' : /^(apps|yours|tools|groups)$/.test(key) ? 'list?' : /^(user)$/.test(key) ? 'object?' : /^(look|feedLive|feedMissing|onPosted|pulseReady)$/.test(key) ? 'function?' : 'any';
    }
    const markup = `<div class="ovh"><div class="ovh-sec"><span>Your Home</span><button type="button" aria-label="Edit Home">Edit</button></div><ul class="ovh-grid" aria-label="Your home"><li><a class="ovh-app" href="https://openvibe.live"><span class="ovh-ic"></span><span class="ovh-name">Live</span></a></li><li><a class="ovh-app" href="https://openvibe.chat"><span class="ovh-ic"></span><span class="ovh-name">Chat</span></a></li></ul></div>`;
    const part = {
        id: 'home-grid', fn: 'home', name: 'Home grid', group: 'layout',
        line: 'The menu\'s Home screen: your apps in a grid you arrange by long-press or Edit, with folders and the app drawer.',
        code: 'OpenVibeHome.home(el, o)',
    };
    const definition = {
        schema: 'design.component@1',
        name: part.id,
        title: part.name,
        summary: text(part.line, MAX.summary),
        anatomy: [
            { part: 'grid', role: 'The apps and folders, four or five to a row on a phone and a wrapped grid on a computer.' },
            { part: 'app', role: 'One app tile: its icon and name, a link; long-press starts Edit and drags it.' },
            { part: 'folder', role: 'A tile of up to four app previews that opens the folder.' },
        ],
        props,
        states: ['default', 'editing', 'dragging', 'folder-open', 'signed-in', 'signed-out'],
        tokens: ['color.bg.raised', 'color.text.secondary', 'size.tap', 'hsl(--ovh-h)'],
        behaviors: { keyboardAware: false, outsideTapCloses: false, scrollLock: false, reducedMotion: 'Movement is removed; a tile still moves with the keyboard and Edit still works.' },
        accessibility: { name: 'Your home grid', target: 'At least 44 × 44 px per tile', focus: 'Arrow keys move between tiles in Edit; Delete takes a tile off Home; Enter opens the app.' },
        platforms: platformsOf(part, null, HOME_MODULE),
        examples: [{ title: 'Default', props: { apps: [{ id: 'live', name: 'Live', url: 'https://openvibe.live' }], edit: false } }],
    };
    return { name: part.id, source: `${HOME_MODULE}#home`, definition, markup };
}

/** The menu's Edit button: toggles arranging Home, and says Done while it is on. */
function buildHomeEdit() {
    const part = {
        id: 'home-edit', fn: 'setEdit', name: 'Home Edit button', group: 'actions',
        line: 'The menu\'s Edit button: turns arranging Home on, and says Done while dragging and removing apps is on.',
        code: '<button type="button" aria-label="Edit Home">Edit</button>',
    };
    const markup = '<button type="button" class="ovh-sec" aria-label="Edit Home" title="Edit Home: move apps, remove them, add folders">Edit</button>';
    const definition = {
        schema: 'design.component@1',
        name: part.id,
        title: part.name,
        summary: text(part.line, MAX.summary),
        anatomy: [{ part: 'button', role: 'A text button in the Home header; its label is Edit at rest and Done while arranging.' }],
        props: { edit: 'boolean', label: 'string?' },
        states: ['default', 'editing', 'focused'],
        tokens: ['color.accent.strong', 'size.tap'],
        behaviors: { keyboardAware: true, outsideTapCloses: false, scrollLock: false, reducedMotion: 'The label changes; no movement is needed.' },
        accessibility: { name: 'Edit Home, or Done arranging Home', target: 'At least 44 × 44 px', focus: 'Tab reaches it first in the Home header; Enter or Space toggles edit mode.' },
        platforms: platformsOf(part, null, HOME_MODULE),
        examples: [{ title: 'Default', props: { edit: false, label: 'Edit Home' } }],
    };
    return { name: part.id, source: `${HOME_MODULE}#home`, definition, markup };
}

/** Every entry: the /kit builders, then the two Home parts that are not kit builders. */
function buildEntries() {
    const entries = PARTS.map(buildPart);
    entries.push(buildHomeGrid(), buildHomeEdit());
    for (const entry of entries) {
        const check = contracts.validate('design.component', entry.definition);
        if (!check.valid) {
            throw new Error(`component registry: ${entry.name} is not design.component@1: ${check.errors.slice(0, 3).map((e) => `${e.path} ${e.message}`).join('; ')}`);
        }
    }
    return entries;
}

module.exports = { buildEntries, propsOf, statesOf };
