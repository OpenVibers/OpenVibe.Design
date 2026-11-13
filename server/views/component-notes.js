'use strict';
/**
 * The component pages for what has shipped since the first registry: the bar's brand, the search pill, the quest
 * card, the avatar, the player, soft pages, icon ink, the footer and metrics. Each page has one specimen, built from the
 * openvibe-shared this site pins wherever that package already holds the part, and the release, the changelog words
 * and the numbered rules behind it. A part that is still in review says so; nothing is claimed as shipped before it is.
 *
 *   notePage(name)   one page, or null
 *   NOTES            the names and their titles (also used by /components/registry)
 */
const kit = require('openvibe-shared/kit');
const mark = require('openvibe-shared/mark');
const appIcon = require('openvibe-shared/app-icon');
const { layout, esc } = require('../render/layout');
const { RULES } = require('../rules/register');

const RULE = new Map(RULES.map((r) => [r.id, r]));
const chip = (href, label, cls = '') => `<a class="cn-chip${cls ? ` ${cls}` : ''}" href="${esc(href)}">${label}</a>`;
const ruleChips = (ids) => ids.filter((id) => RULE.has(id)).map((id) => {
    const r = RULE.get(id);
    return `<a class="cn-chip cn-chip--rule" href="/rules#${esc(id)}" title="${esc(r.rule)}"><b>${esc(String(r.n))}</b> ${esc(r.rule)}</a>`;
}).join('');

const brandMark = mark.svg({ form: 'pair', tone: 'brand', wide: true, size: 34 });
const appTile = appIcon.favicon({ site: 'network' });

