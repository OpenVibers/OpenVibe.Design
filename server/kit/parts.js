'use strict';
/**
 * The OpenVibe Kit, part by part (plan L54 K3): every builder in openvibe-shared/kit with what it is for, a sample, and
 * what it weighs. Each sample is a line of code, and that same line is what the page draws: the snippet a reader copies
 * can never drift from the picture beside it.
 *
 *   PARTS      [{ id, fn, name, group, line, code, web?, wide? }]   code: an expression over `kit`
 *   GROUPS     [[id, name, line]]
 *   HELPERS    [[call, what it does]]   the small functions with nothing to draw
 *   render(part)  → the sample's HTML (or '' with the error, should a release change a builder)
 *
 * web: the part needs kit-web.js for its behaviour (menus that close, copy, sheets, Enter to send, drops). Which CSS
 * file a part needs, and its weight, is measured from the CSS itself (server/kit/weight.js).
 */
const kit = require('openvibe-shared/kit');

const GROUPS = [
    ['actions', 'Actions', 'Buttons, menus and the small marks beside them.'],
    ['content', 'Content', 'Cards, rails, pictures of people and what a page says when it has nothing.'],
    ['layout', 'Layout', 'The shape of a page: its head, tabs, lists, sections and folds.'],
    ['forms', 'Forms', 'Settings rows, search, the composer and the file drop.'],
    ['data', 'Data', 'Numbers, steps, tables, charts, rankings and meters.'],
    ['tools', 'Tools', 'One order for every tool page: what it does, the input, the answer, the family.'],
    ['feedback', 'Feedback', 'Notices, receipts and the shape of a page while it loads.'],
];

