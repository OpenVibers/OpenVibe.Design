'use strict';
/**
 * Finding a glyph by any name (plan L50 step 4): the words people search with, and the names other icon sets use
 * (Lucide, Material Symbols and MUI; Font Awesome's are openvibe-shared's own glyphs.FA). One table, used by the /icons
 * finder, <ov-icon>, /api/v1/glyphs and the migration page (/icons/migrate), so a name works the same everywhere.
 *
 *   words(glyph)          → the search words for a glyph (its synonyms, then every other set's names for it)
 *   resolve(name)         → our glyph for "gear", "fa-gear", "lucide:settings", "material:settings" or "settings", or null
 *   scan(text)            → every icon a page or a component asks for, by set: [{ set, name, count, glyph, brand }]
 *   search(query, n)      → the glyphs that best answer a search: its own name, then any set's name, then its words
 *   LUCIDE, MATERIAL      → { theirName: glyph } (only names whose glyph exists)
 */
const glyphs = require('openvibe-shared/glyphs');
// Brand logos (Shared 4.72.0, Simple Icons, CC0): the drop-in draws fa-brands names too.
let brands = null;
try { brands = require('openvibe-shared/brands'); } catch { brands = null; }

const has = (g) => !!glyphs.path(g);
const keep = (map) => Object.freeze(Object.fromEntries(Object.entries(map).filter(([, g]) => has(g))));