// ── The specimens. Every value is written here (escaped by the builder that takes it), never read from a person. ──
const SPECIMENS = {
    brand: () => `<div class="spec spec--brand">
  <div class="spec-bar">
    <button type="button" class="ovnav-brand" aria-haspopup="menu" aria-expanded="false" aria-label="OpenVibe.Design: its pages and every OpenVibe site">
      <span class="flame">${brandMark}</span>
      <span class="name"><span class="b-core">OpenVibe</span><span class="b-dot">.</span><span class="b-tld">Design</span></span>
    </button>
    <span class="spec-orb" aria-hidden="true">${[0, 1, 2].map(() => '<i></i>').join('')}</span>
  </div>
  <div class="spec-drop" role="group" aria-label="What the button opens">
    <p class="spec-drop-h">Pages on OpenVibe.Design</p>
    <a href="/see"><span>${kit.icon('home')}</span>See</a>
    <a href="/make"><span>${kit.icon('spark')}</span>Make</a>
    <a href="/rules" aria-current="page"><span>${kit.icon('check')}</span>Rules</a>
    <a href="/use"><span>${kit.icon('code')}</span>Use</a>
    <a class="spec-drop-all" href="/components/menu"><span>${kit.icon('grid')}</span>All OpenVibe sites</a>
  </div>
  <p class="spec-note">The mark and the name are one button, and the chevron says it opens. Its list starts with this site's pages; <b>All OpenVibe sites</b> at the end opens the menu past them to every site. The menu button keeps its own place at the right of the bar.</p>
</div>`,

    menu: () => `<div class="spec spec--menu">
  <div class="spec-sheet" role="group" aria-label="The menu's places">
    <div class="spec-places">
      <button type="button" class="is-on" aria-current="page">${kit.icon('home')}<span>Here</span></button>
      <button type="button">${kit.icon('list')}<span>Feed</span></button>
      <button type="button">${kit.icon('spark')}<span>Vibe</span><small>Chat · Agents</small></button>
      <button type="button">${kit.icon('chat')}<span>Chat</span></button>
      <button type="button">${kit.icon('user')}<span>You</span><i class="spec-badge">3</i></button>
    </div>
    <form class="spec-search" role="search" aria-label="The search pill">
      ${kit.icon('search')}
      <input type="search" placeholder="Search OpenVibe" aria-label="Search OpenVibe" value="">
      <span class="spec-actions">
        <button type="button" aria-label="New chat" title="New chat">${kit.icon('plus')}</button>
        <button type="button" aria-label="Open in OpenVibe.Chat" title="Open in Chat">${kit.icon('open')}</button>
        <button type="button" class="spec-close" aria-label="Close the menu" title="Close">${kit.icon('close')}</button>
      </span>
    </form>
    <p class="spec-note">One row of five places: Here (this site), Feed, Vibe with its <b>Chat · Agents</b> switch, Chat, and You with the red count of what is new. Vibe's <b>+</b> starts a chat and ${kit.icon('open')} opens it in OpenVibe.Chat; the icons sit in the search pill beside the close button, so they cost no row. On a phone the menu is one sheet and Chat and Vibe open inside it; on a computer they open the Dock.</p>
  </div>
</div>`,

    'search-pill': () => `<div class="spec spec--search">
  <form class="spec-search spec-search--big" role="search" aria-label="The search pill">
    ${kit.icon('search')}
    <input type="search" placeholder="Search OpenVibe" aria-label="Search OpenVibe" value="night owls">
    <span class="spec-actions">
      <button type="button" aria-label="New chat" title="New chat">${kit.icon('plus')}</button>
      <button type="button" aria-label="Open in OpenVibe.Chat" title="Open in Chat">${kit.icon('open')}</button>
      <button type="button" class="spec-close" aria-label="Close the menu" title="Close">${kit.icon('close')}</button>
    </span>
  </form>
  <div class="spec-split">
    <div><b>The field</b><p>The menu's search, and the place's own field when a place has one. Typing filters the chosen place in place; Enter opens the first result.</p></div>
    <div><b>The actions</b><p><b>+</b> starts a new chat; ${kit.icon('open')} opens the same place in OpenVibe.Chat; <b>×</b> closes the menu and steps back. Each is an icon button with a spoken label and a tooltip, and each has a 44 px target on a phone.</p></div>
  </div>
  <p class="spec-note">Inside the menu the place's actions sit in the pill; the floating Dock keeps them in a slim row of their own. The pill itself is the kit's search: one field, one button, no invented control.</p>
</div>`,

    'quest-card': () => `<div class="spec spec--quest">
  <div class="ovq-quest open" data-progress="1">
    <div class="ovq-head" role="button" tabindex="0" aria-expanded="true">
      <span class="ovq-icon" aria-hidden="true">${kit.icon('trophy')}</span>
      <span class="ovq-titles"><span class="ovq-kicker">TODAY'S QUEST · 1 OF 3</span><span class="ovq-title">Say hello where you watch</span><span class="ovq-bar" aria-hidden="true"><i></i><i></i><i></i></span></span>
      <span class="ovq-chip">${kit.icon('fire')} 4</span>
      <span class="ovq-chev" aria-hidden="true">${kit.icon('chevron')}</span>
    </div>
    <div class="ovq-body">
      <p class="ovq-story">One small thing today, on the sites you already use. The badge is yours when the three steps are done.</p>
      <ol class="ovq-steps">
        <li class="is-done"><a href="/components/quest-card"><span class="ovq-site-icon">${kit.icon('chat')}</span><span class="ovq-step"><span>Say hello in a chat</span><small>OpenVibe.Chat</small></span><span class="ovq-check" aria-label="Done">✓</span></a></li>
        <li class="is-next"><a href="/components/quest-card"><span class="ovq-site-icon">${kit.icon('user')}</span><span class="ovq-step"><span>Follow one person</span><small>Next · OpenVibe.Network</small></span><span class="ovq-go">${kit.icon('chevron')}</span></a></li>
        <li><a href="/components/quest-card"><span class="ovq-site-icon">${kit.icon('feed')}</span><span class="ovq-step"><span>Start a thread</span><small>OpenVibe.Community</small></span><span class="ovq-go">${kit.icon('chevron')}</span></a></li>
      </ol>
      <a class="ovq-more" href="/components/quest-card"><span class="ovq-more-text"><b>More on OpenVibe.Quest</b><span>4 badges · 1 quest going · 9 more to try</span></span><span class="ovq-arrow">${kit.icon('forward')}</span></a>
    </div>
  </div>
  <p class="spec-note">The daily quest card any site can show: its badge mark, the day's quest, the three steps with the next one lit, and one door to OpenVibe.Quest. Its marks are its own SVG, not Font Awesome, and the door's arrow takes the accent.</p>
</div>`,

    avatar: () => `<div class="spec spec--avatar">
  <div class="spec-avatars">
    <figure><span class="spec-av spec-av--face">${kit.mark({ name: 'Ana', src: '/changes/avatar-sample.svg', size: 48 })}</span><figcaption>A picture: the account's own</figcaption></figure>
    <figure><span class="spec-av spec-av--no">${kit.mark({ name: 'A', size: 48 })}</span><figcaption>No picture: the initial</figcaption></figure>
    <figure><span class="spec-av spec-av--broken"><span class="spec-av-shot" aria-hidden="true"></span><span class="spec-av-init">A</span></span><figcaption>A picture that cannot show: the initial, not a broken image</figcaption></figure>
  </div>
  <p class="spec-note">One <code>capture</code> listener and one sweep replace every <code>&lt;img data-ov-initial&gt;</code> that fails with its initial, in the footer's faces and the account picture. It is CSP-safe: no inline handler, no request to another origin. A picture that loads keeps its reserved width and height, so nothing shifts while it arrives.</p>
</div>`,

    player: () => `<div class="spec spec--player">
  <div class="spec-player">
    <video data-ov-player controls playsinline preload="metadata" width="640" height="360" src="/changes/specimen-player.mp4" aria-label="A sample OpenVibe player"></video>
  </div>
  <div class="spec-split">
    <div><b>On a phone</b><p>The controls are one row: play, mute, the volume slider, the time, captions and fullscreen. Speed and picture-in-picture step out; under 380 px the mute button stands alone; under 360 px the time shows the position alone. The row never runs off the screen.</p></div>
    <div><b>Everywhere</b><p>The same player draws every <code>&lt;video data-ov-player&gt;</code>: the network's controls, the picture's own colour while it loads, and the small player that keeps a video going while you browse (<code>mini.js</code>).</p></div>
  </div>
  <p class="spec-note">The phone row here is the change in review, applied to the pinned player so you can see it: speed and picture-in-picture step out and the slider is 64 px, which is what keeps fullscreen on the screen. The 4.200 player still shows both at 390 px and cuts it.</p>
</div>`,

    'soft-pages': () => `<div class="spec spec--soft">
  <ol class="spec-steps">
    <li><span class="spec-step-n">1</span><div><b>Reach for a link</b><p>A same-site link is fetched on pointer down, or after 80 ms of hover on a computer. Never on Save-Data or a 2G/3G connection; at most four in flight; never sign-in, auth, API, a post, a download, a query or an in-page anchor. A page can opt a link out with <code>data-ov-no-prefetch</code>.</p></div></li>
    <li><span class="spec-step-n">2</span><div><b>Press</b><p>The mark's O starts its wait (<code>OVMark.navStart('page')</code>) at pointer down, and the arriving page finishes it at first paint. The bar's ring is the wait, not a spinner.</p></div></li>
    <li><span class="spec-step-n">3</span><div><b>Arrive</b><p>Where the browser has cross-document view transitions, the shared bar is named once and held still while the rest of the page cross-fades: 180 ms, Calm 120 ms, Off none. A page with its own <code>script[type="speculationrules"]</code> keeps it.</p></div></li>
  </ol>
  <p class="spec-note">One line opts a site in, in <code>&lt;head&gt;</code> after <code>theme-loader.js</code> and not deferred: <code>&lt;script src="/shared/soft.js"&gt;&lt;/script&gt;</code>. A site that does not opt in is unchanged. <code>window.OpenVibeSoft = { on(), off(), exclude(selector) }</code>.</p>
</div>`,

    'icon-ink': () => `<div class="spec spec--ink">
  <div class="spec-tiles">
    <figure><span class="spec-tile spec-tile--app">${appTile}</span><figcaption>An app tile: the mark's ink is 0.58 of the tile</figcaption></figure>
    <figure><span class="spec-tile spec-tile--box">${mark.svg({ form: 'pair', tone: 'brand', wide: true, size: 65 })}</span><figcaption>The mark at 0.58 of the tile, measured on the paint</figcaption></figure>
    <figure><span class="spec-glyphs">${['home', 'chat', 'play', 'search', 'user', 'plus'].map((n) => `<span>${kit.icon(n)}</span>`).join('')}</span><figcaption>The glyphs at 18–24 px: one line drawing, one grid</figcaption></figure>
  </div>
  <p class="spec-note">The app tile uses a 0.58 painted-ink fraction of the tile, measured from the painted bounds rather than the viewBox; the icon set is normalised to one ink size so a glyph from any set sits the same beside another. Small glyphs draw their solid form; nothing is scaled by eye.</p>
</div>`,

    footer: () => `<div class="spec spec--footer">
  <div class="spec-footer">
    <p class="spec-online"><b>13 online</b><span class="spec-faces">${kit.mark({ name: 'Ana', size: 24 })}${kit.mark({ name: 'Kai', size: 24 })}${kit.mark({ name: 'Mia', size: 24 })}</span></p>
    <p class="spec-tip"><b>In the last 30 minutes</b><span>4 members · 9 guests</span></p>
    <p class="spec-fine">The count opens the names on a press; a finger never sees a tooltip, so the words are also there.</p>
  </div>
  <p class="spec-note">The footer's online strip says the short count, the faces and one tooltip. Hovering or focusing the count shows "In the last 30 minutes" and the members and guests beneath it; a press opens the same words above the list of names. The tooltip file is fetched by the first pointer over the bar, not with the page.</p>
</div>`,

    metrics: () => `<div class="spec spec--metrics">
  <p class="spec-ovm-label">Example numbers, so every part shows. On Report, Exchange and Compare the same parts draw real ones.</p>
  <div data-ovm="tiles"></div>
  <div class="spec-ovm-grid">
    <figure><figcaption><code>OVMetrics.spark(values)</code></figcaption><div data-ovm="spark"></div></figure>
    <figure><figcaption><code>OVMetrics.percentiles({ p50, p90, p95, n })</code></figcaption><div data-ovm="percentiles"></div></figure>
    <figure><figcaption><code>OVMetrics.bars(rows, { format })</code></figcaption><div data-ovm="bars"></div></figure>
    <figure><figcaption><code>OVMetrics.split(parts, { format })</code></figcaption><div data-ovm="split"></div></figure>
    <figure class="spec-ovm-wide"><figcaption><code>OVMetrics.table(rows, columns)</code></figcaption><div data-ovm="table"></div></figure>
  </div>
  <p class="spec-note" data-ovm-wait>The parts draw in the browser from <code>/shared/ov-metrics.js</code>; with script off, a page shows its own table of the same numbers.</p>
  <p class="spec-note">Every part takes its colours from the theme (tokens only), fits 390 px, reads in both themes and holds still with motion off. A delta knows whether up is good: more calls is green, a slower first token is red, and both say it in words. A number nobody measured is a dash, never 0.</p>
</div>`,
};

