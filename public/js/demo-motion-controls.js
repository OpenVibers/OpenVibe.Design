/**
 * The pages that exist to show motion (/brand, /motion, an icon's page) under reduced motion.
 *
 * When the device asks for less motion, or the person's Motion setting is Calm, nothing on these pages moves, and a
 * page of still demos looks broken. So the page says why, in a line above the demos, and offers to play them here:
 * that sets data-fx-demo on this page's own container (openvibe-shared 4.180.0: inside it ov-fx and the mark play in
 * full), and nothing else. The saved setting is untouched, the rest of the page chrome stays calm, and Stop takes it
 * back. What plays is the real effect, the one every site uses; this file never stands in an animation of its own.
 */
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
    const playing = () => page.hasAttribute('data-fx-demo');

    const notice = document.createElement('div');
    notice.className = 'ov-demo-motion-notice';
    notice.hidden = true;
    notice.setAttribute('role', 'status');
    const words = document.createElement('p');
    const acts = document.createElement('div');
    const button = (label, kind) => { const b = document.createElement('button'); b.type = 'button'; b.className = `ovk-btn ovk-btn--${kind}`; b.textContent = label; acts.appendChild(b); return b; };
    const playBtn = button('Play them on this page', 'primary');
    const stopBtn = button('Stop', 'quiet');
    const calmBtn = button('Turn Calm off everywhere', 'quiet');
    notice.append(words, acts);
    anchor.before(notice);

    function refresh() {
        const on = playing();
        notice.hidden = !(reduced() || on);
        notice.classList.toggle('is-playing', on);
        words.textContent = on
            ? 'Playing on this page only. Your setting has not changed.'
            : calm()
                ? 'Calm is on, so nothing on this page moves. That is the setting working.'
                : 'This device asks for less motion, so nothing on this page moves. That is the setting working.';
        playBtn.hidden = on;
        stopBtn.hidden = !on;
        calmBtn.hidden = on || !calm();
        if (!on && reduced()) document.querySelectorAll('.br-motion-video').forEach((video) => video.pause());
    }

    // The demos were wired while motion was reduced, so a reveal or a count-up skipped itself. Making each stage's
    // markup again gives the kit fresh elements to wire, now inside the demo scope.
    function rewire() {
        page.querySelectorAll('.mo-fx-stage').forEach((stage) => { const html = stage.innerHTML; stage.innerHTML = html; });
        if (window.OVFx && window.OVFx.scan) window.OVFx.scan(page);
    }
    function play() {
        page.setAttribute('data-fx-demo', '');
        rewire();
        if (window.OVMark && window.OVMark.intro) page.querySelectorAll('[data-br-hero], [data-mo-hero]').forEach((mark) => window.OVMark.intro(mark));
        const run = page.querySelector('[data-mo-run]');
        if (run && !run.hidden) run.click();
        document.querySelectorAll('.br-motion-video').forEach((video) => video.play().catch(() => {}));
        refresh();
    }
    function stop() {
        page.removeAttribute('data-fx-demo');
        rewire();
        refresh();
    }
    playBtn.addEventListener('click', play);
    stopBtn.addEventListener('click', stop);
    calmBtn.addEventListener('click', () => { if (loader && loader.display) loader.display.set({ motion: 'auto' }); refresh(); });
    media.addEventListener('change', refresh);
    new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['data-ov-motion'] });
    refresh();
})();
