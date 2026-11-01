/* /brand/explore: the tabs, the name/font/style bar, the arrival and idle motion, the menu buttons, and the picks.
   The picks live in the page's link (#picks=L03,P17,M09), so a link sent to someone opens with them marked, and in
   this browser for next time; the bar's choices are remembered here too. Without this script every tab shows, one
   after another, and every mark is drawn still. */
(function () {
    'use strict';
    var KEY = 'ov_mark_picks', VIEW = 'ov_mark_view', TAB = 'ov_mark_tab';
    var CODE = /^[LPM]\d{2}$/;
    var TABS = { L: 'loop', P: 'pair', M: 'menu' };
    function load(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; } catch (e) { return fallback; } }
    function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* a private window keeps it for the page only */ } }
    function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    function init() {
        var root = document.querySelector('[data-mx]');
        if (!root || root.getAttribute('data-ready')) return;
        root.setAttribute('data-ready', '1');
        root.classList.add('mx-live');

        // ── Picks ──
        var bar = document.querySelector('[data-mx-bar]');
        var out = bar.querySelector('[data-mx-picks]');
        var thumbs = bar.querySelector('[data-mx-thumbs]');
        var picks = [];
        var fromHash = /(?:^#|&)picks=([A-Z0-9,]+)/.exec(location.hash || '');
        if (fromHash) picks = fromHash[1].split(',').filter(function (c) { return CODE.test(c); });
        else picks = (load(KEY, []) || []).filter(function (c) { return CODE.test(c); });
        function order(list) { return list.slice().sort(); }
        function link() { return location.origin + location.pathname + (picks.length ? '#picks=' + order(picks).join(',') : ''); }
        function thumb(code) {
            var card = document.getElementById(code);
            if (!card || !card.querySelector('.mx-stage svg')) return null;
            var box = document.createElement('span');
            if (code[0] === 'M') box.className = 'mb-btn';
            // The large drawing, with its ids made its own: a hidden tab's gradients and masks do not paint elsewhere.
            var stage = card.querySelector('.mx-stage svg');
            var html = stage.outerHTML.replace(/ id="([^"]+)"/g, ' id="$1-t"').replace(/url\(#([^)]+)\)/g, 'url(#$1-t)').replace(/href="#([^"]+)"/g, 'href="#$1-t"');
            box.innerHTML = html;
            var svg = box.firstChild;
            svg.removeAttribute('width'); svg.removeAttribute('height'); svg.removeAttribute('role'); svg.setAttribute('aria-hidden', 'true');
            box.title = code;
            return box;
        }
        function render() {
            all('[data-pick]').forEach(function (b) {
                var c = b.getAttribute('data-pick'), on = picks.indexOf(c) !== -1;
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
                b.textContent = (on ? 'Picked ' : 'Pick ') + c;
                var card = b.closest('.mx-card');
                if (card) card.classList.toggle('is-picked', on);
            });
            bar.hidden = !picks.length;
            out.textContent = order(picks).join(', ');
            while (thumbs.firstChild) thumbs.removeChild(thumbs.firstChild);
            order(picks).forEach(function (c) { var t = thumb(c); if (t) thumbs.appendChild(t); });
            save(KEY, picks);
            if (history.replaceState && (picks.length || /picks=/.test(location.hash))) history.replaceState(null, '', picks.length ? '#picks=' + order(picks).join(',') : location.pathname);
        }
        // "The mark: the Loop (L03, L07), the Pair (P17). The menu button: M09." The two questions stay apart.
        function summary() {
            var of = function (k) { return order(picks).filter(function (c) { return c[0] === k; }); };
            var l = of('L'), p = of('P'), m = of('M'), mark = [];
            if (l.length) mark.push('the Loop (' + l.join(', ') + ')');
            if (p.length) mark.push('the Pair (' + p.join(', ') + ')');
            var parts = [];
            if (mark.length) parts.push('The mark: ' + mark.join(', ') + '.');
            if (m.length) parts.push('The menu button: ' + m.join(', ') + '.');
            return 'My picks. ' + parts.join(' ') + ' ' + link();
        }
        function toggle(code) { var i = picks.indexOf(code); if (i === -1) picks.push(code); else picks.splice(i, 1); render(); }
        function say(btn, words) { var was = btn.textContent; btn.textContent = words; setTimeout(function () { btn.textContent = was; }, 1400); }
        function copy(text, btn) {
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { say(btn, 'Copied'); }, function () { window.prompt('Copy this:', text); });
            else window.prompt('Copy this:', text);
        }

        // ── Tabs ──
        var tabs = all('[data-mx-tab]', root);
        function panelOf(t) { return document.getElementById(t.getAttribute('aria-controls')); }
        function show(name, focus) {
            tabs.forEach(function (t) {
                var on = t.getAttribute('data-mx-tab') === name;
                t.setAttribute('aria-selected', on ? 'true' : 'false');
                t.tabIndex = on ? 0 : -1;
                var p = panelOf(t);
                if (p) p.hidden = !on;
                if (on && focus) t.focus();
            });
            save(TAB, name);
        }
        tabs.forEach(function (t, i) {
            t.addEventListener('click', function (e) {
                e.preventDefault();
                show(t.getAttribute('data-mx-tab'));
                if (!picks.length && history.replaceState) history.replaceState(null, '', '#' + t.getAttribute('data-mx-tab'));
            });
            t.addEventListener('keydown', function (e) {
                var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                if (!k) return;
                e.preventDefault();
                show(tabs[(i + k + tabs.length) % tabs.length].getAttribute('data-mx-tab'), true);
            });
        });
        var h = (location.hash || '').slice(1);
        var start = /^(loop|pair|menu)$/.test(h) ? h : CODE.test(h) ? TABS[h[0]] : picks.length ? TABS[order(picks)[0][0]] : load(TAB, 'loop');
        show(/^(loop|pair|menu)$/.test(start) ? start : 'loop');

        // ── The bar: the name, its font and style, the view ──
        var tools = root.querySelector('[data-mx-tools]');
        var view = load(VIEW, {}) || {};
        var fontsLoaded = false;
        function loadFonts() {
            if (fontsLoaded) return;
            fontsLoaded = true;
            var l = document.createElement('link');
            l.rel = 'stylesheet';
            l.href = root.getAttribute('data-mx-fontcss');
            document.head.appendChild(l);
        }
        function press(attr, value) { all('[' + attr + ']', tools).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute(attr) === String(value) ? 'true' : 'false'); }); }
        var own = tools.querySelector('[data-mx-own]');
        function setSite(name, typed) {
            var text = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 14) || 'Live';
            all('[data-mx-site]').forEach(function (s) { s.textContent = text; });
            press('data-mx-set-site', typed ? '' : text);
            if (!typed) own.value = '';
            view.site = text; view.typed = !!typed;
        }
        function setFont(key) {
            var chip = tools.querySelector('[data-mx-font="' + key + '"]') || tools.querySelector('[data-mx-font]');
            if (chip.getAttribute('data-mx-font') !== 'nunito') loadFonts();
            root.style.setProperty('--mx-lockface', chip.getAttribute('data-face'));
            press('data-mx-font', chip.getAttribute('data-mx-font'));
            view.font = chip.getAttribute('data-mx-font');
        }
        function setStyle(key) { key = /^(dot|space|stack)$/.test(key) ? key : 'dot'; root.setAttribute('data-lock', key); press('data-mx-lockstyle', key); view.lock = key; }
        function setDensity(on) { if (on) root.setAttribute('data-density', 'sheet'); else root.removeAttribute('data-density'); press('data-mx-density', on ? 'sheet' : ''); view.sheet = !!on; }
        function setStill(on) { root.classList.toggle('mx-still', !!on); press('data-mx-still', on ? '1' : ''); view.still = !!on; }
        setSite(view.site, view.typed);
        if (view.typed) own.value = view.site || '';
        setFont(view.font || 'nunito');
        setStyle(view.lock);
        setDensity(view.sheet);
        setStill(view.still);
        tools.hidden = false;
        tools.querySelector('[data-mx-fonts]').addEventListener('pointerenter', loadFonts);
        tools.querySelector('[data-mx-fonts]').addEventListener('focusin', loadFonts);
        own.addEventListener('input', function () { setSite(own.value || 'Live', !!own.value); save(VIEW, view); });
        tools.addEventListener('click', function (e) {
            var b = e.target.closest('button');
            if (!b) return;
            if (b.hasAttribute('data-mx-set-site')) setSite(b.getAttribute('data-mx-set-site'));
            else if (b.hasAttribute('data-mx-font')) setFont(b.getAttribute('data-mx-font'));
            else if (b.hasAttribute('data-mx-lockstyle')) setStyle(b.getAttribute('data-mx-lockstyle'));
            else if (b.hasAttribute('data-mx-density')) setDensity(!view.sheet);
            else if (b.hasAttribute('data-mx-still')) setStill(!view.still);
            save(VIEW, view);
        });

        // ── The menu buttons: press to open, and each makes its move when it arrives ──
        function play(btn) {
            btn.classList.remove('is-play');
            void btn.offsetWidth;
            btn.classList.add('is-play');
            clearTimeout(btn._mxPlay);
            btn._mxPlay = setTimeout(function () { btn.classList.remove('is-play'); }, 1100);
        }
        document.addEventListener('click', function (e) {
            var mb = e.target.closest('[data-mb]');
            if (mb) {
                var open = !mb.classList.contains('is-open');
                mb.classList.toggle('is-open', open);
                mb.setAttribute('aria-pressed', open ? 'true' : 'false');
                if (!open) play(mb);
                return;
            }
            var p = e.target.closest('[data-pick]');
            if (p) { toggle(p.getAttribute('data-pick')); return; }
            if (e.target.closest('[data-mx-copy]')) { copy(summary(), e.target.closest('[data-mx-copy]')); return; }
            if (e.target.closest('[data-mx-link]')) { copy(link(), e.target.closest('[data-mx-link]')); return; }
            if (e.target.closest('[data-mx-clear]')) { picks = []; render(); return; }
            // In the sheet, a tap anywhere on a card picks it.
            var card = root.getAttribute('data-density') === 'sheet' && e.target.closest('.mx-card');
            if (card) toggle(card.getAttribute('data-code'));
        });

        // ── Arrival and idle: a card is "in" once it has been seen, and "on" (idling) while it is on screen ──
        var cards = all('.mx-card', root);
        if (!('IntersectionObserver' in window)) cards.forEach(function (c) { c.classList.add('is-in'); });
        else {
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (en) {
                    var c = en.target;
                    if (en.isIntersecting) {
                        if (!c.classList.contains('is-in')) {
                            c.classList.add('is-in');
                            if (c.classList.contains('mb-card')) { var big = c.querySelector('.mb-big'); setTimeout(function () { play(big); }, 350); }
                        }
                        c.classList.add('is-on');
                    } else c.classList.remove('is-on');
                });
            }, { threshold: 0.12 });
            cards.forEach(function (c) { io.observe(c); });
        }

        render();
        var focusCode = CODE.test(h) ? h : fromHash && picks.length ? order(picks)[0] : null;
        if (focusCode) { var first = document.getElementById(focusCode); if (first) { first.classList.add('is-in'); first.scrollIntoView({ block: 'center' }); } }
    }
    document.addEventListener('ov:boost:load', init);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
