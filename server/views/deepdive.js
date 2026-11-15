'use strict';

/**
 * The plain pages of "Research first": the composer's module, the canvas's report panel, one report read on
 * Design, "How others do it" on a component page, and the owner's "Proposed from research" list. The look is
 * the main session's; this is kit markup and the words the brief names, nothing restyled.
 *
 * A crop is commentary: it is shown small with its site, its address and the day it was read, and it is never
 * pasted into a design. A reference token is a direction, never a palette to copy.
 */
const kit = require('openvibe-shared/kit');
const { layout, esc } = require('../render/layout');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (iso) => { const t = Date.parse(iso); if (!isFinite(t)) return ''; const d = new Date(t); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const usd = (n) => (n == null || !Number.isFinite(Number(n)) ? '' : Number(n) >= 1 ? `$${Number(n).toFixed(2)}` : Number(n) > 0 ? `${Math.max(1, Math.round(Number(n) * 100))}¢` : 'free');
const publicUrl = (url) => { const s = String(url || ''); return /^\//.test(s) && !/^\/research\//.test(s) ? `https://openvibe.exchange${s}` : s; };
// A report is written by another service: no link or image in it may carry a scheme we did not choose.
const safeHref = (url) => { const s = String(url || ''); return /^(https?:\/\/|\/)/i.test(s) ? publicUrl(s) : null; };
const safeImage = (url) => { const s = String(url || ''); return /^(https?:\/\/|\/|data:image\/)/i.test(s) ? (s.startsWith('data:') ? s : publicUrl(s)) : null; };
const host = (url) => { try { return new URL(String(url)).hostname.replace(/^www\./, ''); } catch { return ''; } };
const DEPTH_LINE = { quick: 'Six sites, about three minutes', thorough: 'Fifteen sites, a deeper read', expert: 'Thirty sites, plus interactions, accessibility and speed' };

function cropSrc(e, research) {
    if (e && e.crop) return publicUrl(e.crop);
    if (e && e.cropId && research && research.id) return `/research/${encodeURIComponent(research.id)}/crop/${encodeURIComponent(e.cropId)}`;
    return null;
}
function evidenceList(evidence, { crops = false, research = null } = {}) {
    const list = Array.isArray(evidence) ? evidence : [];
    if (!list.length) return '';
    return `<ul class="dd-evidence">${list.map((e) => {
        const site = e.site || host(e.url);
        const label = site || (e.url ? 'Source' : 'Evidence');
        const href = safeHref(e.url);
        const link = href ? `<a href="${esc(href)}" rel="noopener">${esc(label)}</a>` : `<span>${esc(label)}</span>`;
        const when = e.capturedAt ? ` · read ${esc(day(e.capturedAt) || String(e.capturedAt).slice(0, 10))}` : '';
        const src = crops ? safeImage(cropSrc(e, research)) : null;
        const crop = src ? `<img class="dd-crop" src="${esc(src)}" alt="A crop from ${esc(label)}" loading="lazy" decoding="async">` : '';
        return `<li>${crop}<span class="dd-ev">${link}${when}${e.note ? ` · ${esc(e.note)}` : ''}</span></li>`;
    }).join('')}</ul>`;
}

/** The composer's "Research first" module. `options` is GET /api/deep-dive/options. */
function researchModule({ options = null, recent = [], signedIn = false } = {}) {
    const o = options || {};
    const depths = Array.isArray(o.depths) ? o.depths : [];
    const priced = depths.some((d) => d.price_usd != null);
    if (!signedIn) {
        // Like every module, the summary says its value, and the value is Off until a dive is chosen: "Research first
        // Deep dive" read as if one were already on (the 11-12 review).
        return `<details class="dv-mod" data-mod="research"><summary><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg><span class="dv-mod-k">Research first</span><b>Off</b></summary>
<div class="dv-mod-sheet" role="group" aria-label="Research first"><header><b>Research first</b><small>An expert design research run: we search everywhere, capture the best sites at phone and computer sizes, and tell you what works and why. It goes into the brief for every take.</small></header>
<p>${kit.button({ href: '/auth/login?next=%2Fcreate', label: 'Sign in to start a deep dive', kind: 'quiet', icon: 'spark' })}</p>
<p class="dv-fine">A deep dive is priced and held on your Balance before it runs. <a href="/deep-dive">Read about design deep dives</a>.</p></div></details>`;
    }
    const depthRows = depths.length ? depths.map((d, i) => `<label class="dv-opt"><input type="radio" name="research_depth" value="${esc(d.id)}" data-label="${esc(d.name || d.id)}"${d.id === 'thorough' || (!i && !depths.some((x) => x.id === 'thorough')) ? ' checked' : ''}><span><b>${esc(d.name || d.id)}</b><small>${esc(d.line || DEPTH_LINE[d.id] || '')}${d.price_usd != null ? ` · ${usd(d.price_usd)}` : ''}${d.sites ? ` · ${Number(d.sites)} sites` : ''}</small></span></label>`).join('')
        : `<p class="dv-fine">The depths are not readable right now. <a href="/deep-dive">Start a design deep dive</a>, then attach it here.</p>`;
    const done = (recent || []).filter((r) => r && r.id);
    const recentRows = done.length ? `<label class="dv-start"><span>Or attach a dive you already ran</span><select name="research_id"><option value="">None</option>${done.map((r) => `<option value="${esc(r.id)}">${esc(String(r.question || 'Deep dive').slice(0, 80))}${r.status === 'running' ? ' (still running)' : ''} · ${esc(day(r.createdAt))}</option>`).join('')}</select></label>` : '';
    return `<details class="dv-mod" data-mod="research"><summary><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/></svg><span class="dv-mod-k">Research first</span><b data-mod-v>Off</b></summary>
<div class="dv-mod-sheet" role="group" aria-label="Research first"><header><b>Research first</b><small>A deep dive's synthesis (patterns, do and don't, reference tokens as inspiration, the rules it cites) becomes part of the generation brief. Each take says which research points it follows. A site's assets and code are never copied.</small></header>
<label class="dv-opt dv-opt--check"><input type="checkbox" name="research" value="new" data-research="on"><span><b>Start a deep dive for this design</b><small>The takes wait for its report, then are drawn from it.</small></span></label>
<div class="dv-deep" data-research-new hidden>
${depthRows}
${priced ? '' : '<p class="dv-fine">The price is shown before the dive starts on <a href="/deep-dive">the design deep dive page</a>.</p>'}
</div>
<div class="dv-deep" data-research-attach>
${recentRows}
<label class="dv-start"><span>Or paste a report link or run id</span><input type="text" name="research_ref" autocomplete="off" maxlength="2000" placeholder="https://openvibe.exchange/deep-dive/…"></label>
</div>
<p class="dv-fine">A dive is a separate priced run on OpenVibe.AI; its report stays readable on OpenVibe Exchange and at <span class="dd-inline">/research/&lt;id&gt;</span> here. Research informs; it never copies a site's assets or code.</p></div></details>`;
}

/** The canvas's research panel: the live steps, then the numbered points the takes follow. */
function researchPanel(research) {
    if (!research || !research.id) return '';
    const steps = (research.progress && Array.isArray(research.progress.steps)) ? research.progress.steps : [];
    const points = Array.isArray(research.points) ? research.points : [];
    const running = research.status === 'starting' || research.status === 'running';
    const stepList = steps.length ? `<ol class="dd-steps">${steps.map((s) => `<li class="dd-step is-${esc(s.state || 'waiting')}"><span>${esc(s.name)}</span></li>`).join('')}</ol>` : '';
    const shown = points.slice(0, 6);
    const pointsList = shown.length ? `<ol class="dd-points">${shown.map((p) => `<li id="p${esc(String(p.n))}"><a href="${esc(research.url)}#p${esc(String(p.n))}"><span class="dd-n">${esc(String(p.n))}</span>${esc(p.text)}</a></li>`).join('')}</ol>${points.length > shown.length ? `<p class="dv-fine"><a href="${esc(research.url)}">All ${points.length} research points on the report</a></p>` : ''}` : '';
    const stateKey = `${research.status}|${steps.map((s) => s.state).join(',')}`;
    return `<section class="dv-research" data-dv-research="${esc(research.id)}" data-dd-state="${esc(stateKey)}" aria-labelledby="dv-research-h">
<h2 id="dv-research-h">Research first${running ? ' · working' : research.status === 'done' ? ' · its report' : ''}</h2>
<p class="dv-research-q">${esc(research.question || 'A deep dive')} · ${esc(research.depth || 'thorough')}${research.priceUsd != null ? ` · ${esc(usd(research.priceUsd))}` : ''}${research.status === 'done' ? ` · ${points.length} points` : ''}</p>
${stepList}
${research.status === 'failed' ? `<p class="dv-fine is-error">The deep dive did not finish${research.error ? `: ${esc(research.error)}` : ''}. The takes are drawn without it.</p>` : ''}
${running ? `<p class="dv-fine">The takes wait for the report. <a href="${esc(research.url)}">Follow it</a>.</p>` : research.reportUrl && safeHref(research.reportUrl) ? `<p class="dv-links"><a href="${esc(research.url)}">Read the report on Design</a> · <a href="${esc(safeHref(research.reportUrl))}" rel="noopener">On OpenVibe Exchange</a></p>` : `<p class="dv-links"><a href="${esc(research.url)}">Read the report</a></p>`}
${pointsList}</section>`;
}

/** The chips on one take: the points it was asked to follow, linked to the report. */
function takePoints(points, research) {
    if (!Array.isArray(points) || !points.length) return '';
    const base = research && research.url ? research.url : '#';
    return `<p class="dv-take-research">Follows ${points.map((p) => `<a href="${esc(base)}#p${esc(String(p.n))}" title="${esc(String(p.text || '').slice(0, 240))}">research point ${esc(String(p.n))}</a>`).join(', ')}</p>`;
}

/** The screenshots, by site: phone and computer, light and dark; each opens full page in the viewer (deep-dive-shots.js). */
function shotsGallery(r) {
    const shots = Array.isArray(r.shots) ? r.shots : [];
    if (!shots.length) return '';
    const base = `/research/${encodeURIComponent(r.id || '')}/crop/`;
    const bySite = new Map();
    for (const s of shots) { const k = s.sourceId || s.url; if (!bySite.has(k)) bySite.set(k, []); bySite.get(k).push(s); }
    const order = (s) => (s.viewport < 700 ? 0 : 2) + (s.theme === 'dark' ? 1 : 0);
    const label = (s) => `${s.viewport < 700 ? 'Phone' : 'Computer'} · ${s.theme === 'dark' ? 'dark' : 'light'}`;
    const cards = [...bySite.values()].map((list) => {
        const first = list[0];
        const frames = list.slice().sort((a, b) => order(a) - order(b)).map((s) => `<a class="dds-frame${s.viewport < 700 ? ' is-phone' : ''}" href="${base}${encodeURIComponent(s.id)}" data-dd-shot="${esc(`${host(s.url)} · ${label(s)}`)}"><img src="${base}${encodeURIComponent(s.cropId || s.id)}" alt="${esc(`${host(s.url)}, ${label(s)}`)}" loading="lazy" decoding="async"><span>${esc(label(s))}</span></a>`).join('');
        return `<article class="dds-site"><header><a href="${esc(/^https?:\/\//i.test(first.url) ? first.url : '#')}" rel="noopener noreferrer" target="_blank">${esc(first.site || host(first.url))}</a><small>${esc(host(first.url))}${first.capturedAt ? ` · read ${esc(day(first.capturedAt))}` : ''}${list.some((s) => s.cached) ? ' · from the week\'s cache' : ''}</small></header><div class="dds-row">${frames}</div></article>`;
    }).join('');
    return `<section class="dd-sec dds" aria-labelledby="dds-h" data-dd-shots><h2 id="dds-h">The screenshots <small>${shots.length} from ${bySite.size} site${bySite.size === 1 ? '' : 's'}</small></h2>
<p class="dv-fine">Private to you. Each is shown as commentary with its site and the day it was read; open one to see the whole page.</p>${cards}</section>`;
}

/** The image search pages the dive read (ai.deep-dive@1 image_sheets): each a whole grid of recent images, read at once. */
function imageSheetsSection(r) {
    const sheets = Array.isArray(r.imageSheets) ? r.imageSheets : [];
    if (!sheets.length) return '';
    const base = `/research/${encodeURIComponent(r.id || '')}/crop/`;
    return `<section class="dd-sec dds" aria-labelledby="ddi-h" data-dd-shots><h2 id="ddi-h">Image search, a page at a time <small>${sheets.length}</small></h2>
<div class="ddi-grid">${sheets.map((x) => `<figure class="ddi-sheet"><a href="${base}${encodeURIComponent(x.id)}" data-dd-shot="${esc(`${x.engine || 'images'} · ${x.query || ''}`)}"><img src="${base}${encodeURIComponent(x.id)}" alt="${esc(`Image results for ${x.query || ''}`)}" loading="lazy" decoding="async"></a><figcaption><b>${esc(x.query || '')}</b><small>${esc([x.engine, x.recency && x.recency !== 'any' ? `past ${x.recency}` : null, x.count ? `${x.count} images` : null].filter(Boolean).join(' · '))}</small>${x.reading ? `<p>${esc(String(x.reading).slice(0, 600))}</p>` : ''}</figcaption></figure>`).join('')}</div></section>`;
}

/** One report, read on Design: the numbered points with their evidence, and the rules it proposes. */
function researchPage({ research, viewer = null, notice = null, error = null } = {}) {
    const r = research || {};
    const points = Array.isArray(r.points) ? r.points : [];
    const groups = [...new Set(points.map((p) => p.group))];
    const steps = (r.progress && Array.isArray(r.progress.steps)) ? r.progress.steps : [];
    const proposals = Array.isArray(r.proposals) ? r.proposals : [];
    const running = r.status === 'starting' || r.status === 'running';
    const body = `<div class="ds-wrap tk dd-page">
<header class="ds-page-h"><p class="ds-kicker">Research first</p><h1>${esc(r.question || 'A deep dive')}</h1>
<p class="ds-lede">A ${esc(r.depth || 'thorough')} deep dive${r.priceUsd != null ? ` (${esc(usd(r.priceUsd))})` : ''}${r.createdAt ? `, started ${esc(day(r.createdAt))}` : ''}; the takes on its design follow the numbered points below. ${safeHref(r.reportUrl) ? `<a href="${esc(safeHref(r.reportUrl))}" rel="noopener">The run on OpenVibe Exchange</a>.` : ''}</p>
<p class="dd-status">${running ? 'Working' : r.status === 'done' ? `Done · ${points.length} research points` : r.status === 'failed' ? 'Did not finish' : esc(r.status || '')}${r.error ? ` · ${esc(r.error)}` : ''}</p>
${notice ? `<p class="dd-notice">${esc(notice)}</p>` : ''}${error ? `<p class="dd-notice is-error">${esc(error)}</p>` : ''}
${steps.length ? `<ol class="dd-steps">${steps.map((s) => `<li class="dd-step is-${esc(s.state || 'waiting')}"><span>${esc(s.name)}</span></li>`).join('')}</ol>` : ''}
</header>
${points.length ? `<section class="dd-sec" aria-labelledby="dd-points-h"><h2 id="dd-points-h">The research points</h2>
${groups.map((g) => `<h3>${esc(g === "don't" ? 'Do not' : g === 'do' ? 'Do' : g === 'research' ? 'What the best write-ups say' : g === 'reference token' ? 'Reference tokens, as inspiration' : g)}</h3><ol class="dd-points dd-points--page">${points.filter((p) => p.group === g).map((p) => `<li id="p${esc(String(p.n))}"><span class="dd-n">${esc(String(p.n))}</span><div><p>${esc(p.text)}</p>${evidenceList(p.evidence, { crops: true, research: r })}</div></li>`).join('')}</ol>`).join('')}
</section>` : running ? kit.empty({ icon: 'spark', title: 'Still researching', text: 'The points appear here as the dive writes them up.' }) : kit.empty({ icon: 'search', title: 'No report yet', text: 'This deep dive has not produced a report.' })}
${shotsGallery(r)}${imageSheetsSection(r)}
${proposals.length ? `<section class="dd-sec" aria-labelledby="dd-props-h"><h2 id="dd-props-h">Proposed from research</h2>${proposalsList(proposals, { compact: true })}</section>` : ''}
<p class="dd-back"><a href="${r.designId ? `/d/${encodeURIComponent(r.designId)}` : '/create'}">${r.designId ? 'Back to the design' : 'Create a design'}</a></p>
</div>`;
    return layout({ title: `${String(r.question || 'A deep dive').slice(0, 70)} · Research`, description: 'A deep dive report on OpenVibe.Design: patterns, do and don\'t, reference tokens and the rules it cites, with the evidence behind each point.', path: `/research/${r.id || ''}`, robots: 'noindex, nofollow', styles: ['css/deepdive.css'], scripts: ['js/deep-dive-shots.js'], body });
}

/** "How others do it" on a component page. Empty and absent until a finished dive has a point for it. */
function componentFinds({ component, finds = [], reports = 0 } = {}) {
    if (!Array.isArray(finds) || !finds.length) return '';
    return `<section class="crl-sec dd-finds" id="how-others" aria-labelledby="dd-finds-h"><h2 id="dd-finds-h">How others do it</h2>
<p>From ${reports === 1 ? 'a deep dive' : `${reports} deep dives`} on this component. Each crop is commentary: it is shown with its site and the day it was read, and is never copied into a design.</p>
<ul class="dd-find-list">${finds.map((f) => `<li class="dd-find">
${safeImage(cropSrc({ crop: f.crop, cropId: f.cropId }, { id: f.researchId })) ? `<a href="${esc(safeHref(f.url) || safeImage(cropSrc({ crop: f.crop, cropId: f.cropId }, { id: f.researchId })))}" rel="noopener"><img class="dd-crop" src="${esc(safeImage(cropSrc({ crop: f.crop, cropId: f.cropId }, { id: f.researchId })))}" alt="A crop from ${esc(f.site || host(f.url) || 'a reference site')}" loading="lazy" decoding="async"></a>` : ''}
<div><b>${esc(f.title || 'A finding')}</b>
${f.site || f.capturedAt || f.url ? `<p class="dd-attrib">${esc(f.site || host(f.url) || 'Reference')}${f.capturedAt ? ` · read ${esc(day(f.capturedAt) || String(f.capturedAt).slice(0, 10))}` : ''}${safeHref(f.url) ? ` · <a href="${esc(safeHref(f.url))}" rel="noopener">the site</a>` : ''}${f.n ? ` · <a href="${esc(f.researchUrl)}#p${esc(String(f.n))}">research point ${esc(String(f.n))}</a>` : f.researchUrl ? ` · <a href="${esc(f.researchUrl)}">the report</a>` : ''}</p>` : ''}
</div></li>`).join('')}</ul></section>`;
}

function proposalsList(proposals, { owner = false, compact = false } = {}) {
    const list = Array.isArray(proposals) ? proposals : [];
    if (!list.length) return compact ? '' : kit.empty({ icon: 'spark', title: 'No proposed rules', text: 'A deep dive that proposes a rule for the register shows it here. Nothing is added by itself.' });
    return `<div class="dd-props">${list.map((p) => `<article class="dd-prop" id="proposal-${esc(p.id)}">
<header><span class="dd-prop-state is-${esc(p.state)}">${p.state === 'approved' ? 'Approved' : p.state === 'dismissed' ? 'Dismissed' : 'Proposed'}</span><h3>${esc(p.rule)}</h3></header>
${p.detail ? `<p>${esc(p.detail)}</p>` : ''}
${p.why ? `<p class="dd-why"><span>Why</span> ${esc(p.why)}</p>` : ''}
${p.evidence && p.evidence.length ? evidenceList(p.evidence, { crops: true, research: p.research }) : ''}
<p class="dd-attrib">${p.research ? `From <a href="${esc(p.research.url)}">${esc(p.research.question || 'a deep dive')}</a>` : 'From a deep dive'} · area: ${esc(p.area || 'products')}</p>
${safeHref(p.prUrl) ? `<p class="dd-pr"><a href="${esc(safeHref(p.prUrl))}" rel="noopener">The pull request against the register</a></p>` : ''}
${p.prError ? `<p class="dd-notice is-error">${esc(p.prError)}</p>` : ''}
${owner && p.state === 'proposed' ? `<div class="dd-prop-acts">
<form method="post" action="/rules/proposals/${esc(p.id)}/approve"><button type="submit" class="ovk-btn ovk-btn--primary">Approve and open a pull request</button></form>
<form method="post" action="/rules/proposals/${esc(p.id)}/dismiss"><button type="submit" class="ovk-btn ovk-btn--quiet">Dismiss</button></form>
</div>` : ''}
</article>`).join('')}</div>`;
}

/** "Proposed from research" on /rules, for the owner only. */
function proposalsSection(proposals) {
    return `<section class="rl-sec dd-proposed" aria-labelledby="rl-proposed-h"><div class="rl-sec-head"><h2 id="rl-proposed-h">Proposed from research</h2><p>A deep dive can propose a rule for this register, with the evidence behind it. Only the owner decides; approval opens a pull request against <code>server/rules/register.js</code>. Nothing is added by itself.</p></div>
${proposalsList(proposals, { owner: true })}</section>`;
}

// ── The design deep dive's own pages (11-15, the owner: the deep dive "was supposed to be for openvibe.design", built
// on Exchange's general deep dive, which researches any question). /deep-dive starts one; /research/:id follows it
// live (public/js/deep-dive-live.js, the live view Exchange had) until its report is written. ──

const STEP_LABELS = { plan: 'Planning', search: 'Searching', read: 'Reading write-ups', choose: 'Choosing sites', capture: 'Capturing', analyse: 'Analysing', synthesise: 'Writing it up', report: 'The report' };
const STEP_NOTES = {
    plan: 'The questions an expert designer would ask, and the searches that answer them.',
    search: 'Exchange\'s research sources and engines, open-source projects on GitHub, design write-ups, and our own rules register and component registry.',
    read: 'The general deep dive at its core: the best design write-ups read in full, noted against the questions, and answered with their sources.',
    choose: 'The sites worth capturing, with a reason each. On Thorough and Expert you can add or drop any before Capture.',
    capture: 'Each site at 390 and 1280 px, light and dark where it supports dark, full page after a slow scroll, with its measured type, colour, spacing and components.',
    analyse: 'A vision model reads each screenshot; a text model reads the measured facts and the words.',
    synthesise: 'Patterns across sites, the gap nobody fills, reference tokens, and recommendations checked against our rules.',
    report: 'The report, its evidence and the receipt.',
};
const jsLit = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const when = (iso) => { if (!iso) return ''; try { return new Date(iso).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; } catch { return String(iso); } };

/** /deep-dive: what a design deep dive does, the form (question, depth with its price, sites already known), your dives. */
function deepDivePage({ options = null, recent = [], signedIn = false, question = '', error = null } = {}) {
    const depths = (options && Array.isArray(options.depths) ? options.depths : []);
    const depthCards = depths.length
        ? `<fieldset class="ddh-depths"><legend>Depth</legend>${depths.map((d, i) => `<label class="ddh-depth"><input type="radio" name="depth" value="${esc(d.id)}"${d.id === 'quick' || (!i && !depths.some((x) => x.id === 'quick')) ? ' checked' : ''}><span><b>${esc(d.name || d.id)}</b><strong>${esc(usd(d.price_usd))}</strong><small>${esc(d.line || DEPTH_LINE[d.id] || (d.sites ? `${Number(d.sites)} sites` : ''))}</small></span></label>`).join('')}</fieldset>`
        : '<p class="dv-fine">The depths and their prices are not readable right now; try again in a moment.</p>';
    const form = signedIn
        ? `<form method="post" action="/deep-dive" class="ddh-form">
<label class="ddh-field"><span>What are you designing?</span><textarea name="question" rows="3" maxlength="500" required placeholder="A phone-first robot control panel">${esc(question)}</textarea></label>
${depthCards}
<label class="ddh-field"><span>Sites you already know <small>(optional, one per line)</small></span><textarea name="sites" rows="2" maxlength="4000" placeholder="https://example.com/panel"></textarea></label>
<div class="ddh-go">${kit.button({ label: 'Start the deep dive', type: 'submit', icon: 'spark' })}<p class="dv-fine">The price is held before it starts; you can stop it at any step.</p></div>
${error ? `<p class="dd-notice is-error" role="alert">${esc(error)}</p>` : ''}
</form>`
        : kit.empty({ icon: 'person', title: 'Sign in to run a design deep dive', text: 'It spends your allowance and keeps private screenshots, so it needs your account. What it does is below.', action: { href: '/auth/login?next=%2Fdeep-dive', label: 'Sign in with OpenVibe' } });
    const mine = (recent || []).filter((r) => r && r.id);
    const list = signedIn && mine.length ? `<section class="dd-sec" aria-labelledby="ddh-mine-h"><h2 id="ddh-mine-h">Your deep dives</h2><ul class="ddh-mine">${mine.slice(0, 12).map((r) => `<li><a href="/research/${encodeURIComponent(r.id)}">${esc(String(r.question || 'A deep dive').slice(0, 120))}</a><small>${esc(r.depth || '')} · ${esc(r.status === 'done' ? 'done' : r.status || '')} · ${esc(day(r.createdAt))}</small></li>`).join('')}</ul></section>` : '';
    const step = (n, title, text) => `<li><span class="ddh-n">${n}</span><div><b>${title}</b><p>${text}</p></div></li>`;
    const what = `<section class="dd-sec" aria-labelledby="ddh-what-h"><h2 id="ddh-what-h">What a design deep dive does</h2><ol class="ddh-what">
${step(1, 'Researches the question first.', 'The core is <a href="https://openvibe.exchange/deep-dive">Exchange\'s deep dive</a>: the questions an expert would ask, every search we have, and the write-ups worth reading.')}
${step(2, 'Chooses the sites worth a look.', 'A model ranks real products with a reason each; on Thorough and Expert you can add or drop any before Capture.')}
${step(3, 'Captures them properly.', '390 and 1280 px, dark and light where the site supports it, the whole page after a slow scroll, with its type scale, palette, spacing, grid and components measured. Expert adds open menus, hover and focus, axe-core and LCP/CLS/INP.')}
${step(4, 'Reads them as a designer.', 'A vision model reads each screenshot and a text model the measured facts and the words: hierarchy, density, what draws the eye, what works and what fails.')}
${step(5, 'Writes it up against our rules.', 'The patterns and how many sites use each, the best version, what everyone gets wrong, the gap nobody fills, reference tokens as direction, do and don\'t, and recommendations that say which of our rules they follow or would change.')}
${step(6, 'Feeds your designs.', 'Its numbered points become the brief for a design on <a href="/create">Create</a> (Research first), and every take says which points it follows. Nothing from a captured site is ever copied.')}
</ol></section>`;
    const body = `<div class="ds-wrap tk dd-page ddh">
<header class="ds-page-h"><p class="ds-kicker">Research first</p><h1>Design deep dive</h1>
<p class="ds-lede">Expert design research: we research your question in full, capture the best sites at phone and computer sizes, and tell you what works and why, checked against OpenVibe's own rules.</p></header>
${form}${list}${what}</div>`;
    return layout({ title: 'Design deep dive', description: 'Expert design research on OpenVibe.Design: the question researched in full, the best sites captured at phone and computer sizes and read as a designer, written up against our rules.', path: '/deep-dive', styles: ['css/deepdive.css'], body });
}

/** /research/:id while it runs: the live view, drawn from AI's state and redrawn every two seconds; choosing sites. */
function researchLivePage({ research, state }) {
    const r = research || {};
    const st = state || {};
    const id = r.id || '';
    const base = `/research/${encodeURIComponent(id)}`;
    const since = st.created_at || r.createdAt;
    const seed = { id, since, stateUrl: `${base}/state`, shotUrl: `${base}/crop/`, labels: STEP_LABELS, notes: STEP_NOTES, order: Object.keys(STEP_LABELS),
        minutes: { quick: 3, thorough: 8, expert: 18 }[r.depth] || null,
        state: { status: st.status || 'queued', step: st.step || 'plan', progress: st.progress || 0, steps: st.steps || [], site_limit: st.site_limit || null,
            candidates: (st.candidates || []).map((c) => ({ url: c.url, title: c.title, reason: c.reason, source_id: c.source_id, kind: c.kind, chosen: c.chosen })),
            captures: (st.captures || []).map((c) => ({ id: c.id, source_id: c.source_id, url: c.url, viewport: c.viewport, theme: c.theme, skip: c.skip, cached: c.cached, crops: (c.crops || []).slice(0, 1).map((x) => ({ id: x.id })) })),
            gaps: st.gaps || [], error: st.error || null } };
    const choosing = st.status === 'choosing';
    const steps = new Map((st.steps || []).map((x) => [x.key, x]));
    const fallback = `<ol class="dd-steps">${Object.keys(STEP_LABELS).map((k) => { const x = steps.get(k) || { status: 'pending' }; return `<li class="dd-step is-${esc(x.status)}"><span>${esc(STEP_LABELS[k])}${x.detail ? ` · ${esc(x.detail)}` : ''}</span></li>`; }).join('')}</ol>`;
    const chooseForm = choosing ? `<section class="dd-sec ddh-choose" aria-labelledby="ddh-choose-h"><h2 id="ddh-choose-h">Choose the sites to capture</h2>
<p class="dv-fine">Drop any you do not want, add your own, then start the capture (or it starts by itself when the wait ends).</p>
<ul class="ddh-cands">${(st.candidates || []).map((c) => `<li><div><a href="${esc(/^https?:\/\//i.test(c.url) ? c.url : '#')}" rel="noopener noreferrer" target="_blank">${esc(c.title || host(c.url))}</a><small>${esc(host(c.url))}${c.reason ? ` · ${esc(c.reason)}` : ''}</small></div><form method="post" action="${base}/sites"><input type="hidden" name="drop" value="${esc(c.url)}">${kit.button({ label: 'Drop', type: 'submit', kind: 'quiet', small: true })}</form></li>`).join('')}</ul>
<form method="post" action="${base}/sites" class="ddh-form"><label class="ddh-field"><span>Add sites <small>(one per line)</small></span><textarea name="sites" rows="2" maxlength="4000"></textarea></label><input type="hidden" name="start" value="1"><div class="ddh-go">${kit.button({ label: 'Start the capture', type: 'submit', icon: 'spark' })}</div></form></section>` : '';
    const body = `<div class="ds-wrap tk dd-page">
<header class="ds-page-h"><p class="ds-kicker">Design deep dive</p><h1>${esc(r.question || 'A deep dive')}</h1>
<p class="ds-lede">A ${esc(r.depth || 'thorough')} deep dive${r.priceUsd != null ? ` · ${esc(usd(r.priceUsd))} held` : ''}${since ? ` · started ${esc(when(since))}` : ''}. Its report appears here when it is written.</p></header>
<section class="dd-live ddl-scope"${choosing ? '' : ' data-dd-run'}>${fallback}</section>
${chooseForm}
<form method="post" action="${base}/cancel" class="ddh-cancel">${kit.button({ label: 'Stop the deep dive', type: 'submit', kind: 'danger' })}<span class="dv-fine">Stopping ends the next model call and the next capture.</span></form>
<p class="dd-back"><a href="/deep-dive">All your deep dives</a></p>
</div><script type="application/json" id="dd-state">${jsLit(seed)}</script>`;
    return layout({ title: `${String(r.question || 'A deep dive').slice(0, 70)} · Deep dive`, description: 'A design deep dive at work.', path: base, robots: 'noindex, nofollow', styles: ['css/deepdive.css'], scripts: ['js/deep-dive-live.js', 'js/deep-dive-shots.js'], body });
}

module.exports = { researchModule, researchPanel, takePoints, researchPage, componentFinds, proposalsSection, proposalsList, evidenceList, day, usd, DEPTH_LINE, deepDivePage, researchLivePage, STEP_LABELS };
