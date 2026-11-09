'use strict';
/**
 * /forms: OpenVibe's own form controls (openvibe-shared 4.109, ov-forms.js and ov-forms.css; the owner, 11-03: "a custom
 * system for those select inputs … implemented in openvibe.design and shared across the network and all websites
 * rather than using default stuff … mobile, desktop, etc. device specific support that looks amazing"). Every part is
 * live on the page — the select (a menu here, a sheet on a phone), several choices, search, the switch, choice cards,
 * fields — with the markup to copy and the attributes it reads. Server-rendered; the page has plain controls without
 * JavaScript, and the navbar brings ov-forms.js like on every OpenVibe site.
 *
 *   formsPage({ base })
 */
const kit = require('openvibe-shared/kit');
const { layout, esc } = require('../render/layout');

const AGENT_SELECT = `<select id="fm-agent" name="agent" data-ov-title="Fallback agent">
  <option value="">None</option>
  <option value="codex" data-state="ok" data-badge="20% used"
          data-desc="ChatGPT plan · signed in on ada-laptop" selected>Codex</option>
  <option value="opencode" data-state="warn" data-badge="88% used"
          data-desc="5-hour window nearly full">OpenCode</option>
  <option value="minimax" disabled data-state="off" data-desc="Not signed in on this machine"
          data-href="#fm-attrs" data-href-label="Sign in">MiniMax Code</option>
</select>`;

const ROWS_SNIPPET = `// The kit's builders, server or browser (openvibe-shared/kit, docs/kit.md)
kit.switchRow({
  name: 'burn_after_read', icon: 'flame',
  title: 'Burn after reading', line: 'Gone once it is opened',
})
kit.segmented({
  name: 'visibility', value: 'public', label: 'Visibility',
  items: [
    { value: 'public',   label: 'Public',   icon: 'globe' },
    { value: 'unlisted', label: 'Unlisted', icon: 'link'  },
    { value: 'private',  label: 'Private',  icon: 'lock'  },
  ],
})`;

// The demo is the kit's own output: kit.switchRow and kit.segmented (openvibe-shared, pinned here).
const VISIBILITY = [{ value: 'public', label: 'Public', icon: 'globe' }, { value: 'unlisted', label: 'Unlisted', icon: 'link' }, { value: 'private', label: 'Private', icon: 'lock' }];

