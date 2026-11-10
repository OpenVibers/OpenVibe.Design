'use strict';
/**
 * The four doors' pages (/see, /make, /use) and the four cards that lead the home. Plain kit markup the site already
 * draws: the .ds-system-grid / .ds-sys card is the one the home's "whole system" grid and /system use, and each
 * page's icon is the site's own glyph (openvibe-shared/glyphs). No new look.
 *
 *   doorPage(id)   one door: its name, one line, its pages as cards in their order, and the count
 *   homeDoors()    the same cards for the doors themselves, at the top of the home
 */
const kit = require('openvibe-shared/kit');
const glyphs = require('openvibe-shared/glyphs');
const { layout, esc } = require('../render/layout');
const { DOORS, doorById, pageOf, countOf, sentence } = require('../site/doors');

const icon = (name) => glyphs.svg(name, { size: 22 });

/** A page's card: its own glyph, its name, and one line from its own lede. */
function pageCard(page) {
    return `<li><a class="ds-sys" href="${esc(page.href)}"><span class="ds-sys-ic">${icon(page.icon)}</span><span class="ds-sys-t"><b>${esc(page.name)}</b></span><small>${esc(sentence(page.line))}</small></a></li>`;
}

function doorPage(id) {
    const door = doorById(id);
    if (!door) throw new Error(`No door: ${id}`);
    const pages = door.pages.map(pageOf).filter(Boolean);
    const body = `<div class="ds-wrap">
<header class="ds-page-h"><p class="ds-kicker">OpenVibe.Design</p><h1>${esc(door.name)}</h1>
<p class="ds-lede">${esc(door.line)}</p><p class="ds-fine" data-door-count>${esc(countOf(pages.length))}</p></header>
<ul class="ds-system-grid" data-door-pages>${pages.map(pageCard).join('')}</ul>
</div>`;
    return layout({
        title: door.name,
        description: door.line,
        path: door.href,
        active: door.href,
        body,
    });
}

/** The four doors at the top of the home: the same cards, one line each, linking to the doors. */
function homeDoors() {
    return `<section class="ds-system" aria-labelledby="ds-doors-h"><div class="ds-head-row"><h2 id="ds-doors-h">Four doors</h2><a class="ds-more" href="/system">The system map${kit.icon('chevron')}</a></div>
<p class="ds-fine ds-system-lede">Everything on OpenVibe.Design, in four places.</p>
<ul class="ds-system-grid" data-home-doors>${DOORS.map((door) => `<li><a class="ds-sys" href="${esc(door.href)}"><span class="ds-sys-ic">${icon(door.icon)}</span><span class="ds-sys-t"><b>${esc(door.name)}</b></span><small>${esc(door.line)}</small></a></li>`).join('')}</ul></section>`;
}

module.exports = { doorPage, homeDoors, pageCard };