// ── Synonyms: the words a person types for each glyph (not its own name, nor Font Awesome's) ──
const SYN = {
    gear: 'settings cog preferences options config', sliders: 'adjust controls settings tune mixer', trash: 'delete remove bin garbage',
    close: 'x cancel dismiss exit', pencil: 'edit write compose rename', plus: 'add new create', minus: 'remove subtract less',
    search: 'find magnifier lookup', home: 'house start main', user: 'person profile account me', members: 'people users team',
    group: 'team community crowd', chat: 'message comment talk conversation', mail: 'email envelope letter', inbox: 'mail messages tray',
    bell: 'notification alert ring', heart: 'like love favorite', star: 'favorite rate rating', eye: 'view show visible watch see',
    'eye-off': 'hide hidden invisible private', lock: 'secure private password closed', key: 'password access unlock',
    shield: 'security safe protect privacy', check: 'done ok tick yes confirm', copy: 'duplicate clone', clipboard: 'paste notes',
    scissors: 'cut clip trim', save: 'floppy disk store keep', download: 'save get import', upload: 'send put export', share: 'send forward',
    open: 'external new tab link out', link: 'url chain hyperlink', retry: 'refresh reload again redo repeat', undo: 'revert back',
    history: 'past recent previous time', clock: 'time hour watch', calendar: 'date schedule event day', pin: 'location place marker',
    map: 'directions place', globe: 'world earth internet web', camera: 'photo picture snapshot', video: 'movie record clip camera',
    image: 'picture photo', film: 'movie video cinema reel', music: 'song audio note', mic: 'microphone voice record audio',
    volume: 'sound speaker audio loud', mute: 'silent sound off quiet', play: 'start run go', pause: 'hold wait', stop: 'halt end',
    live: 'broadcast stream on air', tv: 'television screen', computer: 'desktop monitor laptop pc screen', phone: 'call telephone',
    robot: 'bot ai machine automation', brain: 'mind think ai smart', spark: 'magic ai sparkles new shine', fire: 'hot trending flame',
    zap: 'lightning bolt power energy fast', trophy: 'award win prize cup', crown: 'king premium vip', gem: 'diamond premium jewel',
    gift: 'present reward', coin: 'money credits currency token', dollar: 'money price usd cost', wallet: 'money payment purse',
    card: 'credit payment', cart: 'shop basket buy', store: 'shop market', tag: 'label price', ticket: 'pass admission',
    chart: 'graph stats analytics data', gauge: 'speed meter performance dashboard', 'trend-up': 'growth increase rising',
    'trend-down': 'decline decrease falling', rocket: 'launch fast startup', plane: 'flight travel send', airplane: 'flight travel',
    car: 'drive vehicle', train: 'rail travel', walk: 'pedestrian step', route: 'path directions way', code: 'develop programming html',
    terminal: 'console shell command cli', bug: 'error issue defect', wrench: 'tool fix repair', hammer: 'build tool',
    toolbox: 'tools kit', box: 'package parcel', archive: 'storage box', folder: 'directory', file: 'document page',
    book: 'read guide manual docs', 'book-open': 'read learn guide', news: 'article newspaper press', megaphone: 'announce shout marketing',
    rss: 'feed subscribe', idea: 'lightbulb tip insight', help: 'question support faq', info: 'information about details',
    alert: 'warning caution danger', 'alert-circle': 'error warning', ban: 'block forbid prohibited', filter: 'funnel refine',
    sort: 'order arrange', list: 'items bullets', grid: 'tiles layout apps', menu: 'hamburger navigation bars', more: 'ellipsis options dots',
    sun: 'light day bright', moon: 'dark night', cloud: 'weather sky', snow: 'winter cold', drop: 'water rain liquid',
    tree: 'nature forest', leaf: 'nature eco plant', paw: 'pet animal dog cat', fish: 'sea animal', game: 'controller gamepad gaming',
    dice: 'random chance luck', sword: 'fight battle', target: 'goal aim bullseye', flag: 'report mark', enter: 'login sign in',
    leave: 'logout sign out exit', expand: 'fullscreen maximize enlarge', compress: 'minimize shrink', busy: 'loading wait spinner',
    nodes: 'network connections graph', server: 'host backend', database: 'data storage sql', chip: 'cpu processor hardware',
    drive: 'disk storage', wifi: 'wireless internet signal', palette: 'colors theme paint', text: 'type font letters',
    signature: 'sign autograph', scale: 'balance law justice', gavel: 'law judge auction', medical: 'health doctor hospital',
    food: 'restaurant eat meal', dish: 'meal plate food', mug: 'coffee cup tea drink', couch: 'sofa lounge', door: 'exit entrance room',
    city: 'buildings town urban', tent: 'camping outdoors', mountain: 'hiking peak nature', umbrella: 'rain weather protect',
    lifebuoy: 'support help rescue', smile: 'happy emoji face', laugh: 'funny lol emoji', skull: 'dead danger', ghost: 'boo spooky',
    child: 'kid baby', hand: 'wave stop palm', handshake: 'deal agreement partner', shirt: 'clothes merch', 'thumbs-up': 'like approve good',
    swap: 'exchange switch trade', move: 'drag arrange', grip: 'drag handle reorder', sidebar: 'panel layout', columns: 'layout split',
    table: 'spreadsheet rows data', steps: 'checklist todo progress', task: 'todo checklist done', reply: 'respond answer back',
    forward: 'send next', infinity: 'forever endless loop', keyboard: 'type input keys', print: 'printer paper', contrast: 'theme dark light',
    ear: 'listen hearing audio', record: 'rec dot capture', cc: 'captions subtitles', scroll: 'document paper history',
    focus: 'target center aim', compass: 'explore navigate direction', hourglass: 'timer wait loading', weight: 'gym fitness heavy',
    parking: 'car park', restroom: 'toilet wc bathroom', storm: 'thunder lightning weather', wind: 'air breeze weather',
    wave: 'audio signal ocean', water: 'sea ocean waves', seedling: 'grow plant sprout', recycle: 'reuse green eco',
    piggy: 'savings bank money', money: 'cash bills payment', donate: 'give charity', ranking: 'leaderboard medal top',
    'check-double': 'read seen done all', 'user-circle': 'avatar profile account', invite: 'add person join',
    'user-off': 'remove person block', 'user-lock': 'private account', 'link-off': 'unlink broken', 'chat-off': 'no messages muted',
    'camera-off': 'no camera', 'camera-flip': 'switch camera', 'mic-off': 'muted no mic', 'phone-off': 'hang up end call',
    'cloud-off': 'offline', 'heart-broken': 'sad breakup', 'heart-pulse': 'health heartbeat', clapper: 'movie film action',
    headphones: 'audio listen music', radio: 'broadcast fm', branch: 'git fork', commit: 'git version', layers: 'stack levels',
    shapes: 'geometry objects', cubes: 'blocks 3d boxes', id: 'badge identity card', at: 'email mention', hash: 'tag hashtag number',
    quote: 'citation saying', heading: 'title header', 'align-left': 'text paragraph', 'list-ordered': 'numbers ranked',
    timeline: 'history events', window: 'app browser', 'window-restore': 'windows',
};

