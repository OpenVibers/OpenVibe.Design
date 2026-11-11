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
const { layout, esc } = require('../render/layout');
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

function changesPage() {
    const all = releases();
    const pin = pinned();
    const counted = all.filter((r) => screenshots(r.version).length).length;
    const hero = `<header class="ds-page-h chg-hero"><p class="ds-kicker">OpenVibe.Shared</p><h1>Every shared release, and where it shows</h1>
<p class="ds-lede">Each release of the shared package every OpenVibe site loads, newest first, in the words its own changelog uses. The text is read from <code>openvibe-shared@${esc(pin.version)}</code>, the version this site pins; no request is made to GitHub when a person opens this page. Each release links to the component pages it touches, numbers the <a href="/rules">rules</a> it carries out, and shows the screenshots the repo holds for it.</p>
${kit.stats([[all.length, 'releases'], [counted, 'with screenshots'], [pin.version, 'pinned']], { label: 'The archive in numbers' })}
<p class="chg-links">${kit.button({ href: '/components/registry', label: 'The components', kind: 'quiet', icon: 'puzzle' })}${kit.button({ href: '/rules', label: 'The rules', kind: 'quiet', icon: 'rules' })}${kit.button({ href: '/api/v1/changes', label: 'As JSON', kind: 'quiet', icon: 'code' })}</p>
<p class="ds-fine">Older entries name fewer pages: the changelog is old, the component pages are new. The link is left out rather than guessed.</p></header>`;
    const latest = all.slice(0, 12).map((r) => `<a href="#v${esc(r.version)}"><b>${esc(r.version)}</b><span>${esc(r.title)}</span></a>`).join('');
    const index = all.length > 12 ? `<nav class="chg-index" aria-label="Newest releases"><p class="chg-label">Newest</p><div class="chg-index-row">${latest}</div><p class="ds-fine">${all.length} releases in all; every one follows, newest first.</p></nav>` : '';
    const list = all.map(releaseCard).join('');
    return layout({
        title: `Changes: ${all.length} OpenVibe.Shared releases`,
        description: `Every OpenVibe.Shared release in the pinned changelog, newest first: what changed, the component pages it touches, the rules it carries out, and its screenshots.`,
        path: '/changes',
        active: '/components',
        styles: ['css/changes.css'],
        body: `<article class="chg">${hero}${index}<div class="chg-list">${list}</div>
<footer class="chg-foot"><p>Read from <code>openvibe-shared@${esc(pin.version)}</code>. A release is listed in the order the package writes it; the links are the only additions.</p>
<p>${kit.button({ href: '/components/registry', label: 'Every component', kind: 'quiet' })}${kit.button({ href: '/rules', label: 'How OpenVibe decides', kind: 'quiet' })}</p></footer></article>`,
    });
}

function changesJson() {
    const all = releases();
    return {
        schema: 'openvibe.changes@1',
        pinned: pinned(),
        releases: all.map((r) => ({
            version: r.version,
            date: r.date,
            title: r.title,
            pages: componentsOf(r).map((c) => ({ key: c.key, title: c.title, href: c.href })),
            rules: rulesOf(r),
            screenshots: screenshots(r.version),
        })),
    };
}

module.exports = { changesPage, changesJson };
