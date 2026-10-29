/**
 * The theme studio, live (plan 2026-10-28 §5.2). The page works without this file (the gallery links to each theme's
 * page); with it:
 *   - picking a theme recolours the three previews (Live, Chat, a shop) through CSS variables scoped to them
 *   - editing a core colour derives the rest of the theme's tokens and recolours as you drag
 *   - the checks measure WCAG contrast for text, muted text, buttons and links; Use waits until every required one passes
 *   - "See it as" simulates colour-vision differences on the previews (SVG filters in the page)
 *   - Use saves the theme (and your edits) to your account through /api/me/theme, which every OpenVibe site follows;
 *     History lists your earlier looks and Restore brings one back; Share sends it to the gallery's review
 * Text is set with textContent; nothing from a theme is written as markup.
 */
(function () {
    'use strict';
    const root = document.querySelector('.ds-studio');
    if (!root) return;
    const signedIn = root.getAttribute('data-signed-in') === '1';
    let themes = [];
    try { themes = JSON.parse(document.getElementById('ds-themes').textContent) || []; } catch (e) { themes = []; }
    const byId = new Map(themes.map((t) => [t.id, t]));
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
    const previews = $('#ds-previews');
    const status = $('#ds-status');
    const say = (t) => { status.textContent = t || ''; };

    // ── Colour maths: sRGB, WCAG contrast, mixing ──
    const hex = (h) => { const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(h || '').trim()); if (!m) return null; let x = m[1]; if (x.length === 3) x = x.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)); };
    const toHex = (rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
    const lum = (rgb) => { const c = rgb.map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    const WHITE = [255, 255, 255], INK = [11, 13, 16];

    /** The full token set from the six core colours (the way builtin themes derive theirs). */
    function derive(core) {
        const bg = hex(core['--bg-primary']), card = hex(core['--bg-card']), text = hex(core['--text-primary']);
        const muted = hex(core['--text-muted']), accent = hex(core['--accent']), border = hex(core['--border']);
        if (!bg || !card || !text || !muted || !accent || !border) return null;
        const light = lum(bg) > 0.4;
        const onAccent = contrast(WHITE, accent) >= 4.5 ? WHITE : INK;
        return {
            '--bg-primary': toHex(bg), '--bg-card': toHex(card), '--bg-secondary': toHex(mix(bg, card, 0.6)),
            '--bg-tertiary': toHex(mix(card, text, 0.05)), '--bg-hover': toHex(mix(card, text, 0.08)), '--bg-input': toHex(mix(bg, card, 0.35)),
            '--text-primary': toHex(text), '--text-secondary': toHex(mix(text, muted, 0.45)), '--text-muted': toHex(muted),
            '--accent': toHex(accent), '--accent-light': toHex(light ? accent : mix(accent, WHITE, 0.18)), '--accent-dark': toHex(mix(accent, INK, 0.2)),
            '--accent-strong': toHex(accent), '--on-accent-strong': toHex(onAccent), '--on-accent': toHex(onAccent),
            '--accent-rgb': accent.map(Math.round).join(', '),
            '--border': toHex(border), '--border-light': toHex(mix(border, text, 0.12)),
            '--color-scheme': light ? 'light' : 'dark',
        };
    }

    // ── State ──
    let base = null;         // the theme picked
    let edited = null;       // core overrides, or null
    const coreOf = (v) => ({ '--bg-primary': v['--bg-primary'], '--bg-card': v['--bg-card'] || v['--bg-secondary'], '--text-primary': v['--text-primary'], '--text-muted': v['--text-muted'] || v['--text-secondary'], '--accent': v['--accent'], '--border': v['--border'] });
    const current = () => { if (!base) return null; if (!edited) return base.variables; return Object.assign({}, base.variables, derive(Object.assign(coreOf(base.variables), edited)) || {}); };

    function paint() {
        const v = current();
        if (!v) return;
        for (const [k, x] of Object.entries(v)) if (/^--[a-z][a-z0-9-]*$/.test(k)) previews.style.setProperty(k, String(x));
        const core = coreOf(v);
        $$('.ds-field input[type=color]').forEach((inp) => { const x = hex(core[inp.getAttribute('data-var')]); if (x) inp.value = toHex(x); });
        $$('.ds-field input[data-hex]').forEach((inp) => { if (document.activeElement !== inp) { const x = hex(core[inp.getAttribute('data-hex')]); inp.value = x ? toHex(x) : ''; } });
        $('#ds-current').textContent = base.name + (edited ? ' (edited)' : '');
        $('#ds-reset').disabled = !edited;
        check(v);
    }

    // ── Checks (WCAG 2.1): required ones gate Use ──
    function check(v) {
        const g = (k) => hex(v[k]);
        const rows = [
            ['Text on the background', g('--text-primary'), g('--bg-primary'), 4.5, true],
            ['Text on cards', g('--text-primary'), g('--bg-card'), 4.5, true],
            ['Muted text on cards', g('--text-muted'), g('--bg-card'), 4.5, true],
            ['Button text', g('--on-accent-strong') || g('--on-accent'), g('--accent-strong') || g('--accent'), 4.5, true],
            ['Links on the background', g('--accent-light') || g('--accent'), g('--bg-primary'), 4.5, true],
            ['Lines against cards', g('--border'), g('--bg-card'), 1.3, false],
        ];
        const list = $('#ds-checks');
        list.textContent = '';
        let ok = true;
        for (const [label, fg, bg, need, required] of rows) {
            if (!fg || !bg) continue;
            const r = contrast(fg, bg), pass = r >= need;
            if (required && !pass) ok = false;
            const li = document.createElement('li');
            li.className = pass ? 'is-pass' : required ? 'is-fail' : 'is-warn';
            const b = document.createElement('b'); b.textContent = label;
            const s = document.createElement('span'); s.textContent = `${r.toFixed(1)}:1${pass ? '' : ` · needs ${need}`}`;
            li.append(b, s);
            list.appendChild(li);
        }
        const use = $('#ds-use');
        use.disabled = !base || (signedIn && !ok);
        use.title = ok ? '' : 'Every required check must pass';
        return ok;
    }

    // ── Picking and editing ──
    function pick(id, { quiet = false } = {}) {
        const t = byId.get(id);
        if (!t) return;
        base = t; edited = null;
        $$('.ds-swatch[data-theme-id]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-theme-id') === id)));
        paint();
        const code = $('#ds-code');
        if (code) code.href = `/tokens?theme=${encodeURIComponent(id)}`;
        if (!quiet) { try { history.replaceState(null, '', `/studio?theme=${encodeURIComponent(id)}`); } catch (e) { /* */ } }
        say('');
    }
    root.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('.ds-swatch[data-theme-id]');
        if (b) pick(b.getAttribute('data-theme-id'));
        const f = e.target.closest && e.target.closest('[data-show]');
        if (f) {
            const show = f.getAttribute('data-show');
            $$('[data-show]').forEach((x) => x.setAttribute('aria-pressed', String(x === f)));
            $$('.ds-swatch[data-theme-id]').forEach((s) => { s.parentElement.hidden = show !== 'all' && s.getAttribute('data-mode') !== show; });
        }
    });
    const setCore = (k, value) => { const x = hex(value); if (!x || !base) return; edited = Object.assign({}, edited || {}, { [k]: toHex(x) }); paint(); };
    $$('.ds-field input[type=color]').forEach((inp) => inp.addEventListener('input', () => setCore(inp.getAttribute('data-var'), inp.value)));
    $$('.ds-field input[data-hex]').forEach((inp) => inp.addEventListener('change', () => setCore(inp.getAttribute('data-hex'), inp.value)));
    $('#ds-reset').addEventListener('click', () => { edited = null; paint(); say('Back to the theme as it was.'); });
    $('#ds-cvd').addEventListener('change', (e) => {
        const v = e.target.value;
        previews.style.filter = v === 'gray' ? 'grayscale(1)' : v ? `url(#ds-cvd-${v})` : '';
    });

    // ── Talking to /api (this site's proxy of Network's theme API, as the signed-in person) ──
    async function api(path, opts) {
        const r = await fetch(path, Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }, opts || {}));
        let body = null; try { body = await r.json(); } catch (e) { body = null; }
        if (!r.ok) { const err = new Error((body && (body.detail || body.error)) || `HTTP ${r.status}`); err.status = r.status; throw err; }
        return body || {};
    }
    $('#ds-use').addEventListener('click', async () => {
        if (!signedIn) { location.href = '/auth/login?next=' + encodeURIComponent(location.pathname + location.search); return; }
        if (!base) return;
        const v = current();
        say('Saving…');
        try {
            await api('/api/me/theme', { method: 'PUT', body: JSON.stringify({ theme_id: base.id, custom_variables: edited ? derive(Object.assign(coreOf(base.variables), edited)) : null }) });
            // This page wears it at once; every other OpenVibe site follows on its next page.
            for (const [k, x] of Object.entries(v)) if (/^--[a-z][a-z0-9-]*$/.test(k)) document.documentElement.style.setProperty(k, String(x));
            say(`${base.name}${edited ? ' (with your edits)' : ''} is your theme on every OpenVibe site.`);
            loadHistory();
        } catch (err) { say(err.status === 401 ? 'Sign in again to save it.' : `Not saved: ${err.message}`); }
    });
    const form = $('#ds-submit-form');
    if (form) form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!signedIn || !base) return;
        const name = $('#ds-name').value.trim();
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
        if (slug.length < 2) { say('Give it a name of two letters or more.'); return; }
        const v = current();
        try {
            await api('/api/themes/submit', { method: 'POST', body: JSON.stringify({ name, slug, description: $('#ds-desc').value.trim(), mode: v['--color-scheme'] === 'light' ? 'light' : 'dark', variables: v, tags: [] }) });
            say(`${name} is waiting for review. You can use it yourself right away.`);
            form.reset();
        } catch (err) { say(`Not sent: ${err.message}`); }
    });

    // ── History and restore ──
    /** "Today 14:13", "Yesterday 09:02", else "Oct 21, 14:13", in the person's own time zone. */
    function whenOf(v) {
        const s = String(v || '');
        const d = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s) && !/[zZ+]/.test(s.slice(10)) ? s.replace(' ', 'T') + 'Z' : s);
        if (isNaN(d.getTime())) return s.slice(0, 16);
        const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const day = new Date(d); day.setHours(0, 0, 0, 0);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const ago = Math.round((today - day) / 86400000);
        if (ago === 0) return `Today ${time}`;
        if (ago === 1) return `Yesterday ${time}`;
        return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
    }
    async function loadHistory() {
        const list = $('#ds-history-list');
        if (!list || !signedIn) return;
        let h = [];
        try { h = (await api('/api/me/theme/history')).history || []; } catch (e) { return; }
        list.textContent = '';
        if (!h.length) { const li = document.createElement('li'); li.className = 'ds-fine'; li.textContent = 'Your earlier looks appear here after your first change.'; list.appendChild(li); return; }
        for (const x of h.slice(0, 20)) {
            const li = document.createElement('li');
            const t = byId.get(x.theme_id);
            const dot = document.createElement('i'); dot.className = 'ds-hist-dot';
            const accent = (x.custom_variables && x.custom_variables['--accent']) || (t && t.variables['--accent']);
            if (hex(accent)) dot.style.background = toHex(hex(accent));
            const b = document.createElement('b'); b.textContent = (x.theme_name || x.theme_id) + (x.custom_variables ? ' (edited)' : '');
            const when = document.createElement('small'); when.textContent = whenOf(x.created_at);
            const go = document.createElement('button'); go.type = 'button'; go.className = 'ovk-btn ovk-btn--quiet ovk-btn--small'; go.textContent = 'Restore';
            go.addEventListener('click', async () => {
                go.disabled = true;
                try {
                    await api(`/api/me/theme/history/${encodeURIComponent(x.id)}/restore`, { method: 'POST', body: '{}' });
                    if (byId.has(x.theme_id)) { pick(x.theme_id, { quiet: true }); if (x.custom_variables) { edited = coreOf(x.custom_variables); paint(); } }
                    say(`Restored ${x.theme_name || x.theme_id}. Every OpenVibe site follows on its next page.`);
                    loadHistory();
                } catch (err) { say(`Not restored: ${err.message}`); go.disabled = false; }
            });
            li.append(dot, b, when, go);
            list.appendChild(li);
        }
    }

    // ── Start: the theme in the address, else the person's active one, else the first ──
    const wanted = new URLSearchParams(location.search).get('theme');
    if (wanted && byId.has(wanted)) pick(wanted, { quiet: true });
    else if (signedIn) api('/api/me/theme').then((m) => { if (m && byId.has(m.theme_id)) { pick(m.theme_id, { quiet: true }); if (m.custom_variables) { edited = coreOf(m.custom_variables); paint(); } } else if (themes[0]) pick(themes[0].id, { quiet: true }); }).catch(() => { if (themes[0]) pick(themes[0].id, { quiet: true }); });
    else if (themes[0]) pick((byId.has('vibe') ? 'vibe' : themes[0].id), { quiet: true });
    loadHistory();
})();
