/**
 * The element editor's icon picker: as the label changes, ask GET /api/v1/glyphs/suggest for the best glyphs by
 * meaning and draw them as one-tap choices. The field still takes any glyph or Font Awesome name; this only helps.
 * Without JavaScript the server-rendered suggestions for the current label stay, and typing a name works.
 */
(function () {
    'use strict';
    const label = document.querySelector('[data-el-label]');
    const field = document.querySelector('[data-el-icon]');
    const row = document.querySelector('[data-el-icon-row]');
    if (!label || !field || !row) return;
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let timer = null, seq = 0;
    const render = (glyphs) => {
        row.innerHTML = glyphs.length
            ? glyphs.map((g) => `<button type="button" class="el-icon-pick" data-el-icon-pick="${esc(g.name)}"><b>${esc(g.name)}</b>${g.tags && g.tags.length ? `<span>${esc(g.tags.slice(0, 2).join(' · '))}</span>` : ''}</button>`).join('')
            : '<span class="dv-fine">No close glyph yet: <a href="/icons#draw">draw one</a>.</span>';
    };
    const ask = async () => {
        const words = label.value.trim();
        if (!words) { row.innerHTML = '<span class="dv-fine">Type a label for suggestions.</span>'; return; }
        const mine = ++seq;
        try {
            const r = await fetch(`/api/v1/glyphs/suggest?label=${encodeURIComponent(words)}&limit=5`, { headers: { accept: 'application/json' } });
            if (mine !== seq) return;
            const data = r.ok ? await r.json() : { glyphs: [] };
            if (mine === seq) render(data.glyphs || []);
        } catch { /* the field still works */ }
    };
    label.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(ask, 250); });
    row.addEventListener('click', (e) => {
        const b = e.target.closest('[data-el-icon-pick]');
        if (!b) return;
        field.value = b.dataset.elIconPick;
        field.focus();
        row.querySelectorAll('[data-el-icon-pick]').forEach((x) => x.classList.toggle('is-on', x === b));
    });
})();
