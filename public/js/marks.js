/* /brand/explore: pick the marks you like. The picks live in the page's link (#picks=L03,P17), so a link sent to
   someone opens with them marked, and in this browser for next time. Copy puts "L03, P17" on the clipboard. */
(function () {
    'use strict';
    var KEY = 'ov_mark_picks';
    function init() {
        var bar = document.querySelector('[data-mx-bar]');
        if (!bar || bar.getAttribute('data-ready')) return;
        bar.setAttribute('data-ready', '1');
        var out = bar.querySelector('[data-mx-picks]');
        var picks = [];
        var fromHash = /(?:^#|&)picks=([A-Z0-9,]+)/.exec(location.hash || '');
        if (fromHash) picks = fromHash[1].split(',').filter(function (c) { return /^[LP]\d{2}$/.test(c); });
        else { try { picks = JSON.parse(localStorage.getItem(KEY) || '[]').filter(function (c) { return /^[LP]\d{2}$/.test(c); }); } catch (e) { picks = []; } }
        function order(list) { return list.slice().sort(); }
        function link() { return location.origin + location.pathname + (picks.length ? '#picks=' + order(picks).join(',') : ''); }
        function render() {
            document.querySelectorAll('[data-pick]').forEach(function (b) {
                var on = picks.indexOf(b.getAttribute('data-pick')) !== -1;
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
                b.textContent = on ? 'Picked ' + b.getAttribute('data-pick') : 'Pick ' + b.getAttribute('data-pick');
                var card = b.closest('.mx-card');
                if (card) card.classList.toggle('is-picked', on);
            });
            bar.hidden = !picks.length;
            out.textContent = order(picks).join(', ');
            try { localStorage.setItem(KEY, JSON.stringify(picks)); } catch (e) { /* a private window keeps them for the page only */ }
            if (history.replaceState) history.replaceState(null, '', picks.length ? '#picks=' + order(picks).join(',') : location.pathname);
        }
        function say(btn, words) { var was = btn.textContent; btn.textContent = words; setTimeout(function () { btn.textContent = was; }, 1400); }
        function copy(text, btn) {
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { say(btn, 'Copied'); }, function () { window.prompt('Copy this:', text); });
            else window.prompt('Copy this:', text);
        }
        document.addEventListener('click', function (e) {
            var b = e.target.closest('[data-pick]');
            if (b) { var c = b.getAttribute('data-pick'); var i = picks.indexOf(c); if (i === -1) picks.push(c); else picks.splice(i, 1); render(); return; }
            if (e.target.closest('[data-mx-copy]')) copy('My picks: ' + order(picks).join(', ') + ' (' + link() + ')', e.target.closest('[data-mx-copy]'));
            if (e.target.closest('[data-mx-link]')) copy(link(), e.target.closest('[data-mx-link]'));
            if (e.target.closest('[data-mx-clear]')) { picks = []; render(); }
        });
        render();
        if (fromHash && picks.length) { var first = document.getElementById(order(picks)[0]); if (first) first.scrollIntoView({ block: 'center' }); }
    }
    document.addEventListener('ov:boost:load', init);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
