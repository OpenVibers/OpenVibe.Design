'use strict';

// The catalog is the one source for each rule, live demo, token references, and generated native examples.
const TOKENS = Object.freeze({
    durationFast: { path: 'motion.duration.fast', value: '180ms' },
    durationBase: { path: 'motion.duration.base', value: '260ms' },
    durationSlow: { path: 'motion.duration.slow', value: '360ms' },
    durationReduced: { path: 'motion.duration.reduced', value: '0ms' },
    easingStandard: { path: 'motion.easing.standard', value: 'cubic-bezier(.2,.7,.2,1)' },
    easingBack: { path: 'motion.easing.back', value: 'cubic-bezier(.34,1.56,.64,1)' },
    tap: { path: 'size.tap', value: '44px' },
    spaceMd: { path: 'space.md', value: '12px' },
    radiusPill: { path: 'radius.pill', value: '999px' },
    text: { path: 'color.text.primary', value: 'theme.text.primary' },
    surface: { path: 'color.bg.surface', value: 'theme.surface' },
    accent: { path: 'color.accent.base', value: 'theme.accent' },
});
const t = (...keys) => keys;
const patterns = [
    ['patch-in-place','Streams that hold still','Patch in place', 'Update existing nodes when their identity is unchanged. Keep focus, selection, and local element state attached to the same node.', '2026-10-30 · Rebuilding the stream on every event reset expanded tools and stole the reader’s place.', 'When one event changes, only its row changes.', t('durationFast','easingStandard','spaceMd')],
    ['follow-bottom','Streams that hold still','Follow the bottom', 'Keep the reader at the bottom only while they were already there. New activity should never pull someone away from older content they are reading.', '2026-10-30 · Incoming events dragged readers to the latest message while they were inspecting an earlier step.', 'Scroll follows new events only while the reader is at the end.', t('durationBase','easingStandard')],
    ['keep-anchor','Streams that hold still','Keep the anchor', 'Before inserting or changing rows above the viewport, remember the first visible row and its screen position. Restore that position after the patch.', '2026-10-30 · A new chain card shifted the visible run, making the reader lose the sentence they were following.', 'Content above the viewport can change without moving the visible row.', t('spaceMd','durationFast')],
    ['smooth-folds','Streams that hold still','Smooth folds', 'Animate a fold between its measured open and closed heights. Cancel an older animation before starting another, and finish by returning layout to its natural height.', '2026-10-30 · Native details toggles snapped large tool groups open and closed in the middle of a live stream.', 'Folds change height in place and remain interruptible.', t('durationSlow','easingStandard','easingBack')],
    ['fade-in','Streams that hold still','Fade in new rows', 'New rows may fade in briefly after they are inserted. Existing rows stay still; reduced motion removes the entrance animation.', '2026-10-30 · Replacing the whole stream made every event flash on every update.', 'Only newly added rows enter; updates do not replay the entrance.', t('durationFast','durationReduced','easingStandard')],
    ['progress-strip','Status in one line','Progress strip', 'Show the current task, completed steps, and elapsed time in one compact row. Let the reader open details when they want the plan.', '2026-10-30 · A full progress card pushed the conversation down while duplicating details already in the stream.', 'A short status first; details stay one tap away.', t('durationBase','easingStandard','tap')],
    ['outcome-line','Status in one line','Outcome line', 'Show the result with a status icon, clear title, and a quiet reason. Put the next useful actions in pill buttons on that same line.', '2026-10-30 · Failure rendered as a large red block and hid the next action beneath it.', 'The outcome and its recovery actions share one calm row.', t('radiusPill','tap','spaceMd')],
    ['one-row','One row per thing','One row per thing', 'Keep one row for the task and nest retries or attempts inside it. Name shipping work for the person and target so the list stays scannable.', '2026-10-30 · Each retry became a separate row, so one task looked like several unrelated jobs.', 'Attempts belong inside the task that owns them.', t('spaceMd','durationBase','easingStandard')],
    ['icon-pills','Elements','Pill buttons with icons', 'Pair a familiar icon with a short action label inside a pill. Keep the full control at least 44 px tall and give icon-only controls an accessible name.', '2026-10-30 · Small icon-only retry controls were hard to identify and too easy to miss on touch screens.', 'Use icon and text together for an action.', t('tap','radiusPill','spaceMd')],
    ['status-badges','Elements','Status badges', 'Use a compact badge with an icon and a clear status word. Give the badge a semantic status color while preserving readable contrast.', '2026-10-30 · Color alone made live, complete, and failed states ambiguous.', 'Status always has a word as well as a color.', t('spaceMd','radiusPill','text')],
    ['metadata-chips','Elements','Metadata chips', 'Present secondary metadata as short, labeled chips rather than raw URLs or long unbroken strings. Let chips wrap without widening the page.', '2026-10-30 · Raw provider URLs widened the run row and competed with its title.', 'Keep secondary metadata compact and breakable.', t('spaceMd','radiusPill','text')],
    ['empty-state','Elements','One-line empty states', 'Say what is empty in one line and offer one direct action. Keep the action visible beside the explanation when space allows.', '2026-10-30 · Empty panels became dead ends with a paragraph of explanation and no next step.', 'Explain the empty state and give one way forward.', t('tap','spaceMd','accent')],
    ['tabs-not-folds','Elements','Tabs, not folds', 'Use tabs when people switch between peer views, and folds when they reveal details in the current view. Do not put tabs inside a fold for the same choice.', '2026-10-30 · Nested tabs and folds repeated the same navigation and hid the active view.', 'Choose one navigation model for a set of peer views.', t('tap','durationFast','easingStandard')],
    ['touch-targets','Elements','44 px targets', 'Give interactive controls a minimum 44 by 44 px target, including icon controls. Keep visual spacing separate from the hit area.', '2026-10-30 · Dense icon rows were difficult to operate on a phone despite their visible glyphs.', 'Every interactive target is at least 44 px.', t('tap','spaceMd')],
    ['motion','Motion','Motion tokens', 'Use the shared 180, 260, and 360 ms duration scale with standard easing for ordinary transitions. Honor reduced motion everywhere, and reserve back easing for playful feedback.', '2026-10-30 · Components used unrelated timings and kept moving after reduced motion was requested.', 'Share timings across platforms and respect the system setting.', t('durationFast','durationBase','durationSlow','durationReduced','easingStandard','easingBack')],
    ['site-switcher','Navigation','Site switcher', 'Open the shared site switcher from the single site navbar. Keep its focus, placement, and close behavior consistent across every page.', '2026-10-30 · A local site picker fork drifted from the shared switcher and behaved differently across services.', 'Use openvibe-shared/site-switcher.js and the shared navbar trigger.', t('tap','durationBase','easingStandard')],
    ['single-navbar','Navigation','One navbar per page', 'Render one shared navbar at the top of each page. Put local section navigation inside the page body instead of adding a second header.', '2026-10-30 · A page-specific header sat beneath the Frame navbar and duplicated the page title.', 'The shared Frame owns the page navbar.', t('spaceMd','tap')],
    ['bottom-tabs','Navigation','Bottom tabs without overlap', 'On phones, reserve space for a bottom tab bar in the scrollable content. Keep the last item and focused controls clear of the fixed bar and safe area.', '2026-10-30 · The fixed phone tabs covered the final rows and hid the focused control.', 'Scrollable content has enough bottom inset for the tabs and safe area.', t('tap','spaceMd','durationBase')],
    ['mark-system','Brand','The mark studies', 'Treat the mark as a working component with a loading state and a per-site morph. Compare the five studies in the live study page before choosing the mark used by the kit.', '2026-10-30 · A static logo could not communicate loading or adapt to a site identity.', 'The mark carries its identity through loading and site changes.', t('durationSlow','easingStandard','easingBack')],
].map(([slug,group,title,rule,bug,summary,tokens]) => ({ slug, group, title, rule, bug, summary, tokens: [...new Set([...tokens, 'tap', 'spaceMd', 'durationBase'])] }));

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function componentName(p) { return `Ov${p.slug.split('-').map(x => x[0].toUpperCase()+x.slice(1)).join('')}`; }
function nativeSpecs(p) {
    const name = componentName(p);
    const refs = p.tokens.map(key => TOKENS[key]).filter(Boolean);
    const swift = [`struct ${name}: View {`, `    let status: String`, `    @Environment(\\.accessibilityReduceMotion) private var reduceMotion`, `    var body: some View {`, `        HStack(spacing: OvScale.spaceMd) {`, `            Text(status).font(.body)`, `        }`, `        .frame(minHeight: OvScale.sizeTap)`, `        .animation(reduceMotion ? .none : .easeOut(duration: OvScale.motionDurationBase), value: status)`, `    }`, `}`, `// Tokens: ${refs.map(x => `${x.path}=${x.value}`).join(', ')}`].join('\n');
    const compose = [`@Composable`, `fun ${name}(status: String, reduceMotion: Boolean) {`, `    Row(`, `        modifier = Modifier.defaultMinSize(minHeight = OvScale.SizeTap),`, `        horizontalArrangement = Arrangement.spacedBy(OvScale.SpaceMd),`, `    ) {`, `        Text(status, style = MaterialTheme.typography.bodyMedium)`, `    }`, `    // Apply motion only when !reduceMotion.`, `}`, `// Tokens: ${refs.map(x => `${x.path}=${x.value}`).join(', ')}`].join('\n');
    return { swift, compose };
}
function tokenRows(p) { return p.tokens.map(k => TOKENS[k]).filter(Boolean).map(x => `<li><code>${esc(x.path)}</code><span>${esc(x.value)}</span></li>`).join(''); }
function demo(p) {
    const id = esc(p.slug);
    return `<section class="pdemo" data-pattern-demo="${id}" aria-label="Live ${esc(p.title)} demo">
      <div class="pdemo-head"><span class="pdot"></span><strong>${esc(p.title)}</strong><span class="pmeta">Live demo</span></div>
      <div class="pdemo-body"><div class="pwidget" data-widget="${id}"></div></div>
      <div class="pdemo-controls" data-controls="${id}"></div>
      <p class="plive-status" aria-live="polite">Try the controls to see the rule.</p>
    </section>`;
}
function pageLayout({ title, description, path, active, scripts = [], body }) {
    const layout = require('../render/layout');
    return layout.layout({ title, description, path, active, scripts, styles: ['css/patterns.css'], body });
}
function page(p) {
    const spec = nativeSpecs(p);
    const body = `<header class="phead"><p class="peye">Patterns from production · ${esc(p.group)}</p><h1>${esc(p.title)}</h1><p class="plede">${esc(p.summary)}</p></header>
      ${demo(p)}
      <section class="prule"><h2>The rule</h2><p>${esc(p.rule)}</p></section>
      <aside class="pbug"><h2>The bug that taught it</h2><p><time datetime="${esc(p.bug.slice(0,10))}">${esc(p.bug)}</time></p></aside>
      <section class="ptokens"><h2>Tokens used</h2><ul>${tokenRows(p)}</ul></section>
      <section class="pnative"><h2>Native spec · generated from this pattern and the shared token registry</h2><div class="pcodegrid"><figure><figcaption>SwiftUI</figcaption><pre><code>${esc(spec.swift)}</code></pre></figure><figure><figcaption>Compose</figcaption><pre><code>${esc(spec.compose)}</code></pre></figure></div></section>
      <nav class="pnext" aria-label="Pattern navigation"><a href="/patterns">All patterns</a>${p.slug==='mark-system'?'<a href="/patterns/mark/studies">Open all five mark studies ↗</a>':''}</nav>`;
    return pageLayout({ title: `${p.title} pattern`, description:p.rule, path:`/patterns/${p.slug}`, active:'/patterns', scripts:['js/pattern-kit.js','js/patterns.js'], body:`<article class="pattern-page">${body}</article>` });
}
function index() {
    const groups = [...new Set(patterns.map(p => p.group))];
    const cards = groups.map(g => `<section class="pgroup"><h2>${esc(g)}</h2><div class="pcards">${patterns.filter(p => p.group===g).map(p => `<a class="pcard" href="/patterns/${esc(p.slug)}"><span>${esc(p.title)}</span><small>${esc(p.summary)}</small><b aria-hidden="true">→</b></a>`).join('')}</div></section>`).join('');
    return pageLayout({ title:'Patterns', description:'Working OpenVibe patterns, extracted from shipped code with live demos and native specs.', path:'/patterns', active:'/patterns', body:`<article class="patterns-index"><header class="phead"><p class="peye">OpenVibe Kit · patterns from production</p><h1>Patterns that hold up in production</h1><p class="plede">Each pattern pairs a live demo with its rule, the bug that taught it, shared tokens, and generated native examples.</p></header>${cards}</article>` });
}
module.exports = { patterns, TOKENS, nativeSpecs, page, index, esc };
