'use strict';
/**
 * /changes: every openvibe-shared release this site pins, newest first, its changelog entry as written, the component
 * pages it touches, the rule numbers it carries out, and the screenshots the repo holds for it. The page never calls
 * the network: the release text comes from node_modules/openvibe-shared/CHANGELOG.md (server/changes.js).
 *
 *   changesPage()   the page
 *   changesJson()   the same archive as data (/api/v1/changes)
 */
const kit = require('openvibe-shared/kit');
const { layout, esc, canonical } = require('../render/layout');
const { releases, markdown, componentsOf, rulesOf, screenshots, pinned } = require('../changes');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso) => {
    const [y, m, d] = String(iso || '').split('-').map(Number);
    return y ? `${d} ${MONTHS[m - 1]} ${y}` : '';
};
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function linkChips(links, cls = '') {
    return links.map((l) => `<a class="chg-chip${cls}" href="${esc(l.href)}">${esc(l.label)}</a>`).join('');
}

function shotFigure(group, version) {
    const first = group.files.find((f) => f.width === 390 && f.scheme === 'dark') || group.files[0];
    return `<figure class="chg-shot">
  <a href="${esc(first.href)}"><img src="${esc(first.href)}" alt="${esc(`${group.title} at ${first.width} px, ${first.scheme}`)}" width="390" height="auto" loading="lazy" decoding="async"></a>
  <figcaption><b>${esc(group.title)}</b><span>${group.files.map((f) => `<a href="${esc(f.href)}">${f.width} · ${f.scheme}</a>`).join('')}</span></figcaption>
</figure>`;
}

function releaseCard(r) {
    const components = componentsOf(r);
    const rules = rulesOf(r);
    const shots = screenshots(r.version);
    return `<article class="chg-release" id="v${esc(r.version)}" data-release="${esc(r.version)}">
  <header class="chg-head">
    <div><h2><a href="#v${esc(r.version)}">${esc(r.version)}</a></h2><time datetime="${esc(r.date)}">${esc(day(r.date))}</time></div>
  </header>
  <div class="chg-entry">${markdown(r.body)}</div>
  ${components.length ? `<p class="chg-refs"><span class="chg-label">Pages</span>${linkChips(components.map((c) => ({ href: c.href, label: c.title })))}</p>` : ''}
  ${rules.length ? `<p class="chg-refs"><span class="chg-label">Rules</span>${rules.map((x) => `<a class="chg-chip chg-chip--rule" href="${esc(x.href)}" title="${esc(x.rule)}"><b>${esc(String(x.n))}</b> ${esc(x.rule)}</a>`).join('')}</p>` : ''}
  ${shots.length ? `<div class="chg-shots" data-shots="${shots.length}"><p class="chg-label">Screenshots in the repo</p><div class="chg-shot-row">${shots.map((g) => shotFigure(g, r.version)).join('')}</div></div>` : ''}
</article>`;
}

function releaseRow(r) {
    const hasShots = screenshots(r.version).length > 0;
    // Lean on purpose (328 rows): the fold's styles read the parts by element, so no class or attribute per row.
    return `<a href="/changes/${esc(r.version)}"><b>${esc(r.version)}</b><span>${esc(r.title)}</span><small>${esc(r.date)}</small>${hasShots ? '<i title="Has screenshots"></i>' : ''}</a>`;
}

function monthLabel(date) {
    const [year, month] = String(date || '').split('-').map(Number);
    return `${MONTHS[month - 1]} ${year}`;
}

