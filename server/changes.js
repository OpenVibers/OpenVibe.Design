'use strict';

/**
 * OpenVibe.Shared's changelog, read from the package this site pins (never a request to GitHub at page time), and the
 * component pages and rules each release names. One module so /changes, its JSON and scripts/capture-release.js agree
 * about what a release touches.
 *
 *   releases()                 every release in the pinned CHANGELOG, newest first
 *   releaseOf(version)         one release, or null
 *   pinned()                   { version, changelog }
 *   screenshots(version)       the webp plates under public/changes/<version>/, grouped by component
 *   markdown(text)             the small, escaped markdown the CHANGELOG uses (paragraphs, lists, bold, code, links)
 *
 * The release entries are rendered as written. The only additions are links: the component page a release touches and
 * the rule numbers in the register it carries out. Those links are curated for the newest releases (RELEASES) and
 * found by keyword for the older ones; a page link is never invented for a component that has no page here.
 */
const fs = require('fs');
const path = require('path');
const { PUBLIC_DIR } = require('./assets');
const { RULES } = require('./rules/register');
const tokens = require('openvibe-shared/tokens');
const { BUILTIN_THEMES } = require('openvibe-shared/builtin-themes');

const SHARED_DIR = path.dirname(require.resolve('openvibe-shared/package.json'));
const SHARED_VERSION = require('openvibe-shared/package.json').version;
const CHANGELOG = path.join(SHARED_DIR, 'CHANGELOG.md');
const CHANGES_DIR = path.join(PUBLIC_DIR, 'changes');

// A page this site already renders, or a note page added with the component. The href is what a release links to.
const PAGES = Object.freeze({
    brand: { title: 'The bar’s brand', href: '/components/brand' },
    navbar: { title: 'The navbar', href: '/components/navbar' },
    menu: { title: 'The menu', href: '/components/menu' },
    'you-home': { title: 'You home', href: '/components/you-home' },
    'search-pill': { title: 'The search pill', href: '/components/search-pill' },
    dock: { title: 'The Dock', href: '/components/dock' },
    'quest-card': { title: 'The quest card', href: '/components/quest-card' },
    avatar: { title: 'The avatar', href: '/components/avatar' },
    player: { title: 'The player', href: '/components/player' },
    footer: { title: 'The footer', href: '/components/footer' },
    'soft-pages': { title: 'Soft pages', href: '/components/soft-pages' },
    'icon-ink': { title: 'Icon ink', href: '/components/icon-ink' },
    themes: { title: 'Themes', href: '/themes' },
    motion: { title: 'Motion', href: '/motion' },
    icons: { title: 'Icons', href: '/icons' },
    kit: { title: 'The kit', href: '/kit' },
    forms: { title: 'Forms', href: '/forms' },
    loading: { title: 'Loading', href: '/loading' },
    rules: { title: 'Rules', href: '/rules' },
    system: { title: 'The system map', href: '/system' },
    brandpage: { title: 'The mark', href: '/brand' },
    tokens: { title: 'Tokens', href: '/tokens' },
});

// What the newest releases touch, read from their entries (the release headings are the source; this is only links).
const RELEASES = Object.freeze({
    '4.200.0': {
        components: ['brand', 'menu', 'search-pill', 'dock'],
        rules: ['button-becomes-its-tab', 'places-say-what-they-hold', 'actions-as-icons-in-the-pill', 'every-site-from-the-name', 'menu-opens-here'],
    },
    '4.199.0': { components: ['avatar', 'soft-pages'], rules: ['content-hashed-assets'] },
    '4.198.0': { components: ['menu', 'dock'], rules: ['opens-it-closes-it', 'places-say-what-they-hold'] },
    '4.197.0': { components: ['footer'], rules: ['say-it-once'] },
    '4.196.0': { components: ['dock', 'kit'], rules: ['state-in-words', 'one-question', 'calm-reduces-off-removes'] },
    '4.195.0': { components: ['menu', 'you-home'], rules: ['opens-it-closes-it', 'account-in-the-menu', 'menu-opens-here'] },
    '4.194.0': { components: ['menu', 'search-pill', 'avatar'], rules: ['places-say-what-they-hold', 'one-pill-for-balances', 'account-in-the-menu'] },
    '4.193.0': { components: ['menu', 'navbar', 'avatar'], rules: ['menu-button-at-the-right', 'one-menu-button', 'account-in-the-menu', 'calm-reduces-off-removes'] },
    '4.192.0': { components: ['player'], rules: ['the-video-comes-along', 'no-spinners'] },
    '4.191.0': { components: ['navbar', 'footer'], rules: ['one-bar'] },
    '4.190.0': { components: ['brand', 'menu', 'footer', 'icon-ink'], rules: ['the-name-opens-its-pages', 'every-site-from-the-name', 'one-list-of-sites', 'a-change-has-a-mark'] },
    '4.189.0': { components: ['menu', 'dock'], rules: ['one-pill-for-balances', 'menu-opens-here', 'menu-and-dock-meet'] },
    '4.188.0': { components: ['menu', 'you-home', 'avatar'], rules: ['account-in-the-menu', 'only-the-pair'] },
    '4.187.0': { components: ['menu', 'navbar', 'brand'], rules: ['one-menu-button', 'the-pair', 'two-badges-two-meanings'] },
    '4.186.0': { components: ['motion', 'brandpage', 'dock'], rules: ['no-spinners', 'opens-it-closes-it'] },
    '4.185.0': { components: ['you-home', 'dock'], rules: ['opens-it-closes-it', 'menu-and-dock-meet'] },
    '4.184.0': { components: ['navbar'], rules: ['one-bar'] },
    '4.183.0': { components: ['motion', 'icons'], rules: ['calm-reduces-off-removes', 'effects-by-device-not-screen', 'two-icon-sets'] },
    '4.181.0': { components: ['dock'], rules: ['first-paint-alone'] },
    '4.180.0': { components: ['motion'], rules: ['calm-reduces-off-removes'] },
});

