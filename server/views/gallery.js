'use strict';

/**
 * The Elements and packs gallery on OpenVibe.Design: the list beside /create, one listing with Install, Remix,
 * Try it, a rating and a report, and the staff report queue. The look is drawn from the element document with
 * Design's own control preview; the real one is the Try it page.
 *
 * A pack shows its whole deck, on its card (the first four, smaller) and on its page (every element, each one a door
 * to Try it): a pack drawn as its first button said one control where there are eight.
 */
const kit = require('openvibe-shared/kit');
const { layout, esc } = require('../render/layout');
const { renderLook } = require('../create/element');

const stars = (n) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
const ratingText = (r) => (r && r.count ? `${r.average} / 5 from ${r.count} rating${r.count === 1 ? '' : 's'}` : 'No ratings yet');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const itemsOf = (l) => (l.kind === 'pack' && l.document && Array.isArray(l.document.items) ? l.document.items : []);
const firstLook = (l) => renderLook({ look: l.look || (itemsOf(l)[0] && itemsOf(l)[0].look) || (l.document && l.document.look) || { component: 'button', label: l.name } });
const tryHref = (l, i = null) => `/gallery/${encodeURIComponent(l.slug)}/try${i ? `?item=${i}` : ''}`;

/** The card's picture: an element's look, or a pack's first four looks in a small deck with "+N more". */
function cardLook(l) {
    const items = itemsOf(l);
    if (!items.length) return `<span class="el-g-look">${firstLook(l)}</span>`;
    const shown = items.slice(0, 4).map((it) => `<span class="el-g-mini">${renderLook(it)}</span>`).join('');
    const more = items.length > 4 ? `<span class="el-g-more">+${items.length - 4} more</span>` : '';
    return `<span class="el-g-look el-g-look--pack" data-count="${Math.min(items.length, 4)}">${shown}${more}</span>`;
}

function card(l) {
    const items = itemsOf(l);
    const what = l.kind === 'pack' ? `Pack · ${plural(items.length, 'element')}` : 'Element';
    return `<li class="el-g-card"><a href="/gallery/${encodeURIComponent(l.slug)}">
${cardLook(l)}
<span class="el-g-text"><span class="el-g-kind">${esc(what)}${l.official ? ` ${kit.badge('Official', 'accent')}` : ''}</span>
<span class="el-g-title">${esc(l.name)}</span>
<span class="el-g-summary">${esc(l.summary || '')}</span>
<small class="el-g-by">${esc(l.author && l.author.name || 'A maker')} · ${plural(l.installs, 'install')} · ${esc(ratingText(l.rating))}</small></span></a></li>`;
}

const KINDS = [['', 'All', 'grid'], ['element', 'Elements', 'spark'], ['pack', 'Packs', 'folder']];
const SORTS = [['new', 'Newest'], ['installs', 'Most installed'], ['rating', 'Best rated']];

/** The kind filters (icon, name and count: rule 134) and the order, as links: crawlable, no script. */
function filters({ q, kind, sort, counts }) {
    const href = (k, s) => {
        const p = new URLSearchParams();
        if (q) p.set('q', q);
        if (k) p.set('kind', k);
        if (s && s !== 'new') p.set('sort', s);
        const qs = p.toString();
        return `/gallery${qs ? `?${qs}` : ''}`;
    };
    const n = (k) => (k ? counts[k] : counts.all);
    const chips = KINDS.map(([k, label, ic]) => `<a class="el-g-chip" href="${esc(href(k, sort))}"${k === kind ? ' aria-current="page"' : ''}><span class="el-g-chip-ic">${kit.icon(ic)}</span><span>${label}</span><span class="el-g-n">${Number(n(k)) || 0}</span></a>`).join('');
    const order = SORTS.map(([s, label]) => `<a href="${esc(href(kind, s))}"${s === sort ? ' aria-current="true"' : ''}>${label}</a>`).join('');
    return `<div class="el-g-filters"><nav class="el-g-chips" aria-label="Kind">${chips}</nav><nav class="el-g-sort" aria-label="Order">${order}</nav></div>`;
}