const NOTES = Object.freeze({
    brand: {
        title: 'The bar’s brand',
        summary: 'The mark and the site’s name as one button: the site’s own pages, then every OpenVibe site.',
        release: { version: '4.201.0', state: 'in review', href: '/changes#v4.201.0' },
        shipped: 'The one button for the mark and the name is in review for the next Shared release. Until 4.200.0 the left end was a link plus a separate switcher button; the bar’s right end already holds the menu button on every width.',
        quote: '“Make it so this whole thing becomes the drop down, not … two separate buttons … one drop down so it’s less confusing … the view all sites button … improve the sizing.” — the owner, 2026-11-10 (ask 347)',
        rules: ['one-menu-button', 'menu-button-at-the-right', 'the-name-opens-its-pages', 'every-site-from-the-name'],
        build: `// openvibe-shared/navbar.js: one button, its list, then every site\n<button type="button" class="ovnav-brand" id="openvibe-brand-btn"\n        aria-haspopup="menu" aria-expanded="false">\n  <span class="flame"><span class="ov-mark" data-size="42" data-wide></span></span>\n  <span class="name">OpenVibe<span class="b-dot">.</span>Design</span>\n</button>\n// OVDrop.pages(button, navLinks, navIcon, { label: 'All OpenVibe sites', onClick: openSwitcher })`,
    },
    navbar: {
        title: 'The navbar',
        summary: 'One bar on every site: the brand at the left, the menu button at the right, and the person last.',
        release: { version: '4.200.0', state: 'shipped', href: '/changes#v4.200.0' },
        shipped: '4.200.0 moved the menu button to the right end on every width, made the name open its pages and put “All OpenVibe sites” at the end of that list. The brand’s one-button form is in review for the next release.',
        quote: '“The menu button should be on the right, even on desktop … there’s like a duplicated icon.” — the owner, 2026-11-10',
        rules: ['one-bar', 'one-menu-button', 'menu-button-at-the-right', 'the-name-opens-its-pages', 'every-site-from-the-name'],
        build: `// openvibe-shared/navbar.js\n// left: the brand (the mark and the name); right: the menu button, then the person\n// the name opens its pages; “All OpenVibe sites” opens the menu past them`,
    },
    dock: {
        title: 'The Dock',
        summary: 'The panels beside the work, and the same panels inside a phone’s menu sheet.',
        release: { version: '4.198.0', state: 'shipped', href: '/changes#v4.198.0' },
        shipped: '4.198.0 let the Dock’s panels mount inside the menu on a phone (dock-mount.js), with no head of their own and the same state as the floating Dock; 4.196.0 made the Actor block one row and one field, and left out a black stage for a session that ended with no picture.',
        quote: '“combine and consolidate these two menus into one unified menu … easier to search between.” — the owner, 2026-11-10',
        rules: ['places-say-what-they-hold', 'menu-and-dock-meet', 'opens-it-closes-it', 'state-in-words'],
        build: `// openvibe-shared/dock-mount.js (loaded on first use)\nconst panel = OpenVibeDock.mountInto(host, { tab: 'vibe' });\npanel.show('agents');\npanel.destroy(); // no nodes or listeners left behind`,
    },
    'you-home': {
        title: 'You home',
        summary: 'Your face and name, add or switch account, Display, Settings, Sign out, then only what has no other home.',
        release: { version: '4.195.0', state: 'shipped', href: '/changes#v4.195.0' },
        shipped: '4.195.0 replaced the old account block in the menu with one slim row: your face and name, add or switch account, Display, Settings and Sign out, each a full touch target with a tooltip. Below it, small, only this site’s own items, your status and Admin.',
        quote: '“When I said integrate the user drop down into this menu, I didn’t mean like this … get rid of this thing.” — the owner, 2026-11-10',
        rules: ['account-in-the-menu', 'menu-opens-here', 'targets-44'],
        build: `// openvibe-shared/navbar.js hands the menu three small things; ov-home.js draws the row\nme: { add, out, own }\n// no dropdown: the picture opens the menu on You`,
    },
    menu: {
        title: 'The menu',
        summary: 'One navigation sheet: Here, Feed, Vibe with Chat · Agents, Chat and You; the pressed button flies to its tab.',
        release: { version: '4.200.0', state: 'shipped', href: '/changes#v4.200.0' },
        shipped: '4.200.0 made the menu one row of places: this site, Feed, Vibe (Chat · Agents), Chat and You. The button that was pressed flies to the tab it opens and becomes it, and closing flies it back. The notifications and the avatar count are in review for the next release.',
        quote: '“When you click this button, I want it to animate into the tab it becomes. Same with the other buttons.” — the owner, 2026-11-10; and “instead of having this called AI as the tab, let’s call it Vibe, and then under Vibe is Chat and Agents.”',
        rules: ['places-say-what-they-hold', 'button-becomes-its-tab', 'actions-as-icons-in-the-pill', 'menu-opens-here', 'menu-and-dock-meet', 'account-in-the-menu'],
        build: `// openvibe-shared/search.js\nOpenVibeSearch.open({ from: pressedElement });\n// each place has a stable data-tab id; the sheet's origin is the pressed button's centre\n// Vibe is the spark: its switch is Chat · Agents; Chat is the conversations; You carries the notifications`,
    },
    'search-pill': {
        title: 'The search pill',
        summary: 'The menu’s field, and the place’s actions as icons inside it: new, open in Chat, close.',
        release: { version: '4.200.0', state: 'shipped', href: '/changes#v4.200.0' },
        shipped: 'A place’s actions became icons in 4.200.0: + (new) and the open icon (open in OpenVibe.Chat) sit in the search pill, left of the close button, so they cost no row. The floating Dock keeps one slim row of the same icons.',
        quote: '“remove the text of Vibe conversations … the new conversation button can … move to an icon plus button … Open in chat should be … a little button icon.” — the owner, 2026-11-10',
        rules: ['actions-as-icons-in-the-pill', 'say-it-once', 'targets-44'],
        build: `// openvibe-shared/search.js: the pill's actions are the panel's own buttons, mirrored\n<span class="ovk-find">\n  <button type="button" aria-label="New chat" data-ov-new-chat>+</button>\n  <button type="button" aria-label="Open in OpenVibe.Chat" data-ov-open-chat><i data-ov-icon="open"></i></button>\n  <button type="button" aria-label="Close">×</button>\n</span>`,
    },
    'quest-card': {
        title: 'The quest card',
        summary: 'One daily quest a site can show: its mark, the day’s quest, three steps and one door to OpenVibe.Quest.',
        release: { version: 'next', state: 'in review', href: '/components/quest-card' },
        shipped: 'The designed daily quest card any site can show is in review for the next Shared release (openvibe-shared/quest, quest.css). It draws its own marks, so a site need not load Font Awesome, and the door’s arrow takes the accent. A site reads its own server; the browser never calls OpenVibe.Quest.',
        quote: '“Quest card: its own marks (no Font Awesome), the door’s arrow in the accent.” — the change that ships openvibe-shared/quest',
        rules: ['only-the-pair', 'two-icon-sets', 'state-in-words', 'a-change-has-a-mark'],
        build: `// openvibe-shared/quest.js, with quest.css beside it\nconst card = OpenVibeQuest.mount(document.getElementById('quest'), {\n  load: () => fetch('/api/home/daily-quest').then((r) => r.json()),\n});\ncard.refresh(); // read again and redraw`,
    },
    avatar: {
        title: 'The avatar',
        summary: 'A person’s picture; when it cannot show, the initial it becomes instead of a broken image.',
        release: { version: '4.201.0', state: 'in review', href: '/changes#v4.199.0' },
        shipped: '4.199.0 gave avatars their reserved box (width, height and async decode) so a page no longer shifts. The fallback to the initial is in review for the next release: a capture listener and a sweep replace any <img data-ov-initial> that fails, CSP-safe, in the footer’s faces and the account picture.',
        quote: '“A picture that cannot show becomes its initial (footer faces and account picture).” — the change, after a broken avatar in Locker’s footer',
        rules: ['two-icon-sets', 'state-in-words', 'targets-44'],
        build: `// openvibe-shared/footer.js (and the account picture)\n<img src="/avatar/ana" alt="" width="32" height="32"\n     loading="lazy" decoding="async" data-ov-initial="A">\n// a failed load becomes <i class="ov-initial">A</i>; no inline handler, no extra request`,
    },
    player: {
        title: 'The player',
        summary: 'The network’s video player: one row of controls on a phone that never runs off the screen.',
        release: { version: '4.201.0', state: 'in review', href: '/changes#v4.192.0' },
        shipped: '4.192.0 shipped our own small player that keeps a video going while you browse. The phone row is in review for the next release: the phone rules lost to a later sizing block, so at 390 px fullscreen was cut; the fix puts the phone block last, steps speed and picture-in-picture out, shortens the volume slider and shows the position alone under 360 px.',
        quote: '“Player on a phone: one row that never runs off the screen.” — the change, measured at 390 px on openvibe.video',
        rules: ['player-row-never-runs-off', 'cascade-in-order', 'the-video-comes-along', 'targets-44'],
        build: `<!-- openvibe-shared/player.css + player.js -->\n<video data-ov-player controls playsinline preload="metadata"\n       src="/video.m3u8" poster="/poster.jpg"></video>\n<!-- on a phone: play, mute, volume, time, captions, fullscreen; speed and PiP step out -->`,
    },
    'soft-pages': {
        title: 'Soft pages',
        summary: 'A page fetched on intent, its wait drawn by the mark, and a bar that holds still while the page cross-fades.',
        release: { version: '4.201.0', state: 'in review', href: '/changes#v4.192.0' },
        shipped: 'The soft page is in review for the next Shared release (soft.js). A same-site link is fetched on pointer down or after 80 ms of hover, never on Save-Data or 2G/3G, at most four in flight. The mark’s wait starts on the press and ends at first paint; cross-document view transitions hold the shared bar still and fade the rest (180 ms; Calm 120 ms; Off none). Measured on production pages at 390 px: press to first paint 1632 ms to 994 ms median.',
        quote: '“soft.js: prefetch on intent, the mark on the press, cross-document view transitions” — the change; 39% / ~0.64 s less press-to-first-paint in five throttled runs',
        rules: ['first-paint-alone', 'content-hashed-assets', 'no-spinners', 'calm-reduces-off-removes'],
        build: `<!-- in <head>, after theme-loader.js, not deferred -->\n<script src="/shared/soft.js"></script>\n\n// a page can turn one link off, or the whole thing:\n<a href="/next" data-ov-no-prefetch>Next</a>\nOpenVibeSoft = { on(), off(), exclude(selector) };`,
    },
    'icon-ink': {
        title: 'Icon ink',
        summary: 'A mark’s painted ink inside its tile: 0.58 of the tile, measured, not scaled by eye.',
        release: { version: '4.201.0', state: 'in review', href: '/changes#v4.183.0' },
        shipped: '4.183.0 gave every shape glyph a solid drawing at 18 px and under. The normalisation in review measures every shared icon set in Chrome, normalises 666 drawings to one ink size (0.79), and uses a 0.58 painted-ink fraction for app tiles; the old oversized tile rule is gone.',
        quote: '“Use a 0.58 painted-ink fraction for app tiles and remove the old oversized tile rule.” — the change, with the 50/58/64% comparison sheet',
        rules: ['two-icon-sets', 'only-the-pair', 'targets-44'],
        build: `// openvibe-shared/app-icon.js: the favicon's heavy form on a rounded tile\nfavicon({ site })   // mark(site, 0.58, 'heavy')\n\n// the test measures the painted bounds in headless Chrome, not the viewBox:\ntest/icon-ink.test.js   // ink within 4% of the target, centre within 3%`,
    },
    metrics: {
        title: 'Metrics',
        summary: 'The network’s one way to show numbers: tiles, a trend line, ranked bars, percentiles, a split and a sortable table.',
        release: { version: '4.232.0', state: 'shipped', href: '/changes#v4.232.0' },
        shipped: '4.232.0 shipped ov-metrics.js. Report, Exchange, Compare and the admin panel draw their AI and usage numbers with it: time to first token, tokens a second, success, cache share, cost per call and per task. The words come from OVMetrics.format, which servers also use, so 540 ms, $0.0042 and 86.0 tok/s read the same on every site.',
        quote: '“ov-metrics.js: the network’s one way to show numbers … nobody draws a chart of their own.” — the 4.232.0 change, for every AI call measured everywhere',
        rules: ['numbers-drawn-once', 'state-in-words', 'no-fake-content'],
        build: `<script src="/shared/ov-metrics.js" defer></script>\n\n// tiles with a delta that knows whether up is good\nslot.append(OVMetrics.tiles([\n  { label: 'Calls', value: OVMetrics.format.count(18420), delta: 0.12, trend: daily },\n  { label: 'Time to first token', value: OVMetrics.format.ms(row.ttft_ms.p50), sub: 'p95 ' + OVMetrics.format.ms(row.ttft_ms.p95), better: 'down' },\n]));\n// p50 and p95 on one scale, from report.ai-performance@1\nslot.append(OVMetrics.percentiles(row.ttft_ms, { label: 'Time to first token' }));\n// a sortable table; a numeric column can carry a bar\nslot.append(OVMetrics.table(rows, [{ key: 'model', label: 'Model' }, { key: 'tps', label: 'Speed', numeric: true, bar: true, format: OVMetrics.format.tps }]));\n\n// on a server: the same words\nconst { format } = require('openvibe-shared/ov-metrics');\nformat.ms(1310);   // '1.3 s'`,
    },
    footer: {
        title: 'The footer',
        summary: 'The strip that says how many are online, the faces, and one tooltip that says what the count means.',
        release: { version: '4.197.0', state: 'shipped', href: '/changes#v4.197.0' },
        shipped: '4.197.0 made the footer say “13 online”, then the faces; hovering or focusing the count shows “In the last 30 minutes” and the members and guests, and a press opens the same words above the names. A guests-only strip opens that line too.',
        quote: '“Make it like shorthand ‘3 online’. If you put your mouse over it, it says ‘last 30 minutes’.” — the owner, 2026-11-10',
        rules: ['one-bar', 'state-in-words', 'say-it-once', 'targets-44'],
        build: `// openvibe-shared/footer.js\n// one read: /api/frame/online gives { count, members, guests, faces, live }\n// the count carries data-ov-tip="In the last 30 minutes"; a press opens the names`,
    },
});

