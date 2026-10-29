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
    const frames = () => [...canvas.querySelectorAll('.dv-card iframe')];
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
    canvas.classList.add('dv-enhanced');
    document.getElementById('dv-theme').addEventListener('change', () => themeForm.requestSubmit());
    themeForm.addEventListener('submit', async event => {
        event.preventDefault();
        const themeId = document.getElementById('dv-theme').value;
        const css = cssByTheme[themeId];
        if (!css) { themeForm.submit(); return; }
        frames().forEach(frame => frame.contentWindow.postMessage({ type: 'design-theme', css }, '*'));
        try {
            const response = await fetch(`/api/v1/designs/${encodeURIComponent(canvas.dataset.id)}/theme`, {
                method: 'POST', headers: { 'content-type': 'application/json', ...(canvas.dataset.key ? { 'x-design-key': canvas.dataset.key } : {}) },
                body: JSON.stringify({ themeId }),
            });
            if (!response.ok) throw new Error('Could not save the theme.');
        } catch (error) {
            document.getElementById('dv-status').textContent = error.message;
        }
    });

    if ([...canvas.querySelectorAll('.dv-card')].every(card => ['done', 'failed'].includes(card.dataset.status))) return;
    const url = `/api/v1/designs/${encodeURIComponent(canvas.dataset.id)}${canvas.dataset.key ? `?key=${encodeURIComponent(canvas.dataset.key)}` : ''}`;
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
