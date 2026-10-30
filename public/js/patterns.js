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
    } else if (id === 'mark-system') {
      const row=node('div','mark-demo'),mark=node('span','ov-mark','ov');row.append(mark,node('span','','OpenVibe'));widget.append(row);control('Loading state',()=>{mark.classList.toggle('loading');say(mark.classList.contains('loading')?'Loading state active.':'Loading state stopped.');});control('Change site',()=>{mark.textContent=mark.textContent==='ov'?'lv':'ov';mark.style.borderRadius=mark.textContent==='lv'?'50%':'16px';say('The mark morphs for the active site.');});control('Open five studies',()=>{window.location.href='/patterns/mark/studies';});
    }
  });
})();
