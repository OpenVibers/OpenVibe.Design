/* The deep dive's screenshots, opened (11-15, the owner: "it should show screenshots it takes"). Any link with
 * data-dd-shot (a thumbnail in the live strip or the report's gallery) opens the full-page screenshot in a viewer
 * over the page: scroll it, step to the previous or next one with the arrows (or a swipe), Escape or the backdrop
 * closes it. Without JavaScript the link opens the image itself. Text is set with textContent; motion follows
 * html[data-ov-motion] (Calm reduces, only Off stops). */
(function () {
    'use strict';
    if (window.__ddShots) return;
    window.__ddShots = true;
    var dlg = null, img = null, cap = null, list = [], at = 0;

    function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function build() {
        dlg = h('dialog', 'dds-view');
        dlg.setAttribute('aria-label', 'Screenshot');
        var bar = h('div', 'dds-bar');
        cap = h('p', 'dds-cap');
        var prev = h('button', 'dds-btn', '‹'); prev.type = 'button'; prev.setAttribute('aria-label', 'Previous screenshot');
        var next = h('button', 'dds-btn', '›'); next.type = 'button'; next.setAttribute('aria-label', 'Next screenshot');
        var open = h('a', 'dds-btn dds-open', '↗'); open.target = '_blank'; open.rel = 'noopener'; open.setAttribute('aria-label', 'Open the image on its own');
        var close = h('button', 'dds-btn', '✕'); close.type = 'button'; close.setAttribute('aria-label', 'Close');
        bar.append(cap, prev, next, open, close);
        var scroller = h('div', 'dds-scroll');
        img = h('img', 'dds-img'); img.alt = '';
        scroller.append(img);
        dlg.append(bar, scroller);
        document.body.append(dlg);
        prev.addEventListener('click', function () { show(at - 1); });
        next.addEventListener('click', function () { show(at + 1); });
        close.addEventListener('click', function () { dlg.close(); });
        dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
        dlg.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowLeft') { e.preventDefault(); show(at - 1); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); show(at + 1); }
        });
        var x0 = null;
        scroller.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
        scroller.addEventListener('touchend', function (e) {
            if (x0 == null) return;
            var dx = e.changedTouches[0].clientX - x0; x0 = null;
            if (Math.abs(dx) > 60) show(at + (dx < 0 ? 1 : -1));
        }, { passive: true });
        dlg.__open = open;
    }
    function show(i) {
        if (!list.length) return;
        at = (i + list.length) % list.length;
        var a = list[at];
        img.classList.remove('is-in'); void img.offsetWidth; img.classList.add('is-in');
        img.src = a.getAttribute('href');
        img.alt = a.getAttribute('data-dd-shot') || 'A screenshot';
        cap.textContent = (a.getAttribute('data-dd-shot') || '') + ' · ' + (at + 1) + ' of ' + list.length;
        dlg.__open.href = a.getAttribute('href');
        img.parentNode.scrollTop = 0;
    }
    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[data-dd-shot]');
        if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
        if (typeof HTMLDialogElement !== 'function') return;
        e.preventDefault();
        if (!dlg) build();
        var group = a.closest('[data-dd-shots]') || document;
        list = Array.prototype.slice.call(group.querySelectorAll('a[data-dd-shot]'));
        if (!dlg.open) dlg.showModal();
        show(Math.max(0, list.indexOf(a)));
    });
})();
