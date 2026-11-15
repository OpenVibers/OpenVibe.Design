// /forms: say what a demo holds, so a visitor sees the hidden control follow OpenVibe's own (a select, or a set of
// segmented radios).
(function () {
    'use strict';
    document.querySelectorAll('[data-fm-out]').forEach(function (out) {
        var key = out.getAttribute('data-fm-out');
        var select = document.getElementById(key) || document.querySelector('input[name="' + key + '"]');
        if (!select) return;
        var group = select.name ? document.querySelectorAll('input[name="' + select.name + '"]') : [select];
        var say = function () {
            var checked = select.type === 'radio' ? document.querySelector('input[name="' + select.name + '"]:checked') : select;
            out.textContent = (checked && checked.value) || '(none)';
        };
        group.forEach(function (el) { el.addEventListener('change', say); });
        say();
    });
    // A slider says its value beside it as it moves.
    document.querySelectorAll('output[data-fm-range]').forEach(function (out) {
        var range = document.getElementById(out.getAttribute('data-fm-range'));
        if (!range) return;
        var say = function () { out.textContent = range.value; };
        range.addEventListener('input', say);
        say();
    });
})();
