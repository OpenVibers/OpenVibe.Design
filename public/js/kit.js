/**
 * /icons/kit (server/views/icon-page.js kitPage): find glyphs as you type, say what is picked beside the download
 * button, and clear the picks. Without this script the page is the same form: tick, name, download.
 */
(function () {
    'use strict';
    const form = document.querySelector('[data-kit-form]');
    if (!form) return;
    const tools = form.querySelector('[data-kit-tools]');
    if (tools) tools.hidden = false;
    const sum = form.querySelector('[data-kit-sum]');
    const go = form.querySelector('[data-kit-go]');
    const boxes = () => form.querySelectorAll('input[name="names"]');
    function update() {
        const picked = [...boxes()].filter((b) => b.checked).map((b) => b.value);
        sum.textContent = picked.length ? `${picked.length} picked: ${picked.slice(0, 4).join(', ')}${picked.length > 4 ? '…' : ''}` : 'Tick the icons you use';
        go.disabled = picked.length === 0;
    }
    form.addEventListener('change', (e) => { if (e.target && e.target.name === 'names') update(); });
    const find = form.querySelector('[data-kit-find]');
    if (find) find.addEventListener('input', () => {
        const q = find.value.trim().toLowerCase().replace(/^fa-/, '');
        form.querySelectorAll('.kit-tile').forEach((t) => {
            t.hidden = !!q && !t.dataset.name.includes(q) && !(t.dataset.fa || '').split(' ').some((f) => f.includes(q));
        });
    });
    // Enter in the search box finds; it never downloads.
    if (find) find.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
    const clear = form.querySelector('[data-kit-clear]');
    if (clear) clear.addEventListener('click', () => { boxes().forEach((b) => { b.checked = false; }); update(); });
    update();
})();
