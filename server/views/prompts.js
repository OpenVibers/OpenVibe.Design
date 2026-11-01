'use strict';
/**
 * openvibe.design/prompts: every instruction openvibe.design sends to an AI model, word for word (the owner,
 * 2026-11-01: "publishing the prompts… public facing"). Each one is built here by the same function the service calls,
 * with the person's own words shown as {placeholders}, so the page cannot drift from what runs. GET /api/v1/prompts
 * answers the same list as JSON.
 */
const { layout, esc } = require('../render/layout');
const { systemPrompt, CATEGORY_BRIEF } = require('../arena/ai');
const { themePrompt, editPrompt } = require('../designs');
const { SYSTEM: GLYPH_SYSTEM } = require('../glyphs/drafts');

const SOURCE = 'https://github.com/OpenVibers/OpenVibe.Design/blob/main/';

function list() {
    return [
        {
            id: 'design-page',
            title: 'Designing a page',
            used: 'Create, the Studio and the Arena: every page, screen, component or logo a model draws.',
            source: 'server/arena/ai.js',
            parts: [
                { label: 'System prompt (the category changes per request)', text: systemPrompt('{category}') },
                { label: 'The request', text: '{your prompt}\n\nCategory: {category}\nReturn one complete HTML document.' },
                { label: 'The categories', text: Object.entries(CATEGORY_BRIEF).map(([k, v]) => `${k}: ${v}`).join('\n') },
            ],
        },
        {
            id: 'design-theme',
            title: 'Drawing it in your theme',
            used: 'Create and the Studio, when a design is drawn in the theme you picked.',
            source: 'server/designs.js',
            parts: [{ label: 'The request', text: themePrompt('{your prompt}', ['{the theme\'s colour variables}']) }],
        },
        {
            id: 'design-edit',
            title: 'Editing a design',
            used: 'The Studio, when you ask for a change in words.',
            source: 'server/designs.js',
            parts: [{ label: 'The request', text: editPrompt('{your instruction}', '{the current page}', '{the theme\'s colour variables}') }],
        },
        {
            id: 'glyph-draft',
            title: 'Drawing an icon',
            used: 'Icons: drafts for the OpenVibe glyph set. A person reviews every draft before it joins the set.',
            source: 'server/glyphs/drafts.js',
            parts: [
                { label: 'System prompt (with drawings from the set as examples)', text: GLYPH_SYSTEM },
                { label: 'The request', text: 'The icon: "{name}". What it stands for: {what it is for}' },
            ],
        },
    ];
}

function promptsPage() {
    const items = list();
    const body = `<div class="pr-wrap">
<header class="pr-hero">
<p class="pr-eye">Open by default</p>
<h1>The prompts behind openvibe.design</h1>
<p class="pr-lede">Every instruction openvibe.design sends to an AI model, word for word. They come from the same code that sends them, so this page always shows what runs. Your own words go where a prompt says <code>{…}</code>. Copy them, improve them, use them anywhere.</p>
<nav class="pr-toc" aria-label="The prompts">${items.map((p) => `<a href="#${p.id}">${esc(p.title)}</a>`).join('')}</nav>
</header>
${items.map((p) => `<section class="pr-card" id="${p.id}">
<h2>${esc(p.title)}</h2>
<p class="pr-used">${esc(p.used)} <a href="${SOURCE}${p.source}">${esc(p.source)}</a></p>
${p.parts.map((part, i) => `<div class="pr-part"><div class="pr-part-h"><span>${esc(part.label)}</span><button type="button" class="pr-copy" data-pr-copy="${p.id}-${i}">Copy</button></div><pre id="${p.id}-${i}">${esc(part.text)}</pre></div>`).join('')}
</section>`).join('')}
<p class="pr-fine">The same list as JSON: <a href="/api/v1/prompts">/api/v1/prompts</a>. openvibe.design is open source (MIT).</p>
</div>`;
    return layout({
        title: 'The prompts behind openvibe.design',
        description: 'Every instruction openvibe.design sends to an AI model, word for word, from the code that sends it.',
        path: '/prompts',
        active: '/prompts',
        styles: ['css/prompts.css'],
        scripts: ['js/prompts.js'],
        body,
    });
}

module.exports = { promptsPage, list };
