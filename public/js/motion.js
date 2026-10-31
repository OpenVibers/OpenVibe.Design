/**
 * /motion's conveniences (server/views/motion.js): "Play it again" replays the hero mark's intro (OVMark.intro), and
 * "Race the curves" sends a dot along each shared curve at once, so the three can be told apart. The effects
 * themselves are openvibe-shared/ov-fx's (the navbar loads it for data-fx). Without JavaScript both buttons stay hidden.
 */
(function () {
    'use strict';
    const replay = document.querySelector('[data-mo-replay]');
    const hero = document.querySelector('[data-mo-hero]');
    if (replay && hero) {
        replay.hidden = false;
        replay.addEventListener('click', () => { if (window.OVMark && window.OVMark.intro) window.OVMark.intro(hero); });
    }
    const run = document.querySelector('[data-mo-run]');
    const races = Array.from(document.querySelectorAll('[data-mo-race]'));
    if (run && races.length) {
        run.hidden = false;
        run.addEventListener('click', () => {
            races.forEach((r) => r.classList.remove('is-run'));
            void document.body.offsetWidth;   // start from the left again
            races.forEach((r) => r.classList.add('is-run'));
        });
    }
})();
