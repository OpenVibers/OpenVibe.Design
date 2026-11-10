'use strict';
/**
 * The four doors are the whole bar (the owner, 2026-11-10: "There's so many … pages … it needs to be a more cohesive,
 * interconnected product that's more straightforward to use and … consolidated"). This is the one map of where every
 * page sits: the doors in order, their pages in order, each page's icon and the one line it shows on its door.
 *
 * The line is an excerpt of the page's own lede (its h1 where a page has no lede), so a card never invents copy.
 * test/doors.test.js holds every line against the page it came from: when a page's lede changes, that test fails
 * instead of the card drifting.
 *
 * The doors are the bar. A door's own page is at its href (/see, /make, /use); /rules is the register itself, with
 * /system as its second page. Old addresses keep working: `breadcrumbOf` also places the pages that were not in the
 * map (a theme page under Themes, a component page under Components) under the door they belong to.
 */

/** A page's one line: its lede's first clause, or its h1 when it has no lede. */
const PAGES = {
    look: { name: 'Look', href: '/look', icon: 'eye', line: 'One theme and one set of comfort settings for every OpenVibe site' },
    tokens: { name: 'Tokens', href: '/tokens', icon: 'code', line: 'Take any OpenVibe theme into your own app, its light and dark halves together' },
    brand: { name: 'Brand', href: '/brand', icon: 'star', line: 'The O is the network, open to everyone; the V is the vibe in it' },
    components: { name: 'Components', href: '/components', icon: 'puzzle', line: 'from the shared kit, each with its props, states, tokens, behaviour, accessibility and how it is built on the web, Android and iOS' },
    kit: { name: 'Kit', href: '/kit', icon: 'cubes', line: 'each one function call that returns plain HTML: escaped, phone first, on the site’s own theme' },
    forms: { name: 'Forms', href: '/forms', icon: 'list', line: 'Every select is OpenVibe’s own: a menu on a computer, a sheet from the bottom on a phone' },
    patterns: { name: 'Patterns', href: '/patterns', icon: 'table', line: 'Each pattern pairs a live demo with its rule, the bug that taught it, shared tokens, and generated native examples' },
    motion: { name: 'Motion', href: '/motion', icon: 'wind', line: 'The mark draws its ring, drops its V in on a spring and catches the light once' },
    loading: { name: 'Loading', href: '/loading', icon: 'hourglass', line: 'How OpenVibe waits: the page arrives drawn, a list shows its own shape until it fills in' },
    progress: { name: 'Progress', href: '/progress', icon: 'gauge', line: 'One ov-progress follows a file from selection through transfer and processing' },
    native: { name: 'Native', href: '/native', icon: 'phone', line: 'An OpenVibe app is never a web page in a frame' },
    create: { name: 'Create', href: '/create', icon: 'spark', line: 'What will you design?' },
    themes: { name: 'Themes', href: '/themes', icon: 'palette', line: 'Pick a theme, change any colour, and see it on three sites at once' },
    icons: { name: 'Icons', href: '/icons', icon: 'shapes', line: 'icons in the mark’s own line: a 24-unit grid, strokes two units wide with round ends, in the colour of the text around them' },
    fonts: { name: 'Fonts', href: '/fonts', icon: 'book', line: 'Open licence typefaces with their source and licence beside them' },
    uploader: { name: 'Uploader', href: '/uploader', icon: 'upload', line: 'The picker opens the system chooser on a phone and accepts a drop on a computer' },
    prompts: { name: 'Prompts', href: '/prompts', icon: 'quote', line: 'Every instruction openvibe.design sends to an AI model, word for word' },
    arena: { name: 'Arena', href: '/arena', icon: 'crown', line: 'Two designs from the same brief, the models hidden' },
    rules: { name: 'The register', href: '/rules', icon: 'scale', line: 'Every style, design and organization decision behind OpenVibe, one sentence each' },
    system: { name: 'System', href: '/system', icon: 'layers', line: 'Everything OpenVibe is made of' },
    developers: { name: 'Developers', href: '/developers', icon: 'terminal', line: 'The theme catalog is open JSON' },
};

