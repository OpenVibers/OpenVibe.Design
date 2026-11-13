'use strict';

const { layout, esc } = require('../render/layout');
const kit = require('openvibe-shared/kit');
const ovServe = require('openvibe-shared/serve');
const { attrEscape } = require('../arena/sanitize');
const { themeCss } = require('../designs');
const deepDiveView = require('./deepdive');

// The composer's choices. The server takes kind, themeId and who (designs.create); each is a choice a person can see.
const G = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const MAKES = [
    { id: 'page', name: 'Page', glyph: G('<rect x="3" y="4.5" width="18" height="15" rx="3"/><path d="M3 9h18M7 13h6M7 16h10"/>'),
        placeholder: 'Describe the page: who it is for and what it should get them to do…',
        examples: ['Landing page for a coffee roaster', 'Pricing page with three plans', 'Portfolio for a photographer'] },
    { id: 'screen', name: 'App screen', glyph: G('<rect x="7" y="2.5" width="10" height="19" rx="3"/><path d="M10.5 5.5h3M10 17.5h4"/>'),
        placeholder: 'Describe the screen: what the app does and what this screen is for…',
        examples: ['Mobile onboarding', 'Dashboard for a fitness app', 'A music player, now playing'] },
    { id: 'component', name: 'Component', glyph: G('<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="3.5" y="13" width="17" height="7.5" rx="2"/>'),
        placeholder: 'Describe the part: what it shows and the states it has…',
        examples: ['Pricing section', 'Sign-up form with its errors', 'A stat card with a small chart'] },
    { id: 'slide', name: 'Slide', glyph: G('<rect x="3" y="4.5" width="18" height="12" rx="2.5"/><path d="M12 16.5V20M8.5 20h7M7 9h6M7 12h9"/>'),
        placeholder: 'Describe the slide: the one point it makes and who is in the room…',
        examples: ['Title slide for a launch talk', 'Three numbers from last quarter', 'A before and after comparison'] },
    { id: 'email', name: 'Email', glyph: G('<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.6 7.6l8.4 6 8.4-6"/>'),
        placeholder: 'Describe the email: who gets it and what you want them to do…',
        examples: ['Welcome email for a new member', 'A monthly product update', 'A receipt that reads well'] },
    { id: 'social-card', name: 'Social card', glyph: G('<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9.3" cy="9.6" r="1.7"/><path d="M4.6 16.4l4.4-4 3.4 3 2.6-2.2 4.4 4"/>'),
        placeholder: 'Describe the card: what it announces and where it will be posted…',
        examples: ['Going live tonight at 8', 'A quote from a customer', 'A new feature in one line'] },
    { id: 'mark', name: 'Mark', glyph: G('<circle cx="12" cy="12" r="8.2"/><path d="M8.4 12.4l2.4 2.4 4.8-5.4"/>'),
        placeholder: 'Describe the mark: the name, what it stands for and where it will be used…',
        examples: ['A mark for a robotics club', 'An app icon for a notes app', 'A monogram, two letters'] },
    { id: 'element', name: 'Element', glyph: G('<rect x="4" y="6" width="16" height="12" rx="6"/><circle cx="12" cy="12" r="2.4"/>'),
        placeholder: 'Describe an element: what it looks like and what it does…',
        examples: ['A big red button that makes the robot spin, once a minute, costs 100 points', 'A meter that fills when chat reacts', 'A button that turns the headlights on'] },
];
const MAKE = Object.fromEntries(MAKES.map((m) => [m.id, m]));
const FRAME_ICON = G('<rect x="3.5" y="5" width="12" height="9" rx="2"/><rect x="14" y="9.5" width="6.5" height="10" rx="2"/>');
const LINK_ICON = G('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.200 1.200M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1.200-1.200"/>');
const WHO = [
    { id: 'claude', name: 'Claude Opus 5.5', line: 'Three takes from one designer, the strongest' },
    { id: 'sonnet', name: 'Claude Sonnet 5.5', line: 'Three takes from one designer, sooner' },
    { id: 'any', name: 'Top three', line: 'One take each from the three best models you can use, your own keys first' },
    { id: 'compare', name: 'Three makers', line: 'One take each from three different companies, side by side' },
];
const SPARK = G('<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>');
const ARROW = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
// A theme's colours, only when they are plain colours (they go into a style attribute).
const colour = (v, fallback) => (/^(#[0-9a-f]{3,8}|rgba?\([0-9., %]+\))$/i.test(String(v || '')) ? String(v) : fallback);
const swatch = (t) => { const v = (t && t.variables) || {}; return `--b:${colour(v['--bg-primary'], '#0b0f19')};--c:${colour(v['--bg-card'], '#151b28')};--a:${colour(v['--accent'], '#3b82f6')};--t:${colour(v['--text-primary'], '#e6edf7')}`; };
function ago(iso, now = Date.now()) {
    const t = Date.parse(iso); if (!isFinite(t)) return '';
    const m = Math.max(0, Math.round((now - t) / 60000));
    if (m < 2) return 'just now'; if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
    const d = Math.round(h / 24); return d < 30 ? `${d} ${d === 1 ? 'day' : 'days'} ago` : new Date(t).toISOString().slice(0, 10);
}

/**
 * The page somebody who is not on a Specific-people design's list sees. It never shows the prompt,
 * a variant, a version or a thumbnail; OVShare.gate offers "Ask for access" to a signed-in person and
 * "Sign in" to everybody else.
 */
function gate({ id, signedInAs = null, signInUrl = '/auth/login' }) {
    const body = `<section class="dv-gate"><h1>A design on OpenVibe.Design</h1>
<p>This is shared with specific people.</p>
<div data-ov-share-gate data-kind="design" data-id="${esc(id)}"${signedInAs ? ` data-signed-in-as="${esc(signedInAs)}"` : ''} data-sign-in-url="${esc(signInUrl)}">This design is shared with specific people on OpenVibe.Design.</div>
</section>
<script src="${ovServe.url('ov-share.js')}" defer></script>`;
    return layout({ title: 'A design on OpenVibe.Design', path: '/d', robots: 'noindex, nofollow', body, scripts: [] });
}

// A look's four colours (page, text, accent, card) as the small picture's variables; plain colours only.
const lookStyle = (look) => { const w = (look && look.swatch) || []; return `--b:${colour(w[0], '#0b0f19')};--t:${colour(w[1], '#e6edf7')};--a:${colour(w[2], '#3b82f6')};--c:${colour(w[3], '#151b28')}`; };
const money = (n) => `$${Number(n).toFixed(2)}`;
// A maker's name as the maker writes it; "shared" is OpenVibe's own key for that model.
const MAKER = { openai: 'OpenAI', deepseek: 'DeepSeek', anthropic: 'Anthropic', google: 'Google', meta: 'Meta', xai: 'xAI', mistral: 'Mistral', minimax: 'MiniMax', openrouter: 'OpenRouter', shared: 'OpenVibe', local: 'Your machine' };
const maker = (p) => { const k = String(p || '').toLowerCase(); return MAKER[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : ''); };

/**
 * /create. `options` is what GET /api/create/options answers (kinds, frames, looks, models, takes, limits); without it
 * (the catalogue or the model list did not answer) the composer falls back to the themes and the four ways to pick a
 * designer, and the form posts as it always did. With a script, the form is sent to POST /api/create and the cost is
 * asked from POST /api/create/estimate as the choices change.
 */
function create({ recent = [], themes = [], options = null, research = null } = {}) {
    const o = options || {};
    const kinds = (o.kinds && o.kinds.length ? o.kinds : MAKES.slice(0, 3).map((m) => ({ id: m.id, name: m.name, frames: [] })))
        .map((k) => ({ ...k, ...(MAKE[k.id] || { glyph: MAKES[0].glyph, placeholder: 'Describe what you need…', examples: [] }), name: k.name || (MAKE[k.id] || {}).name || k.id }));
    const frames = o.frames || [];
    const looksAll = o.looks && o.looks.length ? o.looks
        : themes.map((t) => { const v = t.variables || {}; return { id: t.id, name: t.name, source: 'theme', swatch: [v['--bg-primary'], v['--text-primary'], v['--accent'], v['--bg-card']] }; });
    const looks = looksAll.slice(0, 12), look = looks[0] || null;
    const models = o.models || [];
    const takes = o.takes || { min: 1, max: 4, default: 3 };
    const limits = o.limits || { models: 4, takes_total: 8 };

    const kindRow = `<fieldset class="dv-kinds" data-ovk-scroll><legend class="dv-visually-hidden">What you are making</legend>${kinds.map((k, i) => `<label><input type="radio" name="kind" value="${esc(k.id)}" data-placeholder="${esc(k.placeholder)}" data-frames="${esc((k.frames || []).join(' '))}"${i ? '' : ' checked'}><span>${k.glyph}<b>${esc(k.name)}</b></span></label>`).join('')}</fieldset>`;
    const first = kinds[0] || { frames: [] };
    const frameMod = frames.length ? `<details class="dv-mod" data-mod="frame"><summary>${FRAME_ICON}<span class="dv-mod-k">Size</span><b data-mod-v>${esc((frames.find((f) => f.id === (first.frames || [])[0]) || frames[0]).name)}</b></summary>
<div class="dv-mod-sheet" role="group" aria-label="Size"><header><b>Size</b><small>The frame the design is drawn and judged in.</small></header>
${frames.map((f) => `<label class="dv-opt" data-frame="${esc(f.id)}"><input type="radio" name="frame" value="${esc(f.id)}" data-label="${esc(f.name)}"${f.id === (first.frames || [])[0] ? ' checked' : ''}><span><b>${esc(f.name)}</b><small>${Number(f.width)} × ${Number(f.height)}</small></span></label>`).join('')}</div></details>` : '';
    const lookMod = look ? `<details class="dv-mod" data-mod="look"><summary><i class="dv-sw" style="${lookStyle(look)}" data-mod-sw></i><span class="dv-mod-k">Look</span><b data-mod-v>${esc(look.name)}</b></summary>
<div class="dv-mod-sheet" role="group" aria-label="Look"><header><b>Look</b><small>Every take wears this theme. You can change it on the canvas.</small></header>
<div class="dv-looks">${looks.map((t, i) => `<label class="dv-look"><input type="radio" name="look" value="${esc(t.id)}" data-label="${esc(t.name)}" data-sw="${lookStyle(t)}"${i ? '' : ' checked'}><span style="${lookStyle(t)}"><i aria-hidden="true"></i><b>${esc(t.name)}</b></span></label>`).join('')}</div>
<a class="dv-mod-more" href="/themes">All ${looksAll.length} looks, or make your own</a></div></details>` : '';
    const modelRows = models.map((m) => `<label class="dv-opt dv-opt--check"><input type="checkbox" name="models" value="${esc(m.id)}" data-label="${esc(m.name)}"><span><b>${esc(m.name)}</b><small>${esc(maker(m.provider))}${m.price_in != null && m.price_out != null ? ` · ${money(m.price_in)} in, ${money(m.price_out)} out, per million tokens` : ''}</small></span></label>`).join('');
    const whoMod = `<details class="dv-mod" data-mod="who"><summary>${SPARK}<span class="dv-mod-k">Designer</span><b data-mod-v>${WHO[0].name}</b></summary>
<div class="dv-mod-sheet" role="group" aria-label="Designer"><header><b>Designer</b><small>Who draws the takes.</small></header>
<div class="dv-ways">${WHO.map((w, i) => `<label class="dv-opt"><input type="radio" name="who" value="${w.id}" data-label="${esc(w.name)}"${i ? '' : ' checked'}><span><b>${esc(w.name)}</b><small>${esc(w.line)}</small></span></label>`).join('')}</div>
${models.length ? `<p class="dv-group-h">Or choose the models yourself<small>Up to ${Number(limits.models) || 4}, side by side. Prices are OpenVibe Exchange's.</small></p>
<div class="dv-models" data-max="${Number(limits.models) || 4}">${modelRows}</div>
<div class="dv-takes"><span><b>Takes from each</b><small>${Number(limits.takes_total) || 8} takes at most in one run</small></span><span class="dv-step"><button type="button" data-step="-1" aria-label="One take fewer">−</button><input type="number" name="takes" inputmode="numeric" min="${Number(takes.min) || 1}" max="${Number(takes.max) || 4}" value="${Number(takes.default) || 3}" data-total="${Number(limits.takes_total) || 8}" aria-label="Takes from each model"><button type="button" data-step="1" aria-label="One take more">+</button></span></div>` : ''}
<a class="dv-mod-more" href="https://openvibe.exchange/models">Compare these models on OpenVibe Exchange</a></div></details>`;
    const researchMod = deepDiveView.researchModule({ options: research && research.options, recent: research && research.recent, signedIn: Boolean(research && research.signedIn) });
    const startMod = options ? `<details class="dv-mod" data-mod="start"><summary>${LINK_ICON}<span class="dv-mod-k">Start</span><b data-mod-v>Blank</b></summary>
<div class="dv-mod-sheet" role="group" aria-label="Start from"><header><b>Start from a page</b><small>Paste a public address and the takes begin from what that page says and how it is laid out. Leave it empty to start blank.</small></header>
<label class="dv-start"><span class="dv-visually-hidden">The page's address</span><input type="url" name="start_url" inputmode="url" autocomplete="off" placeholder="https://example.com/page" maxlength="2000"></label>
<p class="dv-start-note">An earlier design can be the start too: open it and press Remix.</p></div></details>` : '';
    const kindName = Object.fromEntries(kinds.map((k) => [k.id, k]));
    const lookName = Object.fromEntries(looksAll.map((t) => [t.id, t.name]));
    const body = `<section class="dv-create"><h1>What will you design?</h1>
<form method="post" action="/create" class="dv-composer" data-dv-composer${options ? ' data-api="/api/create"' : ''}>
${kindRow}
<label class="dv-visually-hidden" for="dv-prompt">Describe your design</label>
<textarea id="dv-prompt" name="prompt" required maxlength="${Number(limits.prompt) || 4000}" placeholder="${esc((kinds[0] || MAKES[0]).placeholder)}"></textarea>
<div class="dv-tray">${frameMod}${lookMod}${whoMod}${startMod}${researchMod}<button type="submit" class="dv-go"><span data-go-label>Create three takes</span>${ARROW}</button></div>
<p class="dv-cost" data-dv-cost role="status" hidden></p></form>
<div class="dv-examples" aria-label="Try an example">${kinds.map((k) => (k.examples || []).map((x) => `<button type="button" data-example="${esc(x)}" data-kind="${esc(k.id)}">${k.glyph}<span>${esc(x)}</span></button>`).join('')).join('')}</div>
<a class="dv-create-door" href="/gallery"><span class="dv-create-door-ic"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg></span><span><b>Elements and packs</b><small>Free controls and stream buttons people made with AI: try one, install it, remix it.</small></span><span class="dv-create-door-go" aria-hidden="true">${ARROW}</span></a>
${recent.length ? `<section class="dv-recent"><h2>Your recent designs</h2><ul>${recent.map((d) => { const k = kindName[d.kind] || MAKE[d.kind] || MAKES[0]; const bits = [k.name, lookName[d.look] || lookName[d.themeId], d.model, d.status === 'running' ? 'Drawing now' : d.status === 'failed' ? 'Did not finish' : ago(d.createdAt)].filter(Boolean);
        return `<li><a class="dv-rc" href="${esc(d.url)}"><span class="dv-rc-k" aria-hidden="true">${d.thumbnail ? `<img src="${esc(d.thumbnail)}" alt="" loading="lazy" decoding="async">` : k.glyph}</span><span class="dv-rc-t"><b>${esc(d.prompt)}</b><small>${esc(bits.join(' · '))}</small></span></a></li>`; }).join('')}</ul></section>` : ''}</section>`;
    return layout({ title: 'Create a design', path: '/create', body, active: '/create', styles: ['css/deepdive.css'], scripts: ['js/design.js'] });
}

const themeListener = `<script data-dv-theme="1">(function(){addEventListener('message',function(event){if(event.source!==parent||!event.data||event.data.type!=='design-theme')return;var style=document.getElementById('design-tokens');if(style&&typeof event.data.css==='string')style.textContent=event.data.css;});})();</script>`;

/**
 * The click-edit overlay. It is appended to the rendered srcdoc at render time and never stored with the model
 * HTML. It reports a stable nth-of-type path, a tag and whether the element is a leaf; the parent validates every
 * field before it sends one change back through the server. The script only uses DOM APIs and postMessage, so the
 * frame's `default-src 'none'` CSP still blocks every network request.
 */
const overlayScript = `<script data-dv-overlay="1">(function(){
'use strict';
var selected=null,lastOutline='';
function tagName(el){return el&&el.tagName?el.tagName.toLowerCase():'';}
function segment(el){var i=1,s=el;while((s=s.previousElementSibling)){if(s.tagName===el.tagName)i++;}return tagName(el)+':nth-of-type('+i+')';}
function pathOf(el){var parts=[];while(el&&el!==document.documentElement){if(el===document.body){parts.unshift('body');return parts.join(' > ');}parts.unshift(segment(el));el=el.parentElement;}return null;}
function allowed(el){var t=tagName(el);return !!t&&t!=='html'&&t!=='body'&&t!=='script'&&t!=='style'&&t!=='head'&&t!=='title'&&t!=='meta'&&t!=='link'&&t!=='iframe'&&t!=='object'&&t!=='embed'&&t!=='form'&&t!=='input'&&t!=='textarea'&&t!=='select';}
document.addEventListener('click',function(event){var el=event.target;if(!el||el.nodeType!==1)return;event.preventDefault();event.stopPropagation();if(!allowed(el))return;
if(selected&&selected.style){selected.style.outline=lastOutline;selected.style.outlineOffset='';}
selected=el;lastOutline=el.style.outline||'';el.style.outline='2px solid #7aa7ff';el.style.outlineOffset='2px';
var text=(el.textContent||'').replace(/\\s+/g,' ').trim().slice(0,400);
parent.postMessage({type:'design-select',path:pathOf(el),tag:tagName(el),leaf:el.children.length===0,text:text},'*');
},true);
document.addEventListener('submit',function(event){event.preventDefault();},true);
document.addEventListener('mouseover',function(event){var el=event.target;if(el&&el.nodeType===1&&allowed(el))el.style.cursor='crosshair';},true);
})();</script>`;

const framePolicy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">`;

function frame(html, title, { interactive = false } = {}) {
    const withPolicy = html.replace(/<head\b[^>]*>/i, `$&${framePolicy}`);
    const injected = `${themeListener}${interactive ? overlayScript : ''}`;
    const document = /<\/body>/i.test(withPolicy)
        ? withPolicy.replace(/<\/body>/i, `${injected}</body>`)
        : /<\/html>/i.test(withPolicy) ? withPolicy.replace(/<\/html>/i, `${injected}</html>`) : withPolicy + injected;
    return `<iframe title="${esc(title)}" sandbox="allow-scripts" referrerpolicy="no-referrer" loading="lazy" srcdoc="${attrEscape(document)}"></iframe>`;
}

const VERSION_KIND = { generated: 'Picked frame', chat: 'AI edit', click: 'Click edit' };
const versionTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(11, 16);
};
const versionDetail = (v) => v.kind === 'chat' && v.instruction
    ? `<q>${esc(v.instruction)}</q>`
    : v.kind === 'click' && v.change
        ? `<span class="dv-fine">${esc((v.change.path || '').replace(/^body > /, ''))}${v.change.text !== undefined ? ' · text' : ''}${v.change.color ? ' · colour' : ''}${v.change.spacing ? ' · spacing' : ''}${v.change.align ? ' · alignment' : ''}</span>`
        : '';

/**
 * Publish on openvibe.space (open item D8): the working frame as a site at <name>.openvibe.space, in the person's own
 * Space project. Only the owner, signed in, sees the form; a guest's private link is told to sign in.
 */
function publishPanel({ design, pick, viewer, editKey, publishing = {} }) {
    const published = design.published;
    const mine = Boolean(viewer) && !editKey;
    const head = `<summary>Publish <span>${published ? 'live' : 'on openvibe.space'}</span></summary>`;
    const note = publishing.notice ? `<p class="dv-ok" role="status">${esc(publishing.notice)} <a href="${esc(published ? published.url : '#')}" target="_blank" rel="noopener">${esc(published ? published.url.replace(/^https:\/\//, '') : '')}</a></p>` : '';
    const err = publishing.error ? `<p class="dv-err" role="alert">${esc(publishing.error)}</p>` : '';
    let inner;
    if (!publishing.enabled) inner = '<p class="dv-fine">Publishing is not set up on this server.</p>';
    else if (!mine) inner = '<p class="dv-fine">Sign in as the person who made this design to publish it as a site on openvibe.space.</p>';
    else if (!pick) inner = '<p class="dv-fine">Pick a frame first: the working frame is what gets published.</p>';
    else inner = `${published ? `<p class="dv-live">Live at <a href="${esc(published.url)}" target="_blank" rel="noopener">${esc(published.url.replace(/^https:\/\//, ''))}</a></p>` : ''}
<form method="post" action="/d/${encodeURIComponent(design.id)}/publish" class="dv-publish-form">
${published ? '' : '<label class="dv-publish-name"><span>Site name <small>(optional; a–z, 0–9 and hyphens)</small></span><span class="dv-publish-addr"><input name="name" maxlength="40" pattern="[a-z0-9]([a-z0-9]|-(?=[a-z0-9])){2,39}" autocapitalize="none" autocomplete="off" spellcheck="false" placeholder="my-landing-page"><span>.openvibe.space</span></span></label>'}
<button type="submit">${published ? 'Publish this version' : 'Publish on openvibe.space'}</button>
</form>
<p class="dv-fine">The working frame becomes the site's page, in a project called Designs on your Space account. Publishing again updates the same address; Space keeps the earlier versions for a rollback.</p>`;
    return `<details class="dv-publish" id="dv-publish"${publishing.notice || publishing.error || published ? ' open' : ''}>${head}${note}${err}${inner}</details>`;
}

function canvas({ data, themes = [], editKey = '', viewer = null, publishing = { enabled: false } }) {
    const { design, variants, pick, versions = [] } = data;
    const selectedTheme = themes.find(t => t.id === design.themeId) || themes[0] || { variables: {} };
    const variables = selectedTheme.variables || {};
    const pickedIndex = pick ? Number(pick.variantIndex) : -1;
    const pickedVariant = pickedIndex >= 0 ? variants[pickedIndex] : null;
    const chatLeft = pick ? Math.max(0, Number(pick.chatEditLimit || 0) - Number(pick.chatEdits || 0)) : 0;
    const canChat = Boolean(pick) && chatLeft > 0;
    const cards = variants.map((v, index) => {
        const picked = index === pickedIndex;
        const done = v.status === 'done';
        const isElement = design.kind === 'element';
        return `<article class="dv-card" data-status="${esc(v.status)}" data-index="${index}" data-picked="${picked ? 'true' : 'false'}" data-variant-id="${esc(v.id || '')}">
<div class="dv-frame${isElement ? ' dv-frame--element' : ''}">${isElement
        ? (done && v.look ? `<div class="dv-el-look">${v.look}</div>`
            : `<div class="dv-skeleton" role="status"><span>${esc(v.status === 'failed' ? 'Could not make the element' : 'Writing the element…')}</span><small>${esc(v.status === 'failed' ? String(v.element_error || v.error || 'The AI did not return a valid element.').slice(0, 240) : 'A look and a recipe together')}</small></div>`)
        : done ? frame(v.html, `${v.model || 'Design'} frame`, { interactive: picked }) :
        `<div class="dv-skeleton" role="status"><span>${esc(v.model || 'Designer')}</span><small>${esc(v.status === 'failed' ? 'Could not generate' : 'Creating…')}</small></div>`}</div>
<div class="dv-label"><span class="dv-model">${esc(v.model || 'Designer')}</span>${done ?
        `<span>${(Number(v.ms || 0) / 1000).toFixed(1)} s · $${Number(v.costUsd || 0).toFixed(4)}</span>` : ''}</div>
${deepDiveView.takePoints(v.research_points || v.researchPoints, design.research)}
<div class="dv-card-actions">${picked
        ? (design.kind === 'element'
            ? `<span class="dv-picked">Working element</span><a class="dv-fine" href="/d/${encodeURIComponent(design.id)}/element/preview${editKey ? `?key=${encodeURIComponent(editKey)}` : ''}">Preview, tweak and publish ${ARROW}</a>`
            : `<span class="dv-picked">Working frame</span><span class="dv-fine">Click any element to edit it</span>`)
        : done ? (pick ? '<span class="dv-fine">Not the working frame</span>'
            : `<form method="post" action="/d/${encodeURIComponent(design.id)}/pick"><input type="hidden" name="key" value="${esc(editKey)}"><input type="hidden" name="variantIndex" value="${index}"><button type="submit" class="dv-pick" data-pick="${index}">Use this design</button></form>`)
            : '<span class="dv-fine">Waiting for this designer…</span>'}</div>
</article>`;
    }).join('');
    const themeOptions = themes.map(t => `<option value="${esc(t.id)}"${t.id === design.themeId ? ' selected' : ''}>${esc(t.name)}</option>`).join('');
    const aliasTokens = new Set(['--bg-card', '--bg-secondary', '--text-muted', '--accent', '--on-accent', '--border']);
    const tokenNames = [...new Set([...Object.keys(variables),
        '--text-primary', '--text-muted', '--accent', '--bg-primary', '--bg-card', '--border'])]
        .filter(name => /^--[a-z][a-z0-9-]{1,40}$/.test(name)
            && (aliasTokens.has(name) || /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(String(variables[name] || ''))));
    const tokenOptions = tokenNames.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
    const cssByTheme = Object.fromEntries(themes.map(t => [t.id, themeCss(t.variables || {})]));
    const cssJson = JSON.stringify(cssByTheme).replace(/</g, '\\u003c');
    const versionRows = versions.map(v => `<li${v.current ? ' class="is-current"' : ''}>
<span class="dv-vseq">v${v.seq}</span>
<span class="dv-vbody"><b>${esc(VERSION_KIND[v.kind] || v.kind)}</b>${v.current ? ' <span class="dv-vnow">now</span>' : ''}
<small>${esc(v.model || 'unknown model')}${v.provider ? ` · ${esc(v.provider)}` : ''}${v.createdAt ? ` · ${esc(versionTime(v.createdAt))}` : ''}${v.kind === 'chat' && v.costUsd ? ` · $${Number(v.costUsd).toFixed(4)}` : ''}</small>
${versionDetail(v)}</span></li>`).join('');
    const voteNote = pick && pick.vote
        ? pick.vote.state === 'recorded' ? ' Arena vote recorded.'
            : pick.vote.state === 'guest' ? ' Guest pick saved; sign in through the same secret link to count it as an Arena vote.'
                : pick.vote.state === 'failed' ? ' The Arena vote could not be recorded; the working frame is still saved.'
                    : pick.vote.state === 'pending' ? ' Recording the Arena vote…'
                        : '' : '';
    const statusText = pick ? `Working frame selected. ${versions.length} version${versions.length === 1 ? '' : 's'} kept.${voteNote}`
        : design.status === 'done' ? 'Three designs ready. Pick one to start editing.'
            : design.status === 'failed' ? 'Generation failed.' : 'Designers are working…';
    const keyInput = `<input type="hidden" name="key" value="${esc(editKey)}">`;
    const versionsPanel = design.kind === 'element' ? '' : `<details class="dv-versions" id="dv-versions" open>
<summary>Versions <span>${versions.length}</span></summary>
<div class="dv-vcontrols">
<form method="post" action="/d/${encodeURIComponent(design.id)}/undo">${keyInput}<button type="submit"${pick && pick.canUndo ? '' : ' disabled'}>Undo</button></form>
<form method="post" action="/d/${encodeURIComponent(design.id)}/redo">${keyInput}<button type="submit"${pick && pick.canRedo ? '' : ' disabled'}>Redo</button></form>
</div>
${versions.length ? `<ol class="dv-vlist" id="dv-vlist">${versionRows}</ol>` : '<p class="dv-fine">Pick a frame; its HTML becomes version 1. Every accepted edit adds a version and nothing is deleted.</p>'}
</details>`;
    const chatPanel = design.kind === 'element' ? '' : `<form class="dv-chat" id="dv-chat-form" method="post" action="/d/${encodeURIComponent(design.id)}/edit">
${keyInput}
<label for="dv-instruction">Edit with AI</label>
<div class="dv-chat-row"><input id="dv-instruction" name="instruction" maxlength="1000" placeholder="${pick ? 'Make the hero bolder, add a pricing section…' : 'Pick a frame first'}"${canChat ? '' : ' disabled'}>
<button type="submit"${canChat ? '' : ' disabled'}>Send</button></div>
<p class="dv-chat-status" id="dv-edit-status" role="status" aria-live="polite"></p>
<p class="dv-fine">${pick ? `${chatLeft} of ${pick.chatEditLimit} AI edits left on this design. Click edits and undo are free.` : 'Chat edits work on the picked frame.'}</p>
</form>`;
    const body = `<section class="dv-canvas" data-kind="${esc(design.kind || 'page')}" data-id="${esc(design.id)}" data-key="${esc(editKey)}" data-picked="${pick ? pickedIndex : ''}" data-variant-id="${esc(pickedVariant && pickedVariant.id || '')}">
<header class="dv-heading"><a href="/create">${kit.icon('back')} New design</a><h1>${esc(design.prompt)}</h1>
<p id="dv-status" role="status">${esc(statusText)}</p>
<p class="dv-share"><button type="button" data-ov-share-sheet data-kind="design" data-id="${esc(design.id)}"
  data-title="${esc(design.prompt)}" data-url="${esc(`/d/${encodeURIComponent(design.id)}`)}">Share</button></p></header>
${deepDiveView.researchPanel(design.research)}
${design.kind === 'element' ? `<section class="dv-el-panel"><h2>Element</h2><p>The AI wrote the look and the recipe together. The preview runs it on sample data and moves the size, tint and label sliders; the same page adds it to your Live channel or publishes it to the Elements and packs gallery.</p><p><a class="ovk-btn ovk-btn--primary" href="/d/${encodeURIComponent(design.id)}/element/preview${editKey ? `?key=${encodeURIComponent(editKey)}` : ''}">Open the element preview</a></p></section>` : ''}
${chatPanel}
<div class="dv-rail" id="dv-rail">${cards}</div>
${design.kind === 'element' ? '' : publishPanel({ design, pick, viewer, editKey, publishing })}
${versionsPanel}
<nav class="dv-toolbar" aria-label="Canvas tools"><label>Device <select id="dv-device"><option value="390">Phone · 390</option><option value="834">Tablet · 834</option><option value="1280">Desktop · 1280</option></select></label>
<form method="post" action="/d/${encodeURIComponent(design.id)}/theme" id="dv-theme-form">${keyInput}<label>Theme <select id="dv-theme" name="themeId">${themeOptions}</select></label><button type="submit">Apply</button></form></nav>
</section>
<aside class="dv-element" id="dv-element" hidden aria-label="Edit the selected element">
<div class="dv-element-head"><b id="dv-element-tag">Element</b><button type="button" id="dv-element-close">Close</button></div>
<form id="dv-element-form">
<label for="dv-element-text">Text</label><textarea id="dv-element-text" rows="3" maxlength="1000"></textarea>
<p class="dv-fine" id="dv-element-note" hidden>This element contains other elements. Edit the text element inside it; colour, spacing and alignment still apply.</p>
<label for="dv-element-color">Text colour (theme token)</label><select id="dv-element-color"><option value="">Keep</option>${tokenOptions}</select>
<label for="dv-element-spacing">Spacing (padding)</label><select id="dv-element-spacing"><option value="">Keep</option><option value="none">None</option><option value="sm">Small · 8px</option><option value="md">Medium · 16px</option><option value="lg">Large · 24px</option></select>
<label for="dv-element-align">Alignment</label><select id="dv-element-align"><option value="">Keep</option><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select>
<button type="submit">Save as a new version</button>
<p class="dv-status" id="dv-element-status" role="status" aria-live="polite"></p>
</form>
</aside>
<script type="application/json" id="dv-theme-css">${cssJson}</script>`;
    return layout({ title: 'Design canvas', path: `/d/${encodeURIComponent(design.id)}`, robots: 'noindex, nofollow',
        body, styles: ['css/deepdive.css'], scripts: ['js/design.js'] });
}

module.exports = { create, canvas, gate, frame, overlayScript };