// ── Lucide's names (lucide.dev) whose glyph has another name here; identical names need no entry ──
const LUCIDE = keep({
    x: 'close', settings: 'gear', 'settings-2': 'sliders', 'sliders-horizontal': 'sliders', 'sliders-vertical': 'sliders', 'trash-2': 'trash',
    'external-link': 'open', 'square-arrow-out-up-right': 'open', loader: 'busy', 'loader-circle': 'busy', 'loader-2': 'busy',
    'volume-1': 'volume', 'volume-2': 'volume', 'volume-x': 'mute', 'volume-off': 'mute', users: 'members', 'users-round': 'members',
    'message-circle': 'chat', 'message-square': 'chat', 'messages-square': 'chat', 'message-circle-off': 'chat-off', house: 'home',
    // Our chevron points right (Font Awesome's chevron-right); down, up and back are the other ways.
    'map-pin': 'pin', 'map-pinned': 'pin', pin: 'tack', 'chevron-right': 'chevron', 'chevron-down': 'down', 'chevron-up': 'up', 'rotate-ccw': 'retry', 'rotate-cw': 'retry',
    'refresh-cw': 'retry', 'refresh-ccw': 'retry', repeat: 'retry', 'undo-2': 'undo', 'log-in': 'enter', 'log-out': 'leave',
    'circle-help': 'help', 'help-circle': 'help', 'circle-alert': 'alert-circle', 'triangle-alert': 'alert', 'alert-triangle': 'alert',
    'circle-check': 'check-circle', 'circle-check-big': 'check-circle', 'check-circle-2': 'check-circle', 'circle-x': 'x-circle',
    'circle-plus': 'plus-circle', 'circle-minus': 'minus-circle', 'check-check': 'check-double', ellipsis: 'more',
    'more-horizontal': 'more', 'ellipsis-vertical': 'more', 'more-vertical': 'more', 'grip-vertical': 'grip', 'layout-grid': 'grid',
    'grid-3x3': 'grid', 'panel-left': 'sidebar', monitor: 'computer', laptop: 'computer', cpu: 'chip', 'hard-drive': 'drive',
    'share-2': 'nodes', network: 'nodes', workflow: 'nodes', 'link-2': 'link', unlink: 'link-off', 'link-2-off': 'link-off',
    'shield-check': 'shield', 'user-round': 'user', 'circle-user': 'user-circle', 'circle-user-round': 'user-circle', 'user-x': 'user-off',
    'user-plus': 'invite', 'calendar-days': 'calendar', 'alarm-clock': 'clock', 'switch-camera': 'camera-flip', images: 'image',
    clapperboard: 'clapper', 'circle-stop': 'stop', 'skip-forward': 'skip', 'heart-crack': 'heart-broken', 'file-text': 'file',
    pen: 'pencil', 'pen-line': 'pencil', 'square-pen': 'pencil', edit: 'pencil', 'cloud-lightning': 'storm', snowflake: 'snow',
    droplet: 'drop', droplets: 'water', waves: 'wave', flame: 'fire', sparkles: 'spark', sparkle: 'spark', 'wand-sparkles': 'spark',
    award: 'trophy', medal: 'ranking', crosshair: 'focus', earth: 'globe', languages: 'language', 'code-xml': 'code',
    'square-terminal': 'terminal', 'git-branch': 'branch', 'git-commit-horizontal': 'commit', 'git-commit': 'commit', package: 'box',
    boxes: 'cubes', type: 'text', 'at-sign': 'at', funnel: 'filter', 'arrow-up-down': 'sort', 'arrow-down-wide-narrow': 'sort-asc',
    printer: 'print', tags: 'tag', 'shopping-cart': 'cart', 'shopping-bag': 'cart', 'credit-card': 'card', coins: 'coin',
    'dollar-sign': 'dollar', 'piggy-bank': 'piggy', banknote: 'money', 'trending-up': 'trend-up', 'trending-down': 'trend-down',
    'chart-line': 'chart', 'line-chart': 'chart', 'bar-chart': 'chart', 'bar-chart-2': 'chart', 'chart-column': 'chart',
    'chart-no-axes-column': 'chart', activity: 'heart-pulse', 'train-front': 'train', footprints: 'walk', trees: 'tree', 'tree-pine': 'tree',
    'tree-deciduous': 'tree', sprout: 'seedling', 'paw-print': 'paw', bot: 'robot', 'bot-message-square': 'robot', baby: 'child',
    coffee: 'mug', 'cup-soda': 'mug', utensils: 'food', 'utensils-crossed': 'food', 'flask-conical': 'flask', stethoscope: 'medical',
    sofa: 'couch', 'door-open': 'door', 'door-closed': 'door', 'building-2': 'city', building: 'city', 'life-buoy': 'lifebuoy',
    swords: 'sword', dices: 'dice', 'dice-5': 'dice', 'gamepad-2': 'game', gamepad: 'game', newspaper: 'news', 'id-card': 'id',
    'key-round': 'key', shrink: 'compress', maximize: 'expand', minimize: 'compress', 'maximize-2': 'expand', 'minimize-2': 'compress',
    'arrow-left-right': 'arrows-h', 'arrow-right-left': 'swap', 'columns-2': 'columns', 'table-2': 'table', 'list-checks': 'steps',
    'list-todo': 'task', 'corner-up-left': 'reply', 'circle-parking': 'parking', 'square-parking': 'parking', dumbbell: 'weight',
    'tv-2': 'tv', 'tv-minimal': 'tv', 'circle-dot': 'record', 'mail-open': 'mail', 'bell-ring': 'bell', 'phone-off': 'phone-off',
    'chevron-left': 'back', 'move-right': 'arrow-right', hourglass: 'hourglass', timer: 'hourglass',
    'ticket-check': 'ticket', 'radio-tower': 'live', podcast: 'live', 'ear-off': 'ear', 'scale-3d': 'cubes', 'shapes': 'shapes',
});

