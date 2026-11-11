'use strict';

/**
 * The Elements and packs gallery on OpenVibe.Design: the list beside /create, one listing with Install, Remix,
 * Try it, a rating and a report, and the staff report queue. The look is drawn from the element document with
 * Design's own control preview; the real one is the Try it page.
 */
const kit = require('openvibe-shared/kit');
const { layout, esc } = require('../render/layout');
const { renderLook } = require('../create/element');

const stars = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
const ratingText = (r) => (r && r.count ? `${r.average} / 5 from ${r.count} rating${r.count === 1 ? '' : 's'}` : 'No ratings yet');
const lookOf = (l) => renderLook({ look: l.look || (l.document && l.document.items && l.document.items[0] && l.document.items[0].look) || { component: 'button', label: l.name } });

function card(l) {
    return `<li class="el-g-card"><a href="/gallery/${encodeURIComponent(l.slug)}">
<span class="el-g-look">${lookOf(l)}</span>
<span class="el-g-text"><span class="el-g-title"><b>${esc(l.name)}</b> ${kit.badge(l.kind === 'pack' ? 'Pack' : 'Element', l.official ? 'accent' : undefined)}</span>
<small>${esc(l.author && l.author.name || 'A maker')} · ${l.installs} install${l.installs === 1 ? '' : 's'} · ${esc(ratingText(l.rating))}</small>
<span class="el-g-summary">${esc(l.summary || '')}</span></span></a></li>`;
}

function galleryPage({ listings = [], count = 0, q = '', kind = '', sort = 'new', viewer = {}, notice = null } = {}) {
    const signedIn = viewer.kind === 'user';
    const body = `<section class="el-page el-gallery">
${kit.head({ title: 'Elements and packs', sub: 'Free controls, buttons and stream widgets people made with AI. Install one on your channel, remix it, or try it first.', actions: [kit.button({ href: '/create', label: 'Make one' })] })}
${notice ? `<p class="dv-ok" role="status">${esc(notice)}</p>` : ''}
<div class="el-g-sec">
<form class="el-g-search" method="get" action="/gallery" role="search">
<input type="search" name="q" value="${esc(q)}" placeholder="Search elements and packs" aria-label="Search elements and packs">
<select name="kind" aria-label="Kind"><option value="">All kinds</option><option value="element"${kind === 'element' ? ' selected' : ''}>Elements</option><option value="pack"${kind === 'pack' ? ' selected' : ''}>Packs</option></select>
<select name="sort" aria-label="Sort"><option value="new"${sort === 'new' ? ' selected' : ''}>Newest</option><option value="installs"${sort === 'installs' ? ' selected' : ''}>Most installed</option><option value="rating"${sort === 'rating' ? ' selected' : ''}>Best rated</option></select>
${kit.button({ label: 'Search', kind: 'quiet', type: 'submit' })}
</form>
<p class="dv-fine">${count} listing${count === 1 ? '' : 's'}, free to install.${signedIn ? ' Make one in <a href="/create">/create</a>, choose Element, then publish it from its preview.' : ''}</p>
${listings.length ? `<ul class="el-g-list">${listings.map(card).join('')}</ul>` : kit.empty({ icon: 'spark', title: 'Nothing here yet', text: 'No listing matches that search.' })}
</div></section>`;
    return layout({ title: 'Elements and packs', description: 'Free buttons, controls and stream widgets people made with AI: install one on your channel, remix it, or try it first.', path: '/gallery', body, active: '/gallery' });
}

function itemList(l) {
    if (l.kind !== 'pack' || !Array.isArray(l.document.items)) return '';
    return `<ul class="el-g-items">${l.document.items.map((it) => `<li><b>${esc(it.name || 'Element')}</b>${it.description ? ` <small>${esc(it.description)}</small>` : ''}</li>`).join('')}</ul>`;
}

