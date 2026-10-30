/* Extracted interaction patterns from the shipped runs viewer, reduced to DOM-only Kit helpers. */
(() => {
  'use strict';
  function syncChildren(box, nodes, animate = false, old = null) {
    const want = new Set(nodes), had = new Set(box.children); let fresh = 0;
    for (const child of [...box.children]) if (!want.has(child)) child.remove();
    let ref = box.firstElementChild;
    for (const node of nodes) {
      if (node === ref) { ref = ref.nextElementSibling; continue; }
      if (animate && !had.has(node) && !(old && old.has(node.dataset.seg)) && fresh++ < 6) {
        node.classList.add('enter');
        node.addEventListener('animationend', () => node.classList.remove('enter'), { once: true });
      }
      box.insertBefore(node, ref);
    }
  }
  function patchGroup(group, steps, renderStep) {
    const live = steps.some((step) => step.pending);
    group.classList.toggle('live', live);
    const summary = group.querySelector(':scope > summary');
    const list = group.querySelector(':scope > .steplist');
    if (!summary || !list) return;
    summary.textContent = `${live ? '◉' : '✓'} ${steps.length} step${steps.length === 1 ? '' : 's'} · ${steps.at(-1)?.summary || 'Updated'}`;
    const prev = new Map([...list.children].map((child) => [child.dataset.id, child]));
    syncChildren(list, steps.map((step, index) => {
      const id = String(step.id || index), existing = prev.get(id);
      if (existing && existing.textContent === (step.summary || step.name)) return existing;
      const item = renderStep(step); item.dataset.id = id; return item;
    }));
  }
  function animateDetails(details) {
    const summary = details.querySelector(':scope > summary');
    if (!summary || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    const from = details.getBoundingClientRect().height, opening = !details.open || !!details._closing;
    details._anim?.cancel(); details._anim = null; details._closing = false;
    let to;
    if (opening) { details.open = true; to = details.getBoundingClientRect().height; }
    else { const css = getComputedStyle(details); to = summary.getBoundingClientRect().height + parseFloat(css.borderTopWidth) + parseFloat(css.borderBottomWidth) + parseFloat(css.paddingTop) + parseFloat(css.paddingBottom); details._closing = true; }
    if (Math.abs(to - from) < 2) { if (details._closing) { details.open = false; details._closing = false; } return true; }
    details.style.overflow = 'clip';
    const animation = details.animate({ height: [`${from}px`, `${to}px`] }, { duration: Math.round(Math.min(360, 170 + Math.abs(to - from) * .15)), easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
    details._anim = animation;
    animation.onfinish = () => { if (details._anim !== animation) return; details._anim = null; if (details._closing) { details.open = false; details._closing = false; } details.style.overflow = ''; animation.cancel(); };
    return true;
  }
  function scrollBottom(box, state, smooth) {
    const gap = box.scrollHeight - box.clientHeight - box.scrollTop;
    state.stick = true; if (gap <= 1) return;
    state.autoScroll = Date.now();
    if (smooth && gap < box.clientHeight * 1.5 && !matchMedia('(prefers-reduced-motion: reduce)').matches) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
    else box.scrollTop = box.scrollHeight;
  }
  function updateProgress(root, data) {
    root.replaceChildren();
    const button = document.createElement('button'); button.className = 'progress-line'; button.type = 'button';
    button.append(Object.assign(document.createElement('strong'), { textContent: data.title }), Object.assign(document.createElement('span'), { className: 'pmeta', textContent: `${data.done}/${data.total} · ${data.steps} steps · ${data.elapsed}` }));
    const detail = Object.assign(document.createElement('div'), { className: 'progress-fold', textContent: data.detail });
    button.addEventListener('click', () => { button.classList.toggle('open'); button.setAttribute('aria-expanded', String(button.classList.contains('open'))); });
    root.append(button, detail);
  }
  function updateOutcome(root, data) {
    root.replaceChildren();
    const row = Object.assign(document.createElement('div'), { className: 'outcome-line' });
    const badge = Object.assign(document.createElement('span'), { className: `status-badge ${data.status}`, textContent: `${data.icon} ${data.title}` });
    const copy = document.createElement('div'); copy.className = 'outcome-copy'; copy.append(Object.assign(document.createElement('small'), { textContent: data.reason }));
    row.append(badge, copy);
    for (const action of data.actions) { const button = document.createElement('button'); button.type = 'button'; button.className = `opill pill-action${action.primary ? ' primary' : ''}`; button.textContent = action.label; button.addEventListener('click', action.onClick); row.append(button); }
    root.append(row);
  }
  window.OpenVibePatternKit = Object.freeze({ syncChildren, patchGroup, animateDetails, scrollBottom, updateProgress, updateOutcome });
})();
