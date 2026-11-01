'use strict';
/**
 * /look: your look on every OpenVibe site, in one place. The theme you wear (and the way to change it), Light / Dark /
 * Auto, text size, motion, the season's themes and the comfort settings (more contrast, a readable font, colour-blind-safe
 * colours, true black). The settings belong to theme-loader.js (openvibe-shared), which
 * applies them at once on this device and saves them to the account when the person is signed in, so every OpenVibe
 * site follows. public/js/look.js only wires these controls to it. Without JavaScript the page says so.
 *
 *   lookPage({ themes, me })
 */
const kit = require('openvibe-shared/kit');
const { layout, esc } = require('../render/layout');

// The sites a person can give a look of their own (service ids, as openvibe-shared/shell writes them on <html>).
const SITES = [['live', 'OpenVibe.Live'], ['chat', 'OpenVibe.Chat'], ['games', 'OpenVibe.Games'], ['community', 'OpenVibe.Community'], ['media', 'OpenVibe.Media'], ['tools', 'OpenVibe.Tools'], ['bot', 'OpenVibe.Bot'], ['actor', 'OpenVibe.Actor'], ['quest', 'OpenVibe.Quest'], ['rent', 'OpenVibe.Rent'], ['deals', 'OpenVibe.Deals'], ['network', 'OpenVibe.Network'], ['design', 'OpenVibe.Design']];

/**
 * The three icon styles side by side, each a small phone screen drawn with the real glyphs (ov-glyphs.js): a header
 * with icons above 18 px, rows with small ones and an app bar whose current tab is solid. Line and Solid force their
 * style on every icon (.ovg-line, .ovg-solid); Auto resets the person's own choice (--ovg-pref) so it shows what
 * Auto does: solid where an icon is small, lines where it is large. A screen is a button that picks its style
 * (public/js/look.js), the same as the Icons choice above it.
 */
function iconStyles() {
    const STYLES = [
        ['auto', 'Auto', 'Solid when small, lines when large. The default.'],
        ['line', 'Line', 'Outlines at every size.'],
        ['solid', 'Solid', 'Filled at every size.'],
    ];
    const i = (name, force) => `<i class="fa-solid ${name}${force ? ` ovg-${force}` : ''}" aria-hidden="true"></i>`;
    const screen = (style) => {
        const force = style === 'auto' ? '' : style;
        const rows = [['fa-tower-broadcast', 72], ['fa-comments', 54], ['fa-heart', 64]].map(([n, w]) => `<span class="lk-st-row"><span class="lk-st-dot">${i(n, force)}</span><span class="lk-st-lines"><span style="width:${w}%"></span><span></span></span></span>`).join('');
        const bar = ['fa-house', 'fa-compass', 'fa-bell', 'fa-user'].map((n, k) => `<span class="lk-st-tab"${k === 0 ? ' aria-current="page"' : ''}>${i(n, force)}</span>`).join('');
        return `<span class="lk-st-screen"${style === 'auto' ? ' style="--ovg-pref:18.4px"' : ''}><span class="lk-st-head"><span class="lk-st-title"></span>${i('fa-magnifying-glass', force)}${i('fa-bell', force)}</span>${rows}<span class="lk-st-bar">${bar}</span></span>`;
    };
    return `<div class="lk-styles" role="group" aria-label="The icon styles, side by side">${STYLES.map(([id, name, what]) => `<button type="button" class="lk-style" data-pick-icons="${id}" aria-pressed="${id === 'auto' ? 'true' : 'false'}">${screen(id)}<span class="lk-st-cap"><b>${name}</b><small>${what}</small></span></button>`).join('')}</div>`;
}