function listingPage({ listing: l, viewer = {}, installed = null, myRating = null, canRemix = false, notice = null, error = null } = {}) {
    const signedIn = viewer.kind === 'user';
    const next = `/gallery/${encodeURIComponent(l.slug)}`;
    const installForm = !signedIn
        ? kit.notice({ kind: 'info', text: `Sign in to install or rate this ${l.kind}.` }) + `<p>${kit.button({ href: `/auth/login?next=${encodeURIComponent(next)}`, label: 'Sign in with OpenVibe' })}</p>`
        : installed
            ? `<p class="dv-ok" role="status">${kit.badge('Installed', 'ok')} On your channel${installed.channel ? ` (${esc(installed.channel)})` : ''}${installed.library && installed.library.error ? `; Live said: ${esc(installed.library.error)}` : ''}.</p>`
            : `<form method="post" action="${next}/install"><p>${kit.button({ label: 'Install', type: 'submit' })}</p><p class="dv-fine">Free. It goes to your Live channel and the maker is credited.</p></form>`;
    const rateForm = signedIn && installed
        ? `<form method="post" action="${next}/rating" class="el-g-rate"><fieldset><legend>Your rating</legend>
<label>Stars <select name="stars" required>${[5, 4, 3, 2, 1].map((n) => `<option value="${n}"${myRating && myRating.stars === n ? ' selected' : ''}>${n} — ${stars(n)}</option>`).join('')}</select></label>
<label>Note (optional) <input type="text" name="note" maxlength="400" value="${esc(myRating && myRating.note || '')}"></label>
${kit.button({ label: myRating ? 'Update rating' : 'Rate it', type: 'submit', kind: 'quiet' })}</fieldset></form>`
        : (signedIn ? '<p class="dv-fine">Install it to rate it.</p>' : '');
    const remixForm = signedIn && canRemix
        ? `<form method="post" action="${next}/remix" class="el-g-remix"><p>${kit.button({ label: 'Remix', type: 'submit', kind: 'quiet' })}</p><p class="dv-fine">A copy of your own that credits ${esc(l.author && l.author.name || 'the original')}.</p></form>`
        : (signedIn ? '' : `<p class="dv-fine"><a href="/auth/login?next=${encodeURIComponent(next)}">Sign in</a> to remix it.</p>`);
    const reportForm = signedIn
        ? `<details class="el-g-report"><summary>Report this ${l.kind}</summary><form method="post" action="${next}/report">
<label>Reason <select name="reason"><option value="unsafe">Unsafe</option><option value="broken">Broken</option><option value="spam">Spam</option><option value="other">Other</option></select></label>
<label>What is wrong? <textarea name="detail" maxlength="1000" rows="3"></textarea></label>
${kit.button({ label: 'Send report', type: 'submit', kind: 'quiet' })}</form><p class="dv-fine">Staff read reports; nothing is hidden by a report itself.</p></details>`
        : '';
    return layout({
        title: l.name, description: l.summary || `${l.name}, a free ${l.kind} for OpenVibe.`, path: next,
        robots: l.status === 'published' ? 'index, follow' : 'noindex, nofollow',
        active: '/gallery',
        body: `<section class="el-page el-listing">
${kit.head({ title: l.name, sub: `${l.kind === 'pack' ? 'Pack' : 'Element'} by ${l.author && l.author.name || 'a maker'} · ${l.installs} install${l.installs === 1 ? '' : 's'} · ${ratingText(l.rating)}`, back: { href: '/gallery', label: 'Elements and packs' }, actions: [kit.badge('Free', 'ok')] })}
${notice ? `<p class="dv-ok" role="status">${esc(notice)}</p>` : ''}${error ? `<p class="dv-err" role="alert">${esc(error)}</p>` : ''}
<div class="el-g-detail">
<div class="el-g-preview">${lookOf(l)}</div>
<div class="el-g-side">
${l.summary ? `<p class="dv-prose">${esc(l.summary)}</p>` : ''}
${l.remix_of ? `<p class="dv-fine">Remixed from <a href="/gallery/${encodeURIComponent(l.remix_of)}">an earlier element</a>.</p>` : ''}
<h2>Install</h2>${installForm}
<h2>Try it</h2><p><a class="ovk-btn ovk-btn--quiet" href="${next}/try">Try it</a></p>
<h2>Remix</h2>${remixForm}
<h2>Rating</h2><p>${esc(ratingText(l.rating))}</p>${rateForm}
${itemList(l)}
<h2>Report</h2>${reportForm}
</div></div></section>`,
    });
}

function moderationPage({ reports = [], notice = null } = {}) {
    return layout({
        title: 'Element reports', description: 'Staff reports on the Elements gallery.', path: '/gallery/moderation', robots: 'noindex, nofollow', active: '/gallery',
        body: `<section class="el-page">
${kit.head({ title: 'Element reports', sub: 'Pending reports from people. Accepting one hides the listing; rejecting one leaves it be.', back: { href: '/gallery', label: 'Elements and packs' } })}
${notice ? `<p class="dv-ok" role="status">${esc(notice)}</p>` : ''}
${reports.length ? `<ul class="el-g-reports">${reports.map((r) => `<li class="el-g-report-row">
<p><a href="/gallery/${encodeURIComponent(r.slug)}"><b>${esc(r.name)}</b></a> ${kit.badge(r.listing_status)}</p>
<p>${esc(r.reason)} · ${esc(new Date(r.created_at).toISOString().slice(0, 16).replace('T', ' '))}${r.detail ? ` — ${esc(r.detail)}` : ''}</p>
<form method="post" action="/gallery/moderation/reports/${encodeURIComponent(r.id)}">
${kit.button({ label: 'Accept: hide the listing', type: 'submit', kind: 'primary' })}
${kit.button({ label: 'Reject', type: 'submit', kind: 'quiet', name: 'decision', value: 'reject' })}
</form></li>`).join('')}</ul>` : kit.empty({ icon: 'shield', title: 'No pending reports', text: 'Nothing for staff to read right now.' })}
</section>`,
    });
}

module.exports = { galleryPage, listingPage, moderationPage };