// ── Material Symbols / Material Icons names (Google Fonts) and MUI's, snake_case; identical names need no entry ──
const MATERIAL = keep({
    settings: 'gear', tune: 'sliders', more_vert: 'more', more_horiz: 'more', delete: 'trash', delete_outline: 'trash', edit: 'pencil',
    add: 'plus', remove: 'minus', done: 'check', done_all: 'check-double', check_circle: 'check-circle', cancel: 'x-circle', error: 'alert-circle',
    warning: 'alert', help_outline: 'help', favorite: 'heart', favorite_border: 'heart', star_border: 'star', thumb_up: 'thumbs-up',
    visibility: 'eye', visibility_off: 'eye-off', person: 'user', people: 'members', groups: 'group', person_add: 'invite',
    account_circle: 'user-circle', email: 'mail', chat_bubble: 'chat', forum: 'chat', notifications: 'bell', content_copy: 'copy',
    content_paste: 'clipboard', content_cut: 'scissors', file_download: 'download', file_upload: 'upload', description: 'file',
    insert_drive_file: 'file', photo_camera: 'camera', videocam: 'video', volume_up: 'volume', volume_off: 'mute', play_arrow: 'play',
    skip_next: 'skip', fast_rewind: 'rewind', music_note: 'music', laptop: 'computer', desktop_windows: 'computer', call: 'phone',
    call_end: 'phone-off', schedule: 'clock', access_time: 'clock', calendar_today: 'calendar', event: 'calendar', today: 'calendar',
    hourglass_empty: 'hourglass', place: 'pin', location_on: 'pin', explore: 'compass', public: 'globe', translate: 'language',
    bug_report: 'bug', build: 'wrench', construction: 'hammer', handyman: 'toolbox', inventory_2: 'box', text_fields: 'text',
    title: 'heading', format_quote: 'quote', format_align_left: 'align-left', tag: 'hash', alternate_email: 'at', filter_list: 'filter',
    filter_alt: 'filter', local_offer: 'tag', sell: 'tag', confirmation_number: 'ticket', shopping_cart: 'cart', storefront: 'store',
    account_balance_wallet: 'wallet', credit_card: 'card', payments: 'money', attach_money: 'dollar', savings: 'piggy',
    trending_up: 'trend-up', trending_down: 'trend-down', show_chart: 'chart', bar_chart: 'chart', insights: 'chart', speed: 'gauge',
    rocket_launch: 'rocket', flight: 'plane', airplanemode_active: 'airplane', directions_car: 'car', directions_walk: 'walk',
    terrain: 'mountain', park: 'tree', eco: 'leaf', pets: 'paw', smart_toy: 'robot', psychology: 'brain', sentiment_satisfied: 'smile',
    mood: 'smile', child_care: 'child', pan_tool: 'hand', checkroom: 'shirt', local_cafe: 'mug', coffee: 'mug', restaurant: 'food',
    science: 'flask', medical_services: 'medical', local_hospital: 'medical', weekend: 'couch', door_front: 'door', meeting_room: 'door',
    apartment: 'city', location_city: 'city', beach_access: 'umbrella', support: 'lifebuoy', balance: 'scale', casino: 'dice',
    sports_esports: 'game', videogame_asset: 'game', all_inclusive: 'infinity', rss_feed: 'rss', newspaper: 'news', article: 'news',
    feed: 'news', campaign: 'megaphone', hearing: 'ear', badge: 'id', vpn_key: 'key', hub: 'nodes', account_tree: 'nodes',
    open_in_new: 'open', launch: 'open', refresh: 'retry', autorenew: 'retry', replay: 'retry', login: 'enter', logout: 'leave',
    fullscreen: 'expand', fullscreen_exit: 'compress', open_with: 'move', swap_horiz: 'swap', view_column: 'columns',
    table_chart: 'table', table_rows: 'table', checklist: 'steps', task_alt: 'task', arrow_back: 'arrow-left', arrow_forward: 'arrow-right',
    arrow_upward: 'arrow-up', arrow_downward: 'arrow-down', expand_more: 'down', keyboard_arrow_down: 'down', expand_less: 'up',
    keyboard_arrow_up: 'up', chevron_right: 'chevron', keyboard_arrow_right: 'chevron', navigate_next: 'chevron',
    chevron_left: 'back', keyboard_arrow_left: 'back', navigate_before: 'back',
    local_fire_department: 'fire', whatshot: 'fire', bolt: 'zap', flash_on: 'zap', auto_awesome: 'spark', card_giftcard: 'gift',
    redeem: 'gift', diamond: 'gem', workspace_premium: 'crown', emoji_events: 'trophy', military_tech: 'ranking', leaderboard: 'ranking',
    gps_fixed: 'target', my_location: 'target', center_focus_strong: 'focus', wb_sunny: 'sun', light_mode: 'sun', dark_mode: 'moon',
    bedtime: 'moon', ac_unit: 'snow', air: 'wind', water_drop: 'drop', waves: 'wave', thunderstorm: 'storm', dashboard: 'grid',
    apps: 'grid', grid_view: 'grid', view_sidebar: 'sidebar', drag_indicator: 'grip', dns: 'server', storage: 'database',
    memory: 'chip', sd_storage: 'drive', fiber_manual_record: 'record', radio_button_checked: 'record', live_tv: 'live',
    closed_caption: 'cc', subtitles: 'cc', monitor_weight: 'weight', fitness_center: 'weight', local_parking: 'parking',
    wc: 'restroom', security: 'shield', verified_user: 'shield', privacy_tip: 'shield', draw: 'signature', history_edu: 'scroll',
    receipt_long: 'scroll', toc: 'list', format_list_numbered: 'list-ordered', format_list_bulleted: 'list', notes: 'text',
    data_object: 'code', integration_instructions: 'code', call_split: 'branch', category: 'shapes', interests: 'shapes',
    menu_book: 'book-open', auto_stories: 'book-open', import_contacts: 'book-open', library_books: 'book', lightbulb: 'idea',
    tips_and_updates: 'idea', mic_none: 'mic', mic_off: 'mic-off', videocam_off: 'camera-off', cloud_off: 'cloud-off', link_off: 'link-off',
    lock_outline: 'lock', send: 'send', share: 'share', person_off: 'user-off', how_to_reg: 'user-check', manage_accounts: 'user-pen',
    playlist_add_check: 'steps', sort: 'sort', print: 'print', inbox: 'inbox', terminal: 'terminal', code: 'code', layers: 'layers',
    palette: 'palette', keyboard: 'keyboard', contrast: 'contrast', timeline: 'timeline', handshake: 'handshake', mail: 'mail',
});