const DOORS = [
    {
        id: 'see', name: 'See', href: '/see', icon: 'eye', line: 'How OpenVibe looks and moves.',
        pages: ['look', 'tokens', 'brand', 'components', 'kit', 'forms', 'patterns', 'motion', 'loading', 'progress', 'native'],
    },
    {
        id: 'make', name: 'Make', href: '/make', icon: 'spark', line: 'What you make with it.',
        pages: ['create', 'themes', 'icons', 'fonts', 'uploader', 'prompts', 'arena'],
    },
    {
        id: 'rules', name: 'Rules', href: '/rules', icon: 'scale', line: 'The register, and the system map of everything OpenVibe is made of.',
        pages: ['rules', 'system'],
    },
    {
        id: 'use', name: 'Use', href: '/use', icon: 'terminal', line: 'Building with it.',
        pages: ['developers'],
    },
];

const doorById = (id) => DOORS.find((d) => d.id === id) || null;
const pageOf = (id) => PAGES[id] || null;

/** Every page in the map, with its door, in door order. */
function pagesInDoors() {
    return DOORS.flatMap((door) => door.pages.map((id) => ({ ...PAGES[id], door })));
}

/** The four doors' own addresses: the bar's places, and the only pages that are a door rather than under one. */
const DOOR_ROOTS = new Set(DOORS.map((d) => d.href));

/**
 * Pages that are not in the map, under the page they extend. Their old addresses are untouched; this only says which
 * door their breadcrumb leads back to.
 */
const EXTRA = [
    [/^\/brand\/explore$/, 'see', 'Brand'],
    [/^\/components\/registry$/, 'see', 'Components'],
    [/^\/components\/[^/]+$/, 'see', 'Components'],
    [/^\/kit\/(?:layout|[^/]+)$/, 'see', 'Kit'],
    [/^\/patterns\/(?!mark\/studies$)[^/]+$/, 'see', 'Patterns'],
    [/^\/icons\/(?:font-awesome-alternative|migrate|kit)$/, 'make', 'Icons'],
    [/^\/icons\/[^/.]+$/, 'make', 'Icons'],
    [/^\/fonts\/make$/, 'make', 'Fonts'],
    [/^\/fonts\/[^/]+$/, 'make', 'Fonts'],
    [/^\/vectors\/make$/, 'make', 'Create'],
    [/^\/arena\/(?:new|r\/[^/]+)$/, 'make', 'Arena'],
    [/^\/t\/[^/]+$/, 'make', 'Themes'],
    [/^\/d\/[^/]+$/, 'make', 'Create'],
];

/**
 * Where a path sits: { door, name } for a breadcrumb, or null for the home, the 404 and machine endpoints. A door's
 * own page has no crumb (it is the door).
 */
function breadcrumbOf(path) {
    const p = String(path || '').split('?')[0].replace(/\/+$/, '') || '/';
    // /rules is the register itself: the door's first page, so it says where it sits like every other map page.
    if (DOOR_ROOTS.has(p) && p !== '/rules') return null;
    const page = pagesInDoors().find((x) => x.href === p);
    if (page) return { door: page.door, name: page.name };
    for (const [re, doorId, name] of EXTRA) {
        if (re.test(p)) return { door: doorById(doorId), name };
    }
    return null;
}

/** The bar's active place for a path: the door it sits under. */
function doorHrefOf(path) {
    const crumb = breadcrumbOf(path);
    if (crumb) return crumb.door.href;
    const p = String(path || '').split('?')[0].replace(/\/+$/, '') || '/';
    return DOOR_ROOTS.has(p) ? p : null;
}

/** "11 pages", "1 page". */
const countOf = (n) => `${n} ${n === 1 ? 'page' : 'pages'}`;

/** A card's line starts a sentence even when its excerpt starts mid-sentence ("from the shared kit…"). */
const sentence = (line) => String(line || '').charAt(0).toUpperCase() + String(line || '').slice(1);

module.exports = { PAGES, DOORS, EXTRA, doorById, pageOf, pagesInDoors, breadcrumbOf, doorHrefOf, countOf, sentence, DOOR_ROOTS };
