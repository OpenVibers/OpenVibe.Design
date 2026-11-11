(function () {
    'use strict';
    const prompt = document.getElementById('dv-prompt');
    if (prompt) {
        const form = prompt.form, KEY = 'dv-composer', API = form.dataset.api || '';
        const q = (sel) => form.querySelector(sel), all = (sel) => Array.from(form.querySelectorAll(sel));
        const picked = (name) => (q(`input[name="${name}"]:checked`) || {}).value || '';
        const chosenModels = () => all('input[name="models"]:checked').map((x) => x.value);
        const takesEl = q('input[name="takes"]'), cost = q('[data-dv-cost]'), goLabel = q('[data-go-label]'), go = q('.dv-go');
        const researchOn = () => { const tick = q('input[name="research"]'); const id = q('select[name="research_id"]'); const ref = q('input[name="research_ref"]'); return Boolean((tick && tick.checked) || (id && id.value) || (ref && ref.value.trim())); };
        const researchValue = () => {
            const id = q('select[name="research_id"]'), ref = q('input[name="research_ref"]');
            if (ref && ref.value.trim()) return { ref: ref.value.trim() };
            if (id && id.value) return { id: id.value };
            const d = q('input[name="research_depth"]:checked');
            return { depth: d ? d.value : 'thorough' };
        };
        const fitResearch = () => {
            const on = researchOn(); const tick = q('input[name="research"]'); const id = q('select[name="research_id"]'), ref = q('input[name="research_ref"]');
            const fresh = q('[data-research-new]');
            if (fresh) fresh.hidden = !(tick && tick.checked) || Boolean((id && id.value) || (ref && ref.value.trim()));
            const attached = Boolean((id && id.value) || (ref && ref.value.trim()));
            const depth = q('input[name="research_depth"]:checked');
            if (tick) setText('research', attached ? 'Attached dive' : on ? (depth && depth.dataset.label ? `Research: ${depth.dataset.label}` : 'Research first') : 'Off');
        };
        const setText = (mod, text) => { const v = q(`.dv-mod[data-mod="${mod}"] [data-mod-v]`); if (v) v.textContent = text; };
        // What a choice in the tray shows: the name of what is chosen (and, for the look, its colours).
        const show = (input) => {
            const mod = input.closest('.dv-mod'); if (!mod || input.type !== 'radio') return;
            if (mod.dataset.mod === 'who' && chosenModels().length) return;
            const v = mod.querySelector('[data-mod-v]'); if (v) v.textContent = input.dataset.label || input.value;
            const sw = mod.querySelector('[data-mod-sw]'); if (sw && input.dataset.sw) sw.setAttribute('style', input.dataset.sw);
        };
        // The sizes a kind can be made at: the others step out of the list, and the first allowed one is chosen.
        const fitFrames = () => {
            const k = q('input[name="kind"]:checked'); const allowed = k && k.dataset.frames ? k.dataset.frames.split(' ').filter(Boolean) : [];
            const rows = all('.dv-opt[data-frame]'); if (!rows.length) return;
            rows.forEach((r) => { r.hidden = allowed.length > 0 && !allowed.includes(r.dataset.frame); });
            const cur = q('input[name="frame"]:checked');
            if (!cur || cur.closest('.dv-opt').hidden) { const first = rows.find((r) => !r.hidden); if (first) { const i = first.querySelector('input'); i.checked = true; show(i); } }
            const mod = q('.dv-mod[data-mod="frame"]'); if (mod) mod.hidden = rows.filter((r) => !r.hidden).length < 2;
        };
        // The ideas under the composer are those of the kind chosen.
        const fitExamples = () => { const id = picked('kind'); document.querySelectorAll('.dv-examples [data-kind]').forEach((b) => { b.hidden = b.dataset.kind !== id; }); };
        const setKind = (id) => { const k = q(`input[name="kind"][value="${CSS.escape(id)}"]`); if (k) { k.checked = true; prompt.placeholder = k.dataset.placeholder || prompt.placeholder; fitFrames(); fitExamples(); const row = k.closest('.dv-kinds'), lab = k.closest('label'); if (row && lab && row.scrollWidth > row.clientWidth) row.scrollTo({ left: Math.max(0, lab.offsetLeft - row.offsetLeft - (row.clientWidth - lab.offsetWidth) / 2), behavior: 'smooth' }); } };
        // Models and takes: at most the page's number of models, and models × takes within the run's total.
        const takesNow = () => (takesEl ? Math.max(Number(takesEl.min) || 1, Math.min(Number(takesEl.max) || 4, Number(takesEl.value) || 1)) : 3);
        const fitModels = () => {
            const box = q('.dv-models'); const max = box ? Number(box.dataset.max) || 4 : 4; const on = chosenModels();
            all('input[name="models"]').forEach((x) => { x.disabled = !x.checked && on.length >= max; });
            if (takesEl) { const total = Number(takesEl.dataset.total) || 8; const cap = Math.max(1, Math.floor(total / Math.max(1, on.length))); if (takesNow() > cap) takesEl.value = String(cap); else takesEl.value = String(takesNow()); }
            const ways = q('.dv-ways'); if (ways) ways.classList.toggle('is-off', on.length > 0);
            const n = on.length ? on.length * takesNow() : 3;
            if (on.length) setText('who', on.length === 1 ? (q('input[name="models"]:checked').dataset.label || '1 model') : `${on.length} models`);
            else { const w = q('input[name="who"]:checked'); if (w) setText('who', w.dataset.label || w.value); }
            if (goLabel && !go.hasAttribute('aria-busy')) goLabel.textContent = n === 1 ? 'Create one take' : `Create ${['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'][n] || n} takes`;
            return n;
        };
        const startUrl = () => { const el = q('input[name="start_url"]'); return el ? el.value.trim() : ''; };
        const body = () => {
            const b = { prompt: prompt.value, kind: picked('kind') || 'page', who: picked('who') || 'claude' };
            if (picked('frame')) b.frame = picked('frame');
            if (picked('look')) b.look = picked('look');
            const m = chosenModels(); if (m.length) { b.models = m; b.takes = takesNow(); }
            if (startUrl()) b.start = { url: startUrl() };
            if (researchOn()) b.research = researchValue();
            return b;
        };
        const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ kind: picked('kind'), who: picked('who'), look: picked('look'), frame: picked('frame'), models: chosenModels(), takes: takesNow(), research: researchOn() ? researchValue() : null })); } catch { /* a private window */ } };
        // What the run will cost, asked from the server as the choices settle (the same plan the run uses).
        const usd = (n) => (n >= 0.995 ? `$${n.toFixed(2)}` : n >= 0.01 ? `${Math.round(n * 100)}¢` : n > 0 ? 'under 1¢' : 'nothing');
        let costTimer = 0, costSeq = 0;
        const say = (text, bad) => { if (!cost) return; cost.textContent = text || ''; cost.hidden = !text; cost.classList.toggle('is-error', Boolean(bad)); };
        const askCost = () => {
            if (!API || !cost) return;
            clearTimeout(costTimer);
            costTimer = setTimeout(async () => {
                const seq = ++costSeq;
                try {
                    const r = await fetch(`${API}/estimate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body()) });
                    const e = await r.json(); if (seq !== costSeq) return;
                    if (!r.ok) return say(chosenModels().length || startUrl() ? (e.detail || '') : '', true);
                    const total = Number(e.total_usd);
                    if (!isFinite(total)) return say('');
                    const about = `About ${usd(total)} for this run`;
                    const bal = e.balance ? (e.covers === false ? ` · your Balance (${usd(Number(e.balance.available_usd) || 0)}) does not cover it` : ' · your Balance covers it') : (e.balance_note ? ` · ${e.balance_note}` : '');
                    say(about + bal, e.covers === false);
                } catch { if (seq === costSeq) say(''); }
            }, 450);
        };
        // The last choices come back (they are this person's habits, kept in this browser only).
        try {
            const last = JSON.parse(localStorage.getItem(KEY) || '{}');
            if (last.kind) setKind(last.kind); else { fitFrames(); fitExamples(); }
            ['who', 'look', 'frame'].forEach((name) => { const el = last[name] && q(`input[name="${name}"][value="${CSS.escape(last[name])}"]`); if (el && !(el.closest('.dv-opt') && el.closest('.dv-opt').hidden)) { el.checked = true; show(el); } });
            (last.models || []).forEach((id) => { const el = q(`input[name="models"][value="${CSS.escape(id)}"]`); if (el) el.checked = true; });
            if (takesEl && last.takes) takesEl.value = String(last.takes);
            if (last.research) {
                if (last.research.depth) { const d = q(`input[name="research_depth"][value="${CSS.escape(last.research.depth)}"]`); if (d) d.checked = true; }
                if (last.research.id) { const sel = q('select[name="research_id"]'); if (sel) sel.value = last.research.id; }
                if (last.research.ref) { const r = q('input[name="research_ref"]'); if (r) r.value = last.research.ref; }
                const tick = q('input[name="research"]'); if (tick) tick.checked = !last.research.id && !last.research.ref;
            }
        } catch { fitFrames(); fitExamples(); }
        fitModels(); fitResearch();
        const mods = all('.dv-mod');
        const closeMods = (except) => mods.forEach((m) => { if (m !== except) m.open = false; });
        form.addEventListener('change', (event) => {
            const input = event.target;
            if (input.name === 'kind') setKind(input.value);
            else if (input.name === 'models' || input.name === 'takes') fitModels();
            else if (input.name === 'start_url') setText('start', startUrl() ? (() => { try { return new URL(startUrl()).hostname; } catch { return 'A page'; } })() : 'Blank');
            else if (input.name === 'who') { all('input[name="models"]').forEach((x) => { x.checked = false; }); fitModels(); show(input); setTimeout(() => closeMods(null), 160); }
            else if (input.name === 'research' || input.name === 'research_depth' || input.name === 'research_id' || input.name === 'research_ref') { fitResearch(); }
            else if (input.closest('.dv-mod')) { show(input); setTimeout(() => closeMods(null), 160); }
            save(); askCost();
        });
        form.addEventListener('click', (event) => {
            const step = event.target.closest('[data-step]'); if (!step || !takesEl) return;
            takesEl.value = String(takesNow() + Number(step.dataset.step)); fitModels(); save(); askCost();
        });
        prompt.addEventListener('blur', askCost);
        const researchRef = q('input[name="research_ref"]');
        if (researchRef) researchRef.addEventListener('input', () => { fitResearch(); save(); askCost(); });
        mods.forEach((m) => m.addEventListener('toggle', () => { if (m.open) closeMods(m); }));
        document.addEventListener('click', (event) => { const open = mods.find((m) => m.open); if (open && (!open.contains(event.target) || event.target === open)) closeMods(null); });
        document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { const open = mods.find((m) => m.open); if (open) { closeMods(null); open.querySelector('summary').focus(); } } });
        prompt.addEventListener('keydown', (event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) form.requestSubmit(); });
        const busy = (on) => { if (!go) return; if (on) { go.setAttribute('aria-busy', 'true'); if (goLabel) goLabel.textContent = 'Drawing…'; } else { go.removeAttribute('aria-busy'); fitModels(); } };
        form.addEventListener('submit', async (event) => {
            if (!API || typeof fetch !== 'function') return busy(true);   // the plain form, as before
            event.preventDefault();
            if (!prompt.value.trim()) return prompt.focus();
            busy(true); closeMods(null);
            try {
                const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body()) });
                const out = await r.json().catch(() => ({}));
                if (!r.ok) { busy(false); return say(out.detail || out.title || 'The designs could not be started. Try again.', true); }
                location.href = out.editUrl || `/d/${encodeURIComponent(out.design.id)}`;
            } catch { busy(false); say('The designs could not be started: this page could not reach the server.', true); }
        });
        document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => {
            prompt.value = button.dataset.example;
            if (button.dataset.kind) { setKind(button.dataset.kind); save(); }
            prompt.focus(); askCost();
        }));
        return;
    }
    const canvas = document.querySelector('.dv-canvas');
    if (!canvas) return;
    const designId = canvas.dataset.id;
    const designKey = canvas.dataset.key;
    const picked = canvas.dataset.picked == null || canvas.dataset.picked === '' ? -1 : Number(canvas.dataset.picked);
    const status = document.getElementById('dv-status');
    const say = (text, isError = false) => {
        if (!status) return;
        status.textContent = text || '';
        status.classList.toggle('is-error', Boolean(isError));
    };
    const api = (path, body) => fetch(`/api/v1/designs/${encodeURIComponent(designId)}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(designKey ? { 'x-design-key': designKey } : {}) },
        body: JSON.stringify(body || {}),
    });
    const problem = async (response) => {
        try { const body = await response.json(); return body.detail || body.title || `Request failed (${response.status}).`; }
        catch { return `Request failed (${response.status}).`; }
    };
    const frames = () => [...canvas.querySelectorAll('.dv-card iframe')];

    // ── Device widths and theme repainting ──
    const device = document.getElementById('dv-device');
    device.value = '390';
    function resize() {
        const width = Number(device.value);
        frames().forEach(frame => {
            const box = frame.closest('.dv-frame');
            const scale = Math.min(1, box.clientWidth / width);
            frame.style.width = `${width}px`;
            frame.style.height = `${box.clientHeight / scale}px`;
            frame.style.transform = `scale(${scale})`;
        });
    }
    device.addEventListener('change', resize);
    window.addEventListener('resize', resize);
    resize();

    let cssByTheme = {};
    try { cssByTheme = JSON.parse(document.getElementById('dv-theme-css').textContent); } catch { /* form still works */ }
    const themeForm = document.getElementById('dv-theme-form');
    const themeSelect = document.getElementById('dv-theme');
    canvas.classList.add('dv-enhanced');
    frames().forEach(frame => frame.addEventListener('load', () => {
        const css = cssByTheme[themeSelect.value];
        if (css) frame.contentWindow.postMessage({ type: 'design-theme', css }, '*');
    }));
    themeSelect.addEventListener('change', () => themeForm.requestSubmit());
    themeForm.addEventListener('submit', async event => {
        event.preventDefault();
        const themeId = themeSelect.value;
        const css = cssByTheme[themeId];
        if (!css) { themeForm.submit(); return; }
        frames().forEach(frame => frame.contentWindow.postMessage({ type: 'design-theme', css }, '*'));
        try {
            const response = await api('/theme', { themeId });
            if (!response.ok) throw new Error(await problem(response));
        } catch (error) {
            say(error.message, true);
        }
    });

    // ── Pick one frame: one Arena vote, idempotent on the server ──
    document.getElementById('dv-rail').addEventListener('submit', async event => {
        const form = event.target.closest('form');
        const button = form && form.querySelector('.dv-pick');
        if (!button) return;
        event.preventDefault();
        const variantIndex = Number(button.dataset.pick);
        button.disabled = true;
        say('Choosing this frame…');
        try {
            const response = await api('/pick', { variantIndex });
            if (!response.ok) throw new Error(await problem(response));
            location.reload();
        } catch (error) {
            button.disabled = false;
            say(error.message, true);
        }
    });

    // ── Chat edit: progress and errors keep the last good version on screen ──
    const chatForm = document.getElementById('dv-chat-form');
    chatForm.addEventListener('submit', async event => {
        event.preventDefault();
        const input = document.getElementById('dv-instruction');
        const button = chatForm.querySelector('button[type=submit]');
        const editStatus = document.getElementById('dv-edit-status');
        const instruction = input.value.trim();
        const note = (text, isError = false) => {
            editStatus.textContent = text || '';
            editStatus.classList.toggle('is-error', Boolean(isError));
        };
        if (!instruction) { note('Describe the change first.', true); input.focus(); return; }
        button.disabled = true;
        input.disabled = true;
        note('Editing the working frame… this can take a moment.');
        try {
            const response = await api('/edit', { instruction });
            if (!response.ok) throw new Error(await problem(response));
            const body = await response.json();
            note(`Saved as version ${body.version ? body.version.seq : '—'}. Reloading…`);
            location.reload();
        } catch (error) {
            note(error.message, true);
            button.disabled = false;
            input.disabled = false;
        }
    });

    // ── Click edit: validate the iframe message before trusting any field ──
    const panel = document.getElementById('dv-element');
    const panelForm = document.getElementById('dv-element-form');
    const elementText = document.getElementById('dv-element-text');
    const elementNote = document.getElementById('dv-element-note');
    const elementColor = document.getElementById('dv-element-color');
    const elementSpacing = document.getElementById('dv-element-spacing');
    const elementAlign = document.getElementById('dv-element-align');
    const elementStatus = document.getElementById('dv-element-status');
    const elementClose = document.getElementById('dv-element-close');
    const pathPattern = /^body(?: > [a-z][a-z0-9-]*:nth-of-type\(\d{1,4}\))*$/;
    let selection = null;
    const panelSay = (text, isError = false) => {
        elementStatus.textContent = text || '';
        elementStatus.classList.toggle('is-error', Boolean(isError));
    };
    function closePanel() {
        panel.hidden = true;
        selection = null;
    }
    elementClose.addEventListener('click', closePanel);
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) closePanel(); });

    window.addEventListener('message', event => {
        if (picked < 0 || !event.data || typeof event.data !== 'object' || Array.isArray(event.data)) return;
        const data = event.data;
        if (data.type !== 'design-select') return;
        if (event.origin !== 'null' && event.origin !== '') return;
        const allowed = new Set(['type', 'path', 'tag', 'leaf', 'text']);
        if (!Object.keys(data).every(key => allowed.has(key))) return;
        if (typeof data.path !== 'string' || data.path.length > 400 || !pathPattern.test(data.path)) return;
        if (typeof data.tag !== 'string' || !/^[a-z][a-z0-9-]*$/.test(data.tag) || data.tag.length > 32) return;
        if (typeof data.leaf !== 'boolean' || typeof data.text !== 'string' || data.text.length > 400) return;
        const target = frames().find(frame => frame.contentWindow === event.source);
        if (!target || Number(target.closest('.dv-card').dataset.index) !== picked) return;
        selection = { path: data.path, tag: data.tag, leaf: data.leaf, text: data.text };
        document.getElementById('dv-element-tag').textContent = data.tag;
        elementText.value = data.text;
        elementText.disabled = !data.leaf;
        elementText.hidden = !data.leaf;
        elementNote.hidden = data.leaf;
        elementColor.value = '';
        elementSpacing.value = '';
        elementAlign.value = '';
        panelSay('');
        panel.hidden = false;
        if (data.leaf) elementText.focus(); else elementColor.focus();
    });

    panelForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!selection) return;
        const body = { path: selection.path };
        if (elementText.value !== selection.text) body.text = elementText.value;
        if (elementColor.value) body.color = elementColor.value;
        if (elementSpacing.value) body.spacing = elementSpacing.value;
        if (elementAlign.value) body.align = elementAlign.value;
        if (Object.keys(body).length === 1) { panelSay('Choose at least one change.', true); return; }
        const button = panelForm.querySelector('button[type=submit]');
        button.disabled = true;
        panelSay('Saving a new version…');
        try {
            const response = await api('/click', body);
            if (!response.ok) throw new Error(await problem(response));
            const saved = await response.json();
            panelSay(`Saved as version ${saved.version ? saved.version.seq : '—'}. Reloading…`);
            location.reload();
        } catch (error) {
            panelSay(error.message, true);
            button.disabled = false;
        }
    });

    if ([...canvas.querySelectorAll('.dv-card')].every(card => ['done', 'failed'].includes(card.dataset.status))) return;
    const url = `/api/v1/designs/${encodeURIComponent(designId)}${designKey ? `?key=${encodeURIComponent(designKey)}` : ''}`;
    const initial = [...canvas.querySelectorAll('.dv-card')].map(card => card.dataset.status).join(',');
    const researchState = () => {
        const box = canvas.querySelector('[data-dd-state]');
        return box ? box.dataset.ddState : '';
    };
    const stateOf = (research) => research ? `${research.status}|${((research.progress && research.progress.steps) || []).map((s) => s.state).join(',')}` : '';
    const initialResearch = researchState();
    const timer = setInterval(async () => {
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) return;
            const data = await response.json();
            if (data.variants.map(v => v.status).join(',') !== initial || stateOf(data.design && data.design.research) !== initialResearch) {
                clearInterval(timer);
                location.reload();
            }
        } catch { /* try the next poll */ }
    }, 1200);
})();
