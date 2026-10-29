/**
 * /look's controls, wired to the network's theme loader (openvibe-shared theme-loader.js: OpenVibeThemeLoader). It shows
 * the theme being worn and sets Light / Dark / Auto, text size, motion and the season's themes. The loader applies each at
 * once and saves it to the account when signed in; this file only reads and writes through it.
 */
(function () {
    'use strict';
    const L = window.OpenVibeThemeLoader;
    const root = document.querySelector('.lk');
    if (!L || !root) return;
    const $ = (s) => document.querySelector(s);
    const themes = (() => { try { return JSON.parse(($('#lk-themes') || {}).textContent || '[]'); } catch (e) { return []; } })();
    const byId = new Map(themes.map((t) => [t.id, t]));
    const say = (text) => { const s = $('#lk-status'); if (s) s.textContent = text; };

    function showTheme() {
        const id = document.documentElement.getAttribute('data-theme') || (L.getCurrent && L.getCurrent()) || 'vibe';
        const t = byId.get(id);
        const name = $('#lk-name');
        if (name) name.textContent = t ? t.name : id.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
        const mode = $('#lk-mode');
        if (mode) mode.textContent = (t ? t.mode : L.modeOf(id)) === 'light' ? 'Light' : 'Dark';
        const dots = $('#lk-dots');
        if (dots && t) {
            dots.replaceChildren(...t.dots.map((c) => { const i = document.createElement('i'); i.className = 'tk-dot'; i.style.background = c; return i; }));
        }
        const studio = $('#lk-studio');
        if (studio) studio.href = `/studio?theme=${encodeURIComponent(id)}`;
        const code = $('#lk-code');
        if (code) code.href = `/tokens?theme=${encodeURIComponent(id)}`;
    }
    function check(name, value) {
        root.querySelectorAll(`input[name="${name}"]`).forEach((i) => { if (i.type === 'radio') i.checked = i.value === value; });
    }
    function showSettings() {
        const d = L.display.get();
        check('scheme', L.scheme.get());
        check('text', d.text);
        check('motion', d.motion);
        const s = root.querySelector('input[name="seasonal"]');
        if (s) s.checked = d.seasonal !== 'off';
    }
    root.addEventListener('change', (e) => {
        const i = e.target;
        if (!i || !i.name) return;
        if (i.name === 'scheme') L.scheme.set(i.value);
        else if (i.name === 'seasonal') L.display.set({ seasonal: i.checked ? 'on' : 'off' });
        else if (i.name === 'text' || i.name === 'motion') L.display.set({ [i.name]: i.value });
        showTheme();
        showSettings();
        say(root.getAttribute('data-signed-in') === '1' ? 'Saved. Every OpenVibe site follows.' : 'Saved on this device.');
    });
    // The account's answer, another tab or the device can change the look while the page is open.
    window.addEventListener('storage', () => { showTheme(); showSettings(); });
    new MutationObserver(showTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    showTheme();
    showSettings();
})();