/** One note page, laid out like the component pages beside it. */
function notePage(name) {
    const note = NOTES[name];
    if (!note) return null;
    const specimen = SPECIMENS[name] ? SPECIMENS[name]() : '';
    const rules = ruleChips(note.rules);
    const release = note.release.state === 'shipped'
        ? `<a href="${esc(note.release.href)}">Shipped in ${esc(note.release.version)}</a>`
        : `In review for the next Shared release (${esc(note.release.version)}) · <a href="/changes">the archive</a>`;
    const body = `<div class="ds-wrap cn">
<header class="ds-page-h"><p class="ds-kicker"><a href="/components/registry">Components</a></p><h1>${esc(note.title)}</h1>
<p class="ds-lede">${esc(note.summary)}</p>
<p class="cn-meta">${release} · <a href="/changes">Every Shared release</a> · <a href="/rules">The rules</a></p></header>
<section class="cn-spec" aria-labelledby="cn-spec-h"><div class="cn-head"><h2 id="cn-spec-h">The specimen</h2><p class="ds-fine">${note.release.state === 'shipped' ? 'Rendered by this site from the openvibe-shared it pins.' : 'The part is in review for the next Shared release; the specimen is here so the design can be seen.'}</p></div>
<div data-specimen>${specimen}</div></section>
<div class="cn-cols">
<section class="cn-shipped" aria-labelledby="cn-shipped-h"><h2 id="cn-shipped-h">What shipped</h2><p>${esc(note.shipped)}</p><blockquote>${esc(note.quote)}</blockquote></section>
<section class="cn-rules" aria-labelledby="cn-rules-h"><h2 id="cn-rules-h">The rules it carries out</h2><p class="cn-chips">${rules || '<span class="ds-fine">No rule has been written for this part yet.</span>'}</p>
<h2>Build it</h2>${kit.snippet({ code: note.build, id: `cn-build-${name}` })}</section>
</div>
<footer class="cn-foot"><p><a href="/changes">Every Shared release, and the component it changed</a> · <a href="/components/registry">Every component</a> · <a href="/rules">How OpenVibe decides</a></p></footer>
</div>`;
    return layout({
        title: `${note.title}: OpenVibe component`,
        description: note.summary,
        path: `/components/${name}`,
        active: '/components',
        styles: ['css/component-registry.css', 'css/specimens.css'],
        sharedStyles: name === 'player' ? ['player.css'] : [],
        shared: name === 'player' ? ['player.js'] : name === 'metrics' ? ['ov-metrics.js'] : [],
        scripts: name === 'metrics' ? ['js/component-metrics.js'] : [],
        body,
    });
}

/** A page's status and rules as one section, for the designed pages that shipped before these notes (navbar, menu). */
function shippedSection(name) {
    const note = NOTES[name];
    if (!note) return '';
    const release = note.release.state === 'shipped'
        ? `<a href="${esc(note.release.href)}">Shipped in ${esc(note.release.version)}</a>`
        : `In review for the next Shared release (${esc(note.release.version)})`;
    return `<section class="cn-shipped cn-shipped--inline" aria-labelledby="cn-shipped-${esc(name)}-h"><h2 id="cn-shipped-${esc(name)}-h">What shipped</h2>
<p>${esc(note.shipped)}</p><blockquote>${esc(note.quote)}</blockquote>
<p class="cn-chips">${ruleChips(note.rules)}</p><p class="cn-meta">${release} · <a href="/changes">Every Shared release</a></p></section>`;
}

const specimen = (name) => (SPECIMENS[name] ? SPECIMENS[name]() : '');
const list = () => Object.entries(NOTES).filter(([name]) => !['menu', 'navbar', 'dock', 'you-home'].includes(name)).map(([name, note]) => ({ name, title: note.title, summary: note.summary }));

module.exports = { notePage, shippedSection, specimen, list, NOTES };
