/**
 * The Arena's small in-browser conveniences. The pages work without this file: /arena/new is a real form that
 * posts to the page, /arena/vote is a real form that posts the winner, and every iframe is already sandboxed.
 *
 * With it, the vote and create forms stay on the page (fetch + JSON), a refusal is shown in words, and a round
 * that is still generating refreshes itself. Nothing from a model is ever inserted into this document.
 */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const status = (el, text) => { if (el) el.textContent = text; };

    async function postJson(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify(body),
            credentials: 'same-origin',
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
            const detail = json && (json.detail || json.title || json.code);
            throw new Error(detail || `The request failed (${res.status}).`);
        }
        return json;
    }

    const vote = $('ar-vote-form');
    if (vote) {
        vote.addEventListener('submit', async (event) => {
            const button = event.submitter;
            if (!button || !button.dataset.winner) return;
            event.preventDefault();
            const out = $('ar-vote-status');
            status(out, 'Recording your vote…');
            try {
                const data = await postJson('/api/v1/arena/vote', {
                    round_id: $('ar-vote-round').value,
                    left_output: $('ar-vote-left-id').value,
                    right_output: $('ar-vote-right-id').value,
                    winner: button.dataset.winner,
                });
                const left = data.revealed.left;
                const right = data.revealed.right;
                const reveal = document.createElement('div');
                reveal.id = 'ar-reveal';
                reveal.className = 'ar-reveal';
                for (const [side, o] of [['Left', left], ['Right', right]]) {
                    const box = document.createElement('div');
                    box.className = 'ar-reveal-side';
                    const h = document.createElement('h2');
                    h.textContent = side;
                    const p = document.createElement('p');
                    const b = document.createElement('b');
                    b.textContent = o.model;
                    p.append(b, document.createTextNode(o.provider ? ` · ${o.provider}` : ''));
                    const meta = document.createElement('p');
                    meta.className = 'ar-fine';
                    meta.textContent = `$${Number(o.cost_usd || 0).toFixed(4)} · ${o.ms} ms · ${o.tokens} tokens`;
                    box.append(h, p, meta);
                    reveal.append(box);
                }
                vote.replaceWith(reveal);
                status(out, `Vote recorded: ${data.vote.winner === 'both_bad' ? 'both bad' : data.vote.winner}. The models are revealed above.`);
            } catch (err) {
                status(out, err.message || 'The vote could not be recorded. Try again.');
            }
        });
    }

    const create = $('ar-new-form');
    if (create) {
        create.addEventListener('submit', async (event) => {
            if (create.getAttribute('data-json') === '0') return;
            event.preventDefault();
            const out = $('ar-new-status');
            status(out, 'Starting the round…');
            try {
                const data = await postJson('/api/v1/arena/rounds', {
                    category: $('ar-category').value,
                    prompt: $('ar-prompt').value,
                });
                window.location.assign(`/arena/r/${encodeURIComponent(data.round.id)}`);
            } catch (err) {
                status(out, err.message || 'The round could not be started. Try again.');
            }
        });
    }

    const round = $('ar-round');
    if (round) {
        const state = ($('ar-round-meta') || {}).textContent || '';
        if (/Status:\s*(queued|generating)/i.test(state)) setTimeout(() => window.location.reload(), 4000);
    }

    // Fit every generated frame to the column it sits in: a desktop frame fills the width, a phone stays a handset.
    var shots = document.querySelectorAll('.ar-shot');
    if (shots.length && 'ResizeObserver' in window) {
        document.documentElement.classList.add('ar-fit');
        var ro = new ResizeObserver(function (entries) {
            entries.forEach(function (entry) {
                var shot = entry.target, frame = shot.querySelector('.ar-shot-frame'), iframe = shot.querySelector('iframe');
                var w = entry.contentRect.width, base = Number(iframe && iframe.getAttribute('width')) || 1280;
                if (!frame || !w) return;
                var s = shot.classList.contains('ar-shot--phone') ? Math.min(0.72, (w - 14) / base) : w / base;
                frame.style.setProperty('--s', String(Math.max(0.12, s)));
            });
        });
        shots.forEach(function (shot) { ro.observe(shot); });
    }
})();
