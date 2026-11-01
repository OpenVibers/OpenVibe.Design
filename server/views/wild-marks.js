'use strict';
/**
 * The third choice on /brand/explore, the Wildcards (the owner, 2026-11-01: "an option 3… wildly different variations…
 * 40 of them… be thoughtful about animations… status icons… how the label could be attached"; then, the same night:
 * "remake all the wildcards… they're not related to OpenVibe or OV… make them specific, branded to our vibe").
 *
 * Every one is the letters O and V themselves, forty treatments (then, again: "some still feel dumb and unrelated, like
 * the rocket" — so no object that hides the letters): made new (script, stencil, neon, blocks, a tag), monograms
 * (woven, linked, a coin, an app tile, a crest), print and paper (riso, cut-out, folded, long shadow, embossed), screen
 * and light (glitch, chrome, a terminal, seven segments, aurora), signals (a pin, play, a signal, a heartbeat, an
 * orbit), hand-made (marker, brush, puffy, stripes, elegant), built from parts (pixels, stars, halftone, tiles, a
 * patch) and a feel (liquid, glass, a ribbon, a sticker, a face).
 *
 * Each drawing says:
 *   - its motion (data-wild-motion on the card's SVG; parts w-a, w-b, w-c move), animated by css/marks.css only while
 *     the card is on screen and never under reduced motion;
 *   - its key part (w-k): what lights up when the mark shows a status (live: red and pulsing; new: a count);
 *   - its lockup: how the name attaches (side, pill, under, bubble, stack, tag, trail).
 * Every drawing is a function of an id prefix, so a mark can be drawn more than once on a page with unique ids.
 */

