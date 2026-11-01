/**
 * /loading's demos (server/views/loading.js): Fill in swaps each placeholder for its real content and measures how far
 * the page below moved; the mark at work runs openvibe-shared's OpenVibeLoading; and the navbar shows its busy state.
 * Without this script the page still shows every placeholder and every snippet.
 */
(function () {
    'use strict';
    const $$ = (s, el = document) => Array.prototype.slice.call(el.querySelectorAll(s));

    // Fill in: the same place, the same size. The number is the height the stage changed by, which is how far
    // everything under it moved.
    $$('[data-ld-kind]').forEach((demo) => {
        const stage = demo.querySelector('[data-ld-stage]');
        const real = demo.querySelector('[data-ld-real]');
        const btn = demo.querySelector('[data-ld-fill]');
        const out = demo.querySelector('[data-ld-moved]');
        if (!stage || !real || !btn) return;
        const waiting = stage.innerHTML;
        btn.addEventListener('click', () => {
            const fill = btn.getAttribute('aria-pressed') !== 'true';
            const before = stage.getBoundingClientRect().height;
            stage.innerHTML = fill ? real.innerHTML : waiting;
            const moved = Math.round(Math.abs(stage.getBoundingClientRect().height - before) * 10) / 10;
            btn.setAttribute('aria-pressed', fill ? 'true' : 'false');
            btn.textContent = fill ? 'Back to waiting' : 'Fill in';
            if (out) {
                out.textContent = fill ? `Moved ${moved} px` : '';
                out.classList.toggle('is-zero', fill && moved === 0);
            }
        });
    });

    // The mark at work.
    const screen = document.querySelector('[data-ld-screen]');
    const STEPS = ['Connecting', 'Joining', 'Buffering', 'Starting'];
    let loader = null;
    let step = 0;
    const start = () => {
        if (!window.OpenVibeLoading || !screen) return;
        if (loader) loader.destroy();
        const idle = screen.querySelector('.ld-screen-idle');
        if (idle) idle.remove();
        step = 0;
        loader = window.OpenVibeLoading.mount(screen, { poster: '/icons/live.png?size=512&color=mark&ground=square&bg=18233d&pad=30', label: STEPS[0], sub: 'Getting your viewer ready', steps: STEPS.length });
    };
    $$('[data-ld-do]').forEach((b) => b.addEventListener('click', () => {
        const what = b.getAttribute('data-ld-do');
        if (what === 'start') return start();
        if (!loader) start();
        if (!loader) return;
        if (what === 'step') { step = Math.min(STEPS.length - 1, step + 1); loader.update({ step, label: STEPS[step] }); }
        if (what === 'slow') loader.slow({ hint: 'Still connecting: the stream is a long way off', actions: [{ label: 'Try again', onClick: start }] });
        if (what === 'fail') loader.fail({ title: 'The stream ended', detail: 'The broadcaster went offline a moment ago.', actions: [{ label: 'Retry', onClick: start }] });
        if (what === 'done') { loader.done(); loader = null; }
    }));

    // Between pages: this page's own navbar, for two and a half seconds.
    const busy = document.querySelector('[data-ld-busy]');
    if (busy) busy.addEventListener('click', () => {
        const nav = window.OpenVibeNavbar;
        if (!nav || typeof nav.busy !== 'function') return;
        nav.busy(true);
        busy.disabled = true;
        setTimeout(() => { nav.busy(false); busy.disabled = false; }, 2500);
    });
})();
