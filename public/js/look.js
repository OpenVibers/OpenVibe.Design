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
    let undoAction = null;
    const say = (message, undo = null) => {
        const toast = $('#lk-toast');
        const label = $('#lk-status');
        const button = $('#lk-undo');
        if (!toast || !label || !button) return;
        label.textContent = message;
        undoAction = undo;
        button.hidden = !undo;
        toast.hidden = !message;
    };
    $('#lk-undo').addEventListener('click', () => {
        const action = undoAction;
        undoAction = null;
        if (action) Promise.resolve(action()).then(() => say('Undone.')).catch(() => say('That did not work. Try again.'));
    });

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
        const change = $('#lk-change');
        if (change) change.href = `/themes?theme=${encodeURIComponent(id)}`;
        const code = $('#lk-code');
        if (code) code.href = `/tokens?theme=${encodeURIComponent(id)}`;
    }
    // Comfort switches: [on, off] values of each display setting (openvibe-shared 4.45.0).
    const COMFORT = { contrast: ['more', 'normal'], font: ['readable', 'default'], colors: ['cb-safe', 'default'], oled: ['on', 'off'] };
    function check(name, value) {
        root.querySelectorAll(`input[name="${name}"]`).forEach((i) => { if (i.type === 'radio') i.checked = i.value === value; });
    }
    function showSettings() {
        const d = L.display.get();
        check('scheme', L.scheme.get());
        check('text', d.text);
        check('motion', d.motion);
        check('icons', d.icons || 'auto');
        const s = root.querySelector('input[name="seasonal"]');
        if (s) s.checked = d.seasonal !== 'off';
        for (const k of Object.keys(COMFORT)) { const c = root.querySelector(`input[name="${k}"]`); if (c) c.checked = d[k] === COMFORT[k][0]; }
    }
    root.addEventListener('change', (e) => {
        const i = e.target;
        if (!i || !i.name) return;
        if (!['scheme', 'seasonal', 'text', 'motion', 'icons', ...Object.keys(COMFORT)].includes(i.name)) return;
        const previous = i.name === 'scheme' ? L.scheme.get() : L.display.get()[i.name];
        if (i.name === 'scheme') L.scheme.set(i.value);
        else if (i.name === 'seasonal') L.display.set({ seasonal: i.checked ? 'on' : 'off' });
        else if (i.name === 'text' || i.name === 'motion' || i.name === 'icons') L.display.set({ [i.name]: i.value });
        else if (COMFORT[i.name]) L.display.set({ [i.name]: COMFORT[i.name][i.checked ? 0 : 1] });
        showTheme();
        showSettings();
        say(root.getAttribute('data-signed-in') === '1' ? 'Saved. Every OpenVibe site follows.' : 'Saved on this device.', () => {
            if (i.name === 'scheme') L.scheme.set(previous);
            else L.display.set({ [i.name]: previous });
            showTheme(); showSettings();
        });
    });
    // ── A different look on one site (signed in): list, add, remove, through /api/me/theme/overrides ──
    const siteList = $('#lk-site-list');
    const siteName = (id) => { const o = Array.from(root.querySelectorAll('#lk-site-form select[name="service"] option')).find((x) => x.value === id); return o ? o.textContent : id; };
    const api = (path, opts = {}) => fetch(path, { credentials: 'same-origin', ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}) } }).then((r) => (r.ok ? r.json().catch(() => ({})) : Promise.reject(r)));
    let currentSites = [];
    function drawSites(items) {
        if (!siteList) return;
        currentSites = items;
        siteList.replaceChildren();
        if (!items.length) { const li = document.createElement('li'); li.className = 'lk-none'; li.textContent = 'Every site wears your theme. Add one to give it a different look.'; siteList.appendChild(li); return; }
        for (const o of items) {
            const li = document.createElement('li');
            const t = byId.get(o.theme_id);
            const icon = document.createElement('img');
            icon.className = 'lk-site-icon'; icon.width = 40; icon.height = 40; icon.alt = '';
            const siteOption = Array.from(root.querySelectorAll('#lk-site-form select[name="service"] option')).find((x) => x.value === o.service);
            if (siteOption && siteOption.dataset.appIcon) icon.src = siteOption.dataset.appIcon;
            else icon.hidden = true;
            const txt = document.createElement('span'); txt.className = 'lk-site-text';
            const b = document.createElement('b'); b.textContent = siteName(o.service);
            const theme = document.createElement('small'); theme.textContent = (t && t.name) || o.theme_name || o.theme_id;
            const dot = document.createElement('i'); dot.className = 'lk-site-swatch';
            if (t && (t.dots[2] || t.dots[0])) dot.style.background = t.dots[2] || t.dots[0];
            theme.prepend(dot); txt.append(b, theme);
            const menu = document.createElement('details'); menu.className = 'lk-site-menu';
            const summary = document.createElement('summary'); summary.textContent = '⋯'; summary.setAttribute('aria-label', `Options for ${siteName(o.service)}`);
            const rm = document.createElement('button');
            rm.type = 'button'; rm.textContent = 'Use my main theme';
            rm.addEventListener('click', () => api(`/api/me/theme/overrides/${encodeURIComponent(o.service)}`, { method: 'DELETE' }).then(loadSites).then(() => say(`${siteName(o.service)} wears your main theme.`, () => api(`/api/me/theme/overrides/${encodeURIComponent(o.service)}`, { method: 'PUT', body: JSON.stringify({ theme_id: o.theme_id }) }).then(loadSites))).catch(() => say('That did not work. Try again.')));
            menu.append(summary, rm);
            li.append(icon, txt, menu);
            siteList.appendChild(li);
        }
    }
    const loadSites = () => api('/api/me/theme/overrides').then((d) => drawSites((d && d.overrides) || [])).catch(() => drawSites([]));
    const siteForm = $('#lk-site-form');
    if (siteForm && siteList) {
        loadSites();
        document.addEventListener('click', (e) => {
            siteList.querySelectorAll('.lk-site-menu[open]').forEach((menu) => { if (!menu.contains(e.target)) menu.open = false; });
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') siteList.querySelectorAll('.lk-site-menu[open]').forEach((menu) => { menu.open = false; menu.querySelector('summary').focus(); });
        });
        siteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const service = siteForm.elements.service.value;
            const themeId = siteForm.elements.theme_id.value;
            const earlier = currentSites.find((x) => x.service === service);
            api(`/api/me/theme/overrides/${encodeURIComponent(service)}`, { method: 'PUT', body: JSON.stringify({ theme_id: themeId }) })
                .then(loadSites).then(() => { $('#lk-site-sheet').close(); say(`${siteName(service)} now wears ${(byId.get(themeId) || {}).name || themeId}.`, () => api(`/api/me/theme/overrides/${encodeURIComponent(service)}`, earlier ? { method: 'PUT', body: JSON.stringify({ theme_id: earlier.theme_id }) } : { method: 'DELETE' }).then(loadSites)); })
                .catch(() => say('That did not work. Try again.'));
        });
    }

    // The account's answer, another tab or the device can change the look while the page is open.
    window.addEventListener('storage', () => { showTheme(); showSettings(); });
    new MutationObserver(showTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    showTheme();
    showSettings();
})();
