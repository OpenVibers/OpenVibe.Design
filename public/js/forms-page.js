// /forms: say what the first demo's select holds, so a visitor sees the hidden select follow OpenVibe's list.
(function () {
    'use strict';
    document.querySelectorAll('[data-fm-out]').forEach(function (out) {
        var select = document.getElementById(out.getAttribute('data-fm-out'));
        if (!select) return;
        var say = function () { out.textContent = select.value || '(none)'; };
        select.addEventListener('change', say);
        say();
    });
})();
