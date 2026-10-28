'use strict';

/**
 * Constants and helpers shared between the legacy Arena tables and the Bench-backed store.
 */

const CATEGORIES = Object.freeze(['landing', 'dashboard', 'mobile_app', 'game_ui', 'logo', 'slides']);
const WINNERS = Object.freeze(['left', 'right', 'tie', 'both_bad']);
const K = 32;
const BASE_ELO = 1000;

class ArenaError extends Error {
    constructor(status, code, detail, extra = {}) {
        super(detail);
        this.name = 'ArenaError';
        this.status = status;
        this.code = code;
        this.detail = detail;
        this.extra = extra;
    }
}

/** Fisher–Yates, with an injectable random source so a test can pin the order. */
function shuffle(list, random = Math.random) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

module.exports = { ArenaError, CATEGORIES, WINNERS, K, BASE_ELO, shuffle };
