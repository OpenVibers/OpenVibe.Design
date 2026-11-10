(function () {
    'use strict';
    const root = document.querySelector('.cr');
    if (!root) return;
    root.querySelectorAll('form[action="#"]').forEach((form) => form.addEventListener('submit', (event) => event.preventDefault()));
    const cancel = document.querySelector('#cr-upload-cancel');
    if (cancel) cancel.addEventListener('click', () => {
        const progress = document.querySelector('.cr-upload progress');
        if (progress) progress.value = 0;
        const state = document.querySelector('#cr-upload-state');
        if (state) state.textContent = 'Cancelled';
        cancel.disabled = true;
    });

    const buttons = Array.from(root.querySelectorAll('[data-cr-play]'));
    if (!buttons.length) return;
    const loader = window.OpenVibeThemeLoader;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const off = () => document.documentElement.getAttribute('data-ov-motion') === 'off';
    let playHere = false;

    // The demos use the shared motion tokens (openvibe-shared/ov-fx.js); Play reads them at click time, after
    // Off's zero durations have been lifted for this page only (Calm keeps its own, calmer lengths).
    const tokenMs = (name, fallback) => {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        const value = parseFloat(raw);
        if (!Number.isFinite(value) || value <= 0) return fallback;
        return raw.endsWith('ms') ? value : value * 1000;
    };
    const tokenCurve = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

    const notice = document.createElement('div');
    notice.className = 'cr-motion-notice';
    notice.hidden = true;
    notice.innerHTML = '<span></span><div><button type="button" class="ovk-btn ovk-btn--quiet" data-play-here>Play animations here</button><button type="button" class="ovk-btn ovk-btn--quiet" data-turn-on>Turn animations on</button></div>';
    buttons[0].closest('.cr-demo').before(notice);

    const refresh = () => {
        notice.hidden = playHere || !off();
        notice.querySelector('span').textContent = 'Animations are off: your Motion setting is Off.';
    };
    notice.querySelector('[data-play-here]').addEventListener('click', () => {
        playHere = true;
        // This page only: the saved display setting is untouched.
        document.documentElement.removeAttribute('data-ov-motion');
        document.documentElement.classList.add('ov-demo-play');
        refresh();
        buttons[0].click();
    });
    notice.querySelector('[data-turn-on]').addEventListener('click', () => {
        if (loader && loader.display) loader.display.set({ motion: 'auto' });
        refresh();
    });
    media.addEventListener('change', refresh);
    new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['data-ov-motion'] });

    const frames = (kind) => kind === 'pop' ? [{ transform: 'scale(.7)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }]
        : kind === 'sheet' ? [{ transform: 'translateY(28px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }]
            : kind === 'menu' ? [{ transform: 'translateX(-20px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }]
                : null;
    const play = (button) => {
        const kind = button.getAttribute('data-cr-play');
        if (kind === 'tokens') {
            root.querySelectorAll('[data-cr-bar]').forEach((bar) => {
                if (!bar.animate) return;
                const step = Number(bar.getAttribute('data-cr-bar'));
                bar.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(180px)' }, { transform: 'translateX(0)' }], {
                    duration: tokenMs(`--ov-dur-${step}`, 120 * step), easing: tokenCurve('--ov-ease-out', 'cubic-bezier(.2,.8,.2,1)'),
                });
            });
            return;
        }
        const target = button.nextElementSibling;
        if (!target || !target.animate || !frames(kind)) return;
        target.animate(frames(kind), {
            duration: tokenMs(kind === 'sheet' ? '--ov-dur-3' : '--ov-dur-2', kind === 'sheet' ? 320 : 200),
            easing: tokenCurve(kind === 'pop' ? '--ov-ease-spring' : '--ov-ease-out', 'cubic-bezier(.2,.8,.2,1)'),
        });
    };
    buttons.forEach((button) => button.addEventListener('click', () => {
        if (!playHere && (calm() || media.matches)) return;
        play(button);
    }));
    refresh();
})();