// Older releases: find the pages a reader would want from the words the entry already uses. First match wins order.
const KEYWORDS = [
    ['quest-card', /\bquest card|\bquests?\b/i],
    ['player', /\b(player|mini\.js|the video|video player)\b/i],
    ['avatar', /\bavatar|\bthe picture\b/i],
    ['brand', /\bbrand\b|\blogo\b|\bthe mark and the name\b/i],
    ['search-pill', /\bsearch pill|\bsearch box|\bsearch field\b/i],
    ['menu', /\bthe menu\b|\bmenu\b/i],
    ['dock', /\bthe dock\b|\bdock\b/i],
    ['you-home', /\bYou tab\b|\bYou home\b/i],
    ['footer', /\bfooter\b/i],
    ['navbar', /\bnavbar\b|\bthe bar\b/i],
    ['soft-pages', /\bprefetch\b|\bview transition|\bsoft\.js\b|\bpage move\b/i],
    ['icon-ink', /\bicon ink\b|\bapp icon\b|\bfavicon\b/i],
    ['icons', /\bicons?\b|\bglyphs?\b/i],
    ['motion', /\bmotion\b|\bcalm\b|\breduced motion\b/i],
    ['themes', /\btheme\b|\blook\b/i],
    ['kit', /\bkit\b|\bcomposer\b|\bsheet\b/i],
    ['forms', /\bform controls?\b|\bfields?\b/i],
    ['loading', /\bskeleton\b|\bspinner\b|\bloading\b/i],
    ['rules', /\brules?\b/i],
];

