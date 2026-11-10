'use strict';
/**
 * The four doors (the owner, 2026-11-10): the bar is four links; /see, /make and /use list exactly their pages in
 * order, each card with its page's own glyph and a line from its own lede; every page in the map says "Door › Page"
 * above its h1; the home leads with the doors; the sitemap and llms.txt list the doors first.
 */
const assert = require('assert');
const glyphs = require('openvibe-shared/glyphs');
const { boot, check, done } = require('./helpers/boot');
const { NAV } = require('../server/render/layout');
const { DOORS, PAGES, pagesInDoors, countOf } = require('../server/site/doors');
const doorsView = require('../server/views/doors');

/** HTML to the words a reader sees: tags and scripts out, entities in, whitespace and case folded. */
function words(html) {
    return String(html)
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;|&rsquo;|&lsquo;|’|‘/g, "'")
        .replace(/&ldquo;|&rdquo;|“|”/g, '"').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
        .replace(/\s+/g, ' ').trim().toLowerCase();
}

const cardsIn = (html, marker) => {
    const start = html.indexOf(marker);
    if (start === -1) return [];
    const end = html.indexOf('</ul>', start);
    return [...html.slice(start, end).matchAll(/<a class="ds-sys" href="([^"]+)"[^>]*>[\s\S]*?<b>([^<]+)<\/b><\/span><small>([^<]*)<\/small>/g)]
        .map((m) => ({ href: m[1], name: m[2], line: m[3] }));
};