const BV = [['0', '#4f7cff'], ['1', '#8b5cf6']];
const WARM = [['0', '#fde68a'], ['1', '#f97316']];
const lin = (id, stops, x1 = 0, y1 = 0, x2 = 1, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
const rad = (id, stops) => `<radialGradient id="${id}" cx=".35" cy=".3" r=".8">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</radialGradient>`;
const R = 'stroke-linecap="round" stroke-linejoin="round"';
const g = (id) => lin(`${id}g`, BV);

const ART = {
    // ── Letters, made new ──
    script(id) {   // a handwritten "ov" in one stroke that draws itself
        return { defs: g(id), body: `<path class="w-a w-k" pathLength="100" d="M33 41 C22 40 14 48 14 57 C14 67 21 74 31 74 C40 74 47 66 47 57 C47 50 43 44 37 42 C44 45 51 46 57 41 L70 75 L87 31" fill="none" stroke="url(#${id}g)" stroke-width="8.5" ${R}/>` };
    },
    stencil(id) {   // a stencil O and V, cut with bridges; the pieces close up
        return {
            defs: g(id) + `<mask id="${id}m"><rect width="100" height="100" fill="#fff"/><path d="M48 51 H98" stroke="#000" stroke-width="4.5"/></mask>`,
            body: `<g class="w-a"><circle cx="31" cy="51" r="19" fill="none" stroke="url(#${id}g)" stroke-width="13" stroke-dasharray="54.7 5" transform="rotate(-92.4 31 51)"/></g>`
                + `<g class="w-b w-k" mask="url(#${id}m)"><path d="M53 25 H66 L72 50 L78 25 H91 L78 77 H66Z" fill="url(#${id}g)"/></g>`,
        };
    },
    neon(id) {   // neon tubes, pink and blue, flickering on
        const f = `<filter id="${id}f" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
        return {
            defs: f,
            body: `<g class="w-a" filter="url(#${id}f)"><circle class="w-k" cx="31" cy="52" r="18" fill="none" stroke="#f472b6" stroke-width="6"/><circle cx="31" cy="52" r="18" fill="none" stroke="#fdf2f8" stroke-width="1.8"/></g>`
                + `<g class="w-b" filter="url(#${id}f)"><path d="M57 33 L71 72 L85 33" fill="none" stroke="#22d3ee" stroke-width="6" ${R}/><path d="M57 33 L71 72 L85 33" fill="none" stroke="#ecfeff" stroke-width="1.8" ${R}/></g>`,
        };
    },
    block3d(id) {   // solid block letters with depth
        const shapes = (dx, dy, stroke) => `<circle cx="${31 + dx}" cy="${48 + dy}" r="17" fill="none" stroke="${stroke}" stroke-width="12"/><path d="M${55 + dx} ${30 + dy} L${69 + dx} ${68 + dy} L${83 + dx} ${30 + dy}" fill="none" stroke="${stroke}" stroke-width="12" ${R}/>`;
        let depth = '';
        for (let i = 6; i >= 1; i -= 1) depth += shapes(i * 0.9, i * 1.1, i > 3 ? '#1e1b4b' : '#312e81');
        return { defs: g(id), body: `<g class="w-a">${depth}<g class="w-k">${shapes(0, 0, `url(#${id}g)`)}</g></g>` };
    },
    tag(id) {   // a graffiti tag, still wet
        return {
            defs: lin(`${id}g`, [['0', '#22d3ee'], ['.5', '#4f7cff'], ['1', '#a855f7']]),
            body: `<ellipse class="w-k" cx="31" cy="48" rx="18" ry="22" transform="rotate(-14 31 48)" fill="none" stroke="url(#${id}g)" stroke-width="11"/>`
                + `<path d="M52 24 Q60 50 67 74 Q76 46 91 21" fill="none" stroke="url(#${id}g)" stroke-width="11" ${R}/>`
                + `<g stroke="#a855f7" stroke-linecap="round"><path class="w-a" d="M28 70 V82" stroke-width="5"/><path class="w-a" style="--i:1" d="M67 76 V90" stroke-width="5"/><path class="w-a" style="--i:2" d="M42 64 V71" stroke-width="3.5"/></g>`
                + `<path d="M20 36 Q24 30 30 29" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>`,
        };
    },
    // ── Monograms ──
    crossed(id) {   // a V woven through an O
        return {
            defs: '',
            body: `<g class="w-a"><circle class="w-k" cx="50" cy="50" r="24" fill="none" stroke="#4f7cff" stroke-width="9"/>`
                + `<path d="M24 18 L50 86 L76 18" fill="none" stroke="#8b5cf6" stroke-width="9" ${R}/>`
                + `<path d="M58.2 72.6 A24 24 0 0 1 51.2 74" fill="none" stroke="#4f7cff" stroke-width="9"/>`
                + `<path d="M31.6 34.6 A24 24 0 0 1 36 30.5" fill="none" stroke="#4f7cff" stroke-width="9"/></g>`,
        };
    },
    chain(id) {   // an O and a V linked like a chain
        return {
            defs: '',
            body: `<g class="w-a"><circle class="w-k" cx="40" cy="54" r="19" fill="none" stroke="#4f7cff" stroke-width="8"/>`
                + `<path d="M50 26 H88 L69 78Z" fill="none" stroke="#8b5cf6" stroke-width="8" stroke-linejoin="round"/>`
                + `<path d="M55.4 39.4 A19 19 0 0 1 58.4 44.8" fill="none" stroke="#4f7cff" stroke-width="8"/></g>`,
        };
    },
    coin(id) {   // an OpenVibe coin with OV struck on it
        return {
            defs: lin(`${id}c`, [['0', '#fef3c7'], ['.5', '#fbbf24'], ['1', '#d97706']]) + lin(`${id}s`, [['0', '#fff', 0], ['.5', '#fff', 0.55], ['1', '#fff', 0]], 0, 0, 1, 0)
                + `<clipPath id="${id}k"><circle cx="50" cy="50" r="40"/></clipPath>`,
            body: `<circle class="w-k" cx="50" cy="50" r="40" fill="url(#${id}c)"/><circle cx="50" cy="50" r="40" fill="none" stroke="#b45309" stroke-width="3" stroke-dasharray="2 2.2"/><circle cx="50" cy="50" r="32" fill="none" stroke="#fffbeb" stroke-width="1.6" opacity=".7"/>`
                + `<circle cx="38" cy="50" r="9.5" fill="none" stroke="#92400e" stroke-width="5.5"/><path d="M53 40 L60.5 60 L68 40" fill="none" stroke="#92400e" stroke-width="5.5" ${R}/>`
                + `<g clip-path="url(#${id}k)"><rect class="w-a" x="-40" y="0" width="26" height="100" fill="url(#${id}s)" transform="skewX(-20)"/></g>`,
        };
    },
    tile(id) {   // ov on an app tile, with a shine
        return {
            defs: g(id) + lin(`${id}s`, [['0', '#fff', 0], ['.5', '#fff', 0.45], ['1', '#fff', 0]], 0, 0, 1, 0) + `<clipPath id="${id}c"><rect x="10" y="10" width="80" height="80" rx="26"/></clipPath>`,
            body: `<rect class="w-k" x="10" y="10" width="80" height="80" rx="26" fill="url(#${id}g)"/><g clip-path="url(#${id}c)"><rect class="w-a" x="-40" y="0" width="30" height="100" fill="url(#${id}s)" transform="skewX(-20)"/></g>`
                + `<circle cx="37" cy="55" r="11.5" fill="none" stroke="#fff" stroke-width="8.5"/><path d="M55 44 L65 67 L75 44" fill="none" stroke="#fff" stroke-width="8.5" ${R}/>`,
        };
    },
    crest(id) {   // an O over a V on a shield
        return {
            defs: g(id) + lin(`${id}s`, [['0', '#fff', 0], ['.5', '#fff', 0.4], ['1', '#fff', 0]], 0, 0, 1, 0) + `<clipPath id="${id}c"><path d="M50 7 L85 19 V47 C85 70 69 85 50 93 C31 85 15 70 15 47 V19Z"/></clipPath>`,
            body: `<path class="w-k" d="M50 7 L85 19 V47 C85 70 69 85 50 93 C31 85 15 70 15 47 V19Z" fill="url(#${id}g)"/><g clip-path="url(#${id}c)"><rect class="w-a" x="-40" y="0" width="24" height="100" fill="url(#${id}s)" transform="skewX(-20)"/></g>`
                + `<circle cx="50" cy="35" r="9" fill="none" stroke="#fff" stroke-width="5.5"/><path d="M37 50 L50 75 L63 50" fill="none" stroke="#fff" stroke-width="7" ${R}/>`,
        };
    },
    pin(id) {   // a map pin is an O on a V: you are here
        return {
            defs: lin(`${id}g`, BV, 0, 0, 0, 1),
            body: `<ellipse class="w-b" cx="50" cy="92" rx="13" ry="3.5" fill="#4f7cff" opacity=".3"/><g class="w-a"><circle class="w-k" cx="50" cy="33" r="17" fill="none" stroke="url(#${id}g)" stroke-width="10"/><path d="M36 45 L50 87 L64 45" fill="none" stroke="url(#${id}g)" stroke-width="10" ${R}/></g>`,
        };
    },
    // ── Print and paper ──
    riso(id) {   // two inks printed a little out of register; they slide into place
        const ov = (c) => `<circle cx="31" cy="50" r="17" fill="none" stroke="${c}" stroke-width="12"/><path d="M56 32 L69 70 L82 32" fill="none" stroke="${c}" stroke-width="12" ${R}/>`;
        return { defs: '', body: `<g class="w-a" opacity=".9" transform="translate(-2.5 -2)">${ov('#f472b6')}</g><g class="w-b w-k" opacity=".85" transform="translate(2.5 2)">${ov('#4f7cff')}</g>` };
    },
    papercut(id) {   // OV cut out of a card, a lighter layer showing through
        return {
            defs: g(id) + `<mask id="${id}m"><rect width="100" height="100" fill="#fff"/><g fill="none" stroke="#000" stroke-width="12" ${R}><circle cx="34" cy="50" r="14"/><path d="M57 34 L69 68 L81 34"/></g></mask>`,
            body: `<g class="w-a"><rect x="10" y="10" width="80" height="80" rx="20" fill="#c4b5fd"/><g fill="none" stroke="#7c6cf0" stroke-width="12" ${R} transform="translate(2.5 2.5)"><circle cx="34" cy="50" r="14"/><path d="M57 34 L69 68 L81 34"/></g>`
                + `<rect class="w-k" x="10" y="10" width="80" height="80" rx="20" fill="url(#${id}g)" mask="url(#${id}m)"/></g>`,
        };
    },
    folded(id) {   // OV folded from paper: a light face and a shadowed one
        return {
            defs: lin(`${id}o`, [['0', '#c7d2fe'], ['.5', '#818cf8'], ['.5', '#5b21b6'], ['1', '#7c3aed']], 0, 0, 1, 1),
            body: `<g class="w-a"><path class="w-k" d="M24 33 H38 L48 43 V57 L38 67 H24 L14 57 V43Z" fill="none" stroke="url(#${id}o)" stroke-width="11" stroke-linejoin="miter"/>`
                + `<path d="M55 30 L69 72" stroke="#a5b4fc" stroke-width="11" stroke-linecap="butt"/><path d="M83 30 L69 72" stroke="#6d28d9" stroke-width="11" stroke-linecap="butt"/><path d="M64.5 70 L69 74 L73.5 70Z" fill="#4c1d95"/></g>`,
        };
    },
    longshadow(id) {   // white OV casting a long shadow on a disc
        const ov = (dx, extra) => `<g transform="translate(${dx} ${dx})" ${extra}><circle cx="31" cy="48" r="14" fill="none" stroke-width="10"/><path d="M53 33 L65 65 L77 33" fill="none" stroke-width="10" ${R}/></g>`;
        let shadow = '';
        for (let i = 1; i <= 22; i += 1) shadow += ov(i * 1.1, 'stroke="#1e1b4b" opacity=".55"');
        return {
            defs: g(id) + `<clipPath id="${id}c"><circle cx="50" cy="50" r="42"/></clipPath>`,
            body: `<circle class="w-k" cx="50" cy="50" r="42" fill="url(#${id}g)"/><g clip-path="url(#${id}c)">${shadow}</g><g class="w-a">${ov(0, 'stroke="#fff"')}</g>`,
        };
    },
    emboss(id) {   // OV pressed into a plate
        const ov = (dx, c) => `<g transform="translate(${dx} ${dx})" fill="none" stroke="${c}" stroke-width="9" ${R}><circle cx="34" cy="50" r="13"/><path d="M57 36 L68 66 L79 36"/></g>`;
        return {
            defs: g(id) + lin(`${id}s`, [['0', '#fff', 0], ['.5', '#fff', 0.35], ['1', '#fff', 0]], 0, 0, 1, 0) + `<clipPath id="${id}c"><rect x="8" y="16" width="84" height="68" rx="16"/></clipPath>`,
            body: `<rect class="w-k" x="8" y="16" width="84" height="68" rx="16" fill="url(#${id}g)"/>${ov(-1.2, '#2e1065')}${ov(1.2, '#c7d2fe')}${ov(0, '#6d5ff7')}`
                + `<g clip-path="url(#${id}c)"><rect class="w-a" x="-40" y="0" width="24" height="100" fill="url(#${id}s)" transform="skewX(-20)"/></g>`,
        };
    },
    // ── Screen and light ──
    glitch(id) {   // OV on a screen that glitches: the colour channels slip
        const ov = (c, w) => `<circle cx="31" cy="50" r="17" fill="none" stroke="${c}" stroke-width="${w}"/><path d="M56 32 L69 70 L82 32" fill="none" stroke="${c}" stroke-width="${w}" ${R}/>`;
        return {
            defs: `<clipPath id="${id}c"><rect x="0" y="44" width="100" height="7"/></clipPath>`,
            body: `<g class="w-a" transform="translate(-3 0)" opacity=".85">${ov('#22d3ee', 11)}</g><g class="w-b" transform="translate(3 0)" opacity=".85">${ov('#f0f', 11)}</g><g class="w-k">${ov('#fff', 9)}</g>`
                + `<g clip-path="url(#${id}c)" transform="translate(6 0)">${ov('#e0e7ff', 9)}</g>`,
        };
    },
    chrome(id) {   // polished chrome letters with a moving shine
        return {
            defs: lin(`${id}m`, [['0', '#f8fafc'], ['.42', '#94a3b8'], ['.5', '#334155'], ['.62', '#cbd5e1'], ['1', '#f1f5f9']], 0, 0, 0, 1)
                + lin(`${id}s`, [['0', '#fff', 0], ['.5', '#fff', 0.8], ['1', '#fff', 0]], 0, 0, 1, 0)
                + `<mask id="${id}k"><g fill="none" stroke="#fff" stroke-width="13" ${R}><circle cx="31" cy="50" r="17"/><path d="M56 32 L69 70 L82 32"/></g></mask>`,
            body: `<g fill="none" stroke="#475569" stroke-width="15.5" ${R}><circle cx="31" cy="50" r="17"/><path d="M56 32 L69 70 L82 32"/></g>`
                + `<g class="w-k" fill="none" stroke="url(#${id}m)" stroke-width="13" ${R}><circle cx="31" cy="50" r="17"/><path d="M56 32 L69 70 L82 32"/></g>`
                + `<g mask="url(#${id}k)"><rect class="w-a" x="-40" y="0" width="18" height="100" fill="url(#${id}s)" transform="skewX(-20)"/></g>`,
        };
    },
    terminal(id) {   // ov_ in a terminal, the cursor blinking
        return {
            defs: '',
            body: `<rect x="6" y="18" width="88" height="64" rx="12" fill="#0b1020" stroke="#4f7cff" stroke-width="3"/><circle cx="17" cy="28" r="2.6" fill="#f87171"/><circle cx="25" cy="28" r="2.6" fill="#fbbf24"/><circle cx="33" cy="28" r="2.6" fill="#34d399"/>`
                + `<path d="M15 46 L22 53 L15 60" fill="none" stroke="#8b5cf6" stroke-width="3.5" ${R}/><circle class="w-k" cx="36" cy="57" r="7.5" fill="none" stroke="#e0e7ff" stroke-width="4.5"/><path d="M48 49 L55 66 L62 49" fill="none" stroke="#e0e7ff" stroke-width="4.5" ${R}/>`
                + `<rect class="w-a" x="67" y="63" width="12" height="4.5" rx="1" fill="#22d3ee"/>`,
        };
    },
    digital(id) {   // OV on a seven-segment display
        const seg = (d, on) => `<path d="${d}" fill="none" stroke="${on ? '#22d3ee' : '#1e293b'}" stroke-width="6" stroke-linecap="round"${on ? ' class="w-a"' : ''}/>`;
        const O = [['M20 24 H40', 1], ['M44 28 V46', 1], ['M44 54 V72', 1], ['M20 76 H40', 1], ['M16 54 V72', 1], ['M16 28 V46', 1], ['M20 50 H40', 0]];
        const V = [['M56 28 V46', 1], ['M84 28 V46', 1], ['M58 54 L68 74', 1], ['M82 54 L72 74', 1], ['M60 24 H80', 0], ['M60 50 H80', 0]];
        return {
            defs: `<filter id="${id}f" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
            body: `<rect class="w-k" x="6" y="14" width="88" height="72" rx="12" fill="#020617"/><g filter="url(#${id}f)">${O.concat(V).map(([d, on]) => seg(d, on)).join('')}</g>`,
        };
    },
    aurora(id) {   // thick OV in an aurora of colour, glowing
        return {
            defs: lin(`${id}a`, [['0', '#22d3ee'], ['.35', '#4f7cff'], ['.7', '#a855f7'], ['1', '#f472b6']], 0, 0, 1, 1) + `<filter id="${id}f" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>`,
            body: `<g class="w-a" filter="url(#${id}f)" opacity=".75" fill="none" stroke="url(#${id}a)" stroke-width="16" ${R}><circle cx="31" cy="50" r="17"/><path d="M56 32 L69 70 L82 32"/></g>`
                + `<g class="w-k" fill="none" stroke="url(#${id}a)" stroke-width="14" ${R}><circle cx="31" cy="50" r="17"/><path d="M56 32 L69 70 L82 32"/></g>`,
        };
    },
    // ── Hand-made ──
    marker(id) {   // OV in marker, drawn twice by hand
        return {
            defs: '',
            body: `<g fill="none" stroke="#8b5cf6" stroke-width="7" ${R}><path class="w-a w-k" pathLength="100" d="M33 32 C20 31 13 41 14 52 C15 63 23 69 32 68 C42 67 48 59 47 49 C46 39 40 33 30 34"/><path class="w-a" pathLength="100" d="M57 30 C60 42 64 56 69 70 C73 56 78 43 85 29"/></g>`
                + `<g fill="none" stroke="#4f7cff" stroke-width="3" ${R} opacity=".7"><path d="M31 36 C22 37 17 45 18 53 C19 61 25 65 32 64"/><path d="M61 33 C63 43 66 54 69 64"/></g>`,
        };
    },
    brush(id) {   // OV with a brush: thick downstrokes, thin upstrokes
        return {
            defs: g(id),
            body: `<g class="w-a"><path class="w-k" fill-rule="evenodd" d="M31 29 C44 29 50 39 50 50 C50 62 42 71 31 71 C19 71 12 62 12 50 C12 37 20 29 31 29Z M33 37 C27 36 22 42 22 51 C22 59 26 64 31 64 C37 64 41 58 41 50 C41 42 38 37 33 37Z" fill="url(#${id}g)"/>`
                + `<path d="M54 28 H66 L72 58 L80 28 H85 L74 74 H67Z" fill="url(#${id}g)"/></g>`,
        };
    },
    puffy(id) {   // OV as puffy bubble letters, squishing
        return {
            defs: lin(`${id}p`, [['0', '#a5b4fc'], ['.5', '#6366f1'], ['1', '#7c3aed']], 0, 0, 0, 1),
            body: `<g class="w-a"><g fill="none" stroke="#1e1b4b" stroke-width="22" ${R}><circle cx="31" cy="50" r="15"/><path d="M57 33 L69 68 L81 33"/></g>`
                + `<g class="w-k" fill="none" stroke="url(#${id}p)" stroke-width="18" ${R}><circle cx="31" cy="50" r="15"/><path d="M57 33 L69 68 L81 33"/></g>`
                + `<g fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".75"><path d="M21 42 A12 12 0 0 1 29 37"/><path d="M55 32 L57.5 39"/><path d="M80 31 L82 33"/></g></g>`,
        };
    },
    stripes(id) {   // OV in stripes, like a classic letterhead
        let lines = '';
        for (let y = 24; y < 80; y += 6) lines += `<rect x="0" y="${y}" width="100" height="3.6" fill="#fff"/>`;
        return {
            defs: g(id) + `<mask id="${id}m">${lines}</mask>`,
            body: `<g class="w-k" mask="url(#${id}m)"><g class="w-a" fill="none" stroke="url(#${id}g)" stroke-width="15" ${R}><circle cx="31" cy="50" r="17"/><path d="M56 31 L69 70 L82 31"/></g></g>`,
        };
    },
    elegant(id) {   // a refined o and v: thick and thin, with small serifs
        return {
            defs: lin(`${id}e`, [['0', '#e0e7ff'], ['1', '#c4b5fd']], 0, 0, 0, 1),
            body: `<g class="w-a"><path class="w-k" fill-rule="evenodd" d="M32 30 C44 30 51 39 51 50 C51 61 44 70 32 70 C20 70 13 61 13 50 C13 39 20 30 32 30Z M32 33 C27 33 24 40 24 50 C24 60 27 67 32 67 C37 67 40 60 40 50 C40 40 37 33 32 33Z" fill="url(#${id}e)"/>`
                + `<path d="M55 31 H66 M75 31 H86" stroke="url(#${id}e)" stroke-width="2.4" stroke-linecap="round"/><path d="M58 31 H65 L72 62 L80 31 H82 L72 71 H69Z" fill="url(#${id}e)"/></g>`,
        };
    },
    // ── Signals ──
    play(id) {   // an O and a V turned on its side: record and play
        return {
            defs: g(id),
            body: `<circle class="w-k" cx="29" cy="50" r="20" fill="url(#${id}g)"/><circle cx="29" cy="50" r="5" fill="#0b1020"/><g class="w-a"><path d="M58 28 L90 50 L58 72Z" fill="#8b5cf6" stroke="#8b5cf6" stroke-width="7" stroke-linejoin="round"/></g>`,
        };
    },
    signal(id) {   // V waves arriving at an O
        const v = (y, i, o) => `<path class="w-a" style="--i:${i}" d="M28 ${y} L50 ${y + 16} L72 ${y}" fill="none" stroke="url(#${id}g)" stroke-width="7" ${R} opacity="${o}"/>`;
        return { defs: g(id), body: `${v(12, 0, 0.35)}${v(30, 1, 0.65)}${v(48, 2, 1)}<circle class="w-k" cx="50" cy="82" r="9" fill="none" stroke="url(#${id}g)" stroke-width="6"/>` };
    },
    beat(id) {   // a heartbeat that writes an o and a v
        return {
            defs: lin(`${id}g`, [['0', '#4f7cff'], ['.6', '#8b5cf6'], ['1', '#ec4899']], 0, 0, 1, 0),
            body: `<path class="w-a w-k" pathLength="100" d="M5 56 H20 C20 43 37 43 37 55 C37 66 22 66 22 55 C22 49 32 48 44 55 L54 77 L64 28 L72 56 H95" fill="none" stroke="url(#${id}g)" stroke-width="7" ${R}/>`,
        };
    },
    orbit(id) {   // a V with an O orbit round it
        return {
            defs: g(id),
            body: `<g class="w-a"><g transform="rotate(-16 50 54)"><path d="M10 54 A40 14 0 0 1 90 54" fill="none" stroke="#c4b5fd" stroke-width="4" opacity=".55"/></g></g>`
                + `<path class="w-k" d="M30 26 L50 78 L70 26" fill="none" stroke="url(#${id}g)" stroke-width="11" ${R}/>`
                + `<g class="w-a"><g transform="rotate(-16 50 54)"><path d="M90 54 A40 14 0 0 1 10 54" fill="none" stroke="#c4b5fd" stroke-width="4"/><circle cx="84" cy="62" r="5" fill="#f472b6"/></g></g>`,
        };
    },
    // ── Built from parts ──
    pixel8(id) {   // O and V in big pixels
        const O = ['.###.', '#...#', '#...#', '#...#', '#...#', '.###.'];
        const V = ['#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'];
        const cols = ['#4f7cff', '#5975fb', '#646ef9', '#6f67f8', '#7b61f7', '#8b5cf6'];
        let k = 0;
        const draw = (rows, ox) => rows.map((row, r) => [...row].map((c, ci) => (c === '#' ? `<rect class="w-a${ox > 50 && r === 5 ? ' w-k' : ''}" style="--i:${k++}" x="${ox + ci * 8}" y="${27 + r * 8}" width="7" height="7" rx="1.2" fill="${cols[r]}"/>` : '')).join('')).join('');
        return { defs: '', body: draw(O, 7) + draw(V, 53) };
    },
    stars2(id) {   // OV in stars, joined
        const ring = Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; return [30 + 18 * Math.cos(a), 50 + 18 * Math.sin(a)]; });
        const vee = [[58, 30], [71, 72], [84, 30]];
        const pts = ring.concat(vee);
        return {
            defs: g(id),
            body: `<path d="M${ring.map((p) => p.map((n) => n.toFixed(1)).join(' ')).join(' L')}Z M58 30 L71 72 L84 30" fill="none" stroke="url(#${id}g)" stroke-width="2.2" opacity=".6"/>`
                + pts.map(([x, y], i) => `<circle class="w-a${i === 7 ? ' w-k' : ''}" style="--i:${i}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i === 7 ? 5.5 : 4}" fill="#e0e7ff"/>`).join(''),
        };
    },
    halftone(id) {   // OV printed in halftone dots
        const dO = (x, y) => Math.abs(Math.hypot(x - 30, y - 50) - 18);
        const seg = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); };
        const dV = (x, y) => Math.min(seg(x, y, 57, 28, 71, 72), seg(x, y, 71, 72, 85, 28));
        let out = '';
        let i = 0;
        for (let y = 20; y <= 80; y += 5) {
            for (let x = 8; x <= 92; x += 5) {
                const d = Math.min(dO(x, y), dV(x, y));
                const r = d < 6.8 ? 2.4 : 0;
                if (r) out += `<circle class="w-a" style="--i:${Math.round(x / 10)}" cx="${x}" cy="${y}" r="${r}"/>`;
                i += 1;
            }
        }
        return { defs: g(id), body: `<g class="w-k" fill="url(#${id}g)">${out}</g>` };
    },
    tiles(id) {   // an O tile and a V tile
        return {
            defs: g(id),
            body: `<g class="w-a" style="--i:0"><rect class="w-k" x="8" y="28" width="40" height="40" rx="9" fill="#4f7cff" transform="rotate(-6 28 48)"/><circle cx="28" cy="48" r="9.5" fill="none" stroke="#fff" stroke-width="6" transform="rotate(-6 28 48)"/></g>`
                + `<g class="w-a" style="--i:1"><rect x="52" y="32" width="40" height="40" rx="9" fill="#8b5cf6" transform="rotate(7 72 52)"/><path d="M63 42 L72 62 L81 42" fill="none" stroke="#fff" stroke-width="6" ${R} transform="rotate(7 72 52)"/></g>`,
        };
    },
    patch(id) {   // an embroidered OV patch
        return {
            defs: '',
            body: `<g class="w-a"><circle class="w-k" cx="50" cy="50" r="41" fill="#3b2a8f"/><circle cx="50" cy="50" r="41" fill="none" stroke="#8b5cf6" stroke-width="4"/><circle cx="50" cy="50" r="35" fill="none" stroke="#e0e7ff" stroke-width="1.8" stroke-dasharray="3 3"/>`
                + `<circle cx="36" cy="50" r="11" fill="none" stroke="#93c5fd" stroke-width="7"/><path d="M53 39 L61 62 L69 39" fill="none" stroke="#c4b5fd" stroke-width="7" ${R}/>`
                + `<g fill="none" stroke="#fff" stroke-width=".9" opacity=".35"><circle cx="36" cy="50" r="11" stroke-dasharray="1.5 1.5"/><path d="M53 39 L61 62 L69 39" stroke-dasharray="1.5 1.5"/></g></g>`,
        };
    },
    // ── A feel ──
    liquid(id) {   // O and V as one drop of liquid
        return {
            defs: lin(`${id}g`, [['0', '#22d3ee'], ['.5', '#4f7cff'], ['1', '#8b5cf6']]),
            body: `<g class="w-a"><g class="w-k" fill="none" stroke="url(#${id}g)" stroke-width="13" ${R}><circle cx="31" cy="50" r="16"/><path d="M58 32 L71 70 L84 32"/></g>`
                + `<path d="M44 46 C50 44 54 44 59 41 L62 50 C56 52 51 54 45 55Z" fill="url(#${id}g)"/><path d="M71 76 C68 82 74 86 71 92" fill="none" stroke="#8b5cf6" stroke-width="5" stroke-linecap="round"/><ellipse cx="24" cy="42" rx="3.5" ry="2" fill="#fff" opacity=".5" transform="rotate(-35 24 42)"/></g>`,
        };
    },
    glass(id) {   // frosted glass: an O pane over a V
        return {
            defs: g(id),
            body: `<path class="w-k" d="M48 22 H64 L72 52 L80 22 H96 L80 80 H64Z" fill="url(#${id}g)"/>`
                + `<g class="w-a"><circle cx="38" cy="50" r="27" fill="#fff" fill-opacity=".14" stroke="#fff" stroke-opacity=".55" stroke-width="2"/><circle cx="38" cy="50" r="12" fill="#0b1020" fill-opacity=".55"/><path d="M20 38 A20 20 0 0 1 32 26" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/></g>`,
        };
    },
    ribbon2(id) {   // a ribbon that loops an O and folds a V
        return {
            defs: lin(`${id}g`, [['0', '#4f7cff'], ['1', '#a855f7']], 0, 0, 1, 0),
            body: `<path class="w-a w-k" pathLength="100" d="M8 70 C8 42 42 32 42 54 C42 72 14 72 18 52 C22 36 46 32 56 38 L68 74 L90 24" fill="none" stroke="url(#${id}g)" stroke-width="11" ${R}/>`
                + `<path d="M8 70 C8 42 42 32 42 54 C42 72 14 72 18 52 C22 36 46 32 56 38 L68 74 L90 24" fill="none" stroke="#fff" stroke-width="2" ${R} opacity=".35"/>`,
        };
    },
    sticker(id) {   // a die-cut OV sticker, a corner peeling
        return {
            defs: g(id),
            body: `<g class="w-a" transform="rotate(-8 50 50)"><g fill="none" stroke="#000" stroke-opacity=".35" stroke-width="22" ${R} transform="translate(2 3)"><circle cx="31" cy="50" r="15"/><path d="M57 32 L70 70 L83 32"/></g>`
                + `<g fill="none" stroke="#fff" stroke-width="22" ${R}><circle cx="31" cy="50" r="15"/><path d="M57 32 L70 70 L83 32"/></g>`
                + `<g class="w-k" fill="none" stroke="url(#${id}g)" stroke-width="10" ${R}><circle cx="31" cy="50" r="15"/><path d="M57 32 L70 70 L83 32"/></g>`
                + `<path d="M80 72 L90 62 L86 74Z" fill="#e5e7eb"/></g>`,
        };
    },
    mascot(id) {   // a round O face with a V grin
        return {
            defs: rad(`${id}g`, [['0', '#93c5fd'], ['.6', '#4f7cff'], ['1', '#7c3aed']]),
            body: `<circle class="w-k" cx="50" cy="52" r="38" fill="url(#${id}g)"/><g class="w-a" fill="#fff"><circle cx="37" cy="42" r="5.5"/><circle cx="63" cy="42" r="5.5"/></g>`
                + `<path d="M36 56 L50 76 L64 56Z" fill="#0b1020" stroke="#0b1020" stroke-width="4" stroke-linejoin="round"/><path d="M44 69 Q50 64 56 69 L50 76Z" fill="#f472b6"/>`,
        };
    },
};

