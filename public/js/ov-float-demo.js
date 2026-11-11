/* ov-float-demo.js — the live demo on /components/float: the shared engine moves the box, the buttons say what it can do. */
(function () {
    'use strict';
    const frame = document.getElementById('crf-frame');
    const box = document.getElementById('crf-box');
    const out = document.getElementById('crf-state');
    if (!frame || !box || !window.OVFloat) return;

    const KEY = 'design:float-demo';
    const DEFAULTS = { x: 0.62, y: 0.2, w: 0.3, mode: 'dock' };
    const state = (g) => `${g.mode === 'float' ? 'floating' : 'docked'}${g.tuck ? ` · tucked ${g.tuck}` : ''} · ${Math.round(g.w * 100)}%`;
    const f = window.OVFloat.attach(box, {
        frame, key: KEY, defaults: DEFAULTS, aspect: 16 / 9, minPx: 150, store: null,
        onChange(g) { if (out) out.textContent = state(g); },
    });
    if (out) out.textContent = state(f.geom());

    const acts = {
        tuck: () => f.tuck(),
        untuck: () => f.untuck(),
        mode: () => f.toggleMode(),
        size: () => f.toggleSize(),
        reset: () => { try { localStorage.removeItem(KEY); } catch { /* */ } f.reset(); },
    };
    for (const button of frame.ownerDocument.querySelectorAll('[data-crf]')) {
        button.addEventListener('click', () => {
            const act = acts[button.dataset.crf];
            if (act) act();
            if (out) out.textContent = state(f.geom());
        });
    }
})();