// Their names for each of our glyphs, and the search words, built once.
const THEIRS = new Map();
for (const [from, map] of [['lucide', LUCIDE], ['material', MATERIAL]]) {
    for (const [name, g] of Object.entries(map)) {
        if (!THEIRS.has(g)) THEIRS.set(g, []);
        THEIRS.get(g).push(from === 'material' ? name.replace(/_/g, ' ') : name);
    }
}
function words(g) {
    const out = new Set(String(SYN[g] || '').split(/\s+/).filter(Boolean));
    for (const n of THEIRS.get(g) || []) out.add(n);
    return [...out];
}

const kebab = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Za-z])(\d)/g, '$1-$2').toLowerCase();
const snake = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/_(outlined|outline|rounded|sharp|two_?tone|filled)$/, '');

/** Our glyph for a name in any set, or null. "lucide:x", "material:settings", "fa-gear", "gear", or a bare other name. */
function resolve(raw) {
    const name = String(raw || '').trim();
    const m = /^(lucide|material|mui|fa):(.+)$/i.exec(name);
    if (m) {
        const set = m[1].toLowerCase(), n = m[2];
        if (set === 'lucide') { const k = kebab(n); return LUCIDE[k] || (has(k) ? k : null); }
        if (set === 'fa') return glyphs.fromFa(n);
        const s = snake(n); return MATERIAL[s] || (has(s.replace(/_/g, '-')) ? s.replace(/_/g, '-') : null);
    }
    const low = name.toLowerCase();
    if (has(low)) return low;
    return glyphs.fromFa(low) || LUCIDE[low] || MATERIAL[low.replace(/-/g, '_')] || null;
}