function releasePage(version) {
    const all = releases();
    const index = all.findIndex((r) => r.version === String(version || '').replace(/^v/, ''));
    if (index < 0) return null;
    const r = all[index];
    const pin = pinned();
    const canonicalPath = `/changes/${r.version}`;
    const navigation = `<nav class="chg-release-nav" aria-label="Release navigation">${index < all.length - 1 ? `<a rel="prev" href="/changes/${esc(all[index + 1].version)}">← ${esc(all[index + 1].version)}</a>` : '<span></span>'}${index > 0 ? `<a rel="next" href="/changes/${esc(all[index - 1].version)}">${esc(all[index - 1].version)} →</a>` : '<span></span>'}</nav>`;
    return layout({
        title: `OpenVibe.Shared ${r.version}: ${r.title}`,
        description: r.title,
        path: canonicalPath,
        active: '/components',
        styles: ['css/changes.css'],
        jsonLd: [{ '@context': 'https://schema.org', '@type': 'TechArticle', headline: `OpenVibe.Shared ${r.version}: ${r.title}`, datePublished: r.date, mainEntityOfPage: canonical(canonicalPath) }],
        body: `<article class="chg">${navigation}<header class="ds-page-h chg-hero"><p class="ds-kicker"><a href="/changes">OpenVibe.Shared releases</a></p><h1>Release ${esc(r.version)}</h1><p class="ds-lede">${esc(day(r.date))} · pinned package <code>openvibe-shared@${esc(pin.version)}</code></p></header><div class="chg-list">${releaseCard(r)}</div>${navigation}<p><a href="/changes">All releases</a></p></article>`,
    });
}

function changesPage() {
    const all = releases();
    const pin = pinned();
    const counted = all.filter((r) => screenshots(r.version).length).length;
    const hero = `<header class="ds-page-h chg-hero"><p class="ds-kicker">OpenVibe.Shared</p><h1>Every shared release, and where it shows</h1>
<p class="ds-lede">Every release of the shared package, newest first, in its changelog's words, with the screens it changed.</p>
${kit.stats([[all.length, 'releases'], [counted, 'with screenshots'], [pin.version, 'pinned']], { label: 'The archive in numbers' })}
<p class="chg-links">${kit.button({ href: '/components/registry', label: 'The components', kind: 'quiet', icon: 'puzzle' })}${kit.button({ href: '/rules', label: 'The rules', kind: 'quiet', icon: 'rules' })}${kit.button({ href: '/api/v1/changes', label: 'As JSON', kind: 'quiet', icon: 'code' })}</p>
 </header>`;
    const full = all.slice(0, 12).map(releaseCard).join('');
    const monthGroups = new Map();
    for (const r of all.slice(12)) {
        const key = r.date.slice(0, 7);
        if (!monthGroups.has(key)) monthGroups.set(key, { label: monthLabel(r.date), releases: [] });
        monthGroups.get(key).releases.push(r);
    }
    const folds = [...monthGroups.values()].map((group) => `<details class="chg-month"><summary><b>${esc(group.label)}</b><span class="chg-month-n">${group.releases.length} ${group.releases.length === 1 ? 'release' : 'releases'}</span></summary><div class="chg-month-rows">${group.releases.map(releaseRow).join('')}</div></details>`).join('');
    return layout({
        title: `Changes: ${all.length} OpenVibe.Shared releases`,
        description: `Every OpenVibe.Shared release in the pinned changelog, newest first: what changed, the component pages it touches, the rules it carries out, and its screenshots.`,
        path: '/changes',
        active: '/components',
        styles: ['css/changes.css'],
        body: `<article class="chg">${hero}<div class="chg-list">${full}</div>${folds}
<footer class="chg-foot"><p>Read from <code>openvibe-shared@${esc(pin.version)}</code>. A release is listed in the order the package writes it; the links are the only additions.</p>
<p>${kit.button({ href: '/components/registry', label: 'Every component', kind: 'quiet' })}${kit.button({ href: '/rules', label: 'How OpenVibe decides', kind: 'quiet' })}</p></footer></article>`,
    });
}

function changesJson(query = {}) {
    const all = releases();
    const limit = Number.isInteger(Number(query.limit)) && Number(query.limit) > 0 ? Math.min(Number(query.limit), 100) : all.length;
    const before = query.before ? all.findIndex((r) => r.version === String(query.before).replace(/^v/, '')) : -1;
    const eligible = before >= 0 ? all.slice(before + 1) : query.before ? [] : all;
    return {
        schema: 'openvibe.changes@1',
        pinned: pinned(),
        releases: eligible.slice(0, limit).map((r) => ({
            version: r.version,
            date: r.date,
            title: r.title,
            pages: componentsOf(r).map((c) => ({ key: c.key, title: c.title, href: c.href })),
            rules: rulesOf(r),
            screenshots: screenshots(r.version),
        })),
    };
}

module.exports = { changesPage, releasePage, changesJson };
