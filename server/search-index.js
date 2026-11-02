'use strict';

/**
 * OpenVibe.Design's icon and theme pages in OpenVibe.Search (openvibe-publishing/search-feed, contracts 0.275.0): one
 * search.index-document@1 per icon (/icons/<name>, the glyph name as the id) and per public theme (/t/<slug>), sent as
 * design.index_document.upserted|deleted through this service's events outbox. Each document is what its page says:
 * an icon's name, the Font Awesome names it stands in for and the formats it downloads in; a theme's name, mode and
 * description. 280 icons and 50 themes were on no network search (2026-11-02).
 *
 * The icons are openvibe-shared's glyphs (they change with a Shared release, so with a deploy) and the themes are
 * OpenVibe.Network's public catalogue (catalog.list(), cached five minutes): a sweep a minute after boot and every six
 * hours. The sequencer (design_index_revisions) gives an unchanged page its old revision and a quiet sweep sends
 * nothing; a page that left the catalogue gets a tombstone. When Network does not answer the theme list, the sweep
 * stops rather than read an empty catalogue as "every theme is gone". Off under DESIGN_DRILL.
 */
const glyphs = require('openvibe-shared/glyphs');
const { createServiceOutbox } = require('openvibe-sdk/events');
const { createSearchFeed } = require('openvibe-publishing/search-feed');
const { faOf, title: glyphTitle } = require('./views/icon-page');

const EVENT_TYPES = ['design.index_document.upserted', 'design.index_document.deleted'];
const START_DELAY_MS = 60_000;
const INTERVAL_MS = 6 * 3_600_000;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,89}$/;
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** One glyph name → what its /icons/<name> page says. */
function describeIcon(row) {
    const name = row.id;
    const fa = faOf(name);
    const label = glyphTitle(name);
    const solid = Boolean(glyphs.SOLID && Object.prototype.hasOwnProperty.call(glyphs.SOLID, name));
    return {
        listed: true,
        title: `${label} icon`,
        summary: `A free ${label.toLowerCase()} icon: download the SVG, make a PNG at any size and colour, or use the font.${fa.length ? ` A drop-in for Font Awesome's fa-${fa[0]}.` : ''} MIT.`,
        body: [name, name.replace(/-/g, ' '), ...fa.map((f) => `fa-${f} ${f.replace(/-/g, ' ')}`),
            `SVG, PNG, web font, React, Android vector drawable.${solid ? ' Outline and solid.' : ''}`].join('\n'),
        facets: { kind: solid ? 'solid' : 'outline' },
        authorship: { mode: 'human' },
    };
}

/** One public theme from Network's catalogue → what its /t/<slug> page says. */
function describeTheme(t) {
    const name = String(t.name || t.slug);
    const mode = t.mode ? String(t.mode) : '';
    return {
        listed: true,
        title: `${name}: an OpenVibe theme`,
        summary: [t.description ? String(t.description) : '', `A ${mode ? `${mode} ` : ''}theme for every OpenVibe site.`].filter(Boolean).join(' '),
        body: [name, mode ? `${mode} theme` : 'theme', t.description || ''].filter(Boolean).join('\n'),
        facets: mode ? { mode } : {},
        authorship: { mode: 'human' },
        publishedAt: t.created_at || null,
        updatedAt: t.updated_at || null,
    };
}

function createSearchIndex({ config, s, catalog, log = console, outbox = null }) {
    const db = s.db;
    const out = outbox || createServiceOutbox({
        db, source: 'design', eventsUrl: (config.events && config.events.url) || null, networkInternalUrl: config.networkInternalUrl,
        clientId: config.oauth.clientId, clientSecret: config.oauth.clientSecret, log, eventTypes: EVENT_TYPES,
    });

    const icons = () => glyphs.NAMES.filter((n) => ID_RE.test(n)).map((n) => ({ id: n })).sort(byId);
    // Throws when Network does not answer: an empty answer must never tombstone every theme.
    async function themes() {
        const list = await catalog.list();
        return list.themes.filter((t) => t && ID_RE.test(String(t.slug || ''))).map((t) => ({ ...t, id: String(t.slug) })).sort(byId);
    }
    const after = (rows, id, limit) => rows.filter((r) => r.id > String(id || '')).slice(0, limit);
    const present = (rows, ids) => { const have = new Set(rows.map((r) => r.id)); return ids.filter((id) => have.has(id)); };

    const feed = createSearchFeed({
        owner: 'design', db, outbox: out, baseUrl: config.baseUrl, now: s.now, log,
        types: {
            icon: {
                page: (row) => `/icons/${row.id}`,
                document: describeIcon,
                rows: async (id, limit) => after(icons(), id, limit),
                exists: async (ids) => present(icons(), ids),
            },
            theme: {
                page: (row) => `/t/${encodeURIComponent(row.id)}`,
                document: describeTheme,
                rows: async (id, limit) => after(await themes(), id, limit),
                exists: async (ids) => present(await themes(), ids),
            },
        },
    });
    const timers = [];

    async function sweep() {
        const res = await feed.sweep();
        for (const [type, r] of Object.entries(res)) {
            if (r.sent || r.removed || r.failed) log.log(`[Search] ${type}: ${r.sent} sent, ${r.removed} removed, ${r.failed} failed of ${r.seen}`);
        }
        if (out.kick) out.kick().catch(() => {});
        return res;
    }
    const quietly = () => { sweep().catch((err) => log.warn(`[Search] sweep failed: ${(err && err.message) || err}`)); };

    function start() {
        if (config.drill || timers.length) return false;
        out.start();
        const kick = setTimeout(quietly, START_DELAY_MS);
        if (kick.unref) kick.unref();
        const tick = setInterval(quietly, INTERVAL_MS);
        if (tick.unref) tick.unref();
        timers.push(kick, tick);
        return true;
    }

    function stop() {
        for (const t of timers.splice(0)) { clearTimeout(t); clearInterval(t); }
        out.stop();
    }

    return { feed, outbox: out, sweep, start, stop, status: () => out.status() };
}

module.exports = { createSearchIndex, describeIcon, describeTheme, EVENT_TYPES };
