'use strict';

/**
 * The Element preview: the look, the recipe run on sample data (people of each role pressing, a fake chat and the
 * robot actions drawn in Bot's simulated arena), the price of any AI it calls, and — for the maker — the tweak
 * sliders, "Add to my channel", "Publish to gallery" and "Build with Codes".
 *
 * It is the same page for the canvas and for Exchange's "Try it": the public copy has no owner controls and no
 * private design id in its form actions.
 */
const kit = require('openvibe-shared/kit');
const { layout, esc } = require('../render/layout');
const { renderLook } = require('../create/element');

// Each kind of outcome has a kit icon; the row's tint says the same thing in colour (design.css .el-out--*).
const ICON = { refused: 'ban', cost: 'coin', chance: 'help', robot: 'robot', screen: 'grid', state: 'chart', stream: 'live', ai: 'spark', money: 'coin', chat: 'chat', unknown: 'info' };

const money = (n) => (n == null ? '–' : `$${Number(n) < 0.1 ? Number(n).toPrecision(2) : Number(n).toFixed(2)}`);

function priceLine({ design = null, price = null }) {
    const making = design && design.estimate && Number.isFinite(Number(design.estimate.total))
        ? `Making it cost ${money(design.estimate.total)}${design.estimate.priced === false ? ' (some models unpriced)' : ''}. `
        : '';
    const calls = price && price.calls && price.calls.length
        ? (price.calls.map((c) => `${c.available ? `${c.model}: ${money(c.price_in)} in / ${money(c.price_out)} out per million${c.max_cost_usd != null ? `, at most ${money(c.max_cost_usd)} a press` : ''}` : `${c.model || 'The model'}: not on the live catalogue, price unknown`}`).join(' · '))
        : null;
    const lead = calls ? `Each press asks an AI. ${calls}.` : 'Free to run: no AI in it, only its recipe.';
    return `<p class="el-price">${kit.icon(calls ? 'spark' : 'check')}<span><b>${esc(lead)}</b> ${esc(making)}<small>An AI action is paid by the person whose channel runs it, from their own Balance; the element itself is free.</small></span></p>`;
}

/**
 * The sample run as turns: who pressed (or what was said in chat), then what happened, indented under it. Six
 * people pressing read as twelve equal boxes before; a turn keeps the cause and its result together.
 */
function timeline(sim) {
    if (!sim || !Array.isArray(sim.events) || !sim.events.length) return '<p class="dv-fine">No sample events.</p>';
    const turns = [];
    for (const e of sim.events) {
        if (e.kind === 'press' || e.kind === 'chat' || !turns.length) turns.push({ start: e, out: [] });
        else turns[turns.length - 1].out.push(e);
    }
    const plain = (t) => String(t || '').replace(/\s*\(simulated\)/g, '');
    const who = (e) => {
        if (e.kind === 'press') return `<b>${esc(e.person || 'Someone')}</b>${e.role ? ` <small>${esc(e.role)}</small>` : ''} <span>presses</span>`;
        if (e.kind === 'chat') return `${kit.icon('chat')}<span class="el-turn-chat">${esc(plain(e.text).replace(/^Chat:\s*/, ''))}</span>`;
        return `<span>${esc(plain(e.text))}</span>`;
    };
    const out = (e) => `<li class="el-out el-out--${esc(e.kind)}">${kit.icon(ICON[e.kind] || 'info')}<span>${esc(plain(e.text))}</span></li>`;
    return `<ol class="el-turns">${turns.map((t) => `<li class="el-turn${t.out.some((e) => e.kind === 'refused') ? ' is-refused' : ''}">
<p class="el-turn-who">${who(t.start)}</p>${t.out.length ? `<ul class="el-turn-out">${t.out.map(out).join('')}</ul>` : ''}</li>`).join('')}</ol>`;
}

/** The robot actions only, in the shape public/js/element-sim.js plays. */
function robotActions(sim) {
    const actions = [];
    for (const e of (sim && sim.events) || []) {
        if (e.kind !== 'robot') continue;
        const robot = e.robot && e.robot.kind === 'robot.drive_pulse' ? { ...e.robot, kind: 'robot.drive_pulse' } : e.headlight != null ? { on: e.headlight } : null;
        actions.push({ kind: 'robot', text: e.text, robot });
    }
    return actions;
}