/** [name, what the idea is, key, lockup, motion] in eight rows of five. */
const WILD_ROWS = [
    { title: 'The letters, made new', line: 'OV written five other ways', items: [
        ['Script', 'ov in one handwritten stroke that writes itself', 'script', 'under', 'draw'],
        ['Stencil', 'a stencil O and V; the pieces close up', 'stencil', 'side', 'join'],
        ['Neon', 'OV in neon tubes, flickering on', 'neon', 'side', 'flicker'],
        ['Blocks', 'OV as solid blocks with depth', 'block3d', 'stack', 'tilt'],
        ['Tag', 'OV sprayed as a tag, still dripping', 'tag', 'side', 'drip'],
    ] },
    { title: 'Monograms', line: 'the O and the V in one sign', items: [
        ['Woven', 'a V woven through an O', 'crossed', 'side', 'tilt'],
        ['Linked', 'an O and a V linked like a chain', 'chain', 'side', 'wobble'],
        ['Coin', 'OV struck on an OpenVibe coin', 'coin', 'pill', 'shine'],
        ['App tile', 'ov on an app tile, with a shine', 'tile', 'pill', 'shine'],
        ['Crest', 'an O over a V on a shield', 'crest', 'stack', 'shine'],
    ] },
    { title: 'Print and paper', line: 'OV as if it were made, not drawn', items: [
        ['Riso', 'two inks a little out of register, sliding into place', 'riso', 'side', 'join'],
        ['Cut-out', 'OV cut out of a card, a layer showing through', 'papercut', 'stack', 'tilt'],
        ['Folded', 'OV folded from paper, light and shadow', 'folded', 'side', 'tilt'],
        ['Long shadow', 'white OV casting a long shadow', 'longshadow', 'pill', 'tilt'],
        ['Embossed', 'OV pressed into a plate', 'emboss', 'stack', 'shine'],
    ] },
    { title: 'Screen and light', line: 'OV glowing, glitching, typed', items: [
        ['Glitch', 'OV with the colour channels slipping', 'glitch', 'side', 'glitch'],
        ['Chrome', 'polished chrome letters with a moving shine', 'chrome', 'side', 'shine'],
        ['Terminal', 'ov_ typed in a terminal, the cursor blinking', 'terminal', 'trail', 'caret'],
        ['Digital', 'OV on a seven-segment display', 'digital', 'side', 'flicker'],
        ['Aurora', 'thick OV in an aurora of colour', 'aurora', 'under', 'pulse'],
    ] },
    { title: 'Signals', line: 'OV pointing, playing, beating', items: [
        ['Pin', 'a map pin is an O on a V: you are here', 'pin', 'tag', 'drop'],
        ['Play', 'an O and a V turned on its side: ● ▶', 'play', 'pill', 'press'],
        ['Signal', 'V waves arriving at an O', 'signal', 'stack', 'cascade'],
        ['Heartbeat', 'a heartbeat that writes an o and a v', 'beat', 'under', 'draw'],
        ['Orbit', 'a V with an O orbit round it', 'orbit', 'side', 'tilt'],
    ] },
    { title: 'Hand-made', line: 'OV with a person\'s hand in it', items: [
        ['Marker', 'OV in marker, drawn by hand', 'marker', 'under', 'draw'],
        ['Brush', 'OV with a brush: thick downstrokes, thin upstrokes', 'brush', 'side', 'tilt'],
        ['Puffy', 'OV as puffy bubble letters, squishing', 'puffy', 'side', 'wobble'],
        ['Stripes', 'OV in stripes, like a classic letterhead', 'stripes', 'side', 'pulse'],
        ['Elegant', 'a refined o and v, thick and thin', 'elegant', 'stack', 'tilt'],
    ] },
    { title: 'Built from parts', line: 'OV made of pieces', items: [
        ['Pixels', 'O and V in big pixels that pop in: play', 'pixel8', 'side', 'pop'],
        ['Stars', 'OV in stars, joined, twinkling', 'stars2', 'stack', 'twinkle'],
        ['Halftone', 'OV printed in dots', 'halftone', 'side', 'pop'],
        ['Tiles', 'an O tile and a V tile that hop', 'tiles', 'side', 'hop'],
        ['Patch', 'an embroidered OV patch', 'patch', 'pill', 'tilt'],
    ] },
    { title: 'A feel', line: 'the same two letters, five moods', items: [
        ['Liquid', 'O and V as one drop of liquid', 'liquid', 'side', 'wobble'],
        ['Glass', 'a frosted O pane over a V', 'glass', 'side', 'glide'],
        ['Ribbon', 'a ribbon that loops an O and folds a V', 'ribbon2', 'under', 'draw'],
        ['Sticker', 'a die-cut OV sticker, a corner peeling', 'sticker', 'tag', 'wobble'],
        ['Face', 'a round O face with a V grin, blinking', 'mascot', 'side', 'blink'],
    ] },
];

const MOTIONS = ['draw', 'join', 'flicker', 'tilt', 'drip', 'wobble', 'shine', 'drop', 'pulse', 'glide', 'hop', 'cascade', 'press', 'pop', 'twinkle', 'blink', 'glitch', 'caret'];

/** The drawing for one key: { defs, body }, every id starting with `id`. */
function wildArt(key, id) {
    const draw = ART[key];
    return draw ? draw(id) : { defs: '', body: '' };
}

module.exports = { WILD_ROWS, wildArt, KEYS: Object.keys(ART), MOTIONS };