function lookPage({ themes = [], me = {} } = {}) {
    const list = (themes || []).filter((t) => t && t.id).map((t) => ({ id: t.id, name: t.name, mode: t.mode, dots: ['--bg-primary', '--bg-card', '--accent', '--text-primary'].map((k) => String((t.variables || {})[k] || '')).filter((v) => /^#[0-9a-f]{3,8}$/i.test(v)) }));
    const signedIn = !!me.signedIn;
    const current = `<section class="ovk-section lk-current" aria-labelledby="lk-cur-h"><h2 id="lk-cur-h">Your theme</h2>
<div class="lk-theme"><span class="tk-dots" id="lk-dots" aria-hidden="true"></span><span><b id="lk-name">The OpenVibe default</b><small id="lk-mode"></small></span></div>
<p class="lk-acts">${kit.button({ href: '/studio', label: 'Change it in the studio', attrs: { id: 'lk-studio' } })} ${kit.button({ href: '/tokens', label: 'As code', kind: 'quiet', attrs: { id: 'lk-code' } })}</p></section>`;
    const settings = kit.section({
        id: 'lk-settings',
        title: 'How every site looks to you',
        note: signedIn ? 'Each change applies at once and is saved to your account, so every OpenVibe site follows.' : 'Each change applies at once on this device. Sign in and it follows you to every OpenVibe site.',
        body: kit.seg({ name: 'scheme', label: 'Light or dark', options: [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Match my device']], value: 'auto' })
            + kit.seg({ name: 'text', label: 'Text size', options: [['100', 'Standard'], ['112', 'Larger'], ['125', 'Largest']], value: '100' })
            + kit.seg({ name: 'motion', label: 'Motion', options: [['auto', 'Full'], ['reduced', 'Reduced']], value: 'auto' })
            // Icons (openvibe-shared 4.71.0, plan L56; the owner, 2026-11-01: "a setting to prefer a certain icon type…
            // configurable for users in most cases"): the sample under it is ordinary page markup, drawn by ov-glyphs.js, so
            // it changes as the choice does.
            + kit.seg({ name: 'icons', label: 'Icons', options: [['auto', 'Auto'], ['line', 'Line'], ['solid', 'Solid']], value: 'auto' })
            + iconStyles()
            + kit.switchRow({ name: 'seasonal', label: 'The season\'s themes', hint: 'Halloween and winter stand in for the default theme while they last', on: true }),
    });
    // Comfort (openvibe-shared 4.45.0): how any theme reads for this person. The sample under the switches is ordinary page
    // markup, so it changes as each switch does: quieter text, a link in running text, the three status colours.
    const comfort = kit.section({
        id: 'lk-comfort',
        title: 'Comfort',
        note: 'On top of any theme, on every OpenVibe site.',
        body: kit.switchRow({ name: 'contrast', label: 'More contrast', hint: 'Quieter text and borders stand out more; links in text are underlined', on: false })
            + kit.switchRow({ name: 'font', label: 'Readable font', hint: 'A typeface made for legibility, with more space between letters, words and lines', on: false })
            + kit.switchRow({ name: 'colors', label: 'Colour-blind-safe colours', hint: 'Success, warning and danger in blue, yellow and orange, never red against green', on: false })
            + kit.switchRow({ name: 'oled', label: 'True black', hint: 'Black backgrounds on dark themes, for OLED screens', on: false })
            + `<div class="lk-sample" aria-label="A sample of how text and status colours read"><p>Body text, <span class="lk-sample-muted">quieter text</span> and <a href="/look#lk-comfort">a link in a sentence</a>.</p><p class="lk-sample-badges">${kit.badge('Working', 'ok')} ${kit.badge('Ends soon', 'warn')} ${kit.badge('Expired', 'bad')}</p></div>`,
    });
    const themeOpts = list.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
    const sites = signedIn ? kit.section({
        id: 'lk-sites',
        title: 'A different look on one site',
        note: 'Wear another theme on one site only: Games in Neon Tokyo, Live in Daylight. Everywhere else keeps your theme.',
        body: `<ul class="lk-sites" id="lk-site-list" aria-live="polite"></ul>
<form class="lk-site-form" id="lk-site-form"><label><span>Site</span><select name="service">${SITES.map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join('')}</select></label>
<label><span>Theme</span><select name="theme_id">${themeOpts}</select></label>${kit.button({ type: 'submit', label: 'Add', small: true })}</form>`,
    }) : '';
    const body = `<header class="ds-page-h"><p class="ds-kicker">Your look</p><h1>Your look, everywhere</h1>
<p class="ds-lede">One theme and one set of comfort settings for every OpenVibe site: Live, Chat, Games, the shops and the rest.</p></header>
<noscript>${kit.notice({ kind: 'info', text: 'These settings need JavaScript in this browser. Your theme still follows your account.' })}</noscript>
<div class="lk" data-signed-in="${signedIn ? '1' : '0'}">${current}${settings}${comfort}${sites}
<p class="lk-status" id="lk-status" role="status"></p>
${signedIn ? `<p class="ds-fine">Every change keeps the look it replaced: <a href="/studio#ds-history">your history</a> brings any of the last fifty back.</p>` : `<p>${kit.button({ href: '/auth/login?next=%2Flook', label: 'Sign in so it follows you', kind: 'quiet', small: true })}</p>`}</div>
<script type="application/json" id="lk-themes">${JSON.stringify(list).replace(/</g, '\\u003c')}</script>`;
    return layout({ title: 'Your look', description: 'Your theme, light or dark, text size, motion, seasonal themes and comfort settings (contrast, a readable font, colour-blind-safe colours, true black) for every OpenVibe site, in one place.', path: '/look', body: `<div class="ds-wrap tk">${body}</div>`, active: '/look', scripts: ['js/look.js'] });
}

module.exports = { lookPage, esc, SITES };
