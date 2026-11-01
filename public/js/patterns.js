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
    } else if (id === 'mark-system') {
      const row=node('div','mark-demo'),mark=node('span','ov-mark','ov');row.append(mark,node('span','','OpenVibe'));widget.append(row);control('Loading state',()=>{mark.classList.toggle('loading');say(mark.classList.contains('loading')?'Loading state active.':'Loading state stopped.');});control('Change site',()=>{mark.textContent=mark.textContent==='ov'?'lv':'ov';mark.style.borderRadius=mark.textContent==='lv'?'50%':'16px';say('The mark morphs for the active site.');});control('Open five studies',()=>{window.location.href='/patterns/mark/studies';});
    }
  });
})();
