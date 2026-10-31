/**
 * /brand's demos (server/views/brand.js): the state buttons set data-state on the stage's mark (ov-mark.js does the
 * rest), "A page on its way" plays the navbar's page-load ring on it at this site's usual pace, the hero can replay
 * its intro (OVMark.intro), and the colours copy. Without JavaScript the buttons stay hidden and the page still says
 * what every move means.
 */
(function () {
    'use strict';
    const $ = (s, el = document) => el.querySelector(s);
    const $$ = (s, el = document) => [...el.querySelectorAll(s)];
    const demo = $('[data-br-demo]');
    const say = $('[data-br-say]');
    const SAY = {};
    let loadTimer = 0;

    function press(btn) { $$('.br-states .br-chip').forEach((b) => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false')); }
    function stopLoad() {
        clearTimeout(loadTimer); loadTimer = 0;
        if (!demo) return;
        demo.removeAttribute('data-nav'); demo.removeAttribute('data-ovm-arrive'); demo.style.removeProperty('--ovm-fill');
    }

    function setState(btn) {
        stopLoad();
        const st = btn.getAttribute('data-br-state');
        if (st) demo.setAttribute('data-state', st); else demo.removeAttribute('data-state');
        press(btn);
        if (say) say.textContent = SAY[st] || '';
    }

    // The navbar's page-load ring, on the stage: it empties, draws round at the usual pace (never closing early),
    // then closes and the V hops.
    function playLoad(btn) {
        stopLoad();
        demo.removeAttribute('data-state');
        press(btn);
        if (say) say.textContent = 'The ring empties, then draws itself round as the next page loads, at the pace this site usually takes in your browser. When the page is here it closes and the V hops.';
        const avg = Math.max(900, (window.OVMark && window.OVMark.usual && window.OVMark.usual('page')) || 1600) * 1.4;
        const t0 = Date.now(), done = t0 + avg;
        const tick = () => {
            const t = Date.now() - t0;
            if (Date.now() >= done) {
                demo.style.setProperty('--ovm-fill', '1'); demo.setAttribute('data-ovm-arrive', '');
                loadTimer = setTimeout(() => { stopLoad(); loadTimer = setTimeout(() => playLoad(btn), 900); }, 620);
                return;
            }
            demo.setAttribute('data-nav', '');
            demo.style.setProperty('--ovm-fill', Math.min(0.94, 0.08 + 0.86 * (1 - Math.exp(-1.6 * t / (avg / 1.4)))).toFixed(3));
            loadTimer = setTimeout(tick, 120);
        };
        tick();
    }

    if (demo) {
        $$('.br-states .br-chip').forEach((b) => {
            b.hidden = false;
            const st = b.getAttribute('data-br-state');
            if (st !== null) {
                SAY[st] = b.getAttribute('data-say') || '';
                b.addEventListener('click', () => setState(b));
            } else if (b.hasAttribute('data-br-load')) {
                b.addEventListener('click', () => playLoad(b));
            }
        });
    }

    const hero = $('[data-br-hero]'), replay = $('[data-br-replay]');
    if (hero && replay) {
        const ready = () => window.OVMark && typeof window.OVMark.intro === 'function';
        const show = () => { if (ready()) replay.hidden = false; else setTimeout(show, 300); };
        show();
        replay.addEventListener('click', () => { if (ready()) window.OVMark.intro(hero); });
    }

    $$('[data-br-copy]').forEach((b) => {
        b.hidden = false;
        b.addEventListener('click', () => {
            const v = b.getAttribute('data-br-copy');
            const ok = () => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy'; }, 1400); };
            try { navigator.clipboard.writeText(v).then(ok, () => {}); } catch { /* no clipboard */ }
        });
    });
})();
