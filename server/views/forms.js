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
// The controls every page gets with no class (ov-forms.css): the same markup the demo draws.
const CONTROLS_SNIPPET = `<label><input type="checkbox" role="switch" checked> Switch back when the week frees</label>
<label><input type="checkbox" checked> Tell me when it switches</label>
<label><input type="radio" name="access" value="ask" checked> Ask first</label>
<label><input type="radio" name="access" value="full"> Full access</label>
<label>Volume <input type="range" min="0" max="100" value="64"></label>
<label>A file <input type="file"></label>

<!-- The browser's own look for one control, or a part of the page: -->
<input type="range" data-ov-native>`;

// One ring per field (design rule one-ring-per-field; the owner, 11-15: "make sure that input double border shit is fixed
// for all element types"): every type people type into, shown plain and inside a box.
const RING_TYPES = [
    ['text', 'Text'], ['search', 'Search'], ['email', 'Email', ' autocomplete="off"'], ['url', 'Address'], ['tel', 'Phone'],
    ['password', 'Password', ' autocomplete="new-password"'], ['number', 'Number'], ['date', 'Date'], ['time', 'Time'],
    ['datetime-local', 'Date and time'], ['month', 'Month'], ['week', 'Week'],
];
const RINGS_SNIPPET = `<!-- A field in a box: the box draws the border and the focus ring; the field is bare. -->
<label class="pill">
  <input type="search" placeholder="Search or ask">
</label>
.pill { border: 1px solid var(--border); border-radius: 999px; }
.pill:focus-within { border-color: var(--accent); }
.pill input { border: 0; outline: none; background: none; }

<!-- On every OpenVibe site the navbar keeps it so even when a page forgets:
     a field in a box is marked data-ov-field="inner" or "bare" and the box
     [data-ov-fieldbox] takes the accent; a field on its own keeps its ring
     on its border (outline-offset 0), never apart from it. -->

// Check a page: openvibe-shared/field-rings (the browser check's "rings")
const { RINGS } = require('openvibe-shared/field-rings');
const { fields, doubles } = await page.evaluate(\`(\${RINGS})()\`);`;

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
  <nav class="fm-jump" aria-label="On this page"><a href="#fm-select">The select</a><a href="#fm-more">Several, search, groups</a><a href="#fm-controls">Switches, boxes and sliders</a><a href="#fm-rows">Switch rows and segments</a><a href="#fm-fields">Fields and choices</a><a href="#fm-attrs">What it reads</a><a href="#fm-use">Use it</a></nav>
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
  <div class="fm-sec-head"><h2 id="fm-controls-h">Switches, boxes and sliders</h2><p>One material for every control: off is set into the page, on is lit from above in the site’s accent. A checkbox with <code>role="switch"</code> is a switch, a slider fills up to its thumb, and a file input’s button is a button. Every page gets them with no class; a site’s own rule always wins, and <code>data-ov-native</code> keeps the browser’s.</p></div>
  <div class="fm-demo">
    <div class="fm-live fm-ctls">
      <label class="fm-ctl"><input type="checkbox" role="switch" checked><span class="fm-ctl-t"><b>Switch back when the week frees</b><small>A switch: <code>role="switch"</code> on a checkbox</small></span></label>
      <label class="fm-ctl"><input type="checkbox" checked><span class="fm-ctl-t"><b>Tell me when it switches</b><small>A checkbox</small></span></label>
      <fieldset class="fm-ctl-set"><legend>Access</legend>
        <label class="fm-ctl"><input type="radio" name="fm-r" value="ask" checked><span class="fm-ctl-t"><b>Ask first</b><small>It asks before it acts</small></span></label>
        <label class="fm-ctl"><input type="radio" name="fm-r" value="full"><span class="fm-ctl-t"><b>Full access</b><small>It acts, then tells you</small></span></label>
      </fieldset>
      <div class="fm-ctl fm-ctl-range"><label for="fm-vol">Volume</label><input id="fm-vol" type="range" min="0" max="100" value="64"><output for="fm-vol" data-fm-range="fm-vol">64</output></div>
      <div class="fm-ctl fm-ctl-file"><label for="fm-file">A file</label><input id="fm-file" type="file"></div>
    </div>
    <div class="fm-code">${kit.snippet({ code: CONTROLS_SNIPPET, id: 'fm-controls-code', label: 'Copy' })}</div>
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

<section class="fm-sec" id="fm-rings" aria-labelledby="fm-rings-h">
  <div class="fm-sec-head"><h2 id="fm-rings-h">One ring per field</h2><p>Every kind of field has one border and one focus ring. Inside a pill, a search bar, a composer or a chip, the box draws them: the field inside is bare, and the box takes the accent while it holds the focus. A field on its own rings on its border, never a second ring apart from it. The navbar measures each field once it is drawn and keeps it that way on every site; the browser check fails a page that draws two. Try each one: focus it, or tab through.</p></div>
  <div class="fm-demo">
    <div class="fm-live fm-stack">
      <div class="fm-rings-grid">
        ${RING_TYPES.map(([t, label, extra]) => `<div class="ov-field"><label for="fm-r-${t}">${esc(label)}</label><input id="fm-r-${t}" type="${t}"${extra || ''}></div>`).join('')}
        <div class="ov-field"><label for="fm-r-textarea">Long text</label><textarea id="fm-r-textarea" rows="2"></textarea></div>
        <div class="ov-field"><label for="fm-r-select">Pick one</label><select id="fm-r-select"><option>Hourly</option><option>Daily</option><option>Weekly</option></select></div>
      </div>
      <p class="fm-rings-cap">In a box: the box's ring is the only one.</p>
      <label class="fm-pill"><span class="fm-pill-ic" aria-hidden="true">${kit.icon('search')}</span><input type="search" placeholder="Search or ask" aria-label="Search or ask"><button type="button" class="fm-pill-go" aria-label="Go">${kit.icon('chevron')}</button></label>
      <div class="fm-pill fm-pill-compose"><div contenteditable="true" role="textbox" aria-label="Message" data-placeholder="Write a message"></div><button type="button" class="fm-pill-go" aria-label="Send">${kit.icon('send')}</button></div>
    </div>
    <div class="fm-code">${kit.snippet({ code: RINGS_SNIPPET, id: 'fm-rings-code', label: 'Copy' })}</div>
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
