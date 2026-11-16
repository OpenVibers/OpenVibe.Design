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
    // The viewer's buttons draw OpenVibe's glyphs, never characters standing in for icons (2026-11-16; the owner: icons
    // as emoji or symbols look cheap): a 24-unit grid, round 2-unit strokes, as openvibe.design/icons draws them.
    var GLYPH = {
        prev: ['M15 6 9 12l6 6'],
        next: ['M9 6l6 6-6 6'],
        open: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
        close: ['M6 6l12 12', 'M18 6 6 18'],
    };
    function glyph(name) {
        var NS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '18'); svg.setAttribute('height', '18'); svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
        GLYPH[name].forEach(function (d) { var p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); svg.appendChild(p); });
        return svg;
    }
    function iconButton(tag, name, label) { var b = h(tag, 'dds-btn'); b.appendChild(glyph(name)); b.setAttribute('aria-label', label); b.title = label; return b; }
    function build() {
        dlg = h('dialog', 'dds-view');
        dlg.setAttribute('aria-label', 'Screenshot');
        var bar = h('div', 'dds-bar');
        cap = h('p', 'dds-cap');
        var prev = iconButton('button', 'prev', 'Previous screenshot'); prev.type = 'button';
        var next = iconButton('button', 'next', 'Next screenshot'); next.type = 'button';
        var open = iconButton('a', 'open', 'Open the image on its own'); open.classList.add('dds-open'); open.target = '_blank'; open.rel = 'noopener';
        var close = iconButton('button', 'close', 'Close'); close.type = 'button';
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
