'use strict';
/**
 * The third choice on /brand/explore, the Wildcards (the owner, 2026-11-01: "an option 3… wildly different variations…
 * 40 of them… be thoughtful about animations… status icons… how the label could be attached"; then, the same night:
 * "remake all the wildcards… they're not related to OpenVibe or OV… make them specific, branded to our vibe").
 *
 * Every one is the O and the V, forty ways: the letters made new (script, stencil, neon, blocks, graffiti), monograms
 * (woven, linked, a coin, an app tile, a crest), an O standing on a V (a map pin, an ice cream, someone cheering, a
 * microphone, a balloon), the two as a scene (a bird past the sun, a sun in a valley, a cocktail, a ball and a cup, a
 * rocket), signals (a speech bubble, play, a signal, a heartbeat, an equaliser), things that are an O and a V (a bulb, a
 * clock at ten past ten, a target, a record, an orbit), letters built from parts (pixels, stars, halftone dots, tiles,
 * an embroidered patch) and a feel (liquid, glass, a ribbon, a sticker, a face).
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
    // ── An O standing on a V ──
    pin(id) {   // a map pin is an O on a V: you are here
        return {
            defs: lin(`${id}g`, BV, 0, 0, 0, 1),
            body: `<ellipse class="w-b" cx="50" cy="92" rx="13" ry="3.5" fill="#4f7cff" opacity=".3"/><g class="w-a"><circle class="w-k" cx="50" cy="33" r="17" fill="none" stroke="url(#${id}g)" stroke-width="10"/><path d="M36 45 L50 87 L64 45" fill="none" stroke="url(#${id}g)" stroke-width="10" ${R}/></g>`,
        };
    },
    cone(id) {   // an O scoop on a V cone
        return {
            defs: lin(`${id}c`, [['0', '#fbbf24'], ['1', '#b45309']], 0, 0, 0, 1) + rad(`${id}s`, [['0', '#a5b4fc'], ['.55', '#6366f1'], ['1', '#7c3aed']]),
            body: `<path d="M27 50 H73 L50 93Z" fill="url(#${id}c)"/><path d="M33 56 L58 80 M43 52 L64 72 M67 56 L42 80 M57 52 L36 72" stroke="#92400e" stroke-width="2" opacity=".55"/>`
                + `<g class="w-a"><circle class="w-k" cx="50" cy="35" r="21" fill="url(#${id}s)"/><path d="M33 47 Q36 56 40 50 Q44 58 48 51 Q52 57 56 50 Q60 56 64 49" fill="none" stroke="#6366f1" stroke-width="4" stroke-linecap="round"/><circle cx="43" cy="27" r="4.5" fill="#fff" opacity=".45"/></g>`,
        };
    },
    cheer(id) {   // someone cheering: an O for a head, a V for arms up
        return {
            defs: g(id),
            body: `<g class="w-a"><path d="M18 18 L50 60 L82 18" fill="none" stroke="url(#${id}g)" stroke-width="10" ${R}/></g><circle class="w-k" cx="50" cy="31" r="11" fill="url(#${id}g)"/>`
                + `<path d="M50 60 V80 M50 80 L40 94 M50 80 L60 94" fill="none" stroke="url(#${id}g)" stroke-width="9" ${R}/>`,
        };
    },
    mic(id) {   // a microphone: the O head held in a V
        return {
            defs: g(id) + `<clipPath id="${id}c"><circle cx="50" cy="32" r="16"/></clipPath>`,
            body: `<circle class="w-k" cx="50" cy="32" r="16" fill="url(#${id}g)"/><g clip-path="url(#${id}c)" stroke="#fff" stroke-width="2" opacity=".35"><path d="M30 26 H70 M30 32 H70 M30 38 H70"/></g>`
                + `<path d="M31 30 L50 62 L69 30" fill="none" stroke="#c4b5fd" stroke-width="5" ${R}/><path d="M50 62 V84 M38 86 H62" fill="none" stroke="#8b5cf6" stroke-width="5" ${R}/>`
                + `<g class="w-b" fill="none" stroke="#8b5cf6" stroke-width="3.5" stroke-linecap="round"><path d="M20 22 q-6 10 0 20"/><path d="M80 22 q6 10 0 20"/></g>`,
        };
    },
    balloon(id) {   // an O balloon on a V knot
        return {
            defs: rad(`${id}g`, [['0', '#c7d2fe'], ['.5', '#4f7cff'], ['1', '#7c3aed']]),
            body: `<g class="w-a"><ellipse class="w-k" cx="50" cy="38" rx="23" ry="27" fill="url(#${id}g)"/><path d="M44 63 L50 72 L56 63" fill="#7c3aed" stroke="#7c3aed" stroke-width="3" stroke-linejoin="round"/>`
                + `<ellipse cx="41" cy="27" rx="5" ry="8" fill="#fff" opacity=".35" transform="rotate(-25 41 27)"/><path d="M50 72 C46 80 54 84 50 92" fill="none" stroke="#a5b4fc" stroke-width="2.5" stroke-linecap="round"/></g>`,
        };
    },
    // ── An O and a V in a scene ──
    bird(id) {   // a V bird gliding past an O sun
        return {
            defs: lin(`${id}s`, WARM, 0, 0, 0, 1) + g(id),
            body: `<circle class="w-k" cx="40" cy="46" r="25" fill="url(#${id}s)"/><g class="w-a"><path d="M46 56 Q57 42 67 50 Q74 38 90 34" fill="none" stroke="url(#${id}g)" stroke-width="7" ${R}/></g>`
                + `<path d="M18 80 H62" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round" opacity=".4"/>`,
        };
    },
    valley(id) {   // an O sun rising in a V valley
        return {
            defs: lin(`${id}s`, WARM, 0, 0, 0, 1) + lin(`${id}m`, [['0', '#8b5cf6'], ['1', '#3b4cca']], 0, 0, 0, 1),
            body: `<circle class="w-a w-k" cx="50" cy="48" r="16" fill="url(#${id}s)"/><path d="M4 90 L28 30 L50 72 L72 30 L96 90Z" fill="url(#${id}m)"/><path d="M28 30 L35 47 L31 45 L28 50 L23 43Z M72 30 L79 47 L75 45 L72 50 L67 43Z" fill="#fff" opacity=".7"/>`,
        };
    },
    cocktail(id) {   // a V glass with an O olive
        return {
            defs: lin(`${id}g`, [['0', '#4f7cff', 0.55], ['1', '#8b5cf6', 0.9]], 0, 0, 0, 1),
            body: `<path class="w-k" d="M16 22 H84 L50 60Z" fill="url(#${id}g)" stroke="#c4b5fd" stroke-width="3" stroke-linejoin="round"/><path d="M50 60 V84 M34 86 H66" fill="none" stroke="#c4b5fd" stroke-width="4" ${R}/>`
                + `<g class="w-a"><path d="M74 8 L54 34" stroke="#fde68a" stroke-width="2.5" stroke-linecap="round"/><circle cx="59" cy="28" r="8" fill="#84cc16"/><circle cx="60.5" cy="26.5" r="3" fill="#ef4444"/></g>`,
        };
    },
    catch(id) {   // an O ball dropping into a V cup
        return {
            defs: g(id) + rad(`${id}b`, [['0', '#fde68a'], ['.6', '#f59e0b'], ['1', '#ea580c']]),
            body: `<path class="w-k" d="M18 44 L50 88 L82 44" fill="none" stroke="url(#${id}g)" stroke-width="11" ${R}/><g class="w-a"><circle cx="50" cy="28" r="12" fill="url(#${id}b)"/></g>`,
        };
    },
    rocket(id) {   // a rocket: an O window, a V flame
        return {
            defs: lin(`${id}g`, [['0', '#e0e7ff'], ['1', '#8b5cf6']], 0, 0, 1, 0) + lin(`${id}f`, [['0', '#fde68a'], ['1', '#f97316']], 0, 0, 0, 1),
            body: `<g class="w-a"><path d="M50 8 C65 20 69 44 64 64 H36 C31 44 35 20 50 8Z" fill="url(#${id}g)"/><path d="M36 50 L24 70 L37 66Z M64 50 L76 70 L63 66Z" fill="#6366f1"/>`
                + `<circle class="w-k" cx="50" cy="36" r="8.5" fill="#0b1020" stroke="#4f7cff" stroke-width="3.5"/></g><path class="w-b" d="M41 66 L50 92 L59 66Z" fill="url(#${id}f)"/>`,
        };
    },
    // ── Signals ──
    bubble(id) {   // an O speech bubble with a V tail, typing
        return {
            defs: g(id),
            body: `<circle class="w-k" cx="52" cy="44" r="30" fill="url(#${id}g)"/><path d="M30 64 L18 88 L44 72Z" fill="#6d5ff7"/>`
                + `<g fill="#fff"><circle class="w-a" style="--i:0" cx="40" cy="44" r="4.5"/><circle class="w-a" style="--i:1" cx="52" cy="44" r="4.5"/><circle class="w-a" style="--i:2" cx="64" cy="44" r="4.5"/></g>`,
        };
    },
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
    eqring(id) {   // an O with an equaliser inside, its bars in a V
        const xs = [29, 36, 43, 50, 57, 64, 71];
        const bars = xs.map((x, i) => { const h = 8 + 28 * (Math.abs(x - 50) / 21); return `<rect class="w-a" style="--i:${i}" x="${x - 2.6}" y="${(70 - h).toFixed(1)}" width="5.2" height="${h.toFixed(1)}" rx="2.6"/>`; }).join('');
        return { defs: g(id), body: `<circle class="w-k" cx="50" cy="50" r="38" fill="none" stroke="url(#${id}g)" stroke-width="6"/><g fill="url(#${id}g)">${bars}</g>` };
    },
    // ── Things that are an O and a V ──
    bulb(id) {   // a bulb with a V filament: ideas
        return {
            defs: rad(`${id}l`, [['0', '#fef3c7'], ['.5', '#fde68a', 0.6], ['1', '#fde68a', 0]]) + g(id),
            body: `<circle class="w-a" cx="50" cy="42" r="34" fill="url(#${id}l)"/><path class="w-k" d="M50 12 C68 12 80 26 80 42 C80 54 72 60 68 68 H32 C28 60 20 54 20 42 C20 26 32 12 50 12Z" fill="#fff" fill-opacity=".08" stroke="url(#${id}g)" stroke-width="5"/>`
                + `<path d="M40 38 L50 58 L60 38" fill="none" stroke="#f59e0b" stroke-width="5" ${R}/><path d="M34 74 H66 M36 81 H64 M42 88 H58" stroke="#8b5cf6" stroke-width="4.5" stroke-linecap="round"/>`,
        };
    },
    clock(id) {   // an O clock at ten past ten: the hands make a V
        return {
            defs: g(id),
            body: `<circle class="w-k" cx="50" cy="50" r="38" fill="none" stroke="url(#${id}g)" stroke-width="7"/><path d="M50 16 V22 M84 50 H78 M50 84 V78 M16 50 H22" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round"/>`
                + `<g class="w-a"><path d="M28 36 L50 50 L75 34" fill="none" stroke="#fff" stroke-width="6" ${R}/></g><circle cx="50" cy="50" r="4.5" fill="#fff"/>`,
        };
    },
    target(id) {   // an O target and an arrow with a V tail
        return {
            defs: '',
            body: `<circle class="w-k" cx="42" cy="58" r="32" fill="#4f7cff"/><circle cx="42" cy="58" r="22" fill="#0b1020"/><circle cx="42" cy="58" r="12" fill="#8b5cf6"/>`
                + `<g class="w-a"><path d="M42 58 L84 16" stroke="#fde68a" stroke-width="4" stroke-linecap="round"/><path d="M78 12 L86 14 L88 22 M74 16 L82 18 L84 26" fill="none" stroke="#f472b6" stroke-width="3.5" ${R}/></g>`,
        };
    },
    vinyl(id) {   // an O record with a V on its label
        return {
            defs: g(id),
            body: `<circle class="w-k" cx="50" cy="50" r="40" fill="#111827"/><g class="w-a" fill="none" stroke="#374151" stroke-width="1.6"><circle cx="50" cy="50" r="34"/><circle cx="50" cy="50" r="28"/><circle cx="50" cy="50" r="22"/></g>`
                + `<path d="M22 36 A32 32 0 0 1 40 20" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".35"/><circle cx="50" cy="50" r="15" fill="url(#${id}g)"/><path d="M44 45 L50 58 L56 45" fill="none" stroke="#fff" stroke-width="3.5" ${R}/>`,
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
    { title: 'An O standing on a V', line: 'put an O on a V and it becomes a thing', items: [
        ['Pin', 'a map pin is an O on a V: you are here', 'pin', 'tag', 'drop'],
        ['Ice cream', 'an O scoop on a V cone', 'cone', 'side', 'wobble'],
        ['Cheer', 'someone cheering: an O head, V arms up', 'cheer', 'stack', 'wave'],
        ['Mic', 'a microphone: the O head held in a V', 'mic', 'side', 'pulse'],
        ['Balloon', 'an O balloon on a V knot, floating', 'balloon', 'trail', 'float'],
    ] },
    { title: 'The O and the V in a scene', line: 'two letters, one little picture', items: [
        ['Bird and sun', 'a V bird gliding past an O sun', 'bird', 'side', 'glide'],
        ['Valley', 'an O sun rising in a V valley', 'valley', 'stack', 'rise'],
        ['Cocktail', 'a V glass with an O olive', 'cocktail', 'side', 'float'],
        ['Catch', 'an O ball dropping into a V cup', 'catch', 'side', 'hop'],
        ['Rocket', 'an O window, a V flame: launch', 'rocket', 'trail', 'rocket'],
    ] },
    { title: 'Signals', line: 'OpenVibe talking, playing, live', items: [
        ['Speech bubble', 'an O bubble with a V tail, typing', 'bubble', 'bubble', 'cascade'],
        ['Play', 'an O and a V turned on its side: ● ▶', 'play', 'pill', 'press'],
        ['Signal', 'V waves arriving at an O', 'signal', 'stack', 'cascade'],
        ['Heartbeat', 'a heartbeat that writes an o and a v', 'beat', 'under', 'draw'],
        ['Equaliser', 'an O with bars inside, in a V', 'eqring', 'side', 'bars'],
    ] },
    { title: 'Things that are an O and a V', line: 'look twice', items: [
        ['Bulb', 'a bulb with a V filament: ideas', 'bulb', 'side', 'flicker'],
        ['Ten past ten', 'an O clock whose hands make a V', 'clock', 'side', 'tilt'],
        ['Target', 'an O target, an arrow with a V tail', 'target', 'tag', 'land'],
        ['Record', 'an O record with a V on its label', 'vinyl', 'side', 'pulse'],
        ['Orbit', 'a V with an O orbit round it', 'orbit', 'side', 'tilt'],
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

const MOTIONS = ['draw', 'join', 'flicker', 'tilt', 'drip', 'wobble', 'shine', 'drop', 'wave', 'pulse', 'float', 'glide', 'rise', 'hop', 'rocket', 'cascade', 'press', 'bars', 'land', 'pop', 'twinkle', 'blink'];

/** The drawing for one key: { defs, body }, every id starting with `id`. */
function wildArt(key, id) {
    const draw = ART[key];
    return draw ? draw(id) : { defs: '', body: '' };
}

module.exports = { WILD_ROWS, wildArt, KEYS: Object.keys(ART), MOTIONS };
