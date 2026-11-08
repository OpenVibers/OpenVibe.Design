/**
 * The Arena's small in-browser conveniences. The pages work without this file: /arena/new is a real form that
 * posts to the page, /arena/vote is a real form that posts the winner, and every iframe is already sandboxed.
 *
 * With it, the create form stays on the page (fetch + JSON) and a refusal is shown in words, a round that is still
 * generating refreshes itself, and on /arena a kind, a vote or the next pair swaps in place (the server's own page,
 * parsed, never a model's output). Nothing from a model is ever inserted into this document: it stays in the
 * sandboxed frames from Bench's render origin.
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

    // Fit every generated frame to the box it sits in. The box's size is set by CSS alone (so nothing moves when this
    // runs); only the drawing inside is scaled to it.
    var ro = 'ResizeObserver' in window ? new ResizeObserver(function (entries) {
        entries.forEach(function (entry) {
            var frame = entry.target, iframe = frame.querySelector('iframe');
            var w = frame.clientWidth, base = Number(iframe && iframe.getAttribute('width')) || 1280;
            if (w) frame.style.setProperty('--s', String(Math.max(0.12, w / base)));
        });
    }) : null;
    function fit(root) {
        if (!ro) return;
        document.documentElement.classList.add('ar-fit');
        root.querySelectorAll('.ar-shot-frame').forEach(function (frame) { ro.observe(frame); });
    }
    fit(document);

    // The arena page itself: choosing a kind, voting and "Next pair" swap the pair and the boards in place, with a
    // short transition, instead of loading the whole page again and jumping to the anchor. Every link and the vote
    // form still work as plain navigation and a plain form post when this does not run.
    var home = $('ar-home');
    if (!home || !window.fetch || !window.DOMParser || !window.history || !history.pushState) return;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var busy = null;

    // A frame swapped in fades in once it has drawn, over a quiet placeholder, instead of flashing white.
    function waitForFrames(root) {
        root.querySelectorAll('.ar-shot-frame, .ar-art').forEach(function (box) {
            var iframe = box.querySelector('iframe');
            if (!iframe) return;
            box.classList.add('ar-wait');
            var done = function () { box.classList.add('is-loaded'); };
            iframe.addEventListener('load', done, { once: true });
            setTimeout(done, 5000);
        });
    }

    // Keep the viewport the person chose (Desktop or Phone) across pairs.
    var view = null;
    home.addEventListener('change', function (event) {
        var t = event.target;
        if (t && t.name === 'ar_view') view = t.value;
    });

    function railCurrent(kind) {
        home.querySelectorAll('.ar-kind').forEach(function (a) {
            if (a.getAttribute('data-kind') === kind) a.setAttribute('aria-current', 'page');
            else a.removeAttribute('aria-current');
        });
    }

    // Bring the pair into view when it is not (a board's "Judge", "Next pair" from far down the page).
    function reveal() {
        var rail = $('ar-kinds') || $('ar-pair');
        if (!rail) return;
        var top = rail.getBoundingClientRect().top;
        var bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ovnav-h')) || 64;
        if (top < bar || top > window.innerHeight * 0.6) {
            window.scrollTo({ top: Math.max(0, window.scrollY + top - bar - 8), behavior: reduced ? 'auto' : 'smooth' });
        }
    }

    async function swap(url, init, opts) {
        if (busy) busy.abort();
        var ctl = busy = new AbortController();
        var slow = setTimeout(function () { home.classList.add('is-loading'); }, 140);
        try {
            var res = await fetch(url, Object.assign({ credentials: 'same-origin', headers: { accept: 'text/html' }, signal: ctl.signal }, init || {}));
            var doc = new DOMParser().parseFromString(await res.text(), 'text/html');
            var next = doc.getElementById('ar-home');
            if (!next || !doc.getElementById('ar-pair')) { window.location.assign(res.redirected ? res.url : (opts.fallback || url)); return; }
            var apply = function () {
                ['ar-pair', 'ar-boards', 'ar-total'].forEach(function (id) {
                    var mine = $(id), theirs = doc.getElementById(id);
                    if (!mine || !theirs) return;
                    if (ro) mine.querySelectorAll('.ar-shot-frame').forEach(function (f) { ro.unobserve(f); });
                    var node = document.importNode(theirs, true);
                    waitForFrames(node);
                    mine.replaceWith(node);
                });
                var kind = next.getAttribute('data-kind');
                home.setAttribute('data-kind', kind);
                railCurrent(kind);
                if (doc.title) document.title = doc.title;
                if (view) { var r = $('ar-view-' + view); if (r) r.checked = true; }
                fit($('ar-pair') || document);
            };
            if (document.startViewTransition && !reduced) {
                var vt = document.startViewTransition(apply);
                await vt.updateCallbackDone;
            } else apply();
            if (opts.push) {
                if (opts.push === window.location.pathname + window.location.search) history.replaceState({ arena: true }, '', opts.push);
                else history.pushState({ arena: true }, '', opts.push);
            }
            if (opts.reveal) reveal();
        } catch (err) {
            if (err && err.name === 'AbortError') return;
            window.location.assign(opts.fallback || url);
        } finally {
            clearTimeout(slow);
            if (busy === ctl) { busy = null; home.classList.remove('is-loading'); }
        }
    }

    // Same-page arena links: a kind in the rail, a board's "Judge", "Next pair", whose votes the boards count.
    home.addEventListener('click', function (event) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        var a = event.target.closest && event.target.closest('a[href]');
        if (!a || !home.contains(a)) return;
        var u = new URL(a.href, window.location.href);
        if (u.origin !== window.location.origin || u.pathname !== '/arena') return;
        event.preventDefault();
        var kind = u.searchParams.get('kind');
        if (kind && a.classList.contains('ar-kind')) railCurrent(kind);
        swap(u.pathname + u.search, null, { push: u.pathname + u.search, reveal: u.hash !== '#ar-boards', fallback: u.href });
    });

    // The vote: the tapped side lights up at once, the answer (the two models, the boards moved) swaps in.
    home.addEventListener('submit', function (event) {
        var form = event.target;
        if (!form || form.id !== 'ar-judge') return;
        var button = event.submitter;
        var winner = button && button.getAttribute('data-winner');
        if (!winner) return;
        event.preventDefault();
        var body = new URLSearchParams();
        new FormData(form).forEach(function (v, k) { body.append(k, v); });
        body.set('winner', winner);
        var pair = $('ar-vote-pair');
        if (pair) pair.setAttribute('data-pick', winner);
        form.querySelectorAll('button[type=submit]').forEach(function (b) { b.disabled = true; });
        swap('/arena/vote', { method: 'POST', body: body, headers: { accept: 'text/html', 'content-type': 'application/x-www-form-urlencoded' } },
            { fallback: window.location.href, reveal: false });
    });

    window.addEventListener('popstate', function () {
        var u = new URL(window.location.href);
        if (u.pathname === '/arena') swap(u.pathname + u.search, null, { fallback: u.href });
    });
})();