const MODELS = [
    ['OpenAI', ['gpt-5.5', 'gpt-5.5-mini', 'gpt-5.4-codex']],
    ['Anthropic', ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']],
    ['DeepSeek', ['deepseek-v4', 'deepseek-v4-flash']],
    ['Open models', ['kimi-k3', 'glm-5', 'qwen-4-coder', 'minimax-m3']],
];

const ATTRS = [
    ['data-desc', 'option', 'A second line under the label.'],
    ['data-badge', 'option', 'A short tag on the right: “Signed in”, “72% used”.'],
    ['data-state', 'option', 'ok · warn · bad · off · new: a dot before the label, and the badge’s tone.'],
    ['data-icon', 'option', 'One or two characters before the label: an emoji, a letter.'],
    ['data-href · data-href-label', 'option', 'A link on the row (“Set up”), kept on a disabled choice: it says how to make it ready.'],
    ['data-ov-search', 'select', 'on or off: a search box (on by itself from 9 choices).'],
    ['data-ov-title', 'select', 'The phone sheet’s title; otherwise the select’s own label.'],
    ['data-ov-select="bare"', 'select', 'No box of its own: for a select inside a chip or a toolbar.'],
    ['multiple', 'select', 'Boxes on the rows; the list stays open; the button says “a, c” or “3 chosen”.'],
    ['data-ov-native', 'any', 'Keeps the browser’s own control, on it and everything inside it.'],
];

function formsPage({ base = 'https://openvibe.design' } = {}) {
    const fieldSnippet = `<div class="ov-field">
  <label for="key">API key</label>
  <input id="key" name="key" autocomplete="off">
  <p class="ov-field-hint">Sealed, never shown again.</p>
</div>`;
    const choiceSnippet = `<div class="ov-choices">
  <label class="ov-choice">
    <input type="radio" name="plan" value="go">
    <span class="ov-choice-body">
      <b class="ov-choice-title">OpenCode Go</b>
      <span class="ov-choice-desc">A month of open models</span>
    </span>
  </label>
  …
</div>`;
    const useSnippet = `<!-- On an OpenVibe site: nothing. The navbar loads both files for a page with a form control. -->
<!-- Anywhere else (MIT): -->
<link rel="stylesheet" href="${base}/shared/ov-forms.css">
<script src="${base}/shared/ov-forms.js" defer></script>`;
    const body = `<article class="fm">
<header class="fm-hero">
  <p class="fm-eye">Forms</p>
  <h1 class="fm-h1">Controls that look like OpenVibe, on every site</h1>
  <p class="fm-lede">Every select is OpenVibe’s own: a menu on a computer, a sheet from the bottom on a phone. A choice can say whether it is ready, how much is used, and how to set it up. The form underneath is the browser’s, so everything that worked still works, and a page without JavaScript keeps its plain controls.</p>
  <nav class="fm-jump" aria-label="On this page"><a href="#fm-select">The select</a><a href="#fm-more">Several, search, groups</a><a href="#fm-controls">Switches and boxes</a><a href="#fm-rows">Switch rows and segments</a><a href="#fm-fields">Fields and choices</a><a href="#fm-attrs">What it reads</a><a href="#fm-use">Use it</a></nav>
</header>

<section class="fm-sec" id="fm-select" aria-labelledby="fm-select-h">
  <div class="fm-sec-head"><h2 id="fm-select-h">The select</h2><p>Open it. On a phone it rises from the bottom with rows a finger tall; on a computer it opens under the button, or above it when there is more room. The keyboard works the whole way: arrows, Home and End, typing to jump, Enter, Escape.</p></div>
  <div class="fm-demo">
    <div class="fm-live">
      <div class="ov-field"><label for="fm-agent">Fallback agent</label>${AGENT_SELECT}<p class="ov-field-hint">Used when Claude Code nears its weekly limit.</p></div>
      <p class="fm-out" aria-live="polite">Chosen: <b data-fm-out="fm-agent">codex</b></p>
    </div>
    <div class="fm-code">${kit.snippet({ code: AGENT_SELECT, id: 'fm-agent-code', label: 'Copy' })}</div>
  </div>
</section>

<section class="fm-sec" id="fm-more" aria-labelledby="fm-more-h">
  <div class="fm-sec-head"><h2 id="fm-more-h">Several, search, groups</h2><p>A long list gets a search box. Groups become headings. A multiple select keeps its list open and counts what is chosen.</p></div>
  <div class="fm-grid">
    <div class="ov-field"><label for="fm-model">Model</label><select id="fm-model" name="model">${MODELS.map(([g, list]) => `<optgroup label="${esc(g)}">${list.map((m) => `<option${m === 'gpt-5.5' ? ' selected' : ''}>${esc(m)}</option>`).join('')}</optgroup>`).join('')}</select></div>
    <div class="ov-field"><label for="fm-sites">Show on</label><select id="fm-sites" name="sites" multiple data-placeholder="No site">${['Live', 'Chat', 'Codes', 'Games', 'Space', 'Blog'].map((s, i) => `<option${i < 2 ? ' selected' : ''}>${s}</option>`).join('')}</select></div>
    <div class="ov-field"><label for="fm-lang">Language</label><select id="fm-lang" name="lang">${[['🇬🇧', 'English'], ['🇪🇸', 'Español'], ['🇯🇵', '日本語'], ['🇧🇷', 'Português'], ['🇩🇪', 'Deutsch']].map(([f, l], i) => `<option data-icon="${f}"${i === 0 ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
  </div>
</section>

<section class="fm-sec" id="fm-controls" aria-labelledby="fm-controls-h">
  <div class="fm-sec-head"><h2 id="fm-controls-h">Switches and boxes</h2><p>A checkbox with <code>role="switch"</code> is a switch. Checkboxes, radios and sliders take the site’s accent. Nothing here changes a size, so a site’s own layout never moves.</p></div>
  <div class="fm-row">
    <label class="fm-check"><input type="checkbox" role="switch" checked> Switch back when the week frees</label>
    <label class="fm-check"><input type="checkbox" checked> Tell me when it switches</label>
    <label class="fm-check"><input type="radio" name="fm-r" checked> Ask first</label>
    <label class="fm-check"><input type="radio" name="fm-r"> Full access</label>
    <label class="fm-check fm-range">Volume <input type="range" min="0" max="100" value="64"></label>
    <label class="fm-check">A file <input type="file"></label>
  </div>
</section>

<section class="fm-sec" id="fm-rows" aria-labelledby="fm-rows-h">
  <div class="fm-sec-head"><h2 id="fm-rows-h">Switch rows and segmented choices</h2><p>The kit builds the two rows a settings form is made of. A switch row is 56 px and the whole row is the target: an icon tile, a title, one line, and an iOS-style switch that is the native checkbox underneath, so it works without JavaScript. A segmented control puts three or four choices in one 44 px control, icons before the words.</p></div>
  <div class="fm-demo">
    <div class="fm-live">
      <div class="ovk-form">
        ${kit.switchRow({ name: 'fm-burn', icon: 'flame', title: 'Burn after reading', line: 'Gone once it is opened' })}
        ${kit.switchRow({ name: 'fm-nsfw', icon: 'eye-off', title: 'Mark as NSFW', line: 'Blurred until it is opened', checked: true })}
        ${kit.switchRow({ name: 'fm-lock', icon: 'lock', title: 'Lock it', line: 'OpenVibe can’t read what’s inside' })}
        ${kit.segmented({ name: 'fm-visibility', value: 'public', label: 'Visibility', items: VISIBILITY })}
      </div>
      <p class="fm-out" aria-live="polite">Chosen: <b data-fm-out="fm-visibility">public</b></p>
    </div>
    <div class="fm-code">${kit.snippet({ code: ROWS_SNIPPET, id: 'fm-rows-code', label: 'Copy' })}</div>
  </div>
</section>

<section class="fm-sec" id="fm-fields" aria-labelledby="fm-fields-h">
  <div class="fm-sec-head"><h2 id="fm-fields-h">Fields and choices</h2><p>Opt in with <code>.ov-field</code> for the whole field: a label, a control 44 px tall (16 px text on a phone, so it never zooms), a hint, an error. <code>.ov-choice</code> draws a choice as a card.</p></div>
  <div class="fm-demo">
    <div class="fm-live fm-stack">
      <div class="ov-field"><label for="fm-key">API key</label><input id="fm-key" autocomplete="off" placeholder="sk-…"><p class="ov-field-hint">Sealed, never shown again.</p></div>
      <div class="ov-field"><label for="fm-note">Note</label><textarea id="fm-note" placeholder="Anything it should know"></textarea></div>
      <div class="ov-choices">
        <label class="ov-choice"><input type="radio" name="fm-plan" value="go" checked><span class="ov-choice-body"><b class="ov-choice-title">OpenCode Go</b><span class="ov-choice-desc">A month of open models, one price.</span></span><span class="ov-sel-badge is-ok">Ready</span></label>
        <label class="ov-choice"><input type="radio" name="fm-plan" value="keys"><span class="ov-choice-body"><b class="ov-choice-title">Your own keys</b><span class="ov-choice-desc">Pay each provider by use.</span></span></label>
      </div>
    </div>
    <div class="fm-code">${kit.snippet({ code: fieldSnippet, id: 'fm-field-code', label: 'Copy' })}${kit.snippet({ code: choiceSnippet, id: 'fm-choice-code', label: 'Copy' })}</div>
  </div>
</section>

<section class="fm-sec" id="fm-attrs" aria-labelledby="fm-attrs-h">
  <div class="fm-sec-head"><h2 id="fm-attrs-h">What it reads</h2><p>Plain HTML attributes: a server that knows what a person has set up writes them, and every site draws them the same way.</p></div>
  <div class="fm-table-wrap"><table class="fm-table"><thead><tr><th scope="col">Attribute</th><th scope="col">On</th><th scope="col">What it does</th></tr></thead><tbody>${ATTRS.map(([a, on, what]) => `<tr><td><code>${esc(a)}</code></td><td>${esc(on)}</td><td>${esc(what)}</td></tr>`).join('')}</tbody></table></div>
</section>

<section class="fm-sec" id="fm-use" aria-labelledby="fm-use-h">
  <div class="fm-sec-head"><h2 id="fm-use-h">Use it</h2><p>On an OpenVibe site the navbar brings both files once the page settles. Anywhere else they are free (MIT). <code>&lt;html data-ov-forms="off"&gt;</code> keeps a whole site on the browser’s own.</p></div>
  ${kit.snippet({ code: useSnippet, id: 'fm-use-code', label: 'Copy' })}
</section>
</article>`;
    return layout({
        title: 'Forms: OpenVibe’s own controls',
        description: 'OpenVibe’s select and form controls, on every site: a menu on a computer, a sheet on a phone, choices that say whether they are ready, switches, fields and choice cards. Live, with the code.',
        path: '/forms', active: '/forms', styles: ['css/forms.css'], scripts: ['js/forms-page.js'], shared: ['ov-forms.js'], body,
    });
}

module.exports = { formsPage, ATTRS };
