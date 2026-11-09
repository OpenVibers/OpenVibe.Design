'use strict';
/**
 * /system: the design system in one map. Every reference page of openvibe.design, grouped the way a builder looks for
 * it (foundations, components, guidance, platforms), each with what it holds counted from the source that holds it.
 * The bar's System place opens it; More lists the same pages in the same order.
 *
 *   systemPage({ themes })   themes: the theme count (null when the catalogue did not answer: then no count shows)
 *   GROUPS                   the map, for the nav and tests
 */
const { layout, esc } = require('../render/layout');

const count = (fn) => { try { const n = fn(); return Number.isFinite(n) && n > 0 ? n : null; } catch { return null; } };

const G = {
    palette: 'M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.1-4-7.6-9-7.6ZM7.5 12.5h.01M9.5 8h.01M14.5 8h.01M17 11.5h.01',
    code: 'M8.5 8 4.5 12l4 4M15.5 8l4 4-4 4M13.5 5.5l-3 13',
    font: 'M5 19 10.5 5h1L17 19M7.4 14h7.2M19 19v-5.5',
    shapes: 'M4 4h7v7H4zM17.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM14 20l3.5-6 3.5 6zM4 14h7v7H4z',
    mark: 'M9 12a5 5 0 1 0 0 .01M13 7l3.5 9L20 7',
    motion: 'M4 18c4 0 5-12 9-12s4 6 7 6M4 6h.01M20 18h.01',
    puzzle: 'M9 4h4v2.5a1.5 1.5 0 0 0 3 0V4h4v5h-2.5a1.5 1.5 0 0 0 0 3H20v8h-5v-2.5a1.5 1.5 0 0 0-3 0V20H4v-5h2.5a1.5 1.5 0 0 0 0-3H4V4z',
    kit: 'M4 7l8-4 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4',
    forms: 'M4 5h16v5H4zM4 14h16v5H4zM7 7.5h5M7 16.5h8',
    loading: 'M4 6h16M4 12h10M4 18h13',
    progress: 'M4 12h16M4 12h9M16 8l4 4-4 4',
    upload: 'M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14',
    rules: 'M6 4h12v16H6zM9 9h6M9 13h6M9 17h3',
    patterns: 'M5 5h14M5 12h14M5 19h9M17 17l2 2 3-4',
    prompt: 'M5 6h14v9H9l-4 4z',
    apps: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM10.5 18h3',
    api: 'M4 12h4l2-5 4 10 2-5h4',
};
const glyph = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${G[k]}"/></svg>`;

