(function () {
    'use strict';
    const prompt = document.getElementById('dv-prompt');
    if (prompt) {
        document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => {
            prompt.value = button.dataset.example;
            prompt.focus();
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
    const timer = setInterval(async () => {
        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) return;
            const data = await response.json();
            if (data.variants.map(v => v.status).join(',') !== initial) {
                clearInterval(timer);
                location.reload();
            }
        } catch { /* try the next poll */ }
    }, 1200);
})();
