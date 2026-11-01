/**
 * /icons in the browser (server/views/icons.js): find a glyph by its name or a Font Awesome name as you type, see the
 * grid at 16, 20, 24 or 32 px, open one large (with what it stands for, Copy the SVG, SVG, PNG and its page), and
 * Escape or the close button shuts it. Without this script every tile is a link to its glyph's page.
 */
(function () {
    'use strict';
    const $ = (s, el = document) => el.querySelector(s);
    const grid = $('[data-ic-grid]');
    if (!grid) return;
    const tools = $('[data-ic-tools]');
    if (tools) tools.hidden = false;

    // Find as you type: a glyph's name, any Font Awesome name it stands for, and the words and other sets' names for it
    // (server/glyphs/aliases.js: "settings", "delete", Lucide's "trash-2", Material's "delete outline").
    const find = $('[data-ic-find]');
    const none = $('[data-ic-none]');
    const drawLink = $('[data-ic-draw-link]');
    if (find) find.addEventListener('input', () => {
        const q = find.value.trim().toLowerCase().replace(/^fa-/, '');
        let shown = 0;
        grid.querySelectorAll('.ic-tile').forEach((t) => {
            const hit = !q || t.dataset.name.includes(q) || (t.dataset.fa || '').split(' ').some((f) => f.includes(q))
                || (q.length > 1 && (t.dataset.words || '').includes(q));
            t.hidden = !hit; if (hit) shown++;
        });
        if (none) none.hidden = shown > 0;
        if (drawLink && /^[a-z][a-z0-9-]{1,31}$/.test(q)) drawLink.href = `/icons?draw=${encodeURIComponent(q)}#draw`;
    });

    // Sizes.
    document.querySelectorAll('[data-ic-size]').forEach((b) => b.addEventListener('click', () => {
        grid.style.setProperty('--ic-size', `${b.dataset.icSize}px`);
        document.querySelectorAll('[data-ic-size]').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    }));

    // One glyph, large.
    const sheet = $('[data-ic-sheet]');
    let current = null;
    const svgOf = (name) => {
        const t = grid.querySelector(`.ic-tile[data-name="${CSS.escape(name)}"] svg`);
        return t ? t.innerHTML : '';
    };
    const standalone = (name) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgOf(name)}</svg>`;
    grid.addEventListener('click', (e) => {
        const t = e.target.closest('.ic-tile');
        // A tile is a link to the glyph's page: a plain click opens it here large, a new-tab click follows the link.
        if (!t || !sheet || typeof sheet.showModal !== 'function' || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        current = t.dataset.name;
        $('[data-ic-sheet-name]', sheet).textContent = current;
        const big = $('[data-ic-sheet-big]', sheet);
        big.innerHTML = '';
        for (let i = 0; i < 4; i++) big.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 24 24" aria-hidden="true">${svgOf(current)}</svg>`);
        const fa = (t.dataset.fa || '').split(' ').filter(Boolean);
        const meta = $('[data-ic-sheet-meta]', sheet);
        meta.textContent = '';
        meta.append(`${t.dataset.by}. `);
        if (fa.length) {
            meta.append('In place of Font Awesome\'s ');
            fa.slice(0, 12).forEach((f, i) => { const c = document.createElement('code'); c.textContent = `fa-${f}`; meta.append(c, i < Math.min(fa.length, 12) - 1 ? ', ' : ''); });
            if (fa.length > 12) meta.append(` and ${fa.length - 12} more`);
            meta.append('.');
        } else meta.append('No Font Awesome name maps to it.');
        const dl = $('[data-ic-download]', sheet);
        dl.href = `/icons/${encodeURIComponent(current)}.svg`; dl.setAttribute('download', `${current}.svg`);
        const png = $('[data-ic-png]', sheet);
        png.href = `/icons/${encodeURIComponent(current)}.png?size=512`; png.setAttribute('download', `${current}-512.png`);
        $('[data-ic-page]', sheet).href = `/icons/${encodeURIComponent(current)}`;
        sheet.showModal();
    });
    if (sheet) {
        $('[data-ic-close]', sheet).addEventListener('click', () => sheet.close());
        sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });
        const copy = $('[data-ic-copy]', sheet);
        copy.addEventListener('click', () => {
            if (!current || !navigator.clipboard) return;
            navigator.clipboard.writeText(standalone(current)).then(() => { copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy the SVG'; }, 1400); }, () => {});
        });
    }
})();
