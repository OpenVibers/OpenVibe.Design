/* /brand/explore: the choices (the Loop or the Pair, then the menu button), the name/font/style bar, the motion, the
   menu buttons, and the picks. The picks live in the page's link (#picks=L03,P17,M09) so a link sent to someone opens
   with them marked, in this browser for next time, and on the server (PUT /api/v1/brand/picks), which counts them into
   the tally at the top. Without this script every choice shows one after another and every mark is drawn still. */
(function () {
    'use strict';
    var KEY = 'ov_mark_picks', VIEW = 'ov_mark_view', TAB = 'ov_mark_tab';
    var CODE = /^[LPMFW]\d{2}$/;
    var TABS = { L: 'loop', P: 'pair', W: 'wild', M: 'menu', F: 'font' };
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
            ['width', 'height', 'role', 'aria-label', 'data-idle'].forEach(function (a) { svg.removeAttribute(a); });   // data-wild stays: a copy moves like its card
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
            syncMenuMark();
            all('[data-mx-count]').forEach(function (el) { var k = el.getAttribute('data-mx-count'); var n = picks.filter(function (c) { return c[0] === k; }).length; el.textContent = n ? String(n) : ''; var st = el.closest('.mx-step'); if (st) st.classList.toggle('is-done', n > 0); });
            store(KEY, picks);
            if (history.replaceState && (picks.length || /picks=/.test(location.hash))) history.replaceState(null, '', picks.length ? '#picks=' + order(picks).join(',') : location.pathname);
        }
        // The menu buttons sit beside the mark this person picked last in step 1 (or today's mark until they pick one),
        // so they judge each button where it will live (the owner, 11-01). A copy with its own ids, in the page's visible
        // defs, so it paints whichever tab is open.
        var shownMark = null;
        function syncMenuMark() {
            var marks = picks.filter(function (c) { return c[0] === 'L' || c[0] === 'P' || c[0] === 'W'; });
            var code = marks.length ? marks[marks.length - 1] : null;
            all('.mx-tab-side, .mx-step-2, .mx-step-3', root).forEach(function (el) { el.classList.toggle('is-later', !code); });
            syncPickFont();
            if (code === shownMark) { navPreview(); return; }
            shownMark = code;
            var defs = root.querySelector('.mx-defs');
            var old = defs && defs.querySelector('[data-chosen]');
            if (old) old.parentNode.removeChild(old);
            var ref = 'art-pair-today';
            var src = code && document.getElementById(code) && document.getElementById(code).querySelector('.mx-stage svg');
            if (src && defs) {
                var tag = '-ch' + (++copies);
                var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('data-chosen', code);
                g.innerHTML = src.innerHTML.replace(/ id="([^"]+)"/g, ' id="$1' + tag + '"').replace(/url\(#([^)]+)\)/g, 'url(#$1' + tag + ')').replace(/href="#([^"]+)"/g, 'href="#$1' + tag + '"');
                defs.appendChild(g);
                ref = 'art-' + code + tag;
            }
            all('.mb-nav use, .fx-mark use', root).forEach(function (u) { u.setAttribute('href', '#' + ref); });
            navRef = code ? ref : null;
            all('[data-mb-with]', root).forEach(function (el) { el.textContent = code ? 'Next to your logo, ' + code + '.' : 'Next to today\u2019s logo. Pick a logo first to see yours here.'; });
            navPreview();
        }
        // The site's own bar at the top wears the picks as you make them (the owner, 11-01: "when you tap an icon… it
        // changes the one in your current page in real time, so you can see what it looks like"): the logo picked last
        // in place of the bar's mark, the menu button picked last in place of its menu button, the font picked last on
        // the name. Only on this page while it is open; nothing about the bar is saved, and clearing a pick puts the
        // bar's own back. The navbar mounts after this script and can redraw itself, so it is re-applied when it does.
        var navRef = null, navSeen = '';
        function lastPick(k) { var l = picks.filter(function (c) { return c[0] === k; }); return l.length ? l[l.length - 1] : null; }
        function swapIn(box, cls, make) {
            var mine = box.querySelector(':scope > .' + cls);
            var own = Array.prototype.filter.call(box.children, function (c) { return !c.classList.contains(cls); });
            if (make) {
                if (!mine) { mine = make(); box.appendChild(mine); }
                own.forEach(function (c) { if (!c.hasAttribute('data-mx-hid')) { c.setAttribute('data-mx-hid', c.style.display || ''); c.style.display = 'none'; } });
                return mine;
            }
            if (mine) mine.parentNode.removeChild(mine);
            own.forEach(function (c) { if (c.hasAttribute('data-mx-hid')) { c.style.display = c.getAttribute('data-mx-hid'); c.removeAttribute('data-mx-hid'); } });
            return null;
        }
        function navPreview() {
            var bar = document.querySelector('.openvibe-navbar');
            var brand = bar && bar.querySelector('.openvibe-navbar-brand');
            if (!brand) return;
            var menu = lastPick('M'), font = lastPick('F');
            var flame = brand.querySelector('.flame');
            if (flame) {
                var mark = swapIn(flame, 'mx-navmark', navRef ? function () {
                    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    s.setAttribute('class', 'mx-navmark'); s.setAttribute('viewBox', '0 0 100 100'); s.setAttribute('aria-hidden', 'true');
                    s.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'use'));
                    return s;
                } : null);
                if (mark) mark.firstChild.setAttribute('href', '#' + navRef);
            }
            var orb = bar.querySelector('.ovnav-orb');
            var src = menu && document.getElementById(menu) && document.getElementById(menu).querySelector('.mb-nav .mb-btn svg');
            if (orb) {
                var box = swapIn(orb, 'mx-navmenu', src ? function () { var b = document.createElement('span'); b.className = 'mx-navmenu mb-btn'; return b; } : null);
                if (box && box.getAttribute('data-code') !== menu) { box.innerHTML = src.outerHTML; box.setAttribute('data-code', menu); }
            }
            var name = brand.querySelector('.name');
            var word = font && document.getElementById(font) && document.getElementById(font).querySelector('.fx-word');
            if (name) name.style.fontFamily = word && word.style.fontFamily ? word.style.fontFamily : '';
            // A short glow on what changed, so the eye goes to the bar.
            var now = [navRef, menu, font].join('|');
            if (navSeen && now !== navSeen) { brand.classList.remove('mx-nav-flash'); if (orb) orb.classList.remove('mx-nav-flash'); void brand.offsetWidth; brand.classList.add('mx-nav-flash'); if (orb && menu) orb.classList.add('mx-nav-flash'); }
            navSeen = now;
        }
        (function watchNav() {
            var tries = 0, obs = null;
            function hook() {
                var bar = document.querySelector('.openvibe-navbar');
                if (!bar) { if (++tries < 40) setTimeout(hook, 250); return; }
                navPreview();
                if (obs || !window.MutationObserver) return;
                // The navbar redraws its brand on sign-in and account changes: put the picks back when it does.
                obs = new MutationObserver(function () {
                    if ((navRef && !bar.querySelector('.mx-navmark')) || (lastPick('M') && !bar.querySelector('.mx-navmenu'))) navPreview();
                });
                obs.observe(bar, { childList: true, subtree: true });
            }
            hook();
        })();
        // The last font picked dresses the name in the menu bars too, so the bar shows all three picks together.
        function syncPickFont() {
            var fonts = picks.filter(function (c) { return c[0] === 'F'; });
            var card = fonts.length && document.getElementById(fonts[fonts.length - 1]);
            var w = card && card.querySelector('.fx-word');
            if (w && w.style.fontFamily) { root.style.setProperty('--mx-pick-font', w.style.fontFamily); root.style.setProperty('--mx-pick-weight', w.style.fontWeight || '800'); }
            else { root.style.removeProperty('--mx-pick-font'); root.style.removeProperty('--mx-pick-weight'); }
        }
        var saveTimer = 0;
        function toggle(code) {
            var prev = picks.slice();
            var i = picks.indexOf(code);
            if (i === -1) picks.push(code); else picks.splice(i, 1);
            render();
            var card = document.getElementById(code);
            if (card && i === -1 && !still()) { card.classList.remove('just-picked'); void card.offsetWidth; card.classList.add('just-picked'); setTimeout(function () { card.classList.remove('just-picked'); }, 500); }
            if (i === -1 && typeof offerStep2 === 'function') offerStep2(code);
            countLocally(prev);
            clearTimeout(saveTimer); saveTimer = setTimeout(sync, 250);
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
            var fo = of('F'); if (fo.length) parts.push('The font: ' + fo.join(', ') + '.');
            return 'My picks. ' + parts.join(' ') + ' ' + link();
        }

        // ── The tally at the top: saved picks, counted (server/brand-picks.js) ──
        var tally = root.querySelector('[data-mx-tally]');
        function fontChip(code) {
            var card = document.getElementById(code), word = card && card.querySelector('.fx-word');
            var el = document.createElement('span'); el.className = 'fx-mini'; el.textContent = 'Aa';
            if (word) { el.style.fontFamily = word.style.fontFamily; el.style.fontWeight = word.style.fontWeight; }
            return el;
        }
        function chip(t) {
            var el = document.createElement('span');
            el.className = 'mx-top'; el.setAttribute('data-code', t.code);
            var art = t.code[0] === 'F' ? fontChip(t.code) : artOf(t.code, 26);
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
        var lastTally = null;
        function showTally(t) {
            if (!tally || !t) return;
            lastTally = t;
            var showWild = !!tally.querySelector('[data-mx-wild]');   // the Wildcards count only where they are shown (?wild=1)
            var loop = t.lean.loop, pair = t.lean.pair, wild = showWild ? t.lean.wild || 0 : 0, both = t.lean.both || 0, sum = loop + pair + wild;
            var pct = sum ? Math.round((loop / sum) * 100) : (showWild ? 34 : 50), ppct = showWild ? (sum ? Math.round((pair / sum) * 100) : 33) : 100 - pct;
            var ppl = function (n) { return n + (n === 1 ? ' person' : ' people'); };
            tally.classList.toggle('is-empty', !t.people);
            tally.querySelector('[data-mx-people]').textContent = t.people ? ppl(t.people) : 'No votes yet. Tap any logo to vote.';
            var top3 = Math.max(loop, pair, wild);
            var leaders = [['the Loop', loop], ['the Pair', pair]].concat(showWild ? [['the Wildcards', wild]] : []).filter(function (x) { return x[1] === top3; });
            tally.querySelector('[data-mx-lead]').textContent = sum ? (leaders.length > 1 ? 'Even so far' : 'More people like ' + leaders[0][0]) : '';
            var split = tally.querySelector('[data-mx-split]');
            split.hidden = !sum;
            split.style.setProperty('--l', pct + '%');
            split.style.setProperty('--p', ppct + '%');
            tally.querySelector('[data-mx-loop]').textContent = String(loop);
            tally.querySelector('[data-mx-pair]').textContent = String(pair);
            var wildEl = tally.querySelector('[data-mx-wild]'); if (wildEl) wildEl.textContent = String(wild);
            var bothEl = tally.querySelector('[data-mx-both]');
            if (bothEl) { bothEl.hidden = !both; bothEl.textContent = ppl(both) + ' like more than one kind'; }
            [['[data-mx-tops-l]', (t.top.L || []).slice(0, 8)], ['[data-mx-tops-p]', (t.top.P || []).slice(0, 8)], ['[data-mx-tops-w]', (t.top.W || []).slice(0, 8)], ['[data-mx-tops-m]', (t.top.M || []).slice(0, 6)], ['[data-mx-tops-f]', (t.top.F || []).slice(0, 6)]].forEach(function (row) {
                var list = tally.querySelector(row[0]);
                if (!list) return;
                list.closest('.mx-tops').hidden = !row[1].length;
                fill(list, row[1]);
            });
            var every = t.all || [];
            var box = tally.querySelector('[data-mx-all]');
            if (box) {
                box.hidden = !every.length;
                box.querySelector('[data-mx-all-n]').textContent = every.length + (every.length === 1 ? ' take' : ' takes');
                ['L', 'P', 'W', 'M', 'F'].forEach(function (k) {
                    var list = box.querySelector('[data-mx-all-' + k.toLowerCase() + ']');
                    if (!list) return;
                    var mine = every.filter(function (x) { return x.code[0] === k; });
                    list.closest('.mx-all-row').hidden = !mine.length;
                    if (box.open || !list.childElementCount || list.childElementCount !== mine.length) fill(list, mine);
                });
            }
        }
        // The tap shows at once: this person's vote is counted into the last tally on the page before the server answers
        // (then the server's own count replaces it). Liking both families counts for both.
        function countLocally(prev) {
            if (!lastTally) return;
            var t = JSON.parse(JSON.stringify(lastTally));
            var had = prev.length > 0, has = picks.length > 0;
            t.people = Math.max(0, t.people + (has && !had ? 1 : !has && had ? -1 : 0));
            var bump = function (list, c, d) { var e = list.find(function (x) { return x.code === c; }); if (e) { e.n += d; if (d > 0) e.fresh = true; } else if (d > 0) list.unshift({ code: c, n: d, fresh: true }); };
            t.all = t.all || [];
            ['L', 'P', 'W', 'M', 'F'].forEach(function (k) {
                var list = t.top[k] || (t.top[k] = []);
                prev.filter(function (c) { return c[0] === k && picks.indexOf(c) === -1; }).forEach(function (c) { bump(list, c, -1); bump(t.all, c, -1); });
                picks.filter(function (c) { return c[0] === k && prev.indexOf(c) === -1; }).forEach(function (c) { bump(list, c, 1); bump(t.all, c, 1); });
                t.top[k] = list.filter(function (x) { return x.n > 0; }).sort(function (a, b) { return b.n - a.n || (a.fresh ? -1 : b.fresh ? 1 : 0); });
            });
            t.all = t.all.filter(function (x) { return x.n > 0; }).sort(function (a, b) { return b.n - a.n || (a.code < b.code ? -1 : 1); });
            var likes = function (arr, k) { return arr.some(function (c) { return c[0] === k; }) ? 1 : 0; };
            var l0 = likes(prev, 'L'), p0 = likes(prev, 'P'), w0 = likes(prev, 'W'), l1 = likes(picks, 'L'), p1 = likes(picks, 'P'), w1 = likes(picks, 'W');
            t.lean = {
                loop: Math.max(0, t.lean.loop - l0 + l1),
                pair: Math.max(0, t.lean.pair - p0 + p1),
                wild: Math.max(0, (t.lean.wild || 0) - w0 + w1),
                both: Math.max(0, (t.lean.both || 0) - (l0 + p0 + w0 > 1 ? 1 : 0) + (l1 + p1 + w1 > 1 ? 1 : 0)),
            };
            showTally(t);
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
        var fontsIn = false;
        function loadFonts() { if (fontsIn) return; fontsIn = true; var css = root.getAttribute('data-mx-fontcss'); if (!css) return; var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = css; document.head.appendChild(l); }
        (window.requestIdleCallback || function (f) { return setTimeout(f, 2500); })(loadFonts);
        function go(name) {
            if (name === 'font') loadFonts();
            var nd = root.querySelector('[data-mx-nudge]'); if (nd) nd.hidden = true;
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
        var start = /^(loop|pair|wild|menu|font)$/.test(h) ? h : CODE.test(h) ? TABS[h[0]] : picks.length ? TABS[order(picks)[0][0]] : load(TAB, 'loop');
        show(/^(loop|pair|wild|menu|font)$/.test(start) ? start : 'loop');

        // ── Each tab's example walks through all fifty, so it is plain there are fifty ──
        (function cycle() {
            var boxes = all('[data-mx-cycle]', root).filter(function (b) { return b.getAttribute('data-mx-cycle') !== 'font'; });
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

        // ── The view: cards, or Sheet (all at once), from the steps bar ──
        var view = load(VIEW, {}) || {};
        function setDensity(on) {
            if (on) root.setAttribute('data-density', 'sheet'); else root.removeAttribute('data-density');
            all('[data-mx-density]', root).forEach(function (b) { b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
            view.sheet = !!on; store(VIEW, view); rails();
        }
        setDensity(view.sheet);
        root.addEventListener('click', function (e) { var b = e.target.closest('[data-mx-density]'); if (b) { e.preventDefault(); setDensity(!view.sheet); } });

        // ── Step 2 is not forgotten: after the first mark is picked, a nudge to the menu button (once a visit) ──
        var nudge = root.querySelector('[data-mx-nudge]');
        function offerStep2(code) {
            if (!nudge) return;
            var has = function (k) { return picks.some(function (c) { return c[0] === k; }); };
            var key, text, to, label;
            if ((code[0] === 'L' || code[0] === 'P' || code[0] === 'W') && !has('M')) { key = '2'; text = code + ' voted. Next: pick a menu button.'; to = 'menu'; label = 'Step 2 \u2192'; }
            else if (code[0] === 'M' && !has('F')) { key = '3'; text = code + ' voted. Last: pick a font.'; to = 'font'; label = 'Step 3 \u2192'; }
            else if (code[0] === 'F' && (has('L') || has('P') || has('W')) && has('M')) { key = 'done'; text = 'All three done. Thank you!'; to = null; label = 'Share'; }
            else return;
            var seen = {};
            try { seen = JSON.parse(sessionStorage.getItem('ov_mark_nudged') || '{}') || {}; } catch (e) { seen = {}; }
            if (seen[key]) return;
            seen[key] = 1;
            try { sessionStorage.setItem('ov_mark_nudged', JSON.stringify(seen)); } catch (e) { /* */ }
            nudge.querySelector('[data-mx-nudge-text]').textContent = text;
            var go2 = nudge.querySelector('[data-mx-nudge-go]');
            go2.textContent = label;
            if (to) { go2.setAttribute('href', '#' + to); go2.setAttribute('data-mx-go', to); go2.removeAttribute('data-mx-share'); }
            else { go2.removeAttribute('data-mx-go'); go2.setAttribute('href', '#'); go2.setAttribute('data-mx-share', ''); }
            nudge.hidden = false;
            clearTimeout(nudge._t);
            nudge._t = setTimeout(function () { nudge.hidden = true; }, 9000);
            var step = steps && to && steps.querySelector('[data-mx-go="' + to + '"]');
            if (step && !still()) { step.classList.remove('is-call'); void step.offsetWidth; step.classList.add('is-call'); }
        }
        if (nudge) nudge.addEventListener('click', function (e) { if (e.target.closest('[data-mx-nudge-close]') || e.target.closest('[data-mx-go]') || e.target.closest('[data-mx-share]')) nudge.hidden = true; });

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
                e.preventDefault();
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

        // A wild mark as a status (the owner, 11-01: "status icons"): live (its key part turns red and pulses, with a red
        // dot) and new (a count on its corner). Copies of the card's own drawing, so they move like it.
        function statuses(card) {
            all('.st[data-st]', card).forEach(function (slot) {
                if (slot.firstChild) return;
                var art = artOf(card.getAttribute('data-code'), 28);
                if (!art) return;
                slot.appendChild(art);
                var label = document.createElement('small');
                label.textContent = slot.getAttribute('data-st') === 'live' ? 'Live' : '3 new';
                slot.appendChild(label);
            });
        }

        // ── Arrival and idle: a card is "in" once it has been seen, and "on" (idling) while it is on screen ──
        var cards = all('.mx-card', root);
        if (!('IntersectionObserver' in window)) cards.forEach(function (c) { c.classList.add('is-in'); if (c.classList.contains('mx-wild')) statuses(c); });
        else {
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (en) {
                    var c = en.target;
                    if (en.isIntersecting) {
                        if (!c.classList.contains('is-in')) {
                            c.classList.add('is-in');
                            if (c.classList.contains('mx-wild')) statuses(c);
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