const now = Date.UTC(2026, 10, 1, 14, 5);
const PARTS = [
    // ── Actions ──
    { id: 'button', fn: 'button', group: 'actions', name: 'Button', line: 'One clear action: primary, quiet, ghost or danger. A link with href, a form button without.',
        code: `kit.button({ label: 'Go live', href: '/go', icon: 'live' }) + kit.button({ label: 'Not now', kind: 'quiet', type: 'button' }) + kit.button({ label: 'Delete', kind: 'danger', type: 'button', small: true })` },
    { id: 'icon-button', fn: 'iconButton', group: 'actions', name: 'Icon button', line: 'An action that is only an icon. Its label is what a screen reader says and what the tooltip shows.',
        code: `kit.iconButton({ href: '/settings', icon: 'gear', label: 'Settings' }) + kit.iconButton({ href: '/invite', icon: 'invite', label: 'Invite people' })` },
    { id: 'action', fn: 'action', group: 'actions', name: 'Action', line: 'A button that posts, with an optional confirm: leave, remove, stop.', web: true,
        code: `kit.action({ action: '/s/night-owls/leave', icon: 'leave', label: 'Leave', kind: 'quiet', confirm: 'Leave Night owls?' })` },
    { id: 'more', fn: 'more', group: 'actions', name: 'More menu', line: 'The rest of a row\'s actions, behind one button. Dangerous ones confirm.', web: true,
        code: `kit.more({ label: 'More', items: [{ href: '/r/night-owls/edit', label: 'Edit the room', icon: 'pencil' }, { href: '/r/night-owls/invite', label: 'Invite', icon: 'invite' }, { action: '/r/night-owls/delete', label: 'Delete the room', icon: 'trash', danger: true, confirm: 'Delete Night owls for everyone?' }] })` },
    { id: 'badge', fn: 'badge', group: 'actions', name: 'Badge', line: 'A word beside a title: live, new, a state. Five tones.',
        code: `kit.badge('live', 'live') + kit.badge('new', 'accent') + kit.badge('paid', 'ok') + kit.badge('expiring', 'warn') + kit.badge('failed', 'bad')` },
    { id: 'dot', fn: 'dot', group: 'actions', name: 'Unread dot', line: 'How many are new. Nothing at zero; 9+ past nine.',
        code: `kit.dot(3) + kit.dot(42)` },

    // ── Content ──
    { id: 'card', fn: 'card', group: 'content', name: 'Card', line: 'A stream, a clip, a room or a place: picture first, the title, who, and one line.',
        code: `kit.card({ href: '/goosely', title: 'Seattle at night, chat picks the route', type: 'stream', live: true, who: 'goosely', count: [1204, 'watching'], sub: 'IRL · Capitol Hill' })` },
    { id: 'rail', fn: 'rail', group: 'content', name: 'Rail', line: 'A row of cards that scrolls sideways on a phone and wraps on a computer when asked. A long list never makes a long page.', wide: true,
        code: `kit.rail({ id: 'now', title: 'Live now', more: { href: '/live', label: 'See all' }, items: [kit.card({ href: '/goosely', title: 'Seattle at night', live: true, who: 'goosely', type: 'stream' }), kit.card({ href: '/surfwax', title: 'Surf race, heat 3', live: true, who: 'surfwax', type: 'stream' }), kit.card({ href: '/v/91', title: 'Building a robot arm, day 12', who: 'ana', type: 'video', count: [880, 'views'] }), kit.card({ href: '/v/92', title: 'Lo-fi and a rainy window', who: 'kai', type: 'video' })] })` },
    { id: 'mark', fn: 'mark', group: 'content', name: 'Mark', line: 'A person or a place: their picture, or up to two letters on a colour that comes from the name.',
        code: `kit.mark({ name: 'Ana Lima' }) + kit.mark({ name: 'Night owls' }) + kit.mark({ name: 'Pike Place', square: true }) + kit.mark({ name: 'kai', size: 48 })` },
    { id: 'empty', fn: 'empty', group: 'content', name: 'Empty state', line: 'What a page says when there is nothing yet, and the one thing to do about it.',
        code: `kit.empty({ icon: 'chat', title: 'No rooms yet', text: 'Start the first one: public, or private to the people you invite.', action: { href: '/rooms/new', label: 'Start a room' } })` },
    { id: 'snippet', fn: 'snippet', group: 'content', name: 'Snippet', line: 'Code to copy, with a copy button in the corner.', web: true,
        code: `kit.snippet({ id: 'embed', code: '<iframe src="https://openvibe.live/embed/goosely" allow="autoplay; fullscreen"></iframe>' })` },
    { id: 'sheet', fn: 'sheet', group: 'content', name: 'Sheet', line: 'More choices without leaving the page: up from the bottom on a phone, a dialog on a computer.', web: true,
        code: `kit.sheetButton({ sheet: 'filters', label: 'Filters', iconOnly: false }) + kit.sheet({ id: 'filters', title: 'Filters', body: kit.chips({ name: 'kind', label: 'Show', options: [['live', 'Live', true], ['clips', 'Clips'], ['rooms', 'Rooms']] }) })` },

    // ── Layout ──
    { id: 'head', fn: 'head', group: 'layout', name: 'Head', line: 'The top of an app page: back, the title, one muted line, icon actions and the tabs. It sticks under the navbar.', wide: true,
        code: `kit.head({ title: 'Settings', sub: 'Saved to your account', back: { href: '/', label: 'Home' }, level: 2, sticky: false, actions: [kit.iconButton({ href: '/help', icon: 'help', label: 'Help' })], tabs: kit.tabs({ base: '/kit/head', items: [{ key: 'look', label: 'Look' }, { key: 'sound', label: 'Sound' }, { key: 'privacy', label: 'Privacy' }], active: 'look' }) })` },
    { id: 'tabs', fn: 'tabs', group: 'layout', name: 'Tabs', line: 'Links, so they work without JavaScript. For settings and explainers, never to hide content.',
        code: `kit.tabs({ base: '/kit/tabs', items: [{ key: 'look', label: 'Look' }, { key: 'sound', label: 'Sound', count: 2 }, { key: 'privacy', label: 'Privacy' }], active: 'look' })` },
    { id: 'list', fn: 'list', group: 'layout', name: 'List', line: 'Rows under a title, with a link to all of them.',
        code: `kit.list([kit.row({ href: '/r/night-owls', mark: kit.mark({ name: 'Night owls' }), title: 'Night owls', sub: 'ana: anyone up for the surf race?', meta: '14:05', unread: 2 }), kit.row({ href: '/r/robots', mark: kit.mark({ name: 'Robot arms' }), title: 'Robot arms', sub: 'kai sent a clip', meta: 'Yesterday' })], { title: 'Your rooms', more: { href: '/rooms', label: 'All' } })` },
    { id: 'row', fn: 'row', group: 'layout', name: 'Row', line: 'A mark, the title with a badge and the time on one line, one muted line under it. The whole row is the link.',
        code: `kit.list([kit.row({ href: '/@goosely', mark: kit.mark({ name: 'goosely' }), title: 'goosely', badge: kit.badge('live', 'live'), meta: '2 h', sub: 'Seattle at night, chat picks the route' })])` },
    { id: 'section', fn: 'section', group: 'layout', name: 'Section', line: 'A titled block of a page, with its count and one quiet note.',
        code: `kit.section({ title: 'Members', count: 12, note: 'Who can do what', body: kit.list([kit.row({ mark: kit.mark({ name: 'Ana Lima' }), title: 'Ana Lima', sub: 'Owner' })], { flush: true }) })` },
    { id: 'fold', fn: 'fold', group: 'layout', name: 'Fold', line: 'A card that opens: setup, extras, the danger zone. It says what is inside and how much.',
        code: `kit.fold({ title: 'Put this room on your site', meta: 'two ways', body: kit.snippet({ code: '<iframe src="https://openvibe.chat/r/night-owls/embed"></iframe>' }) }) + kit.fold({ title: 'Delete the room', tone: 'danger', body: kit.notice({ kind: 'warn', text: 'Everyone loses the history. This cannot be undone.' }) })` },
    { id: 'sidebar', fn: 'sidebar', group: 'layout', name: 'Sidebar', line: 'Navigation down the left on a computer, a drawer on a phone.', web: true, wide: true,
        code: `kit.withSidebar({ sidebar: kit.sidebar({ id: 'kit-demo-side', label: 'Rooms', nav: [{ href: '/kit/sidebar', label: 'Night owls', icon: 'chat', active: true }, { href: '/kit/sidebar', label: 'Robot arms', icon: 'chat' }, { href: '/kit/sidebar', label: 'Surf crew', icon: 'chat' }] }), body: kit.empty({ title: 'Night owls', text: 'The room opens here.' }) })` },
    { id: 'page', fn: 'page', group: 'layout', name: 'Page', line: 'The whole shape of an app page in one call; the side column sits beside the content from 1024 px, under it below.', wide: true,
        code: `kit.page({ id: 'kit-demo-page', head: kit.head({ title: 'Night owls', sub: '38 here', level: 2, sticky: false }), body: kit.list([kit.row({ mark: kit.mark({ name: 'ana' }), title: 'ana', sub: 'anyone up for the surf race?', meta: '14:05' })], { flush: true }), side: kit.stats([[38, 'here now'], [412, 'members']]) })` },

    // ── Forms ──
    { id: 'find', fn: 'find', group: 'forms', name: 'Find', line: 'A search, or "add by name": a pill with an icon, the field and a round button.',
        code: `kit.find({ action: '/search', name: 'q', placeholder: 'Search streams, people and rooms', label: 'Search' })` },
    { id: 'dock', fn: 'dock', group: 'forms', name: 'Composer', line: 'The one thing you type, pinned at the bottom. Enter sends; it grows as you write.', web: true,
        code: `kit.dock({ action: '/r/night-owls/messages', placeholder: 'Message Night owls', id: 'kit-demo-dock' })` },
    { id: 'switch-row', fn: 'switchRow', group: 'forms', name: 'Switch row', line: 'An on/off setting: the label and a hint on the left, the switch on the right.',
        code: `'<form class="ovk-form">' + kit.switchRow({ name: 'live_alerts', label: 'Tell me when people I follow go live', hint: 'In the bell and as a push', on: true }) + '</form>'` },
    { id: 'range-row', fn: 'rangeRow', group: 'forms', name: 'Range row', line: 'An amount: the label, the slider and its value.',
        code: `'<form class="ovk-form">' + kit.rangeRow({ name: 'volume', label: 'Alert volume', value: 60 }) + '</form>'` },
    { id: 'select-row', fn: 'selectRow', group: 'forms', name: 'Select row', line: 'One choice of several, as a row.',
        code: `'<form class="ovk-form">' + kit.selectRow({ name: 'quality', label: 'Video quality', hint: 'Auto follows your connection', options: [['auto', 'Auto'], ['1080', '1080p'], ['720', '720p']], value: 'auto' }) + '</form>'` },
    { id: 'seg', fn: 'seg', group: 'forms', name: 'Segmented', line: 'Two to four choices you can see at once.',
        code: `kit.seg({ name: 'view', label: 'View', options: [['grid', 'Grid'], ['list', 'List'], ['map', 'Map']], value: 'grid' })` },
    { id: 'chips', fn: 'chips', group: 'forms', name: 'Chips', line: 'Filters you can turn on and off, or one of a few.',
        code: `kit.chips({ name: 'kind', label: 'Show', options: [['live', 'Live', true], ['clips', 'Clips', true], ['rooms', 'Rooms'], ['games', 'Games']] })` },
    { id: 'save-bar', fn: 'saveBar', group: 'forms', name: 'Save bar', line: 'The save button of a settings form, kept in reach above the phone\'s app bar.',
        code: `kit.saveBar({ label: 'Save settings' })` },
    { id: 'drop', fn: 'drop', group: 'forms', name: 'Drop', line: 'Where a file goes: a real file input, plus drag and drop, paste and the phone\'s camera.', web: true,
        code: `kit.drop({ name: 'photo', accept: 'image/*', label: 'Choose a photo', hint: 'JPEG, PNG or WebP, up to 20 MB', camera: true, id: 'kit-demo-drop' })` },

    // ── Data ──
    { id: 'stats', fn: 'stats', group: 'data', name: 'Numbers', line: 'A strip of numbers that matter. Zero and unknown are left out; it scrolls sideways on a phone.',
        code: `kit.stats([[1204, 'watching now'], [48, 'people chatting'], [12, 'streams live', '/live']])` },
    { id: 'num', fn: 'num', group: 'data', name: 'Number', line: 'A number the way a reader wants it: money, compact, percent, time. Missing is "–", never 0.',
        code: `[kit.num(12.5, 'money'), kit.num(0.027, 'money'), kit.num(1234567, 'compact'), kit.num(0.375, 'percent'), kit.num(2400, 'ms'), kit.num(null, 'int')].join(' · ')` },
    { id: 'steps', fn: 'steps', group: 'data', name: 'Steps', line: 'A flow of a few steps. Done steps link back; later ones never link ahead.',
        code: `kit.steps({ current: 1, items: [{ label: 'Opt in', href: '/merchant' }, { label: 'Verify the domain' }, { label: 'Choose a plan' }, { label: 'Live' }] })` },
    { id: 'table', fn: 'table', group: 'data', name: 'Table', line: 'Plans, prices, endpoints: anything compared across columns. On a phone each row becomes a card.', wide: true,
        code: `kit.table({ caption: 'Plans', columns: [{ key: 'plan', label: 'Plan', primary: true }, { key: 'price', label: 'Price', fmt: 'money' }, { key: 'streams', label: 'Streams', fmt: 'int' }, { key: 'clips', label: 'Clips kept' }], rows: [{ plan: 'Free', price: 0, streams: 1, clips: '30 days' }, { plan: 'Creator', price: 6, streams: 3, clips: '1 year' }, { plan: 'Studio', price: 18, streams: 10, clips: 'Forever' }] })` },
    { id: 'chart', fn: 'chart', group: 'data', name: 'Chart', line: 'Line, area, bar or scatter. Text stays its real size at every width, and a table with the same numbers sits behind it.', web: true, wide: true,
        code: `kit.chart({ type: 'area', title: 'Viewers, last 7 days', y: { fmt: 'compact' }, x: { time: true }, series: [{ name: 'Viewers', points: [[${now - 6 * 864e5}, 820], [${now - 5 * 864e5}, 1100], [${now - 4 * 864e5}, 960], [${now - 3 * 864e5}, 1480], [${now - 2 * 864e5}, 1320], [${now - 864e5}, 1710], [${now}, 1204]] }] })` },
    { id: 'rank', fn: 'rank', group: 'data', name: 'Ranking', line: 'A leaderboard: the place, the name, the value with its interval, the change, a bar in proportion.',
        code: `kit.rank({ base: 900, fmt: 'int', items: [{ name: 'claude-opus-5-5', value: 1088, interval: 14, delta: 2 }, { name: 'gemini-3-pro', value: 1051, interval: 18, delta: -1 }, { name: 'gpt-5', value: 1032, interval: 16 }, { name: 'deepseek-v4', value: 998, interval: 21, delta: 1 }] })` },
    { id: 'meter', fn: 'meter', group: 'data', name: 'Meter', line: 'How full something is. With tone auto, a limit turns amber from 75 % and red from 90 %.',
        code: `kit.meter({ value: 62, max: 100, label: 'Storage', text: '6.2 of 10 GB' }) + kit.meter({ value: 93, max: 100, label: 'Uploads today', text: '93 of 100', tone: 'auto' })` },

    // ── Tools ──
    { id: 'tool-head', fn: 'toolHead', group: 'tools', name: 'Tool head', line: 'What the tool does, in its colour, with the facts that matter (free, no sign-in, what is kept).',
        code: `kit.toolHead({ icon: 'image', hue: 280, family: 'Images', crumb: { href: '/tools', label: 'Tools' }, title: 'Shrink an image', task: 'Make a picture smaller without it looking worse.', facts: ['Free', 'No sign-in', 'Nothing kept'], level: 2 })` },
    { id: 'tool-input', fn: 'toolInput', group: 'tools', name: 'Tool input', line: 'The one field a tool needs, its button, and examples to try.',
        code: `kit.toolInput({ name: 'domain', label: 'A domain', placeholder: 'openvibe.live', button: 'Look it up', icon: 'search', tries: { items: [{ value: 'openvibe.live' }, { value: 'example.com' }] } })` },
    { id: 'answer', fn: 'answer', group: 'tools', name: 'Answer', line: 'The answer first, then its rows, then what to do next.',
        code: `kit.answer({ title: 'openvibe.live is reachable', badge: kit.badge('ok', 'ok'), rows: [['Address', '104.21.32.1'], ['Answered in', '38 ms'], ['Certificate', 'Valid until Jan 30, 2027']], next: [{ href: '/tools/dns', label: 'See every DNS record' }] })` },
    { id: 'family', fn: 'family', group: 'tools', name: 'Family', line: 'The tools next to this one.',
        code: `kit.family({ title: 'More image tools', more: { href: '/tools/images', label: 'All 14' }, items: [{ href: '/tools/crop', label: 'Crop', icon: 'image' }, { href: '/tools/convert', label: 'Convert', icon: 'swap' }, { href: '/tools/remove-bg', label: 'Remove the background', icon: 'spark' }] })` },
    { id: 'tool', fn: 'tool', group: 'tools', name: 'Tool frame', line: 'One order for every tool page: head, input, answer, family, folds, related.', wide: true,
        code: `kit.tool({ head: kit.toolHead({ icon: 'search', hue: 200, title: 'DNS lookup', task: 'Every record for a domain.', facts: ['Free'], level: 2 }), input: kit.toolInput({ name: 'd', label: 'A domain', placeholder: 'openvibe.live', button: 'Look up' }), answer: kit.answer({ title: '4 records', rows: [['A', '104.21.32.1'], ['AAAA', '2606:4700::6810:2001']] }), family: kit.family({ title: 'More network tools', items: [{ href: '/tools/ping', label: 'Ping', icon: 'wave' }] }) })` },
    { id: 'tries', fn: 'tries', group: 'tools', name: 'Tries', line: 'Examples a person can run with one tap.',
        code: `kit.tries({ name: 'q', label: 'Try', items: [{ value: 'openvibe.live' }, { value: 'openvibe.chat' }, { value: 'example.com' }] })` },

    // ── Feedback ──
    { id: 'notice', fn: 'notice', group: 'feedback', name: 'Notice', line: 'A sentence about what just happened: ok, info, warn or error. Errors are announced.',
        code: `kit.notice({ kind: 'ok', text: 'Saved. Every OpenVibe site follows.' }) + kit.notice({ kind: 'warn', text: 'Your stream key expires in 3 days.' }) + kit.notice({ kind: 'error', text: 'That name is taken. Try another.' })` },
    { id: 'receipt', fn: 'receipt', group: 'feedback', name: 'Receipt', line: 'A result and what it took: the answer first, then one quiet line of facts.',
        code: `kit.receipt({ title: 'Clip saved', body: 'The last 30 seconds of goosely\\'s stream are in your clips.', facts: [['Length', '0:30'], ['Size', '4.2 MB'], ['Kept', 'until you remove it']], actions: [kit.button({ href: '/clips', label: 'Open your clips', kind: 'quiet', small: true })] })` },
    { id: 'skeleton', fn: 'skeleton', group: 'feedback', name: 'Skeleton', line: 'The shape of what is coming, so nothing jumps when it arrives. It never spins.',
        code: `kit.skeleton({ kind: 'row', count: 3 })` },
];

