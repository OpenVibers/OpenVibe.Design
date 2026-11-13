(() => {
  'use strict';
  const $ = (root, sel) => root.querySelector(sel);
  const node = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text) el.textContent = text; return el; };
  const kit = window.OpenVibePatternKit;
  const button = (label, fn, primary = false) => { const b = node('button', `dbtn${primary ? ' primary' : ''}`, label); b.type = 'button'; b.addEventListener('click', fn); return b; };
  document.querySelectorAll('[data-pattern-demo]').forEach((demo) => {
    const id = demo.dataset.patternDemo, widget = demo.querySelector('[data-widget]'), controls = demo.querySelector('[data-controls]'), status = demo.querySelector('.plive-status');
    const say = (text) => { status.textContent = text; };
    const control = (label, fn, primary) => controls.append(button(label, fn, primary));
    const list = () => { const box = node('div', 'stream-box'); ['Queued the run','Read the brief','Started the first step'].forEach((text) => box.append(node('div','stream-item',text))); return box; };
    if (['patch-in-place','follow-bottom','keep-anchor','fade-in'].includes(id)) {
      const box = list(); widget.append(box); const state = { stick: true };
      const patch = (texts) => kit.syncChildren(box, texts.map((text, i) => { const current = [...box.children].find(x => x.dataset.key === String(i)); if (current) { current.textContent=text; return current; } const row = node('div','stream-item',text); row.dataset.key=String(i); return row; }), true);
      box.querySelectorAll('.stream-item').forEach((row,i)=>row.dataset.key=String(i));
      control('Add update', () => { const texts=[...box.children].map(x=>x.textContent);texts.push(`New update · ${new Date().toLocaleTimeString()}`);patch(texts);if(id==='follow-bottom'&&state.stick)kit.scrollBottom(box,state,true);say(id === 'follow-bottom' ? 'At the bottom, so the stream followed.' : 'New row added; existing rows stayed in place.'); });
      if (id === 'keep-anchor') control('Insert above', () => { const top = box.scrollTop; box.prepend(node('div','stream-item','Earlier event inserted above')); box.scrollTop = top + 49; say('The first visible row remains at the same screen position.'); });
      if (id === 'follow-bottom') { box.style.maxHeight='118px'; box.scrollTop=box.scrollHeight; control('Read older rows', () => { box.scrollTop=0; state.stick=false; say('You moved away from the bottom. New updates will not take you back.'); }); }
      if (id === 'patch-in-place') control('Update middle row', () => { const texts=[...box.children].map(x=>x.textContent);texts[1]='Read the brief · details updated';patch(texts);say('Updated in place. Scroll position and node identity stayed stable.'); });
      if (id === 'fade-in') control('Add without replay', () => { const row = node('div','stream-item enter','New row fades in once'); box.append(row); setTimeout(() => row.classList.remove('enter'), 200); say('Only the new row animates.'); });
    } else if (id === 'smooth-folds') {
      const details=node('details','demo-fold'); const summary=node('summary','','4 steps'); const content=node('div','steplist'); details.append(summary,content); widget.append(details);
      const steps=[{id:'read',name:'Read request',summary:'Read request'},{id:'edit',name:'Update component',summary:'Update component'},{id:'check',name:'Check layout',summary:'Check layout'}];
      const renderStep=(step)=>node('div','fold-content',step.summary||step.name); kit.patchGroup(details,steps,renderStep);
      summary.addEventListener('click',(e)=>{e.preventDefault(); if(kit.animateDetails(details))say(details.open?'Fold opened with a height transition.':'Fold closed with a height transition.');else {details.open=!details.open;say('Fold toggled with reduced motion.');}});
      control('Update a step',()=>{steps[1]={...steps[1],summary:'Update component · in place'};kit.patchGroup(details,steps,renderStep);say('Only the changed step row was patched.');});
      control('Toggle fold',()=>summary.click());
    } else if (id === 'progress-strip') {
      kit.updateProgress(widget,{title:'Writing the result',done:2,total:4,steps:3,elapsed:'18s',detail:'Plan: Read request · Build page · Check layout · Report'});const line=widget.querySelector('button');line.addEventListener('click',()=>say(line.classList.contains('open')?'Progress details expanded.':'Progress details collapsed.'));control('Toggle details',()=>line.click());
    } else if (id === 'outcome-line') {
      const row=node('div','outcome-line'); const badge=node('span','status-badge bad','×  Didn’t finish'); const copy=node('div','outcome-copy');copy.append(node('strong','','The model stopped early'),node('small','','The next action stays beside the reason.'));row.append(badge,copy);['Retry','Switch','Fine'].forEach(label=>row.append(button(label,()=>say(`${label} action selected.`),label==='Retry')));widget.append(row);
    } else if (id === 'one-row') {
      const row=node('div','ship-line');row.append(node('span','status-badge','◉  Live'),node('strong','','Ship · Actor #187'),node('span','pmeta','2 attempts')); const attempts=node('div','attempt-list');attempts.append(node('div','attempt','Attempt 1 · stopped'),node('div','attempt','Attempt 2 · running'));row.addEventListener('click',()=>{row.classList.toggle('open');say(row.classList.contains('open')?'Attempts expanded inside the task row.':'Attempts folded inside the task row.');});widget.append(row,attempts);control('Toggle attempts',()=>row.click());
    } else if (id === 'icon-pills') {
      const row=node('div','demo-row');[['↻','Retry'],['⇄','Switch'],['✓','Fine']].forEach(([icon,label],i)=>{const b=button(`${icon}  ${label}`,()=>say(`${label} pressed.`),i===0);b.setAttribute('aria-label',label);row.append(b);});widget.append(row);
    } else if (id === 'status-badges') {
      const row=node('div','demo-row');[['✓ Complete',''],['◉ Running',''],['! Needs attention','warn'],['× Failed','bad']].forEach(([text,kind])=>row.append(node('span',`status-badge ${kind}`,text)));widget.append(row);
    } else if (id === 'metadata-chips') {
      const row=node('div','demo-row');['Provider · OpenAI','Model · GPT','3 steps','18 sec'].forEach(text=>row.append(node('span','meta-chip',text)));widget.append(row);control('Add metadata',()=>{row.append(node('span','meta-chip','Cost · $0.02'));say('Metadata added as a compact chip.');});
    } else if (id === 'empty-state') {
      const row=node('div','empty-demo');row.append(node('span','','No saved patterns yet.'),button('Browse patterns',()=>say('The single action takes you to the pattern list.'),true));widget.append(row);
    } else if (id === 'tabs-not-folds') {
      const tabs=node('div','demo-tabs');const panel=node('div','tab-panel');['Overview','Attempts','Files'].forEach((name,i)=>{const b=button(name,()=>{tabs.querySelectorAll('button').forEach(x=>x.setAttribute('aria-selected','false'));b.setAttribute('aria-selected','true');panel.textContent=`${name} view. Peer views stay at the same level.`;say(`${name} tab selected.`);});b.className='tab-button';b.setAttribute('role','tab');b.setAttribute('aria-selected',String(i===0));tabs.append(b);if(!i)panel.textContent=`${name} view. Peer views stay at the same level.`;});widget.append(tabs,panel);
    } else if (id === 'touch-targets') {
      const row=node('div','demo-row');const hit=button('⌕',()=>say('The full 44 by 44 px target was activated.'));hit.setAttribute('aria-label','Search');hit.style.width='44px';hit.style.padding='0';const box=node('span','target-box','44');row.append(hit,box,node('span','meta-chip','minimum hit area'));widget.append(row);
    } else if (id === 'motion') {
      const row=node('div','demo-row'),mark=node('span','ov-mark','ov');row.append(mark);widget.append(row);control('Standard · 260 ms',()=>{mark.animate([{transform:'translateX(0)'},{transform:'translateX(90px)'}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:260,easing:'cubic-bezier(.2,.7,.2,1)'});say('Standard motion: 260 ms, unless reduced motion is on.');});control('Back easing',()=>{mark.animate([{transform:'scale(1)'},{transform:'scale(1.18)'},{transform:'scale(1)'}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:360,easing:'cubic-bezier(.34,1.56,.64,1)'});say('Back easing is reserved for playful feedback.');});
    } else if (id === 'site-switcher') {
      const frame=node('div','site-switcher-demo'),trigger=button('◉  Open shared site switcher',()=>{const shared=document.querySelector('#openvibe-switch-btn');if(shared){shared.click();say('Opened the site switcher used by the shared navbar.');}else say('Use the OpenVibe mark in the navbar to open the shared switcher.');});frame.append(trigger,node('span','meta-chip','openvibe-shared/site-switcher.js'));widget.append(frame);
    } else if (id === 'single-navbar') {
      const nav=node('nav','sample-nav');nav.setAttribute('aria-label','Example page navbar');nav.append(node('strong','','OpenVibe'),node('span','','Patterns'),node('span','','One shared navbar'));widget.append(nav);say('This page itself uses the shared Frame navbar once.');
    } else if (id === 'bottom-tabs') {
      const frame=node('div','bottom-demo');frame.append(node('strong','','Scrollable content'),node('p','','This content reserves space under the fixed phone tabs.'),node('p','','The final row remains visible above the bar.'));const nav=node('nav','bottom-nav');nav.setAttribute('aria-label','Phone tabs');['Home','Runs','Settings'].forEach(x=>nav.append(button(x,()=>say(`${x} tab selected.`))));frame.append(nav);widget.append(frame);
    } else if (id === 'media-owns-the-screen') {
      // A phone frame: browsing shows the tabs; the watch screen hides them and docks the stream's chat under the picture.
      const frame = node('div', 'watch-demo'), player = node('div', 'watch-player'), chat = node('div', 'watch-chat');
      player.append(node('span', 'watch-live', '● Live'));
      ['Ana: hi!', 'Ben: what game is this?', 'Cy: the stream looks great'].forEach((x) => chat.append(node('p', '', x)));
      const nav = node('nav', 'bottom-nav'); nav.setAttribute('aria-label', 'Phone tabs');
      ['Home', 'Videos', 'Chat'].forEach((x) => nav.append(button(x, () => say(`${x} tab selected.`))));
      frame.append(player, chat, nav);
      widget.append(frame);
      control('Watch screen', () => { frame.classList.add('is-watching'); say('Watching: the tabs step aside and the stream’s chat takes the room.'); }, true);
      control('Browse', () => { frame.classList.remove('is-watching'); say('Browsing: the tabs are back.'); });
      frame.classList.add('is-watching');
    } else if (id === 'decor-stays-out') {
      const frame = node('div', 'decor-demo'), bar = node('div', 'decor-bar'), head = node('strong', 'decor-head', 'Conductor');
      bar.append(node('span', 'decor-mark', 'ov'), node('span', '', 'Codes'));
      frame.append(bar, head, node('p', '', 'The page’s own text stays clear.'));
      widget.append(frame);
      const fall = (land) => {
        frame.querySelectorAll('.decor-leaf').forEach((x) => x.remove());
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (still) { say('Reduced motion is on: no fall at all.'); return; }
        const barBottom = bar.offsetTop + bar.offsetHeight;
        for (let i = 0; i < 6; i++) {
          const leaf = node('span', 'decor-leaf'); frame.append(leaf);
          const x = 26 + i * 22 + Math.round(Math.random() * 10);
          leaf.style.left = `${x}px`;
          const y = land ? barBottom - 14 - Math.round(Math.random() * 3) : 60 + Math.round(Math.random() * 70);
          leaf.animate([{ transform: 'translateY(0) rotate(0)', opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: `translateY(${y}px) rotate(${180 + i * 40}deg)`, opacity: 1, offset: 0.72 }, { transform: `translateY(${y}px) rotate(${180 + i * 40}deg)`, opacity: 0 }], { duration: 2400 + i * 120, easing: 'cubic-bezier(.3,.1,.5,1)', fill: 'forwards' });
        }
        say(land ? 'The leaves land on the bar’s edge and fade there.' : 'The old way: the leaves fall across the heading.');
      };
      control('Play the fall', () => fall(true), true);
      control('The old way', () => fall(false));
    } else if (id === 'shared-columns') {
      const list = node('div', 'cols-demo'), rows = [['1st', 'atlas-1', '1014'], ['2nd–12th', 'nimbus-12', '1009'], ['13th', 'a', '986']];
      rows.forEach(([band, name, score]) => { const r = node('div', 'cols-row'); r.append(node('span', 'cols-band', band), node('span', 'cols-name', name), node('span', 'cols-score', score)); list.append(r); });
      widget.append(list);
      const set = (shared) => { list.classList.toggle('per-row', !shared); say(shared ? 'Every row shares one set of columns: names line up.' : 'Each row sizes its own columns: names jump around.'); };
      control('Shared columns', () => set(true), true);
      control('Per-row columns', () => set(false));
      set(true);
    } else if (id === 'numbers-align') {
      const table = node('table', 'num-demo'), head = node('tr'), body = node('tbody');
      ['Model', 'Votes'].forEach((h, i) => { const th = node('th', i ? 'num' : '', h); head.append(th); });
      const thead = node('thead'); thead.append(head);
      [['atlas-1', '8'], ['nimbus-2', '128'], ['orbit', '1,024']].forEach(([m, v]) => { const tr = node('tr'); tr.append(node('td', '', m), node('td', 'num', v)); body.append(tr); });
      table.append(thead, body); widget.append(table);
      control('Aligned', () => { table.classList.remove('broken'); say('Right-aligned, tabular figures: the digits stack under the header.'); }, true);
      control('The bug', () => { table.classList.add('broken'); say('A broader td rule wins: the numbers sit left under a right-aligned header.'); });
    } else if (id === 'tables-scroll-inside') {
      const box = node('div', 'tscroll-demo'), table = node('table', 'tscroll-table');
      table.innerHTML = '<thead><tr><th>Provider</th><th>Plan</th><th>€ / month</th><th>Traffic</th></tr></thead><tbody><tr><td>Hetzner</td><td>CX22</td><td>4.51</td><td>20 TB</td></tr><tr><td>Netcup</td><td>VPS 1000 G11</td><td>6.74</td><td>unmetered</td></tr></tbody>';
      box.append(table); widget.append(box);
      control('Scroll inside', () => { box.classList.remove('broken'); say('Whole words; the table scrolls inside its box.'); }, true);
      control('The bug', () => { box.classList.add('broken'); say('Words break mid-letter to fit the screen.'); });
    } else if (id === 'measure-at-rest') {
      const card = node('div', 'measure-card', 'Dock'); widget.append(card);
      const play = (atRest) => {
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const anim = card.animate([{ transform: 'scale(.82)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: still ? 0 : 300, easing: 'cubic-bezier(.2,.9,.25,1.08)' });
        const read = () => { const b = card.getBoundingClientRect(); say(`${atRest ? 'At rest' : 'Mid-entrance'}: ${Math.round(b.width)} × ${Math.round(b.height)} px${atRest ? '' : ` (the card is ${card.offsetWidth} × ${card.offsetHeight})`}.`); };
        if (atRest) anim.finished.then(read); else setTimeout(read, still ? 0 : 60);
      };
      control('Measure at rest', () => play(true), true);
      control('Measure mid-entrance', () => play(false));
    } else if (id === 'drag-or-tap') {
      const box = node('div', 'drag-demo'), chip = node('button', 'drag-chip', 'Tap or drag me');
      chip.type = 'button'; box.append(chip); widget.append(box);
      let s = null, swallow = false, taps = 0;
      const corners = ['tl', 'tr', 'bl', 'br']; let at = 'br'; chip.dataset.at = at;
      const move = (e) => { if (!s || e.pointerId !== s.id) return; s.dx = e.clientX - s.x; s.dy = e.clientY - s.y; if (!s.live && Math.abs(s.dx) + Math.abs(s.dy) >= 6) { s.live = true; chip.classList.add('is-moving'); } if (s.live) chip.style.transform = `translate(${s.dx}px, ${s.dy}px)`; };
      const end = (e) => {
        if (!s || e.pointerId !== s.id) return;
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end);
        const live = s.live, r = chip.getBoundingClientRect(), b = box.getBoundingClientRect(); s = null;
        chip.classList.remove('is-moving'); chip.style.transform = '';
        if (!live) return;
        swallow = true; setTimeout(() => { swallow = false; }, 0);
        at = `${r.top + r.height / 2 < b.top + b.height / 2 ? 't' : 'b'}${r.left + r.width / 2 < b.left + b.width / 2 ? 'l' : 'r'}`;
        chip.dataset.at = corners.includes(at) ? at : 'br';
        say('A drag: it snapped to the nearest corner, and the press was not a tap.');
      };
      chip.addEventListener('pointerdown', (e) => { if (e.button) return; s = { x: e.clientX, y: e.clientY, dx: 0, dy: 0, id: e.pointerId, live: false }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end); });
      chip.addEventListener('click', (e) => { if (swallow) { swallow = false; e.preventDefault(); e.stopPropagation(); return; } taps++; say(`A tap (${taps}). It moved less than 6 px, so it stayed a tap.`); }, true);
    } else if (id === 'floating-clears-toasts') {
      const screen = node('div', 'clear-demo'), stack = node('div', 'clear-toasts'), pill = node('span', 'clear-pill', 'Needs you');
      screen.append(stack, pill); widget.append(screen);
      const toast = () => { const t = node('div', 'clear-toast', 'Codes finished a task'); stack.append(t); setTimeout(() => t.remove(), 3200); };
      const set = (on) => { screen.style.setProperty('--clear', on ? '52px' : '0px'); pill.hidden = false; say(on ? 'The pill says how much room it takes: toasts stack above it.' : 'Nobody says: the toast covers the pill.'); toast(); };
      control('Clear the pill', () => set(true), true);
      control('The bug', () => set(false));
    } else if (id === 'labelled-cards') {
      const box = node('div', 'lcards-demo'), table = node('table', 'lcards-table');
      const head = ['City', 'Studio', '1 bedroom', '2 bedrooms'], rows = [['Huntsville', '$902', '$1,010', '$1,147'], ['Mobile', '$858', '$893', '$1,054']];
      const thead = node('thead'), htr = node('tr'); head.forEach((h) => htr.append(node('th', '', h))); thead.append(htr);
      const tbody = node('tbody'); rows.forEach((r) => { const tr = node('tr'); r.forEach((v, i) => { const td = node('td', '', v); td.dataset.label = head[i]; tr.append(td); }); tbody.append(tr); });
      table.append(thead, tbody); box.append(table); widget.append(box);
      control('Labelled cards', () => { box.classList.remove('broken'); say('Each value names its column; the city is the card\u2019s title.'); }, true);
      control('The bug', () => { box.classList.add('broken'); say('The header row is hidden and the cells carry no labels: four bare prices.'); });
    } else if (id === 'ask-with-a-button') {
      const card = node('div', 'ask-demo'), p = node('p', '', 'Your watches belong to your OpenVibe account.'), cta = node('p'), a = node('a', 'ask-btn', 'Sign in with OpenVibe');
      a.href = '#'; a.addEventListener('click', (e) => e.preventDefault()); cta.append(a); card.append(p, cta); widget.append(card);
      control('With a button', () => { card.classList.remove('broken'); say('One sentence, then the button: the next step stands out.'); }, true);
      control('The bug', () => { card.classList.add('broken'); say('A link inside the sentence: easy to miss, and it reads like any other link.'); });
    } else if (id === 'own-places') {
      const orb = node('div', 'places-demo'), core = node('span', 'places-core', 'Run');
      const nodes = ['Pair', 'Submit', 'Sandbox', 'Stream', 'Meter'].map((label, i) => { const n = node('span', 'places-node', label); n.style.setProperty('--i', i); return n; });
      orb.append(core, ...nodes, node('span', 'places-ring r1'), node('span', 'places-ring r2')); widget.append(orb);
      control('Its own places', () => { orb.classList.remove('broken'); say('Pair, submit, sandbox, stream, meter: the picture says how a job runs here.'); }, true);
      control('The bug', () => { orb.classList.add('broken'); say('The same rings on six homes: the picture says nothing about this site.'); });
    } else if (id === 'mixed-words') {
      const row = node('div', 'mixed-demo');
      ['light', 'dark'].forEach((kind) => { const panel = node('div', `mixed-panel ${kind}`); [['Legendary', '#fbbf24'], ['Rare', '#38bdf8'], ['AI', '#a78bfa']].forEach(([w, hue]) => { const b = node('span', 'mixed-word', w); b.style.setProperty('--hue', hue); panel.append(b); }); row.append(panel); });
      widget.append(row);
      control('Mixed with the text', () => { row.classList.remove('broken'); say('Half the hue, half the text: readable on both.'); }, true);
      control('The bug', () => { row.classList.add('broken'); say('The pure hue: fine on dark, 1.7:1 for gold on white.'); });
    } else if (id === 'one-menu') {
      // The owner's menu button (openvibe-shared 4.187.0, root.OpenVibeOrb.svg): a search bar over three apps.
      // Drawn by the shared navbar when it is on the page, else the same shapes inline.
      const orb = (open) => (window.OpenVibeOrb ? window.OpenVibeOrb.svg(20, open)
        : `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><rect x="4" y="5.2" width="16" height="5.6" rx="2.8" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="7.4" cy="8" r="1.15"/><rect x="4.2" y="14.6" width="4" height="4" rx="1.3"/><rect x="10" y="14.6" width="4" height="4" rx="1.3"/><rect x="15.8" y="14.6" width="4" height="4" rx="1.3"/></svg>`);
      const box = node('div', 'menu-demo'); const bar = node('div', 'menu-bar');
      const menu = node('button', 'dbtn menu-orb'); menu.type = 'button'; menu.setAttribute('aria-label', 'The menu button at the top of the page');
      const paint = (open) => { menu.innerHTML = orb(open) + `<span>${open ? 'Close' : 'Menu'}</span>`; menu.setAttribute('aria-expanded', String(open)); };
      paint(false);
      bar.append(node('strong', '', 'OpenVibe.Live'), node('span', 'menu-gap'), menu); const panel = node('ol', 'menu-panel'); box.append(bar, panel); widget.append(box);
      const order = ['This site’s pages', 'Live now', 'Your places', 'Your workspace', 'From the sites', 'What’s new', 'Every site (54)', 'Jump back in'];
      function open(show) { if (show) panel.replaceChildren(...order.map((t) => node('li', '', t))); box.classList.toggle('open', show); paint(show); }
      menu.addEventListener('click', () => open(!box.classList.contains('open')));
      control('Open the menu', () => { open(true); say('The menu button at the top of the page opens the OpenVibe menu on this site: its pages lead.'); }, true);
      control('Back', () => { open(false); say('Back closed the menu; the page stayed.'); });
    } else if (id === 'site-cards') {
      const card = node('div', 'card-demo'); const head = node('div', 'card-head'); head.append(node('strong', '', 'Trending'), node('span', 'pmeta', 'Video')); const list = node('ol', 'card-rows'); card.append(head, list); widget.append(card);
      const add = (title, meta, ok) => { if (!ok) { say('Dropped: the entry’s link is not https on an OpenVibe host.'); return; } const li = node('li', ''); li.append(node('b', '', title), node('small', '', meta)); list.append(li); card.hidden = false; say(`${list.children.length} real entr${list.children.length === 1 ? 'y' : 'ies'}.`); };
      card.hidden = true; say('No entries yet: the card is not shown.');
      control('Publish an entry', () => add(['A rainy night walk', 'Speedrun practice', 'Cozy build stream'][list.children.length % 3], `${20 - list.children.length} views this week`, true), true);
      control('A bad link', () => add('Example', 'javascript:', false));
    } else if (id === 'your-things') {
      const bar = node('div', 'things-bar'); const coins = node('span', 'meta-chip', '● 1,240'); const vibes = node('span', 'meta-chip', '● 30'); const msgs = node('span', 'things-msgs', '✉'); const n = node('b', '', ''); msgs.append(n); const face = node('span', 'things-face', 'A'); const dot = node('i', 'dot-demo'); dot.dataset.state = 'online'; face.append(dot);
      bar.append(node('strong', '', 'Any site'), node('span', 'menu-gap'), coins, vibes, msgs, face); widget.append(bar); let count = 0;
      control('A new message', () => { count += 1; n.textContent = String(count); say(`${count} unread: the same count on every site.`); }, true);
      control('Sign out', () => { bar.classList.toggle('out'); say(bar.classList.contains('out') ? 'Signed out: none of it shows, nothing is asked.' : 'Signed in again.'); });
    } else if (id === 'status-dot') {
      const row = node('div', 'demo-row'); const face = node('span', 'things-face big', 'K'); const dot = node('i', 'dot-demo'); face.append(dot); const word = node('span', 'status-word', ''); row.append(face, word); widget.append(row);
      const set = (state, label, others) => { dot.dataset.state = state; word.textContent = label; say(others); };
      set('online', 'Online', 'Others see a green dot and the word Online.');
      [['online', 'Online', 'Others see a green dot and the word Online.'], ['away', 'Away', 'A crescent after ten minutes without input.'], ['dnd', 'Do not disturb', 'A bar across the dot; pings stay quiet.'], ['live', 'Live now', 'Live outranks the rest while streaming.'], ['none', 'Invisible', 'Others see no dot at all, and never “last seen”.']].forEach(([s2, l, o], i) => control(l, () => set(s2, l, o), i === 0));
    } else if (id === 'fab-sheet') {
      const phone = node('div', 'phone-demo'); phone.append(node('p', '', 'My files'), node('p', 'pmeta', '24 files')); const fab = button('+  New', () => { phone.classList.add('open'); say('The sheet opens from the bottom.'); }, true); fab.className += ' float-demo';
      const sheet = node('div', 'sheet-demo'); ['Upload files', 'New folder', 'Back up a folder'].forEach((t) => sheet.append(node('div', 'sheet-row', t))); phone.append(fab, sheet); widget.append(phone);
      control('Back', () => { phone.classList.remove('open'); say('Back closed the sheet first.'); });
      control('The bug', () => { phone.classList.toggle('broken'); say(phone.classList.contains('broken') ? 'Three forms above the list: the files start a screen down.' : 'One button; the files start at the top.'); });
    } else if (id === 'drop-anywhere') {
      const zone = node('div', 'drop-demo', 'Drop files anywhere here'); const tray = node('ul', 'tray-demo'); widget.append(zone, tray); let n = 0;
      const drop = () => { n += 1; const li = node('li', ''); const bar = node('i', ''); li.append(node('span', '', `photo-${n}.jpg`), bar); tray.append(li); let pct = 0; const tick = setInterval(() => { pct = Math.min(100, pct + 25); bar.style.width = `${pct}%`; if (pct === 100) { clearInterval(tick); li.classList.add('done'); say('In: the list updates in place.'); } }, 220); say('Uploading into the folder on screen.'); };
      zone.addEventListener('dragover', (e) => e.preventDefault()); zone.addEventListener('drop', (e) => { e.preventDefault(); drop(); });
      control('Drop a file', drop, true);
    } else if (id === 'card-or-row') {
      const list = node('ul', 'cr-demo'); ['Report.pdf', 'Budget.xlsx', 'Trailer.mp4', 'Notes.md'].forEach((t) => { const li = node('li', ''); li.append(node('span', 'cr-thumb', t.split('.').pop().toUpperCase()), node('span', '', t)); list.append(li); }); widget.append(list);
      control('Grid', () => { list.classList.remove('rows'); say('The same items as cards.'); }, true); control('List', () => { list.classList.add('rows'); say('The same items as rows: nothing re-rendered.'); });
    } else if (id === 'even-grid') {
      const grid = node('div', 'even-demo'); const fill = (k) => grid.replaceChildren(...Array.from({ length: k }, (_, i) => node('span', '', String(i + 1)))); fill(7); grid.style.setProperty('--cols', 3); widget.append(grid); say('Seven in three columns: one alone.');
      control('Eight in four', () => { fill(8); grid.style.setProperty('--cols', 4); say('Eight in four: two even rows.'); }, true);
      control('The bug', () => { fill(7); grid.style.setProperty('--cols', 3); say('Seven in three columns: one alone.'); });
    } else if (id === 'six-places') {
      const bar = node('div', 'six-demo'); const all = ['Models', 'Chat', 'Arena', 'Rankings', 'Start', 'API', 'Why this model', 'Sell compute', 'Your endpoint', 'Uncensored', 'AI in OpenVibe', 'Questions', 'Status'];
      const draw = (k) => { bar.replaceChildren(node('strong', '', 'OpenVibe.Exchange'), ...all.slice(0, k).map((t) => node('span', '', t)), ...(k < all.length ? [node('span', 'six-more', `More (${all.length - k})`)] : [])); };
      draw(all.length); widget.append(bar); say('Thirteen links wrap and cut the name.');
      control('Six, the rest under More', () => { draw(6); say('Six places, one line, the name whole.'); }, true); control('The bug', () => { draw(all.length); say('Thirteen links wrap and cut the name.'); });
    } else if (id === 'ask-your-agent') {
      const row = node('div', 'ask-demo'); const share = node('span', 'ask-share', 'Share'); const chip = button('\u2726 Ask your agent', () => { box.value = 'About the video \u201cThe Workshop tour\u201d on OpenVibe.Video: '; dock.classList.add('open'); box.focus(); say('Vibe opened with the question waiting. Nothing was sent.'); });
      chip.className = 'ask-chip'; row.append(share, chip);
      const dock = node('div', 'ask-dock'); const box = node('textarea', 'ask-box'); box.rows = 2; box.setAttribute('aria-label', 'Your agent\u2019s box'); const send = button('Send', () => { say(box.value.trim() ? 'The person pressed Send: only now does it go.' : 'Nothing to send.'); }, true); dock.append(node('b', '', 'Vibe'), box, send);
      widget.append(row, dock); say('One quiet chip beside Share.');
      control('The bug', () => { dock.classList.add('open'); box.value = ''; say('A blank box on another page: the person retypes what they were looking at.'); });
    } else if (id === 'levels-with-a-floor') {
      const lv = [['Asks first', 'It asks you before it does anything outside its own work.'], ['Edits on its own', 'It changes your files and drafts without asking. Anything else asks.'], ['A second model checks', 'Another model reviews each step. When it says no, you decide.'], ['Full trust', 'It acts without asking.']];
      const list = node('div', 'lv-demo'); lv.forEach(([title, line], i) => { const l = node('label', 'lv-card'); const r = node('input'); r.type = 'radio'; r.name = 'lv'; if (!i) r.checked = true; r.addEventListener('change', () => say(i === 3 ? 'Full trust: still asks before money, passwords, deleting and someone new.' : `${title}.`)); l.append(r, node('b', '', title), node('span', '', line)); list.append(l); });
      const floor = node('p', 'lv-floor', 'Always asks, at every level: spending money \u00b7 a password or key \u00b7 deleting something \u00b7 messaging someone new.');
      widget.append(list, floor); say('Four levels in words, and the floor in view.');
      control('The bug', () => { floor.classList.toggle('gone'); say(floor.classList.contains('gone') ? 'No floor on the page: full trust reads as \u201canything\u201d.' : 'The floor is back in view.'); });
    } else if (id === 'agent-line') {
      const states = [['running', 'Your agent is building this', 'Watch in your Dock'], ['waiting', 'Your agent asks to publish this', 'Answer in your Dock'], ['done', 'Your agent is done', 'See its steps'], ['failed', 'Your agent couldn\u2019t finish', 'See what happened']];
      const bar = node('div', 'line-demo'); const dot = node('i', ''); const words = node('span', ''); const act = node('span', 'line-act'); bar.append(dot, words, act);
      const work = node('div', 'line-work', 'The space, changing as the agent writes it'); let k = 0;
      const draw = () => { const [st, w, a] = states[k]; bar.dataset.state = st; words.textContent = w; act.textContent = a; work.classList.remove('covered'); say(w + '.'); };
      draw(); widget.append(bar, work);
      control('Next state', () => { k = (k + 1) % states.length; draw(); }, true);
      control('The bug', () => { work.classList.add('covered'); say('A blurred cover over the work: nobody can watch it being made.'); });
    } else if (id === 'column-earns-place') {
      const rows = [['atlas-1', '$0.40', '1.4 s'], ['nimbus-2', '$2.00', '2.6 s'], ['orbit', '$1.20', null]];
      const table = node('table', 'num-demo hn-table'); widget.append(table);
      const draw = (bug) => { const cols = bug ? ['Model', 'Price', 'Reply time', 'Tokens/s', 'First token', 'Licence'] : ['Model', 'Price', 'Reply time'];
        const head = node('tr'); cols.forEach((h) => head.append(node('th', '', h))); const thead = node('thead'); thead.append(head); const body = node('tbody');
        rows.forEach((r) => { const tr = node('tr'); cols.forEach((_, i) => { const v = r[i]; const td = node('td', v == null ? 'hn-quiet' : '', v == null ? (i < 3 ? 'No traffic yet' : 'Not measured yet') : v); tr.append(td); }); body.append(tr); });
        table.replaceChildren(thead, body); };
      draw(false); say('Three columns, each with values; one missing value says why.');
      control('Columns with values', () => { draw(false); say('Three columns, each with values; one missing value says why.'); }, true);
      control('The bug', () => { draw(true); say('Three more columns, nine cells of “Not measured yet”: the real numbers are harder to find.'); });
    } else if (id === 'missing-not-zero') {
      const data = [['atlas-1', 1400], ['nimbus-2', 2600], ['orbit', null]];
      const list = node('ol', 'hn-rank'); const pick = node('p', 'hn-pick'); widget.append(pick, list);
      const draw = (bug) => { const val = (v) => (v == null ? (bug ? 0 : Infinity) : v); const sorted = [...data].sort((a, b) => val(a[1]) - val(b[1]));
        list.replaceChildren(...sorted.map(([m, v]) => { const li = node('li'); li.append(node('b', '', m), node('span', v == null ? 'hn-quiet' : '', v == null ? (bug ? '0 ms' : 'No traffic yet') : `${(v / 1000).toFixed(1)} s`)); return li; }));
        pick.textContent = `Fastest: ${sorted[0][0]}`; pick.classList.toggle('hn-wrong', bug); };
      draw(false); say('The unmeasured model sorts last and wins nothing.');
      control('Missing sorts last', () => { draw(false); say('The unmeasured model sorts last and wins nothing.'); }, true);
      control('The bug', () => { draw(true); say('null became 0: a model nobody measured is “Fastest”.'); });
    } else if (id === 'not-rated-yet') {
      const card = node('div', 'hn-card'); const name = node('b', '', 'orbit'); const score = node('span', 'hn-score'); const sub = node('small', ''); card.append(name, score, sub); widget.append(card);
      const draw = (games, bug) => { if (games || bug) { score.textContent = String(1000 + games * 6); score.classList.remove('hn-quiet'); sub.textContent = games ? `± ${Math.max(12, 80 - games * 4)} · ${games} games` : '0 games'; } else { score.textContent = 'Not rated yet'; score.classList.add('hn-quiet'); sub.textContent = 'No votes so far'; } };
      let games = 0; draw(0, false); say('No games: the words say so.');
      control('Play a game', () => { games += 1; draw(games, false); say(`${games} ${games === 1 ? 'game' : 'games'}: now there is a rating, with its spread.`); }, true);
      control('The bug', () => { games = 0; draw(0, true); say('1000 with no games reads as a result. It is only where everyone starts.'); });
    } else if (id === 'number-names-source') {
      const fig = node('button', 'hn-fig'); fig.type = 'button'; const v = node('b', '', '1.4 s'); const what = node('span', '', 'typical reply'); const src = node('small', 'hn-src', 'Real traffic through the Exchange · 13,208 requests · last 7 days'); fig.append(v, what, src); widget.append(fig);
      fig.addEventListener('click', () => { fig.classList.toggle('open'); say(fig.classList.contains('open') ? 'Where it came from, how much it rests on, and when.' : 'Tap the number for its source.'); });
      fig.classList.add('open'); say('The value, then what it rests on.');
      control('With its source', () => { fig.classList.add('open'); fig.classList.remove('bare'); say('The value, then what it rests on.'); }, true);
      control('The bug', () => { fig.classList.remove('open'); fig.classList.add('bare'); say('A bare “1.4 s”: measured how, on what, when?'); });
    } else if (id === 'price-freshness') {
      const card = node('div', 'hn-card hn-price'); const p = node('b', '', '$0.90'); const unit = node('span', '', 'per 1M output tokens'); const when = node('small', ''); card.append(p, unit, when); widget.append(card);
      const draw = (hours, bug) => { card.classList.toggle('stale', hours > 72 && !bug); when.textContent = bug ? '' : hours < 24 ? `Checked ${hours} hours ago on the provider’s page` : `Checked ${Math.round(hours / 24)} days ago · may have changed`; };
      draw(3, false); say('Checked 3 hours ago.');
      control('Checked today', () => { draw(3, false); say('Checked 3 hours ago.'); }, true);
      control('Nine days later', () => { draw(216, false); say('Old: the price says it may have changed.'); });
      control('The bug', () => { draw(216, true); say('No date: a nine-day-old price looks as live as one we set.'); });
    } else if (id === 'mark-system') {
      const row=node('div','mark-demo'),mark=node('span','ov-mark','ov');row.append(mark,node('span','','OpenVibe'));widget.append(row);control('Loading state',()=>{mark.classList.toggle('loading');say(mark.classList.contains('loading')?'Loading state active.':'Loading state stopped.');});control('Change site',()=>{mark.textContent=mark.textContent==='ov'?'lv':'ov';mark.style.borderRadius=mark.textContent==='lv'?'50%':'16px';say('The mark morphs for the active site.');});control('Open five studies',()=>{window.location.href='/patterns/mark/studies';});
    }
  });
})();