function groups({ themes = null } = {}) {
    const n = {
        icons: count(() => require('openvibe-shared/glyphs').NAMES.length),
        formats: count(() => { const t = require('openvibe-shared/tokens').TARGETS; return Array.isArray(t) ? t.length : Object.keys(t).length; }),
        effects: count(() => require('./motion').EFFECTS.length),
        components: count(() => require('./components-list').GROUPS.reduce((s, g) => s + (Array.isArray(g[3]) ? g[3].length : 0), 0)),
        shapes: count(() => require('./loading').SHAPES.length),
        rules: count(() => require('../rules/register').RULES.length),
        patterns: count(() => require('../patterns/catalog').patterns.length),
        prompts: count(() => require('./prompts').list().length),
        // The web, Android and iOS: the platforms the tokens and components are drawn for.
        platforms: 3,
    };
    return [
        { id: 'foundations', title: 'Foundations', lede: 'What every interface is made of: colour, type, icons, the mark and how things move.', items: [
            { href: '/themes', name: 'Themes', n: themes, unit: 'themes', text: 'Colour, type and shape for every site at once, each checked for contrast.', glyph: 'palette' },
            { href: '/tokens', name: 'Tokens', n: n.formats, unit: 'formats', text: 'Any theme as CSS, Tailwind, Compose, SwiftUI, Flutter, Figma or DTCG.', glyph: 'code' },
            { href: '/fonts', name: 'Fonts', text: 'Typefaces and pairings that read well on every screen.', glyph: 'font' },
            { href: '/icons', name: 'Icons', n: n.icons, unit: 'icons', text: 'One line, one grid, in the text’s colour; draw new ones with AI.', glyph: 'shapes' },
            { href: '/brand', name: 'The mark', text: 'The Pair: its forms, sizes, motion and the rules for using it.', glyph: 'mark' },
            { href: '/motion', name: 'Motion', n: n.effects, unit: 'effects', text: 'One kit of effects and one set of curves, shared by every site.', glyph: 'motion' },
        ] },
        { id: 'components', title: 'Components', lede: 'The parts pages are built from, each the same on every site and specified for native apps.', items: [
            { href: '/components', name: 'Components', n: n.components, unit: 'parts', text: 'Each defined once: anatomy, states and roles, for the web, Compose and SwiftUI.', glyph: 'puzzle' },
            { href: '/kit', name: 'Kit', text: 'Every piece an OpenVibe page is made of, live, with the code to use it.', glyph: 'kit' },
            { href: '/forms', name: 'Forms', text: 'Fields, choices and errors that read the same on every site.', glyph: 'forms' },
            { href: '/loading', name: 'Loading', n: n.shapes, unit: 'shapes', text: 'Placeholders the size of what replaces them. Never a spinning ring.', glyph: 'loading' },
            { href: '/progress', name: 'Progress', text: 'Every state of an upload or a job, in words and one bar.', glyph: 'progress' },
            { href: '/uploader', name: 'Uploader', text: 'The shared file picker and queue: choose a file and keep going.', glyph: 'upload' },
        ] },
        { id: 'guidance', title: 'Guidance', lede: 'What we decided and what production taught us, so new work starts from it.', items: [
            { href: '/rules', name: 'Rules', n: n.rules, unit: 'rules', text: 'Every style, design and organization decision, with the day and the reason.', glyph: 'rules' },
            { href: '/patterns', name: 'Patterns', n: n.patterns, unit: 'patterns', text: 'Each with the bug that taught it, a live demo and native code.', glyph: 'patterns' },
            { href: '/prompts', name: 'Prompts', n: n.prompts, unit: 'prompts', text: 'Every instruction this site sends an AI model, word for word.', glyph: 'prompt' },
        ] },
        { id: 'platforms', title: 'Platforms', lede: 'Taking the system off this site: into apps, code and AI assistants.', items: [
            { href: '/native', name: 'Apps', n: n.platforms, unit: 'platforms', text: 'From the web to Android and iOS, without a frame: the road and the rules.', glyph: 'apps' },
            { href: '/developers', name: 'Developers', text: 'The API, MCP for AI assistants, and how to use any of it in your own app.', glyph: 'api' },
        ] },
    ];
}

// Columns that divide the cards (the even-grid pattern): six and three go three across, four and two go in twos.
const colsFor = (k) => (k % 3 === 0 ? 3 : 2);

function systemPage({ themes = null } = {}) {
    const gs = groups({ themes });
    const total = gs.reduce((s, g) => s + g.items.length, 0);
    const card = (x) => `<li><a class="ds-sys" href="${esc(x.href)}"><span class="ds-sys-ic">${glyph(x.glyph)}</span><span class="ds-sys-t"><b>${esc(x.name)}</b>${x.n ? `<em>${esc(x.n.toLocaleString('en-US'))} ${esc(x.unit)}</em>` : ''}</span><small>${esc(x.text)}</small></a></li>`;
    const body = `<article class="sy">
<header class="sy-hero"><p class="sy-eye">The system</p><h1 class="sy-h1">Everything OpenVibe is made of.</h1>
<p class="sy-lede">${total} references in four groups: the foundations, the components built on them, the rules and patterns that guide new work, and the ways to take it into your own app. The same parts are on every OpenVibe site.</p></header>
${gs.map((g) => `<section class="sy-group" id="${esc(g.id)}" aria-labelledby="sy-${esc(g.id)}-h"><div class="sy-head"><h2 id="sy-${esc(g.id)}-h">${esc(g.title)}</h2><p>${esc(g.lede)}</p></div><ul class="ds-system-grid sy-grid" style="--sy-cols:${colsFor(g.items.length)}">${g.items.map(card).join('')}</ul></section>`).join('')}
</article>`;
    return layout({
        title: 'The design system',
        description: 'Everything OpenVibe is made of: themes, tokens, fonts, icons, the mark and motion; components, the kit and forms; the rules and patterns; and apps and developer tools.',
        path: '/system',
        active: '/system',
        styles: ['css/rules.css'],
        body,
    });
}

module.exports = { systemPage, groups };