const HELPERS = [
    ['kit.esc(text)', 'Escapes text for HTML. Every builder already does it for its text arguments.'],
    ['kit.url(href)', 'Keeps http(s) and same-site links; anything else becomes #.'],
    ['kit.icon(name)', 'One of kit.ICONS as inline SVG, in the text\'s colour. The full set is at /icons.'],
    ['kit.when(ts)', '{ iso, text }: 14:05 today, Yesterday, a weekday this week, Oct 20 this year, else the date.'],
    ['kit.hueOf(key)', 'The colour a mark wears for a name: the same name, the same hue, everywhere.'],
    ['kit.tabOf(query, keys)', 'The open tab: a known key from the query, else the first.'],
    ['kit.enhance(el)', 'After a page inserts markup itself: wires copy buttons, menus, sheets and the composer.'],
];

const byId = new Map(PARTS.map((p) => [p.id, p]));
const cache = new Map();

/** The sample's HTML: the part's own code line run against the installed kit. */
function render(part) {
    if (cache.has(part.id)) return cache.get(part.id);
    let html = '';
    try {
        // The code is this file's own constant, never anything a request sent.
        html = String(new Function('kit', `return (${part.code});`)(kit) || '');
    } catch (err) {
        html = '';
        part.error = (err && err.message) || String(err);
    }
    cache.set(part.id, html);
    return html;
}

module.exports = { PARTS, GROUPS, HELPERS, byId, render };
