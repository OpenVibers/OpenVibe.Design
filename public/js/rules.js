// /rules: the filter. Without it every rule shows; with it, typing narrows the register and says how many match.
(function () {
    'use strict';
    var form = document.querySelector('[data-rl-find]');
    if (!form) return;
    var input = form.querySelector('input');
    var count = form.querySelector('[data-rl-count]');
    var rules = Array.prototype.slice.call(document.querySelectorAll('.rl-rule[data-rl-text]'));
    var areas = Array.prototype.slice.call(document.querySelectorAll('[data-rl-area]'));
    form.hidden = false;
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    function apply() {
        var words = String(input.value || '').toLowerCase().split(/\s+/).filter(Boolean);
        var shown = 0;
        rules.forEach(function (r) {
            var text = r.getAttribute('data-rl-text');
            var match = words.every(function (w) { return text.indexOf(w) !== -1; });
            r.hidden = !match;
            if (match) shown += 1;
        });
        areas.forEach(function (a) {
            var any = a.querySelector('.rl-rule:not([hidden])');
            if (any) a.removeAttribute('data-rl-empty'); else a.setAttribute('data-rl-empty', '');
        });
        count.textContent = words.length ? shown + ' of ' + rules.length : '';
    }
    input.addEventListener('input', apply);
})();
