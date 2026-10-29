'use strict';

const { layout, esc } = require('../render/layout');
const { attrEscape } = require('../arena/sanitize');
const { themeCss } = require('../designs');

const examples = ['Landing page for a coffee roaster', 'Dashboard for a fitness app', 'Pricing section', 'Mobile onboarding'];

function create({ recent = [] } = {}) {
    const body = `<section class="dv-create"><h1>What will you design?</h1>
<form method="post" action="/create"><label class="dv-visually-hidden" for="dv-prompt">Describe your design</label>
<textarea id="dv-prompt" name="prompt" required maxlength="4000" placeholder="Describe a page, an app screen or a component…"></textarea>
<button type="submit">Create designs</button></form>
<div class="dv-examples" aria-label="Try an example">${examples.map(x => `<button type="button" data-example="${esc(x)}">${esc(x)}</button>`).join('')}</div>
${recent.length ? `<section class="dv-recent"><h2>Your recent designs</h2><ul>${recent.map(d => `<li><a href="${esc(d.url)}">${esc(d.prompt)}</a></li>`).join('')}</ul></section>` : ''}</section>`;
    return layout({ title: 'Create a design', path: '/create', body, active: '/create', scripts: ['js/design.js'] });
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

function canvas({ data, themes = [], editKey = '' }) {
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
        return `<article class="dv-card" data-status="${esc(v.status)}" data-index="${index}" data-picked="${picked ? 'true' : 'false'}" data-variant-id="${esc(v.id || '')}">
<div class="dv-frame">${done ? frame(v.html, `${v.model || 'Design'} frame`, { interactive: picked }) :
        `<div class="dv-skeleton" role="status"><span>${esc(v.model || 'Designer')}</span><small>${esc(v.status === 'failed' ? 'Could not generate' : 'Creating…')}</small></div>`}</div>
<div class="dv-label"><span class="dv-model">${esc(v.model || 'Designer')}</span>${done ?
        `<span>${(Number(v.ms || 0) / 1000).toFixed(1)} s · $${Number(v.costUsd || 0).toFixed(4)}</span>` : ''}</div>
<div class="dv-card-actions">${picked
        ? `<span class="dv-picked">Working frame</span><span class="dv-fine">Click any element to edit it</span>`
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
    const body = `<section class="dv-canvas" data-id="${esc(design.id)}" data-key="${esc(editKey)}" data-picked="${pick ? pickedIndex : ''}" data-variant-id="${esc(pickedVariant && pickedVariant.id || '')}">
<header class="dv-heading"><a href="/create">← New design</a><h1>${esc(design.prompt)}</h1>
<p id="dv-status" role="status">${esc(statusText)}</p></header>
<form class="dv-chat" id="dv-chat-form" method="post" action="/d/${encodeURIComponent(design.id)}/edit">
${keyInput}
<label for="dv-instruction">Edit with AI</label>
<div class="dv-chat-row"><input id="dv-instruction" name="instruction" maxlength="1000" placeholder="${pick ? 'Make the hero bolder, add a pricing section…' : 'Pick a frame first'}"${canChat ? '' : ' disabled'}>
<button type="submit"${canChat ? '' : ' disabled'}>Send</button></div>
<p class="dv-chat-status" id="dv-edit-status" role="status" aria-live="polite"></p>
<p class="dv-fine">${pick ? `${chatLeft} of ${pick.chatEditLimit} AI edits left on this design. Click edits and undo are free.` : 'Chat edits work on the picked frame.'}</p>
</form>
<div class="dv-rail" id="dv-rail">${cards}</div>
<details class="dv-versions" id="dv-versions" open>
<summary>Versions <span>${versions.length}</span></summary>
<div class="dv-vcontrols">
<form method="post" action="/d/${encodeURIComponent(design.id)}/undo">${keyInput}<button type="submit"${pick && pick.canUndo ? '' : ' disabled'}>Undo</button></form>
<form method="post" action="/d/${encodeURIComponent(design.id)}/redo">${keyInput}<button type="submit"${pick && pick.canRedo ? '' : ' disabled'}>Redo</button></form>
</div>
${versions.length ? `<ol class="dv-vlist" id="dv-vlist">${versionRows}</ol>` : '<p class="dv-fine">Pick a frame; its HTML becomes version 1. Every accepted edit adds a version and nothing is deleted.</p>'}
</details>
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
        body, scripts: ['js/design.js'] });
}

module.exports = { create, canvas, frame, overlayScript };
