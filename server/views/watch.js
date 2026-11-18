'use strict';
/**
 * /watch: how every OpenVibe site's home page holds to Design's rules today (watch mode, plan §AD.25 item 12). One card
 * a site, worst first: what the daily audit found, the high findings that are new since the check before marked as
 * such, each finding with the rule it breaks and its fix. Whole without JavaScript.
 *
 *   watchPage(rows)   the page; rows from server/review/watch.js list()
 */
const kit = require('openvibe-shared/kit');
const { layout, esc } = require('../render/layout');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const when = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`; };

function finding(f, isNew) {
    return `<li class="rl-detail"><span class="rl-chip${f.severity === 'high' ? '' : ' rl-chip--check'}">${esc(f.severity)}</span>${isNew ? ' <span class="rl-chip">new</span>' : ''} ${esc(f.says)}${f.fix ? ` <span class="rl-why"><span>Fix</span> ${esc(f.fix)}</span>` : ''}${f.rule && f.rule !== 'checklist' ? ` <a class="rl-chip" href="/rules#${esc(f.rule)}">${esc(f.rule)}</a>` : ''}</li>`;
}

function site(r) {
    const head = `<header class="rl-rule-head"><h3><a href="${esc(r.url)}" rel="noopener">${esc(r.host)}</a></h3><time datetime="${esc(r.checked_at)}">${esc(when(r.checked_at))}</time></header>`;
    if (!r.ok) return `<article class="rl-rule" id="${esc(r.host)}">${head}<p class="rl-detail">The page could not be read: ${esc(r.error || 'it did not answer')}.</p></article>`;
    const tally = r.high + r.medium + r.low ? `${r.high} high, ${r.medium} medium, ${r.low} low` : 'Nothing wrong in its markup.';
    const list = r.findings.length ? `<ul>${r.findings.map((f) => finding(f, r.new_high.includes(f.id))).join('')}</ul>` : '';
    return `<article class="rl-rule" id="${esc(r.host)}">${head}<p class="rl-detail">${esc(tally)}${r.new_high.length ? ` · <b>${r.new_high.length} new since ${esc(when(r.previous_at))}</b>` : ''}</p>${list}</article>`;
}

function watchPage(rows = []) {
    const clean = rows.filter((r) => r.ok && !r.high && !r.medium).length;
    const regressed = rows.filter((r) => r.new_high.length).length;
    const last = rows.reduce((m, r) => (r.checked_at > m ? r.checked_at : m), '');
    const hero = `<header class="rl-hero">
  <p class="rl-links rl-door"><span class="rl-label">Rules</span><a class="rl-chip" href="/rules">The register</a><a class="rl-chip" href="/system">The system map</a><span class="rl-chip rl-chip--check" aria-current="page">The watch</span></p>
  <p class="rl-eye">Watch</p>
  <h1 class="rl-h1">Every site, held to the rules daily.</h1>
  <p class="rl-lede">Once a day each OpenVibe site's home page goes through the same audit the rooms run before their reviewers: its markup against the checklist and <a href="/rules">the register</a>. A high finding that was not there the day before is marked new, so a regression shows the day it shipped.</p>
  ${kit.stats([[rows.length, 'sites'], [clean, 'with nothing above low'], [regressed, 'regressed today']], { label: 'The watch in numbers' })}
</header>`;
    const body = rows.length
        ? `${hero}<section class="rl-area">${rows.map(site).join('')}</section><p class="rl-detail">Last checked ${esc(when(last))}. The same data: <a href="/api/v1/watch">/api/v1/watch</a>.</p>`
        : `${hero}<p class="rl-detail">The first daily check has not run yet.</p>`;
    return layout({
        title: 'Watch: every OpenVibe site held to the rules',
        description: 'Each OpenVibe site\'s home page audited daily against OpenVibe\'s design rules, with the regressions marked the day they ship.',
        path: '/watch',
        active: '/system',
        styles: ['css/rules.css'],
        body,
    });
}

module.exports = { watchPage };
