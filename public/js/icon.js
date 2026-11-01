/**
 * One glyph's page (server/views/icon-page.js): the PNG maker previews as you change it, keeps the address in step
 * (so the link rebuilds the same file), and Copy the SVG copies the plain drawing. Without this script the maker is a
 * GET form and works the same, one submit at a time.
 */
(function () {
    'use strict';
    const $ = (s, el = document) => el.querySelector(s);
    const form = $('[data-gp-form]');
    if (!form) return;
    const name = location.pathname.split('/').pop();
    const img = $('[data-gp-img]', form);
    const pngLink = $('[data-gp-png]', form);
    const svgLink = $('[data-gp-svg]', form);
    const bgField = $('[data-gp-bg-field]', form);
    const preview = $('[data-gp-preview]', form);
    const field = (n) => form.elements[n];
    const pick = $('[data-gp-colour]', form);
    const bgPick = $('[data-gp-bgpick]', form);
    const DEFAULT = { size: '256', scale: '1', color: '0f172a', stroke: '2', pad: '0', ground: 'none', bg: 'ffffff', fx: 'flat', style: 'auto' };

    function query() {
        const p = new URLSearchParams();
        Object.keys(DEFAULT).forEach((k) => {
            const v = String(field(k).value).replace(/^#/, '').toLowerCase();
            if (v !== DEFAULT[k] && !(k === 'bg' && field('ground').value === 'none')) p.set(k, v);
        });
        const s = p.toString();
        return s ? `?${s}` : '';
    }
    let timer = 0;
    function update() {
        form.querySelectorAll('[data-gp-out]').forEach((o) => { o.textContent = field(o.dataset.gpOut).value + (o.dataset.gpOut === 'pad' ? '%' : ''); });
        bgField.hidden = field('ground').value === 'none';
        preview.dataset.ground = field('ground').value;
        $('[data-gp-mark]', form).setAttribute('aria-pressed', field('color').value === 'mark' ? 'true' : 'false');
        // A colour typed as hex shows in its swatch too.
        [[field('color'), pick], [field('bg'), bgPick]].forEach(([text, swatch]) => {
            const v = String(text.value).replace(/^#/, '');
            if (/^[0-9a-f]{6}$/i.test(v)) swatch.value = `#${v.toLowerCase()}`;
            else if (/^[0-9a-f]{3}$/i.test(v)) swatch.value = `#${v.replace(/./g, (c) => c + c).toLowerCase()}`;
        });
        clearTimeout(timer);
        timer = setTimeout(() => {
            const q = query();
            const size = Number(field('size').value), px = size * Number(field('scale').value);
            img.src = `/icons/${name}.png${q}`;
            img.width = img.height = Math.min(size, 256);
            img.alt = `${name} icon, ${size} pixels`;
            pngLink.href = `/icons/${name}.png${q}`;
            pngLink.setAttribute('download', `${name}-${px}.png`);
            pngLink.lastChild.textContent = ` PNG, ${px} px`;
            svgLink.href = `/icons/${name}.svg${q}`;
            // The favicon set follows the maker too (its own defaults when nothing is chosen).
            const fav = document.querySelector('[data-gp-fav]');
            if (fav) fav.href = `/icons/${name}/favicon.zip${q}`;
            history.replaceState(null, '', `${location.pathname}${q}#png`);
        }, 120);
    }
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', (e) => { e.preventDefault(); update(); });

    // Colour pickers write the hex fields; "The mark's" switches to the mark's two colours and back.
    pick.addEventListener('input', () => { field('color').value = pick.value.slice(1); update(); });
    bgPick.addEventListener('input', () => { field('bg').value = bgPick.value.slice(1); update(); });
    let lastColour = field('color').value === 'mark' ? DEFAULT.color : field('color').value;
    $('[data-gp-mark]', form).addEventListener('click', () => {
        if (field('color').value === 'mark') field('color').value = lastColour;
        else { lastColour = field('color').value; field('color').value = 'mark'; }
        update();
    });

    // Copy the plain SVG.
    const copy = document.querySelector('[data-gp-copy]');
    if (copy && navigator.clipboard) {
        copy.hidden = false;
        copy.addEventListener('click', () => {
            fetch(copy.dataset.gpCopy).then((r) => r.text()).then((t) => navigator.clipboard.writeText(t)).then(() => {
                copy.textContent = 'Copied';
                setTimeout(() => { copy.textContent = 'Copy the SVG'; }, 1400);
            }, () => {});
        });
    }
})();
