(function () {
    'use strict';
    const brand = document.querySelector('.br');
    const motion = document.querySelector('.mo');
    const icon = document.querySelector('.gp #move');
    const page = brand || motion || icon;
    if (!page) return;
    const anchor = brand ? brand.querySelector('.br-hero') : motion ? motion.querySelector('.mo-hero') : icon.querySelector('.mv-grid');
    if (!anchor) return;
    const loader = window.OpenVibeThemeLoader;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const calm = () => Boolean(loader && loader.display && loader.display.get().motion === 'reduced');
    const reduced = () => calm() || media.matches;
    let localPlay = false;

    const notice = document.createElement('div');
    notice.className = 'ov-demo-motion-notice';
    notice.hidden = true;
    notice.innerHTML = '<span></span><div><button type="button" class="ovk-btn ovk-btn--quiet" data-ov-demo-play>Play animations here</button><button type="button" class="ovk-btn ovk-btn--quiet" data-ov-demo-auto>Turn animations on</button></div>';
    anchor.before(notice);

    const animate = (target) => {
        if (!target || !target.animate) return;
        target.animate([{ transform: 'translateY(10px) scale(.92)', opacity: .55 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], {
            duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)',
        });
    };
    const refresh = () => {
        const off = reduced() && !localPlay;
        notice.hidden = !off;
        notice.querySelector('span').textContent = calm()
            ? 'Animations are off: your Motion setting is Calm.'
            : 'Animations are off: your device asks for less motion.';
        document.querySelectorAll('.br-motion-video').forEach((video) => { if (off) video.pause(); });
    };
    const play = () => {
        const target = page.querySelector('.ov-mark, .mv-tile svg');
        if (window.OVMark && window.OVMark.intro) page.querySelectorAll('.ov-mark, [data-br-hero], [data-mo-hero]').forEach((mark) => window.OVMark.intro(mark));
        document.querySelectorAll('[data-br-replay], [data-mo-replay]').forEach((button) => { if (!button.hidden) button.click(); });
        const run = page.querySelector('[data-mo-run]');
        if (run && !run.hidden) run.click();
        const tile = page.querySelector('[data-mv]');
        if (tile) tile.click();
        document.querySelectorAll('.br-motion-video').forEach((video) => video.play().catch(() => {}));
        animate(target);
        page.querySelectorAll('.br-chip, .mo-btn, .mo-card').forEach((control, i) => {
            if (i < 6) setTimeout(() => animate(control.querySelector('.ov-mark, svg') || control), i * 90);
        });
    };
    notice.querySelector('[data-ov-demo-play]').addEventListener('click', () => {
        localPlay = true;
        // This page only: the saved Motion setting is untouched. Removing the attribute lets the shared tokens and
        // the page's own CSS run again; the notice stays away until the next visit.
        document.documentElement.removeAttribute('data-ov-motion');
        document.documentElement.classList.add('ov-demo-play');
        refresh();
        play();
    });
    notice.querySelector('[data-ov-demo-auto]').addEventListener('click', () => {
        if (loader && loader.display) loader.display.set({ motion: 'auto' });
        refresh();
    });
    page.addEventListener('click', (event) => {
        if (!localPlay) return;
        const control = event.target.closest('.br-chip, .br-replay, .mo-replay, .mo-btn, .mo-card, .mv-tile');
        if (control) animate(control.querySelector('.ov-mark, svg') || control);
    });
    media.addEventListener('change', refresh);
    new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['data-ov-motion'] });
    refresh();
})();
