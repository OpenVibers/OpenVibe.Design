/* /prompts: Copy puts a prompt on the clipboard (selected instead where the clipboard is refused). */
(function () {
    'use strict';
    document.addEventListener('click', function (e) {
        var b = e.target.closest('[data-pr-copy]');
        if (!b) return;
        var pre = document.getElementById(b.getAttribute('data-pr-copy'));
        if (!pre) return;
        var done = function () { var was = b.textContent; b.textContent = 'Copied'; setTimeout(function () { b.textContent = was; }, 1300); };
        var select = function () { var r = document.createRange(); r.selectNodeContents(pre); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(pre.textContent).then(done, select); else select();
    });
})();