function buildWithCodes({ element, design, baseUrl }) {
    const spec = [
        `Build an OpenVibe element mod for: ${element.name}.`,
        element.description || '',
        'The element document (ui.element@1) is below. Write the mod against ov.element@1 in the sandbox ' +
        '(iframe, opaque origin, postMessage only, no network except the streamer-listed endpoint), keep it under 256 KB, ' +
        'and test it in the element test bench.',
        JSON.stringify(element, null, 2),
    ].join('\n\n').slice(0, 12000);
    const href = `https://openvibe.codes/improve/OpenVibers/OpenVibe.Design?prompt=${encodeURIComponent(spec)}`;
    return `<details class="el-codes"><summary>Build with Codes</summary>
<p>OpenVibe.Codes writes the mod from this spec and its tests. Nothing is built until the streamer asks for it.</p>
<label>Task text <textarea rows="6" readonly>${esc(spec)}</textarea></label>
<p>${kit.button({ href, label: 'Build with Codes', kind: 'quiet' })} <span class="dv-fine">Opens OpenVibe.Codes with the task text prefilled.</span></p>
</details>`;
}

function tweakForm({ design, variant, editKey }) {
    const tweaks = (variant && variant.tweaks) || [];
    const ranges = tweaks.filter((t) => t.kind === 'range');
    const label = tweaks.find((t) => t.name === 'label');
    const icon = tweaks.find((t) => t.name === 'icon');
    const show = tweaks.find((t) => t.name === 'show_label');
    const suggested = icon ? require('../glyphs/suggest').score(label ? label.value : '').slice(0, 5) : [];
    if (!tweaks.length) return '';
    return `<form class="el-tweaks" method="post" action="/d/${encodeURIComponent(design.id)}/element/tweak">
<input type="hidden" name="key" value="${esc(editKey)}">
<fieldset><legend>Make it yours</legend>
${ranges.map((t) => `<label class="el-tweak"><span>${esc(t.label)}</span><input type="range" name="${esc(t.name)}" min="${Number(t.min)}" max="${Number(t.max)}" step="${Number(t.step)}" value="${Number(t.value)}" list="el-${esc(t.name)}-values"><datalist id="el-${esc(t.name)}-values">${(t.options || []).map((o, i) => `<option value="${i}">${esc(o)}</option>`).join('')}</datalist><small>${esc((t.options || [])[Number(t.value)] || '')}</small></label>`).join('')}
${label ? `<label class="el-tweak"><span>${esc(label.label)}</span><input type="text" name="label" maxlength="${Number(label.maxlength) || 40}" value="${esc(label.value)}" data-el-label></label>` : ''}
${icon ? `<label class="el-tweak el-tweak--icon"><span>${esc(icon.label)}</span><input type="text" name="icon" maxlength="${Number(icon.maxlength) || 32}" value="${esc(icon.value)}" placeholder="compass" autocomplete="off" spellcheck="false" data-el-icon><small>Suggested for “${esc(label ? label.value : '')}”:</small><span class="el-icon-row" data-el-icon-row>${suggested.map((g) => `<button type="button" class="el-icon-pick" data-el-icon-pick="${esc(g.name)}">${kit.icon(g.name)}<span>${esc(g.name)}</span></button>`).join('') || '<span class="dv-fine">Type a label for suggestions.</span>'}</span><small>Any OpenVibe glyph name, or a Font Awesome name. Leave it empty for no icon.</small></label>` : ''}
${show ? `<label class="el-tweak el-tweak--check"><input type="checkbox" name="show_label" value="1"${show.value ? ' checked' : ''}> ${esc(show.label)}</label>` : ''}
${kit.button({ label: 'Apply', type: 'submit', kind: 'quiet' })}
</fieldset></form>`;
}

/**
 * o: { design (null for a listing), element, sim, price, editKey, viewer, mode ('canvas'|'try'), notice, error,
 *      listingUrl, tryUrl, baseUrl }
 */