function galleryPage({ listings = [], count = 0, counts = null, q = '', kind = '', sort = 'new', notice = null } = {}) {
    const n = counts || { all: count, element: kind === 'element' ? count : 0, pack: kind === 'pack' ? count : 0 };
    const empty = q
        ? kit.empty({ icon: 'search', title: `Nothing matches “${q}”`, text: 'Try another word, or make the control you were looking for.', action: { href: '/create', label: 'Make one' } })
        : kit.empty({ icon: 'spark', title: 'Nothing here yet', text: 'Make a control with AI and publish it from its preview.', action: { href: '/create', label: 'Make one' } });
    const body = `<section class="el-page el-gallery">
${kit.head({ title: 'Elements and packs', sub: 'Free controls, buttons and stream widgets made with AI. Try one, install it, remix it.', actions: [kit.button({ href: '/create', label: 'Make one', icon: 'spark' })] })}
${notice ? kit.notice({ kind: 'ok', text: notice }) : ''}
${kit.find({ action: '/gallery', value: q, placeholder: 'Search elements and packs', hidden: { ...(kind ? { kind } : {}), ...(sort !== 'new' ? { sort } : {}) } })}
${filters({ q, kind, sort, counts: n })}
${listings.length ? `<ul class="el-g-list">${listings.map(card).join('')}</ul>` : empty}
</section>`;
    return layout({ title: 'Elements and packs', description: 'Free buttons, controls and stream widgets people made with AI: try one, install it on your channel, or remix it.', path: '/gallery', body, active: '/gallery' });
}

// A tile names its element only when the control does not already say it ("Look up" on a "Look up" button).
const sameWords = (it) => String(it.name || '').trim().toLowerCase() === String(it.look && it.look.label || '').trim().toLowerCase()
    && !(it.look && it.look.style && it.look.style.show_label === false);

/** A pack's deck: every element as a tile (its look, name and line), each one opening Try it on that element. */
function deck(l) {
    const items = itemsOf(l);
    if (!items.length) {
        return `<div class="el-g-stage">${firstLook(l)}</div>`;
    }
    return `<ul class="el-deck">${items.map((it, i) => `<li><a class="el-deck-tile" href="${esc(tryHref(l, i))}" aria-label="Try ${esc(it.name || 'this element')}">
<span class="el-deck-look">${renderLook(it)}</span>
${sameWords(it) ? '' : `<span class="el-deck-name">${esc(it.name || 'Element')}</span>`}${it.description ? `<span class="el-deck-line">${esc(it.description)}</span>` : ''}
</a></li>`).join('')}</ul>`;
}

/** The one place to act: install (or sign in), try, remix, and the rating. */
function actions({ l, signedIn, installed, myRating, canRemix, next }) {
    const kindWord = l.kind === 'pack' ? 'pack' : 'element';
    const tryBtn = kit.button({ href: tryHref(l), label: 'Try it', kind: 'quiet', icon: 'play' });
    let main;
    if (!signedIn) {
        main = `<div class="el-g-btns el-g-btns--main">${kit.button({ href: `/auth/login?next=${encodeURIComponent(next)}`, label: 'Sign in to install' })}</div><div class="el-g-btns">${tryBtn}</div>
<p class="dv-fine">Try it needs no account. Installing, remixing and rating do.</p>`;
    } else if (installed) {
        const err = installed.library && installed.library.error;
        main = `<p class="el-g-installed">${kit.icon('check')}<span>Installed on your channel${installed.channel ? ` (${esc(installed.channel)})` : ''}</span></p>
${err ? kit.notice({ kind: 'warn', text: `Live said: ${err}` }) : ''}<div class="el-g-btns">${tryBtn}${canRemix ? remixButton(next) : ''}</div>`;
    } else {
        main = `<form method="post" action="${next}/install" class="el-g-btns el-g-btns--main">${kit.button({ label: `Install ${kindWord}`, type: 'submit', icon: 'download' })}</form>
<div class="el-g-btns">${tryBtn}${canRemix ? remixButton(next) : ''}</div>
<p class="dv-fine">Free. It goes to your Live channel and ${esc(l.author && l.author.name || 'the maker')} is credited${canRemix ? '; a remix is your own copy that credits them too' : ''}.</p>`;
    }
    const rate = signedIn && installed
        ? `<form method="post" action="${next}/rating" class="el-g-rate"><fieldset><legend>Your rating</legend>
<label>Stars <select name="stars" required>${[5, 4, 3, 2, 1].map((n) => `<option value="${n}"${myRating && myRating.stars === n ? ' selected' : ''}>${n} — ${stars(n)}</option>`).join('')}</select></label>
<label>Note (optional) <input type="text" name="note" maxlength="400" value="${esc(myRating && myRating.note || '')}"></label>
${kit.button({ label: myRating ? 'Update rating' : 'Rate it', type: 'submit', kind: 'quiet' })}</fieldset></form>`
        : '';
    const r = l.rating;
    const ratingLine = `<p class="el-g-rating">${r && r.count ? `<span class="el-g-stars" aria-hidden="true">${stars(Math.round(r.average))}</span>` : ''}<span>${esc(ratingText(r))}${signedIn && !installed && canRemix ? ' · install it to rate it' : ''}</span></p>`;
    return `<aside class="el-g-act" aria-label="Install and try">${main}${ratingLine}${rate}</aside>`;
}

