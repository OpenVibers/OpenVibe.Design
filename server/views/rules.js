'use strict';
/**
 * /rules: how OpenVibe decides. The decision register (server/rules/register.js) as a page: every style, design and
 * organization rule in one sentence, grouped by area, each with the day it was decided, why, what carries it out and
 * what checks it. Whole without JavaScript; rules.js only adds the filter.
 *
 *   rulesPage()      the page
 *   rulesJson()      the same register as data (/api/v1/rules)
 */
const kit = require('openvibe-shared/kit');
const { layout, esc, baseUrl } = require('../render/layout');
const { AREAS, RULES, byArea, latest } = require('../rules/register');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso) => { const [y, m, d] = String(iso || '').split('-').map(Number); return y ? `${d} ${MONTHS[m - 1]} ${y}` : ''; };
const isExternal = (href) => /^https?:\/\//.test(href);

function rule(r) {
    const see = r.see.map((s) => `<a class="rl-chip" href="${esc(s.href)}"${isExternal(s.href) ? ' rel="noopener"' : ''}>${esc(s.label)}</a>`).join('');
    const checked = r.checked.map((c) => `<span class="rl-chip rl-chip--check">${kit.icon('check')}${esc(c)}</span>`).join('');
    return `<article class="rl-rule" id="${esc(r.id)}" data-rl-text="${esc(`${r.rule} ${r.detail} ${r.why}`.toLowerCase())}">
  <header class="rl-rule-head"><h3><a href="#${esc(r.id)}">${esc(r.rule)}</a></h3><time datetime="${esc(r.decided)}">${esc(day(r.decided))}</time></header>
  <p class="rl-detail">${esc(r.detail)}</p>
  <p class="rl-why"><span>Why</span> ${esc(r.why)}</p>
  ${see || checked ? `<p class="rl-links">${see ? `<span class="rl-label">See</span>${see}` : ''}${checked ? `<span class="rl-label">Checked by</span>${checked}` : ''}</p>` : ''}
</article>`;
}

function rulesPage() {
    const areas = byArea();
    const newest = latest();
    const recent = [...RULES].sort((a, b) => (a.decided < b.decided ? 1 : -1)).slice(0, 5);
    const hero = `<header class="rl-hero">
  <p class="rl-eye">Rules</p>
  <h1 class="rl-h1">How OpenVibe decides.</h1>
  <p class="rl-lede">Every style, design and organization decision behind OpenVibe, one sentence each, with the day it was made and what went wrong without it. <a href="/patterns">Patterns</a> show how a rule looks in a page; this says what the rule is and why.</p>
  ${kit.stats([[RULES.length, 'rules'], [areas.length, 'areas'], [day(newest), 'last decided']], { label: 'The register in numbers' })}
  <form class="rl-find" role="search" action="#" data-rl-find hidden><label for="rl-q" class="ovk-sr">Find a rule</label>${kit.icon('search')}<input id="rl-q" type="search" placeholder="Find a rule: tabs, spinner, price, phone…" autocomplete="off"><output data-rl-count></output></form>
</header>`;
    const index = `<nav class="rl-areas" aria-label="Areas"><ul>${areas.map((a) => `<li><a href="#area-${esc(a.id)}">${esc(a.title)}<span>${a.rules.length}</span></a></li>`).join('')}</ul></nav>`;
    const latestBlock = `<section class="rl-sec rl-recent" aria-labelledby="rl-recent-h"><div class="rl-sec-head"><h2 id="rl-recent-h">Decided lately</h2><p>The newest rules first; each links to its place below.</p></div>
  <ol class="rl-recent-list">${recent.map((r) => `<li><a href="#${esc(r.id)}"><time datetime="${esc(r.decided)}">${esc(day(r.decided))}</time><b>${esc(r.rule)}</b></a></li>`).join('')}</ol></section>`;
    const sections = areas.map((a) => `<section class="rl-sec" id="area-${esc(a.id)}" aria-labelledby="area-${esc(a.id)}-h" data-rl-area>
  <div class="rl-sec-head"><h2 id="area-${esc(a.id)}-h">${esc(a.title)}<span class="rl-n">${a.rules.length}</span></h2><p>${esc(a.lede)}</p></div>
  <div class="rl-list">${a.rules.map(rule).join('')}</div>
</section>`).join('');
    const data = `<section class="rl-sec rl-data" aria-labelledby="rl-data-h"><div class="rl-sec-head"><h2 id="rl-data-h">Use the rules</h2><p>The register is data too: read it from code, hand it to an AI assistant before it designs for OpenVibe, or link one rule by its address.</p></div>
  <p class="rl-links">${kit.button({ href: '/api/v1/rules', label: 'As JSON', kind: 'quiet', icon: 'code' })}${kit.button({ href: '/rules.md', label: 'As Markdown', kind: 'quiet', icon: 'file' })}${kit.button({ href: '/patterns', label: 'The patterns', kind: 'quiet', icon: 'forward' })}</p></section>`;
    const jsonLd = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'How OpenVibe decides', url: `${baseUrl()}/rules`, dateModified: newest, hasPart: RULES.map((r) => ({ '@type': 'CreativeWork', name: r.rule, url: `${baseUrl()}/rules#${r.id}`, dateCreated: r.decided })) }];
    return layout({
        title: 'Rules: how OpenVibe decides',
        description: `${RULES.length} style, design and organization rules behind OpenVibe, each with the day it was decided, why, and what carries it out: honest pages, length without hiding, motion, navigation, phones, words, marks, data, agents and products.`,
        path: '/rules',
        active: '/system',
        styles: ['css/rules.css'],
        scripts: ['js/rules.js'],
        jsonLd,
        body: `<article class="rl">${hero}${index}${latestBlock}${sections}${data}</article>`,
    });
}

function rulesJson() {
    return { count: RULES.length, updated: latest(), areas: AREAS, rules: RULES.map((r) => ({ ...r, url: `${baseUrl()}/rules#${r.id}` })) };
}

module.exports = { rulesPage, rulesJson };