const RULE_KEYWORDS = [
    ['no-spinners', /\bspinner|\bspun\b/i],
    ['the-video-comes-along', /\bvideo comes along|\bsmall player\b|\bmini player\b/i],
    ['player-row-never-runs-off', /\bplayer'?s? controls?\b|\bone row\b/i],
    ['places-say-what-they-hold', /\bplaces\b|\bVibe\b|\bChat\b/i],
    ['button-becomes-its-tab', /\bflies? to its tab\b|\bbecomes its tab\b/i],
    ['actions-as-icons-in-the-pill', /\bicon buttons?\b|\bsearch pill\b/i],
    ['every-site-from-the-name', /\ball OpenVibe sites\b|\bevery site\b/i],
    ['the-name-opens-its-pages', /\bsite'?s name\b|\bthe name\b/i],
    ['menu-opens-here', /\bmenu opens\b|\bthis site'?s tab\b/i],
    ['menu-and-dock-meet', /\bmenu and the Dock\b|\bDock'?s head\b/i],
    ['one-menu-button', /\bone menu\b|\bmenu button\b/i],
    ['account-in-the-menu', /\baccount\b|\bYou tab\b|\bdropdown\b/i],
    ['one-pill-for-balances', /\bbalances?\b|\bwallet\b|\bpill\b/i],
    ['calm-reduces-off-removes', /\bcalm\b|\breduced motion\b|\bmotion off\b/i],
    ['effects-by-device-not-screen', /\bphone.*motion\b|\blite\b/i],
    ['a-change-has-a-mark', /\bNew, Improved or Fixed\b|\bBetter\b/i],
    ['two-icon-sets', /\btwo sets\b|\bglyph names?\b/i],
    ['only-the-pair', /\bthe Pair\b|\bold logo\b|\bmark\b/i],
    ['one-bar', /\bone bar\b|\bnavbar\b|\bempty band\b/i],
    ['content-hashed-assets', /\bcontent hash|\?v=|\bimmutable\b|\bminified\b/i],
    ['first-paint-alone', /\bfirst paint\b|\brelay\b/i],
    ['one-question', /\bone concrete question\b/i],
    ['state-in-words', /\bstatus\b|\bstate\b/i],
    ['say-it-once', /\bone tooltip\b|\bsays it once\b|\bone pill\b/i],
    ['opens-it-closes-it', /\bclose button\b|\bfolds? back\b|\bopens out\b/i],
    ['one-list-of-sites', /\bone list of sites\b|\beight groups\b/i],
    ['two-badges-two-meanings', /\bcount\b.*\bdot\b|\bbadge\b/i],
    ['the-pair', /\bthe Pair\b|\bmark\b/i],
];

const RULE_BY_ID = new Map(RULES.map((r) => [r.id, r]));
// Rule numbers: the register's order is the number a person can cite ("rule 7"). Stable because rules are appended.
const numberOf = (id) => (RULE_BY_ID.get(id) || {}).n || null;

let cached = null;

/** The package this site pins, and the changelog file read from it. */
function pinned() {
    return { version: SHARED_VERSION, changelog: 'CHANGELOG.md' };
}

/** Escape text for HTML. */
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** The changelog's small markdown: paragraphs, lists (nested one level), bold, code, links. Every value is escaped. */
function markdown(text) {
    const safeLink = (href) => (/^https?:\/\//.test(href) || /^\/(?!\/)/.test(href) ? href : null);
    const inline = (s) => esc(s)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
            const url = safeLink(href);
            return url ? `<a href="${esc(url)}"${/^https?:/.test(url) ? ' rel="noopener"' : ''}>${label}</a>` : label;
        })
        .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, pre, url) => `${pre}<a href="${esc(url)}" rel="noopener">${esc(url)}</a>`);
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let para = [];
    let list = null; // { level, items: [] }
    const flushPara = () => {
        if (!para.length) return;
        out.push(`<p>${inline(para.join(' ').trim())}</p>`);
        para = [];
    };
    const flushList = () => {
        if (!list) return;
        // One level of nesting: the nested items sit in their own <ul> inside the parent <li>.
        const html = list.items.map((item) => (item.children.length
            ? `<li>${inline(item.text)}${item.children.length ? `<ul>${item.children.map((c) => `<li>${inline(c)}</li>`).join('')}</ul>` : ''}</li>`
            : `<li>${inline(item.text)}</li>`)).join('');
        out.push(`<ul>${html}</ul>`);
        list = null;
    };
    for (const raw of lines) {
        const line = raw.replace(/\s+$/, '');
        if (!line.trim()) { flushPara(); flushList(); continue; }
        const heading = line.match(/^(#{3,4})\s+(.*)$/);
        if (heading) {
            flushPara(); flushList();
            const level = heading[1].length;
            out.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
            continue;
        }
        const item = line.match(/^(\s*)-\s+(.*)$/);
        if (item) {
            flushPara();
            const indent = item[1].length;
            if (!list) list = { level: indent, items: [] };
            else if (indent > list.level && list.items.length) {
                const parent = list.items[list.items.length - 1];
                parent.children.push(item[2].trim());
                continue;
            }
            list.items.push({ text: item[2].trim(), children: [] });
            continue;
        }
        if (list) {
            // A wrapped list item: the changelog indents its continuation by two spaces.
            const last = list.items[list.items.length - 1];
            if (raw.startsWith('  ') && last) {
                if (last.children.length) last.children[last.children.length - 1] += ` ${line.trim()}`;
                else last.text += ` ${line.trim()}`;
                continue;
            }
            flushList();
        }
        para.push(line.trim());
    }
    flushPara();
    flushList();
    return out.join('\n');
}

/** The first bold sentence of an entry, or its first sentence: the release's own title. */
function titleOf(body) {
    const bold = body.match(/\*\*([\s\S]+?)\*\*/);
    if (bold) return bold[1].replace(/\s+/g, ' ').trim();
    const first = body.replace(/^[-*\s]+/, '').split(/(?<=[.!?])\s/)[0];
    return first ? first.trim() : '';
}

function parse(md) {
    const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
    const releases = [];
    let current = null;
    const heading = /^##\s+(\d+\.\d+\.\d+)\s*(?:—|-)\s*(\d{4}-\d{2}-\d{2})\s*$/;
    for (const line of lines) {
        const m = line.match(heading);
        if (m) {
            if (current) releases.push(current);
            current = { version: m[1], date: m[2], body: [] };
            continue;
        }
        if (current) current.body.push(line);
    }
    if (current) releases.push(current);
    // A version written twice in the changelog is one release: keep its first place and all of its words.
    const byVersion = new Map();
    const unique = [];
    for (const r of releases) {
        if (byVersion.has(r.version)) byVersion.get(r.version).body.push('', ...r.body);
        else { byVersion.set(r.version, r); unique.push(r); }
    }
    for (const r of unique) {
        r.body = r.body.join('\n').trim();
        r.title = titleOf(r.body);
    }
    return unique;
}

function read() {
    if (cached) return cached;
    let md = '';
    try { md = fs.readFileSync(CHANGELOG, 'utf8'); } catch { md = '# Changelog\n'; }
    cached = parse(md);
    return cached;
}

function releases() {
    return read();
}

function releaseOf(version) {
    const key = String(version || '').replace(/^v/, '');
    return read().find((r) => r.version === key) || null;
}

function componentsOf(release) {
    const meta = RELEASES[release.version];
    if (meta) return meta.components.filter((k) => PAGES[k]).map((k) => ({ key: k, ...PAGES[k] }));
    const text = `${release.title} ${release.body}`;
    const found = [];
    for (const [key, re] of KEYWORDS) {
        if (found.length >= 4) break;
        if (re.test(text) && PAGES[key] && !found.some((f) => f.key === key)) found.push({ key, ...PAGES[key] });
    }
    return found;
}

function rulesOf(release) {
    const meta = RELEASES[release.version];
    const ids = meta ? meta.rules : [];
    if (!meta) {
        const text = `${release.title} ${release.body}`;
        for (const [id, re] of RULE_KEYWORDS) {
            if (ids.length >= 3) break;
            if (re.test(text) && RULE_BY_ID.has(id) && !ids.includes(id)) ids.push(id);
        }
    }
    return ids.map((id) => ({ id, n: numberOf(id), rule: RULE_BY_ID.get(id).rule, href: `/rules#${id}` }));
}

/** The screenshots a release has in the repo: public/changes/<version>/<component>-<width>-<scheme>.webp. */
function screenshots(version) {
    const key = String(version || '').replace(/^v/, '');
    const dir = path.join(CHANGES_DIR, key);
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => /^[a-z0-9-]+-(390|1280)-(dark|light)\.webp$/.test(f)); } catch { return []; }
    const groups = new Map();
    for (const file of files.sort()) {
        const m = file.match(/^([a-z0-9-]+)-(390|1280)-(dark|light)\.webp$/);
        if (!m) continue;
        const [, component, width, scheme] = m;
        if (!groups.has(component)) groups.set(component, { component, title: (PAGES[component] || {}).title || component, files: [] });
        groups.get(component).files.push({ width: Number(width), scheme, href: `/changes/${key}/${file}`, file });
    }
    const order = ['dark', 'light'];
    for (const g of groups.values()) g.files.sort((a, b) => a.width - b.width || order.indexOf(a.scheme) - order.indexOf(b.scheme));
    return [...groups.values()].sort((a, b) => Object.keys(PAGES).indexOf(a.component) - Object.keys(PAGES).indexOf(b.component));
}

/** The whole archive as data, for /api/v1/changes and the tests. */
function archive() {
    const all = releases();
    return {
        schema: 'openvibe.changes@1',
        pinned: pinned(),
        releases: all.map((r) => ({
            version: r.version,
            date: r.date,
            title: r.title,
            body: r.body,
            components: componentsOf(r),
            rules: rulesOf(r),
            screenshots: screenshots(r.version),
        })),
    };
}

/** The tokens of a built-in theme as CSS, with !important: what the capture script injects for a light or dark plate. */
function schemeCss(mode) {
    const light = mode === 'light';
    const theme = BUILTIN_THEMES.find((t) => t.slug === (light ? 'daylight' : 'vibe')) || BUILTIN_THEMES[0];
    const doc = tokens.fromTheme(theme);
    const css = tokens.compile(doc, 'css') || '';
    return css
        .replace(/(--[a-zA-Z0-9-]+:[^;]+);/g, '$1 !important;')
        .replace(/color-scheme:\s*(light|dark);/g, 'color-scheme: $1 !important;');
}

module.exports = { releases, releaseOf, pinned, componentsOf, rulesOf, screenshots, archive, markdown, titleOf, schemeCss, PAGES, RELEASES, SHARED_VERSION };
