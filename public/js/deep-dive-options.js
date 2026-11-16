/* /deep-dive's Options fold: opening it sends the choices (an unopened fold leaves every choice to the depth), the
 * summary line says what is chosen, and the image search rows step aside when image search is off. */
(function () {
    'use strict';
    var fold = document.querySelector('[data-ddh-options]');
    if (!fold) return;
    var custom = fold.querySelector('[data-ddh-custom]');
    var line = fold.querySelector('summary small');
    var form = fold.closest('form');
    function vals(name) { return Array.prototype.slice.call(form.querySelectorAll('input[name="' + name + '"]:checked')).map(function (i) { return i.value; }); }
    function say() {
        var vp = vals('vp'), th = vals('th'), img = vals('images')[0], rec = vals('recency')[0];
        var parts = [];
        parts.push(vp.length === 2 || !vp.length ? 'Phone and computer' : vp[0] === '390' ? 'Phone only' : 'Computer only');
        parts.push(th.length === 2 || !th.length ? 'light and dark' : th[0] + ' only');
        parts.push(img === '0' ? 'no image search' : 'image search, ' + (rec === 'any' ? 'any time' : 'past ' + rec));
        if (vals('extras').length) parts.push('Expert extras');
        line.textContent = parts.join(' · ');
        fold.querySelectorAll('[name="recency"], [name="per_sheet"], [name="eng"], [name="img_q"]').forEach(function (el) {
            var group = el.closest('.ddh-opt') || el.closest('.ddh-field');
            if (group) group.classList.toggle('is-off', img === '0');
        });
    }
    fold.addEventListener('toggle', function () { if (fold.open) custom.disabled = false; });
    form.addEventListener('change', say);
    // At least one size and one theme: the last one cannot be turned off.
    form.addEventListener('click', function (e) {
        var i = e.target.closest && e.target.closest('input[name="vp"], input[name="th"]');
        if (i && !i.checked && !vals(i.name).length) { e.preventDefault(); }
    });
    say();
})();