(async () => {
    const t = await boot();
    // One fetch per page across the checks: the app renders the whole catalogue on some of these.
    const seen = new Map();
    const get = (p) => { if (!seen.has(p)) seen.set(p, t.get(p)); return seen.get(p); };
    try {
        await check('a card is plain kit markup: a link, its glyph, its name and its line', async () => {
            const card = doorsView.pageCard(PAGES.look);
            assert.match(card, /^<li><a class="ds-sys" href="\/look">/);
            assert.match(card, /<b>Look<\/b>/);
            assert.ok(card.includes('One theme and one set of comfort settings'));
        });

        await check('the bar is the four doors, in order, and nothing under More', async () => {
            assert.deepStrictEqual(NAV.map((l) => l.href), ['/see', '/make', '/rules', '/use']);
            assert.deepStrictEqual(NAV.map((l) => l.label), ['See', 'Make', 'Rules', 'Use']);
            assert.ok(NAV.every((l) => !l.more), 'no More menu');
            const home = await get('/');
            const json = home.text.match(/window\.__OV_PAGE = (\{[\s\S]*?\});/);
            assert.ok(json, 'the page carries its navbar config');
            const page = JSON.parse(json[1]);
            assert.deepStrictEqual(page.navbar.links.map((l) => l.href), ['/see', '/make', '/rules', '/use'], 'four links in the bar');
            assert.deepStrictEqual(page.navbar.appBar.map((l) => l.href), ['/see', '/make', '/rules', '/use'], 'the phone bar too');
        });

        await check('each door page has its h1, its one line, its count and exactly its pages as cards in order', async () => {
            for (const door of DOORS) {
                if (door.id === 'rules') continue; // the register is its own page, with /system as its second (below)
                const r = await get(door.href);
                assert.strictEqual(r.status, 200, door.href);
                assert.match(r.text, new RegExp(`<h1>${door.name}</h1>`), `${door.href} h1`);
                assert.ok(r.text.includes(door.line), `${door.href} says what is behind it`);
                assert.match(r.text, new RegExp(`data-door-count>${countOf(door.pages.length)}<`), `${door.href} counts its pages`);
                const cards = cardsIn(r.text, 'data-door-pages');
                assert.deepStrictEqual(cards.map((c) => c.href), door.pages.map((id) => PAGES[id].href), `${door.href} page order`);
                assert.strictEqual(cards.length, door.pages.length, `${door.href} lists exactly its pages`);
            }
        });

        await check('each card uses its page\'s own glyph and a line from that page\'s own lede', async () => {
            for (const page of pagesInDoors()) {
                // The line is held against the page it came from: when the page's copy changes, this fails instead of
                // the card drifting. (Create has no lede; its h1 is the line.)
                const source = await get(page.href);
                assert.strictEqual(source.status, 200, page.href);
                assert.ok(words(source.text).includes(words(page.line)), `${page.href} still says "${page.line}"`);
            }
            for (const door of DOORS.filter((d) => d.id !== 'rules')) {
                const r = await get(door.href);
                for (const id of door.pages) {
                    assert.ok(r.text.includes(glyphs.svg(PAGES[id].icon, { size: 22 })), `${door.href}: ${PAGES[id].name}'s own glyph`);
                }
            }
        });

        await check('every page in the map says where it sits, above its h1, and the door links to its page', async () => {
            for (const page of pagesInDoors()) {
                const r = await get(page.href);
                const at = r.text.indexOf('<nav class="ds-crumbs"');
                const h1 = r.text.indexOf('<h1');
                assert.ok(at !== -1 && at < h1, `${page.href}: breadcrumb above the h1`);
                const crumb = r.text.slice(at, r.text.indexOf('</nav>', at));
                assert.ok(crumb.includes(`<a href="${page.door.href}">${page.door.name}</a>`), `${page.href}: the door links to ${page.door.href}`);
                assert.ok(crumb.includes(`aria-current="page">${page.name}<`), `${page.href}: names ${page.name}`);
            }
        });

        await check('Rules is the register, with the system map as its second page', async () => {
            const r = await get('/rules');
            assert.strictEqual(r.status, 200);
            assert.match(r.text, /aria-current="page">The register</, 'the register is the door\'s first page');
            assert.match(r.text, /class="rl-chip" href="\/system">The system map</, 'the system map is its second page');
            const sys = await get('/system');
            assert.match(sys.text, /<a href="\/rules">Rules<\/a>[\s\S]*?aria-current="page">System</, 'System sits under Rules');
        });

        await check('the home leads with the four doors and keeps everything below them', async () => {
            const home = await get('/');
            const cards = cardsIn(home.text, 'data-home-doors');
            assert.deepStrictEqual(cards.map((c) => c.href), DOORS.map((d) => d.href), 'the four doors, in order');
            assert.ok(home.text.indexOf('data-home-doors') < home.text.indexOf('sc-room'), 'above what the home showed before');
            assert.ok(home.text.includes('Your look, everywhere'), 'the hero is still there');
            assert.ok(home.text.includes('ds-system-grid'), 'the whole system is still there');
        });

        await check('the Use door covers the SDK, its files and the versions this site pins', async () => {
            const r = await get('/developers');
            assert.match(r.text, /id="sdk">[\s\S]*?The SDK, the files and the versions/, 'the SDK section');
            for (const name of ['openvibe-sdk', 'openvibe-contracts', 'openvibe-shared']) {
                assert.ok(r.text.includes(`${name}</code></dt><dd>v`), `${name}'s pinned version`);
            }
            assert.match(r.text, /codeload\.github\.com\/OpenVibers\/OpenVibe\.SDK\/tar\.gz\/refs\/tags\/v[0-9]/, 'the SDK pin');
            assert.match(r.text, /href="\/release\.json"/, 'the files and versions this release serves');
        });

        await check('a page that was not in the map sits under the page it extends', async () => {
            const expected = [
                ['/t/aurora', 'Make', '/make', 'Themes'],
                ['/components/registry', 'See', '/see', 'Components'],
                ['/patterns/tabs-not-folds', 'See', '/see', 'Patterns'],
                ['/fonts/make', 'Make', '/make', 'Fonts'],
                ['/vectors/make', 'Make', '/make', 'Create'],
                ['/arena/new', 'Make', '/make', 'Arena'],
            ];
            for (const [path, door, href, page] of expected) {
                const r = await get(path);
                assert.strictEqual(r.status, 200, path);
                const at = r.text.indexOf('<nav class="ds-crumbs"');
                assert.ok(at !== -1 && at < r.text.indexOf('<h1'), `${path}: a breadcrumb above the h1`);
                const crumb = r.text.slice(at, r.text.indexOf('</nav>', at));
                assert.ok(crumb.includes(`<a href="${href}">${door}</a>`) && crumb.includes(`aria-current="page">${page}<`), `${path}: ${door} › ${page}`);
            }
        });

        await check('the sitemap and llms.txt list the doors first', async () => {
            const map = await t.get('/sitemap.xml');
            const locs = [...map.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
            assert.deepStrictEqual(locs.slice(0, 4), ['https://openvibe.design/see', 'https://openvibe.design/make', 'https://openvibe.design/rules', 'https://openvibe.design/use']);
            const llms = await t.get('/llms.txt');
            const text = llms.text;
            assert.ok(text.indexOf('## The four doors') !== -1, 'the doors are a section');
            assert.ok(text.indexOf('## The four doors') < text.indexOf('## Start here'), 'the doors come first');
            for (const door of DOORS) assert.ok(text.includes(`https://openvibe.design${door.href}`), `llms lists ${door.href}`);
        });
    } finally {
        await t.close();
    }
    done();
})().catch((error) => { console.error(error); process.exitCode = 1; });
