/* /brand/explore: the choices (the Loop or the Pair, then the menu button), the name/font/style bar, the motion, the
   menu buttons, and the picks. The picks live in the page's link (#picks=L03,P17,M09) so a link sent to someone opens
   with them marked, in this browser for next time, and on the server (PUT /api/v1/brand/picks), which counts them into
   the tally at the top. Without this script every choice shows one after another and every mark is drawn still. */
(function () {
    'use strict';
    var KEY = 'ov_mark_picks', VIEW = 'ov_mark_view', TAB = 'ov_mark_tab';
    var CODE = /^[LPM]\d{2}$/;
    var TABS = { L: 'loop', P: 'pair', M: 'menu' };
    var API = '/api/v1/brand/picks';
    function load(key, fallback) { try { var v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; } catch (e) { return fallback; } }
    function store(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* a private window keeps it for the page only */ } }
    function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function calm() {
        try { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true; } catch (e) { /* */ }
        return document.documentElement.getAttribute('data-ov-motion') === 'reduced';
    }

    function init() {
        var root = document.querySelector('[data-mx]');
        if (!root || root.getAttribute('data-ready')) return;
        root.setAttribute('data-ready', '1');
        root.classList.add('mx-live');
        var still = function () { return calm() || root.classList.contains('mx-still'); };

        // ── A copy of a card's drawing, with its ids made its own (a hidden tab's gradients do not paint elsewhere) ──
        var copies = 0;
        function artOf(code, size) {
            var card = document.getElementById(code);
            var src = card && card.querySelector('.mx-stage svg');
            if (!src) return null;
            var tag = '-c' + (++copies);
            var box = document.createElement('span');
            box.innerHTML = src.outerHTML.replace(/ id="([^"]+)"/g, ' id="$1' + tag + '"').replace(/url\(#([^)]+)\)/g, 'url(#$1' + tag + ')').replace(/href="#([^"]+)"/g, 'href="#$1' + tag + '"');
            var svg = box.firstChild;
            ['width', 'height', 'role', 'aria-label', 'data-idle'].forEach(function (a) { svg.removeAttribute(a); });
            svg.setAttribute('aria-hidden', 'true');
            if (size) { svg.setAttribute('width', size); svg.setAttribute('height', size); }
            if (code[0] === 'M') box.className = 'mb-btn';
            else { box = svg; }
            return box;
        }

        // ── Picks ──
        var mineBox = root.querySelector('[data-mx-mine]');
        var picks = [];
        var fromHash = /(?:^#|&)picks=([A-Z0-9,]+)/.exec(location.hash || '');
        var fromHere = !!fromHash;
        if (fromHash) picks = fromHash[1].split(',').filter(function (c) { return CODE.test(c); });
        else { picks = (load(KEY, []) || []).filter(function (c) { return CODE.test(c); }); fromHere = picks.length > 0; }
        function order(list) { return list.slice().sort(); }
        function link() { return location.origin + location.pathname + (picks.length ? '#picks=' + order(picks).join(',') : ''); }
        function render() {
            all('[data-pick]').forEach(function (b) {
                var c = b.getAttribute('data-pick'), on = picks.indexOf(c) !== -1;
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
                b.setAttribute('aria-label', (on ? 'Picked ' : 'Pick ') + c);
                var card = b.closest('.mx-card');
                if (card) card.classList.toggle('is-picked', on);
            });
            if (mineBox) { mineBox.hidden = !picks.length; mineBox.querySelector('[data-mx-picks]').textContent = order(picks).join(', '); }
            all('[data-mx-count]').forEach(function (el) { var k = el.getAttribute('data-mx-count'); var n = picks.filter(function (c) { return c[0] === k; }).length; el.textContent = n ? String(n) : ''; });
            store(KEY, picks);
            if (history.replaceState && (picks.length || /picks=/.test(location.hash))) history.replaceState(null, '', picks.length ? '#picks=' + order(picks).join(',') : location.pathname);
        }
        var saveTimer = 0;
        function toggle(code) {
            var i = picks.indexOf(code);
            if (i === -1) picks.push(code); else picks.splice(i, 1);
            render();
            var card = document.getElementById(code);
            if (card && i === -1 && !still()) { card.classList.remove('just-picked'); void card.offsetWidth; card.classList.add('just-picked'); setTimeout(function () { card.classList.remove('just-picked'); }, 500); }
            clearTimeout(saveTimer); saveTimer = setTimeout(sync, 700);
        }
        function say(btn, words) { var was = btn.textContent; btn.textContent = words; setTimeout(function () { btn.textContent = was; }, 1400); }
        function copy(text, btn) {
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { say(btn, 'Copied'); }, function () { window.prompt('Copy this:', text); });
            else window.prompt('Copy this:', text);
        }
        // "The mark: the Loop (L03, L07), the Pair (P17). The menu button: M09." The two questions stay apart.
        function summary() {
            var of = function (k) { return order(picks).filter(function (c) { return c[0] === k; }); };
            var l = of('L'), p = of('P'), m = of('M'), mark = [], parts = [];
            if (l.length) mark.push('the Loop (' + l.join(', ') + ')');
            if (p.length) mark.push('the Pair (' + p.join(', ') + ')');
            if (mark.length) parts.push('The mark: ' + mark.join(', ') + '.');
            if (m.length) parts.push('The menu button: ' + m.join(', ') + '.');
            return 'My picks. ' + parts.join(' ') + ' ' + link();
        }

        // ── The tally at the top: saved picks, counted (server/brand-picks.js) ──
        var tally = root.querySelector('[data-mx-tally]');
        function chip(t) {
            var el = document.createElement('span');
            el.className = 'mx-top'; el.setAttribute('data-code', t.code);
            var art = artOf(t.code, 26);
            if (art) { if (t.code[0] === 'M') art.classList.add('mx-mini-m'); el.appendChild(art); }
            var b = document.createElement('b'); b.textContent = t.code; el.appendChild(b);
            var n = document.createElement('i'); n.textContent = String(t.n); el.appendChild(n);
            return el;
        }
        function fill(list, items) {
            if (!list) return;
            var before = {};
            all('.mx-top', list).forEach(function (el) { before[el.getAttribute('data-code')] = true; });
            while (list.firstChild) list.removeChild(list.firstChild);
            if (!items.length) { var em = document.createElement('em'); em.textContent = 'none yet'; list.appendChild(em); return; }
            items.forEach(function (t) { var c = chip(t); if (!before[t.code]) c.classList.add('is-new'); list.appendChild(c); });
        }
        function showTally(t) {
            if (!tally || !t) return;
            var loop = t.lean.loop, pair = t.lean.pair, sum = loop + pair, pct = sum ? Math.round((loop / sum) * 100) : 50;
            tally.classList.toggle('is-empty', !t.people);
            tally.querySelector('[data-mx-people]').textContent = t.people ? t.people + (t.people === 1 ? ' person has picked' : ' people have picked') : 'Nobody has picked yet. Be the first.';
            tally.querySelector('[data-mx-lead]').textContent = sum ? (loop === pair ? 'Level so far' : loop > pair ? 'The Loop leads' : 'The Pair leads') : 'No picks yet';
            tally.querySelector('.mx-lean').style.setProperty('--l', pct + '%');
            tally.querySelector('[data-mx-loop]').textContent = sum ? pct + '%' : '–';
            tally.querySelector('[data-mx-pair]').textContent = sum ? (100 - pct) + '%' : '–';
            var marks = (t.top.L || []).concat(t.top.P || []).sort(function (a, b) { return b.n - a.n || (a.code < b.code ? -1 : 1); }).slice(0, 6);
            fill(tally.querySelector('[data-mx-tops]'), marks);
            fill(tally.querySelector('[data-mx-tops-m]'), (t.top.M || []).slice(0, 4));
        }
        var savedNote = root.querySelector('[data-mx-saved]');
        function sync() {
            if (!window.fetch) return;
            fetch(API, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ picks: order(picks) }) })
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (d) {
                    if (!d) return;
                    showTally(d.tally);
                    if (savedNote && picks.length) { savedNote.classList.add('is-on'); setTimeout(function () { savedNote.classList.remove('is-on'); }, 1600); }
                })
                .catch(function () { /* the picks stay in the link and this browser */ });
        }
        if (window.fetch) {
            fetch(API, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
                if (!d) return;
                showTally(d.tally);
                var mine = (d.mine || []).filter(function (c) { return CODE.test(c); });
                if (!fromHere && mine.length) { picks = mine; render(); }
                else if (fromHere && order(picks).join() !== order(mine).join() && !fromHash) sync();
            }).catch(function () { /* */ });
        }

        // ── The choices: the big tabs, the steps bar, and "where next" at the end of each ──
        var tabs = all('[data-mx-tab]', root);
        var steps = root.querySelector('[data-mx-steps]');
        function panelOf(name) { return document.getElementById(name); }
        var current = 'loop';
        function show(name, focus) {
            current = name;
            tabs.forEach(function (t) {
                var on = t.getAttribute('data-mx-tab') === name;
                t.setAttribute('aria-selected', on ? 'true' : 'false');
                t.tabIndex = on ? 0 : -1;
                var p = panelOf(t.getAttribute('data-mx-tab'));
                if (p) p.hidden = !on;
                if (on && focus) t.focus();
            });
            all('[data-mx-go]', steps).forEach(function (a) { a.setAttribute('aria-current', a.getAttribute('data-mx-go') === name ? 'true' : 'false'); });
            store(TAB, name);
            rails();
        }
        function go(name) {
            show(name);
            if (!picks.length && history.replaceState) history.replaceState(null, '', '#' + name);
            var p = panelOf(name);
            if (p) p.scrollIntoView({ behavior: still() ? 'auto' : 'smooth', block: 'start' });
        }
        tabs.forEach(function (t, i) {
            t.addEventListener('click', function (e) { e.preventDefault(); show(t.getAttribute('data-mx-tab')); if (!picks.length && history.replaceState) history.replaceState(null, '', '#' + t.getAttribute('data-mx-tab')); });
            t.addEventListener('keydown', function (e) {
                var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                if (!k) return;
                e.preventDefault();
                show(tabs[(i + k + tabs.length) % tabs.length].getAttribute('data-mx-tab'), true);
            });
        });
        root.addEventListener('click', function (e) {
            var a = e.target.closest('[data-mx-go]');
            if (!a) return;
            e.preventDefault();
            go(a.getAttribute('data-mx-go'));
        });
        if (steps) {
            steps.hidden = false;
            var choose = root.querySelector('.mx-choose');
            if ('IntersectionObserver' in window && choose) new IntersectionObserver(function (en) { steps.classList.toggle('is-on', !en[0].isIntersecting && en[0].boundingClientRect.top < 0); }).observe(choose);
        }
        var h = (location.hash || '').slice(1);
        var start = /^(loop|pair|menu)$/.test(h) ? h : CODE.test(h) ? TABS[h[0]] : picks.length ? TABS[order(picks)[0][0]] : load(TAB, 'loop');
        show(/^(loop|pair|menu)$/.test(start) ? start : 'loop');

        // ── Each tab's example walks through all fifty, so it is plain there are fifty ──
        (function cycle() {
            var boxes = all('[data-mx-cycle]', root);
            if (!boxes.length) return;
            var state = boxes.map(function (box, k) {
                var name = box.getAttribute('data-mx-cycle');
                return { box: box, codes: all('.mx-card', panelOf(name)).map(function (c) { return c.getAttribute('data-code'); }), i: 0, kind: name, offset: k };
            });
            var visible = true, tick = 0;
            if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(root.querySelector('.mx-choose'));
            setInterval(function () {
                tick += 1;
                if (!visible || document.hidden || still()) return;
                state.forEach(function (s) {
                    if ((tick + s.offset) % 3) return;   // each moves every third beat, the three a beat apart
                    if (!s.codes.length) return;
                    s.i = (s.i + 7) % s.codes.length;                          // a stride of 7 visits all fifty, each unlike the last
                    var code = s.codes[s.i];
                    var art = artOf(code, s.kind === 'menu' ? 30 : 46);
                    if (!art) return;
                    var layer = document.createElement('span');
                    layer.className = 'mx-ta is-in';
                    if (s.kind === 'menu') { art.classList.add('mb-tabbtn'); art.classList.add('is-play'); }
                    layer.appendChild(art);
                    all('.mx-ta', s.box).forEach(function (old) { old.classList.remove('is-in'); old.classList.add('is-out'); setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 450); });
                    s.box.insertBefore(layer, s.box.querySelector('.mx-tab-code'));
                    var tag = s.box.querySelector('.mx-tab-code');
                    if (tag) tag.textContent = code;
                });
            }, 650);
        })();

        // ── Sideways rails on a phone: fade the edge while there is more, nudge once when first seen ──
        var nudged = typeof WeakSet === 'function' ? new WeakSet() : null;
        function edge(g) {
            var more = g.scrollWidth - g.clientWidth - g.scrollLeft > 6;
            g.classList.toggle('has-more', more);
            g.classList.toggle('is-scrolled', g.scrollLeft > 6);
        }
        function rails() { all('.mx-grid', root).forEach(edge); }
        all('.mx-grid', root).forEach(function (g) { g.addEventListener('scroll', function () { edge(g); }, { passive: true }); });
        window.addEventListener('resize', rails);
        if ('IntersectionObserver' in window && nudged) {
            var railIo = new IntersectionObserver(function (entries) {
                entries.forEach(function (en) {
                    var g = en.target;
                    if (!en.isIntersecting || nudged.has(g)) return;
                    edge(g);
                    if (!g.classList.contains('has-more') || g.scrollLeft > 6 || still() || root.getAttribute('data-density') === 'sheet') return;
                    nudged.add(g);
                    setTimeout(function () { g.classList.add('is-peek'); setTimeout(function () { g.classList.remove('is-peek'); }, 1200); }, 350);
                });
            }, { threshold: 0.6 });
            all('.mx-grid', root).forEach(function (g) { railIo.observe(g); });
        }
        rails();

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
            var chipEl = tools.querySelector('[data-mx-font="' + key + '"]') || tools.querySelector('[data-mx-font]');
            if (chipEl.getAttribute('data-mx-font') !== 'nunito') loadFonts();
            root.style.setProperty('--mx-lockface', chipEl.getAttribute('data-face'));
            press('data-mx-font', chipEl.getAttribute('data-mx-font'));
            view.font = chipEl.getAttribute('data-mx-font');
        }
        function setStyle(key) { key = /^(dot|space|stack)$/.test(key) ? key : 'dot'; root.setAttribute('data-lock', key); press('data-mx-lockstyle', key); view.lock = key; }
        function setDensity(on) { if (on) root.setAttribute('data-density', 'sheet'); else root.removeAttribute('data-density'); press('data-mx-density', on ? 'sheet' : ''); view.sheet = !!on; rails(); }
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
        own.addEventListener('input', function () { setSite(own.value || 'Live', !!own.value); store(VIEW, view); });
        tools.addEventListener('click', function (e) {
            var b = e.target.closest('button');
            if (!b) return;
            if (b.hasAttribute('data-mx-set-site')) setSite(b.getAttribute('data-mx-set-site'));
            else if (b.hasAttribute('data-mx-font')) setFont(b.getAttribute('data-mx-font'));
            else if (b.hasAttribute('data-mx-lockstyle')) setStyle(b.getAttribute('data-mx-lockstyle'));
            else if (b.hasAttribute('data-mx-density')) setDensity(!view.sheet);
            else if (b.hasAttribute('data-mx-still')) setStill(!view.still);
            store(VIEW, view);
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
            var share = e.target.closest('[data-mx-share]');
            if (share) {
                var text = picks.length ? summary() : link();
                var done = function () { share.classList.add('is-done'); setTimeout(function () { share.classList.remove('is-done'); }, 1400); };
                if (navigator.share && /Mobi|Android/i.test(navigator.userAgent || '')) navigator.share({ title: 'My picks for the OpenVibe mark', text: text.replace(/ https?:\S+$/, ''), url: link() }).then(done, function () { /* closed */ });
                else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.prompt('Copy this:', text); });
                else window.prompt('Copy this:', text);
                return;
            }
            if (e.target.closest('[data-mx-link]')) { copy(link(), e.target.closest('[data-mx-link]')); return; }
            if (e.target.closest('[data-mx-clear]')) { picks = []; render(); clearTimeout(saveTimer); saveTimer = setTimeout(sync, 300); return; }
            // A tap anywhere on a card picks it (but not a tap on one of its own buttons, like a menu button's demo).
            var card = e.target.closest('.mx-card');
            if (card && root.contains(card) && !e.target.closest('button, a, input')) toggle(card.getAttribute('data-code'));
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