function elementPreview(o) {
    const { design = null, element, sim = null, price = null, editKey = '', viewer = null, mode = 'canvas', notice = null, error = null } = o;
    const mine = Boolean(design && viewer && (mode === 'canvas'));
    const signedIn = Boolean(viewer);
    const channel = design && design.elementChannel;
    const listing = design && design.elementListing;
    const variant = design && o.variant ? o.variant : null;
    const prompts = design ? `<p class="dv-fine">Made from: “${esc(design.prompt)}”</p>${design.elementRemixOf ? `<p class="dv-fine">Remixed from <a href="/gallery/${encodeURIComponent(design.elementRemixOf)}">the original</a>.</p>` : ''}` : '';
    const back = design
        ? { href: `/d/${encodeURIComponent(design.id)}${editKey ? `?key=${encodeURIComponent(editKey)}` : ''}`, label: 'Back to the design' }
        : { href: o.listingUrl || '/gallery', label: o.listingName || 'Elements and packs' };
    // A pack's Try it: its elements as chips, the open one marked; each is its own page (?item=N), no script.
    const pack = o.pack && o.pack.items.length > 1
        ? `<nav class="el-pack-pick" aria-label="${esc(o.listingName || 'The pack')}: its elements">${o.pack.items.map((name, i) => `<a class="el-g-chip" href="${esc(o.pack.href)}${i ? `?item=${i}` : ''}"${i === o.pack.index ? ' aria-current="page"' : ''}>${esc(name)}</a>`).join('')}</nav>`
        : '';
    const handoffs = mine ? `<div class="el-handoffs">
${channel && !channel.error ? `<p class="dv-ok" role="status">On your channel${channel.url ? `: <a href="${esc(channel.url)}">${esc(channel.url.replace(/^https?:\/\//, ''))}</a>` : '.'}</p>` : ''}
${channel && channel.error ? `<p class="dv-err" role="alert">${esc(channel.error)}</p>` : ''}
${listing && !listing.error ? `<p class="dv-ok" role="status">In the gallery${listing.url ? `: <a href="${esc(listing.url)}">${esc(listing.url)}</a>` : '.'}</p>` : ''}
${listing && listing.error ? `<p class="dv-err" role="alert">${esc(listing.error)}</p>` : ''}
<form method="post" action="/d/${encodeURIComponent(design.id)}/element/channel"><input type="hidden" name="key" value="${esc(editKey)}">${kit.button({ label: channel && !channel.error ? 'Add again to my channel' : 'Add to my channel', type: 'submit' })}</form>
<form method="post" action="/d/${encodeURIComponent(design.id)}/element/gallery"><input type="hidden" name="key" value="${esc(editKey)}">${kit.button({ label: listing && !listing.error ? 'Publish again to the gallery' : 'Publish to the gallery', type: 'submit', kind: 'quiet' })}</form>
<p class="dv-fine">Add to my channel puts it in your Live element library. Publish puts it in the Elements and packs gallery here on Design as a free listing under your name.${signedIn ? '' : ' Sign in to use either.'}</p>
</div>` : (mode === 'canvas' ? '<p class="dv-fine">Sign in at OpenVibe to add this element to your channel or publish it.</p>' : '');
    // The listing's own page is the back link on Try it, so no second "see it in the gallery" link.
    const share = o.listingUrl && mode !== 'try' ? `<p><a href="${esc(o.listingUrl)}">See it in the Elements and packs gallery →</a></p>` : '';
    const tryIt = o.tryUrl ? `<p><a class="ovk-btn ovk-btn--quiet" href="${esc(o.tryUrl)}">Try it again</a></p>` : '';
    const hasRobot = robotActions(sim).length > 0;
    const body = `<section class="el-page el-preview">
${kit.head({ title: element.name, sub: element.description || 'An element made with OpenVibe.Design.', back })}
${prompts}${pack}
${notice ? kit.notice({ kind: 'ok', text: notice }) : ''}${error ? kit.notice({ kind: 'error', text: error }) : ''}
<div class="el-grid">
<div class="el-look-panel">
<div class="el-look-stage">${renderLook(element)}</div>
${mode === 'canvas' ? `<p class="dv-fine">${esc(element.look.component)} · ${esc(element.look.label || '')}${element.look.style && element.look.style.tint ? ` · tint ${esc(element.look.style.tint)}` : ''}</p>` : ''}
${hasRobot ? `<canvas id="el-sim" width="320" height="240" aria-label="OpenVibe.Bot's simulated arena with the element's robot actions played on a local rover"></canvas>
<p class="dv-fine" id="el-sim-state" role="status">Bot's simulated arena: a picture, no robot connected.</p>` : ''}
<script type="application/json" id="el-sim-data">${JSON.stringify({ actions: robotActions(sim) }).replace(/</g, '\\u003c')}</script>
</div>
<div class="el-run">
<h2>On sample data</h2>
<p class="dv-fine">${sim && Array.isArray(sim.events) && sim.events.some((e) => e.kind === 'chat') ? 'Sample people type in a sample chat.' : 'Six sample people, one of each role, press it.'} No robot, Live channel, chat or AI is touched.</p>
${timeline(sim)}
${priceLine({ design, price })}
</div></div>
${tweakForm({ design, variant, editKey })}
${handoffs}
${share}${tryIt}
${design ? buildWithCodes({ element, design }) : ''}
</section>`;
    return layout({
        title: `${element.name} · Element`, description: element.description || `A free ${element.look.component} element made with OpenVibe.Design.`,
        path: o.path || (design ? `/d/${design.id}/element/preview` : `/elements/${o.listingId || ''}/try`),
        robots: o.robots || (design ? 'noindex, nofollow' : 'index, follow'),
        body, scripts: ['js/sim-world.js', 'js/element-sim.js', 'js/element-icon.js'], active: design ? '/create' : '/gallery',
    });
}

module.exports = { elementPreview, timeline, priceLine, robotActions, buildWithCodes };
