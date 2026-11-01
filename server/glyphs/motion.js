'use strict';
/**
 * Icon motion (plan L50 step 7): six presets, each a single move when something happens. Nothing loops and nothing
 * spins; reduced motion (the system's, or OpenVibe's calm setting, html[data-ov-motion="reduced"]) stops them all.
 * The CSS is public/css/icon-motion.css (served as /icons/pack/ov-icon-motion.css); <ov-icon motion="…"> carries the
 * same moves in its own shadow.
 *
 *   PRESETS               [{ id, name, says, when }]
 *   suggest(glyph)        the preset that suits a glyph (a bell rings, a heart beats, an arrow leads)
 *   nudgeOf(glyph)        the way an arrow-like glyph leans: { x, y } in px
 *   CSS                   the stylesheet's text
 */
const fs = require('fs');
const path = require('path');

const PRESETS = Object.freeze([
    { id: 'draw', name: 'Draw in', says: 'Draws itself in, line by line, the first time it shows.', when: 'on show' },
    { id: 'pop', name: 'Press', says: 'Gives under the finger and springs back.', when: 'on press' },
    { id: 'nudge', name: 'Lead', says: 'Leans the way it leads when you point at it.', when: 'on point' },
    { id: 'ring', name: 'Ring', says: 'Swings like a bell, twice, when you point at it.', when: 'on point' },
    { id: 'beat', name: 'Beat', says: 'Beats once, like a heart, when you point at it.', when: 'on point' },
    { id: 'shake', name: 'Shake no', says: 'Shakes no, once, when something is refused (add is-no).', when: 'on refusal' },
]);

const NUDGE = { 'arrow-right': [2, 0], 'arrow-left': [-2, 0], back: [-2, 0], 'arrow-up': [0, -2], 'arrow-down': [0, 2], down: [0, 2], up: [0, -2],
    open: [2, -2], send: [2, -2], plane: [2, -2], forward: [2, 0], enter: [2, 0], leave: [2, 0], chevron: [2, 0], 'chevrons-right': [2, 0],
    'chevrons-left': [-2, 0], download: [0, 2], upload: [0, -2], reply: [-2, 0], 'fast-forward': [2, 0], rewind: [-2, 0], skip: [2, 0], share: [2, -2] };
const SUITS = {
    ring: ['bell', 'megaphone', 'phone', 'alert'],
    beat: ['heart', 'heart-pulse', 'star', 'thumbs-up', 'live', 'record', 'fire', 'spark', 'gift', 'trophy', 'crown'],
    draw: ['check', 'check-circle', 'check-double', 'signature', 'pencil', 'route', 'wave', 'chart', 'trend-up', 'timeline'],
    shake: ['ban', 'lock', 'x-circle', 'alert-circle', 'close'],
};

function suggest(glyph) {
    if (NUDGE[glyph]) return 'nudge';
    for (const [id, list] of Object.entries(SUITS)) if (list.includes(glyph)) return id;
    return 'pop';
}
const nudgeOf = (glyph) => { const d = NUDGE[glyph] || [2, 0]; return { x: d[0], y: d[1] }; };

const CSS = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'icon-motion.css'), 'utf8');

module.exports = { PRESETS, suggest, nudgeOf, CSS };