// Font Awesome's own utility classes: not icon names.
const FA_UTIL = /^(solid|regular|light|thin|duotone|brands|sharp|sharp-solid|fw|lg|sm|xs|xl|2xs|2xl|[1-9]x|10x|spin|spin-pulse|spin-reverse|pulse|beat|beat-fade|fade|bounce|flip|shake|border|pull-left|pull-right|pull-start|pull-end|li|ul|stack|stack-1x|stack-2x|inverse|rotate-\d+|rotate-by|flip-horizontal|flip-vertical|flip-both|layers|layers-text|layers-counter|layers-top-right|layers-bottom-left|swap-opacity|width-auto)$/;

/**
 * Every icon a page or a component asks for: Font Awesome classes, Lucide (data-lucide, the lucide-react/-vue/-svelte
 * imports, <ov-icon>-style names), Material (the ligature spans, <mat-icon>, @mui/icons-material imports). Counted,
 * each with our glyph or null. Text only: nothing is fetched or run.
 */
function scan(text) {
    const src = String(text || '').slice(0, 400000);
    const found = new Map();
    const add = (set, name, glyph) => {
        const key = `${set}:${name}`;
        const was = found.get(key);
        if (was) was.count++;
        else found.set(key, { set, name, count: 1, glyph: glyph || null, brand: set === 'fa-brands' && brands && brands.fromFa ? brands.fromFa(name) || null : null });
    };
    for (const m of src.matchAll(/class\s*=\s*["']([^"']*\bfa[srlbdt]?\b[^"']*|[^"']*\bfa-[a-z0-9-]+[^"']*)["']/gi)) {
        const classes = m[1].split(/\s+/);
        const brand = classes.includes('fa-brands') || classes.includes('fab');
        for (const c of classes) {
            const n = /^fa-([a-z0-9-]+)$/.exec(c);
            if (!n || FA_UTIL.test(n[1])) continue;
            add(brand ? 'fa-brands' : 'fa', n[1], brand ? null : glyphs.fromFa(n[1]));
        }
    }
    for (const m of src.matchAll(/data-lucide\s*=\s*["']([a-z0-9-]+)["']/gi)) add('lucide', m[1], resolve(`lucide:${m[1]}`));
    for (const m of src.matchAll(/import\s*\{([^}]{1,2000})\}\s*from\s*["'](?:lucide-react|lucide-vue-next|lucide-svelte|lucide-solid|lucide-preact|@lucide\/[a-z-]+)["']/g)) {
        for (const part of m[1].split(',')) {
            const n = part.trim().split(/\s+as\s+/)[0].replace(/Icon$/, '');
            if (/^[A-Z][A-Za-z0-9]*$/.test(n)) add('lucide', kebab(n), resolve(`lucide:${n}`));
        }
    }
    for (const m of src.matchAll(/<(?:span|i)[^>]*class\s*=\s*["'][^"']*material-(?:icons|symbols)[a-z-]*[^"']*["'][^>]*>\s*([a-z0-9_]{2,40})\s*</gi)) add('material', m[1], resolve(`material:${m[1]}`));
    for (const m of src.matchAll(/<mat-icon[^>]*>\s*([a-z0-9_]{2,40})\s*<\/mat-icon>/gi)) add('material', m[1], resolve(`material:${m[1]}`));
    for (const m of src.matchAll(/(?:import\s+([A-Z][A-Za-z0-9]*)\s+from\s*["']@mui\/icons-material\/([A-Za-z0-9]+)["'])|(?:import\s*\{([^}]{1,2000})\}\s*from\s*["']@mui\/icons-material["'])/g)) {
        const names = m[2] ? [m[2]] : m[3].split(',').map((p) => p.trim().split(/\s+as\s+/)[0]);
        for (const n of names) if (/^[A-Z][A-Za-z0-9]*$/.test(n)) add('material', snake(n), resolve(`material:${n}`));
    }
    const order = { fa: 0, lucide: 1, material: 2, 'fa-brands': 3 };
    return [...found.values()].sort((a, b) => (a.glyph || a.brand ? 0 : 1) - (b.glyph || b.brand ? 0 : 1) || order[a.set] - order[b.set] || b.count - a.count || (a.name < b.name ? -1 : 1));
}

/** Ranked: the exact glyph a name resolves to, then names that start with or hold the query, then any set's names and
 *  the words. Every word of a several-word query must match somewhere. */
function search(query, n = 24) {
    const q = String(query || '').trim().toLowerCase().slice(0, 100);
    if (!q) return glyphs.NAMES.slice(0, n);
    const exact = resolve(q);
    const terms = q.split(/\s+/).filter(Boolean);
    const scored = [];
    for (const g of glyphs.NAMES) {
        const fa = Object.entries(glyphs.FA).filter(([, x]) => x === g).map(([f]) => f);
        const hay = [g, ...fa, ...words(g)];
        if (!terms.every((t) => hay.some((h) => h.includes(t)))) continue;
        let score = g === exact ? 100 : g === q ? 90 : g.startsWith(q) ? 70 : g.includes(q) ? 60 : 0;
        if (!score) score = fa.some((f) => f === q) ? 50 : words(g).some((w) => w === q) ? 45 : fa.some((f) => f.includes(q)) ? 30 : 20;
        scored.push([g, score]);
    }
    if (exact && !scored.some(([g]) => g === exact)) scored.push([exact, 100]);
    return scored.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n).map(([g]) => g);
}

module.exports = { words, resolve, scan, search, LUCIDE, MATERIAL };
