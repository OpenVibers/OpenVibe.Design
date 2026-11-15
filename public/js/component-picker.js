/* The picker's live demo (/components/picker): Shared's ov-picker.js, exactly as the composer's chips and a session's
   context chip use it. A long list with sections and search, several at once with Done, and a short menu. A <select>
   is OVForms' (ov-forms.js), so it is not shown here. Nothing leaves this page. */
(function () {
    'use strict';
    function start() {
        const P = window.OpenVibePicker;
        const said = document.querySelector('[data-cr-pick-said]');
        if (!P || !said) return;
        const show = (k, v) => { const b = document.querySelector(`[data-cr-pick-v="${k}"]`); if (b) b.textContent = v; };
        let model = 'auto';
        let sources = ['web'];
        const MODELS = [
            { title: '', rows: [{ id: 'auto', name: 'Auto', line: 'The best fit for what you ask, within your budget' }] },
            { title: 'Anthropic', rows: [['opus', 'Opus 5.5', '$15 / $75 per 1M'], ['sonnet', 'Sonnet 5.5', '$3 / $15 per 1M'], ['haiku', 'Haiku 5.5', '$1 / $5 per 1M']].map(([id, name, line]) => ({ id, name, line })) },
            { title: 'Other labs', rows: [['gpt', 'GPT-6.1 Sol', 'OpenAI'], ['gemini', 'Gemini 4', 'Google'], ['qwen', 'Qwen 3.8 Max', 'Qwen'], ['kimi', 'Kimi K3', 'Moonshot'], ['glm', 'GLM-4.7-Flash', 'Z.ai · Free'], ['deepseek', 'DeepSeek V4', 'DeepSeek']].map(([id, name, line]) => ({ id, name, line, badge: /Free/.test(line) ? 'Free' : '' })) },
            { title: 'Your computers', rows: [{ id: 'llama', name: 'Llama 5 8B', line: 'Studio PC' }] },
        ];
        const SOURCES = [['web', 'Web'], ['news', 'News'], ['video', 'Video'], ['code', 'Code'], ['papers', 'Papers']].map(([id, name]) => ({ id, name }));
        document.addEventListener('click', (e) => {
            const b = e.target.closest('[data-cr-pick]');
            if (!b) return;
            const kind = b.getAttribute('data-cr-pick');
            if (kind === 'model') {
                P.open({ anchor: b, title: 'Model', sections: MODELS, value: model, search: 'auto', onPick: (row) => { model = row.id; show('model', row.name); said.textContent = `Picked ${row.name}.`; } });
            } else if (kind === 'sources') {
                P.open({ anchor: b, title: 'Sources', rows: SOURCES, value: sources, multi: true, onPick: (rows) => { sources = rows.map((r) => r.id); show('sources', rows.map((r) => r.name).join(', ') || 'None'); said.textContent = `Searching ${rows.length} source(s).`; } });
            } else {
                P.open({ anchor: b, title: 'This session', search: false, rows: [{ id: 'copy', name: 'Copy the link', line: 'For you or anyone you share it with' }, { id: 'new', name: 'New session', line: 'Start over with an empty box' }, { id: 'stop', name: 'Stop it', line: 'It stops after the step it is on' }], onPick: (row) => { said.textContent = `Chose: ${row.name}.`; } });
            }
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