const remixButton = (next) => `<form method="post" action="${next}/remix">${kit.button({ label: 'Remix a copy', type: 'submit', kind: 'quiet', icon: 'copy' })}</form>`;

function listingPage({ listing: l, viewer = {}, installed = null, myRating = null, canRemix = false, notice = null, error = null } = {}) {
    const signedIn = viewer.kind === 'user';
    const next = `/gallery/${encodeURIComponent(l.slug)}`;
    const items = itemsOf(l);
    const sub = [l.kind === 'pack' ? `Pack of ${plural(items.length, 'element')}` : 'Element', `by ${l.author && l.author.name || 'a maker'}`, plural(l.installs, 'install')].join(' · ');
    const report = signedIn
        ? `<details class="el-g-report"><summary>${kit.icon('flag')}Report this ${l.kind}</summary><form method="post" action="${next}/report">
<label>Reason <select name="reason"><option value="unsafe">Unsafe</option><option value="broken">Broken</option><option value="spam">Spam</option><option value="other">Other</option></select></label>
<label>What is wrong? <textarea name="detail" maxlength="1000" rows="3"></textarea></label>
${kit.button({ label: 'Send report', type: 'submit', kind: 'quiet' })}</form><p class="dv-fine">Staff read every report; a report alone hides nothing.</p></details>`
        : '';
    const own = signedIn && !canRemix && l.author && viewer.subject === l.author.subject
        ? '<p class="dv-fine">Yours. Other people can remix it, and every copy credits you.</p>' : '';
    return layout({
        title: l.name, description: l.summary || `${l.name}, a free ${l.kind} for OpenVibe.`, path: next,
        robots: l.status === 'published' ? 'index, follow' : 'noindex, nofollow',
        active: '/gallery',
        body: `<section class="el-page el-listing">
${kit.head({ title: l.name, sub, back: { href: '/gallery', label: 'Elements and packs' }, actions: [kit.badge('Free', 'ok')] })}
${notice ? kit.notice({ kind: 'ok', text: notice }) : ''}${error ? kit.notice({ kind: 'error', text: error }) : ''}
${l.summary ? `<p class="el-g-lede">${esc(l.summary)}</p>` : ''}
${l.remix_of ? `<p class="dv-fine">Remixed from <a href="/gallery/${encodeURIComponent(l.remix_of)}">an earlier element</a>.</p>` : ''}
<div class="el-g-detail">
<div class="el-g-main">
${items.length ? `<h2 class="el-g-h">In this pack</h2><p class="dv-fine">Tap one to try it on sample data.</p>` : ''}
${deck(l)}
</div>
${actions({ l, signedIn, installed, myRating, canRemix, next })}
</div>
${own}${report}
</section>`,
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
