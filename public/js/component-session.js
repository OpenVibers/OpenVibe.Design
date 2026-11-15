/* The session's live demo (/components/session): Shared's ov-session.js, exactly as the menu's Vibe, Codes' home and
   Actor's chat mount it, over a Frame recorded on this page (a fetch stand-in for one address only): a coding session
   with its plan, the tools it used, the files it changed and their diffs, an answered approval, a helper, and the
   words streaming in. Nothing leaves this page. */
(function () {
    'use strict';
    const BASE = `${location.origin}/__demo-frame`;
    const iso = (s) => new Date(Date.now() - s * 1000).toISOString();
    const run = { ref: 'codes:demo', kind: 'code', title: 'Add a dark mode switch to the settings page', status: 'running', created_at: iso(134), started_at: iso(134), cost: { usd: 0.034 }, doing: { text: 'Running the tests' }, agent: { id: 'claude-code', name: 'Claude Code', hue: 25, glyph: 'code' }, model: { name: 'Sonnet 5.5' }, where: { kind: 'machine', name: 'Studio PC' }, target: { repo: 'ada/settings-site' } };
    const T = (seq, x) => ({ seq, status: 'done', from: 'agent', started_at: iso(130 - seq * 6), ended_at: iso(127 - seq * 6), ...x });
    const steps = [
        T(1, { kind: 'message', from: 'person', text: 'Add a dark mode switch to the settings page. It should remember the choice.' }),
        T(2, { kind: 'think', text: 'The page is server-rendered: a class on <html> and a saved choice.' }),
        T(3, { kind: 'tool', tool_call: { name: 'TodoWrite', input: { todos: [{ content: 'Find the settings page', status: 'completed' }, { content: 'Add the switch', status: 'completed' }, { content: 'Remember the choice', status: 'in_progress' }, { content: 'Run the tests', status: 'pending' }] } } }),
        T(4, { kind: 'tool', tool_call: { name: 'Read', input: { file_path: 'src/pages/settings.html' } }, text: '<h1>Settings</h1>' }),
        T(5, { kind: 'tool', tool_call: { name: 'Grep', input: { pattern: 'data-theme' } }, text: 'src/css/base.css:4: html[data-theme="dark"] {' }),
        T(6, { kind: 'message', text: 'The dark colours are in **base.css** already, so the switch only sets `data-theme` and keeps it:\n\n1. a labelled switch\n2. the choice in `localStorage`\n3. set before the first paint' }),
        T(7, { kind: 'tool', tool_call: { name: 'Edit', input: { file_path: 'src/pages/settings.html', old_string: '<h2>Appearance</h2>', new_string: '<h2>Appearance</h2>\n<label class="switch"><input type="checkbox" role="switch"> Dark mode</label>' } } }),
        T(8, { kind: 'tool', tool_call: { name: 'Write', input: { file_path: 'src/js/theme-early.js', content: "const t = localStorage.getItem('theme');\nif (t) document.documentElement.dataset.theme = t;" } } }),
        T(9, { kind: 'approval', title: 'Run the tests on Studio PC?', text: 'It runs `npm test` in ada/settings-site.', result: { approval: 'a1', answer: 'approve', answer_label: 'Run them' } }),
        T(10, { kind: 'child', title: 'A helper checks the page in a browser', text: 'Both widths look right', child_run: 'codes:demo-helper' }),
        T(11, { kind: 'tool', status: 'running', ended_at: null, tool_call: { name: 'Bash', input: { command: 'npm test' } } }),
    ];
    const helper = [{ seq: 1, kind: 'message', from: 'person', text: 'Check the page at two widths.' }, { seq: 2, kind: 'message', from: 'agent', text: 'Both widths look right; nothing scrolls sideways.' }];
    const others = [
        { ref: 'actor:demo', kind: 'task', title: 'Book a table for Friday', status: 'waiting', waiting: { for: 'approval' }, created_at: iso(900), updated_at: iso(600), agent: { name: 'Actor', hue: 265, glyph: 'robot' } },
        { ref: 'chat:demo', kind: 'chat', title: 'A good first synth', status: 'waiting', waiting: { for: 'message' }, preview: { text: 'One with a good filter.' }, created_at: iso(5000), updated_at: iso(4000), agent: { name: 'Vibe', glyph: 'chat' } },
    ];
    const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
    const stream = () => {
        const enc = new TextEncoder();
        const body = new ReadableStream({ start(c) {
            setTimeout(() => c.enqueue(enc.encode(`id: 12\nevent: step\ndata: ${JSON.stringify({ step: { seq: 12, kind: 'message', from: 'agent', status: 'running', text: 'All 48 tests pass.' } })}\n\n`)), 900);
            setTimeout(() => c.enqueue(enc.encode(`event: delta\ndata: ${JSON.stringify({ seq: 12, text: ' Opening the pull request now.' })}\n\n`)), 1700);
        } });
        return Promise.resolve(new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }));
    };
    const real = window.fetch.bind(window);
    window.fetch = (url, init) => {
        const u = String(url);
        if (!u.startsWith(BASE)) return real(url, init);
        const path = u.slice(BASE.length).split('?')[0];
        if (path === '/runs' && (!init || !init.method || init.method === 'GET')) return json({ runs: [run, ...others], partial: [] });
        if (path === '/runs' && init && init.method === 'POST') return json({ ...run, ref: 'codes:demo-new', title: 'Your new session', status: 'done' }, 201);
        if (path === '/run-options') return json({ agents: [{ id: 'auto', name: 'Auto', kind: 'auto' }, { id: 'actor', name: 'Actor', kind: 'actor' }, { id: 'codes', name: 'Codes', kind: 'codes' }, { id: 'claude-code', name: 'Claude Code', kind: 'harness' }], places: [{ kind: 'auto', name: 'Auto' }, { kind: 'machine', id: 'dev_1', name: 'Studio PC' }] });
        if (path === '/choices') return json({ groups: [{ id: 'openvibe', title: 'OpenVibe', rows: [{ model: 'anthropic/claude-sonnet-5-5', name: 'Sonnet 5.5', maker: 'Anthropic' }, { model: 'glm/glm-4.7-flash', name: 'GLM-4.7-Flash', free: true }] }] });
        const m = /^\/runs\/([^/]+)(\/.*)?$/.exec(path);
        if (m) {
            const ref = decodeURIComponent(m[1]);
            const rest = m[2] || '';
            if (rest === '/events') return ref === 'codes:demo' ? stream() : json({}, 204);
            if (rest === '/steps') return json({ steps: ref === 'codes:demo' ? steps : ref === 'codes:demo-helper' ? helper : [{ seq: 1, kind: 'message', from: 'person', text: (others.find((r) => r.ref === ref) || {}).title || 'Hello' }] });
            if (!rest) return json(ref === 'codes:demo' ? run : ref === 'codes:demo-helper' ? { ref, kind: 'code', title: 'A helper checks the page in a browser', status: 'done' } : (others.find((r) => r.ref === ref) || run));
            return json({ ok: true });
        }
        return json({ error: 'Not in this demo' }, 404);
    };
    function start() {
        const host = document.getElementById('cr-session');
        if (!host || !window.OpenVibeSession) return;
        window.OpenVibeSession.mount(host, {
            base: BASE, token: 'demo', sibling: (f) => `/shared/${f}`, open: 'codes:demo',
            works: [{ value: 'ada/settings-site', name: 'ada/settings-site', line: 'On OpenVibe.Git' }],
            starters: [['code', 'Build me a landing page for my band'], ['globe', 'What changed in AI this week?']],
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
