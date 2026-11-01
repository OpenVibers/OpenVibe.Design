'use strict';
/**
 * The third choice on /brand/explore (the owner, 2026-11-01: "an option 3… wildly different variations… be creative…
 * completely different ideas for OpenVibe branding… 40 of them… so you can choose the Loop, the Pair and/or these…
 * be thoughtful about animations and effects… status icons… how the label could be attached").
 *
 * Not an O and a V: forty other ideas of what OpenVibe is, in eight rows of five, each drawn by hand on the page's
 * 100-unit grid in the brand's blue to violet (with a warm accent where the idea needs light). Each one also says:
 *   - its motion: parts of the drawing carry classes (w-a, w-b, w-c…) that css/marks.css animates for that idea (bars
 *     bounce, the eye blinks, the sun rises, the plane glides), only while the card is on screen and never under
 *     reduced motion;
 *   - its key part (w-k): what lights up when the mark shows a status (live: red and pulsing; new: a count badge);
 *   - its lockup: how the name attaches to it (side, pill, under, bubble, stack, tag, trail).
 * Every drawing is a function of an id prefix, so a mark can be drawn more than once on a page with ids that never clash.
 */

const BV = [['0', '#4f7cff'], ['1', '#8b5cf6']];
const lin = (id, stops, x1 = 0, y1 = 0, x2 = 1, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
const rad = (id, stops) => `<radialGradient id="${id}" cx=".35" cy=".3" r=".8">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</radialGradient>`;
const R = 'stroke-linecap="round" stroke-linejoin="round"';
const star4 = (cx, cy, r) => `M${cx} ${cy - r} C${cx + r * 0.08} ${cy - r * 0.3} ${cx + r * 0.3} ${cy - r * 0.08} ${cx + r} ${cy} C${cx + r * 0.3} ${cy + r * 0.08} ${cx + r * 0.08} ${cy + r * 0.3} ${cx} ${cy + r} C${cx - r * 0.08} ${cy + r * 0.3} ${cx - r * 0.3} ${cy + r * 0.08} ${cx - r} ${cy} C${cx - r * 0.3} ${cy - r * 0.08} ${cx - r * 0.08} ${cy - r * 0.3} ${cx} ${cy - r}Z`;

const ART = {
    // ── Sound and signal ──
    soundwave(id) {
        const xs = [22, 31, 40, 50, 60, 69, 78];
        const bars = xs.map((x, i) => { const h = 14 + 44 * (1 - Math.abs(x - 50) / 28); return `<rect class="w-a${x === 50 ? ' w-k' : ''}" style="--i:${i}" x="${x - 3.5}" y="20" width="7" height="${h.toFixed(1)}" rx="3.5"/>`; }).join('');
        return { defs: lin(`${id}g`, BV, 0, 0, 1, 1), body: `<g fill="url(#${id}g)">${bars}</g><rect x="14" y="82" width="72" height="4" rx="2" fill="url(#${id}g)" opacity=".35"/>` };
    },
    ripple(id) {
        const arc = (r, o, i) => `<path class="w-a" style="--i:${i}" d="M28 ${72 - r} A${r} ${r} 0 0 1 ${28 + r} 72" fill="none" stroke="url(#${id}g)" stroke-width="8" stroke-linecap="round" opacity="${o}"/>`;
        return { defs: lin(`${id}g`, BV, 0, 1, 1, 0), body: `${arc(24, 1, 0)}${arc(39, 0.72, 1)}${arc(54, 0.45, 2)}<circle class="w-k" cx="28" cy="72" r="10" fill="url(#${id}g)"/>` };
    },
    fork(id) {
        return {
            defs: lin(`${id}g`, BV, 0, 0, 0, 1),
            body: `<g class="w-a"><path class="w-k" d="M32 14 L50 56 L68 14" fill="none" stroke="url(#${id}g)" stroke-width="10" ${R}/></g><path d="M50 56 V88" stroke="url(#${id}g)" stroke-width="10" stroke-linecap="round"/>`
                + `<g class="w-b" fill="none" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round" opacity=".65"><path d="M18 20 q-7 9 0 18"/><path d="M10 15 q-10 14 0 28"/><path d="M82 20 q7 9 0 18"/><path d="M90 15 q10 14 0 28"/></g>`,
        };
    },
    pulse(id) {
        return {
            defs: lin(`${id}g`, [['0', '#4f7cff'], ['.55', '#8b5cf6'], ['1', '#ec4899']], 0, 0, 1, 0),
            body: `<rect x="6" y="14" width="88" height="72" rx="22" fill="#4f7cff" opacity=".1"/><path class="w-a w-k" pathLength="100" d="M8 54 H28 L36 38 L48 74 L60 22 L68 54 H92" fill="none" stroke="url(#${id}g)" stroke-width="8" ${R}/>`,
        };
    },
    bubble(id) {
        return {
            defs: lin(`${id}g`, BV),
            body: `<g class="w-a"><path class="w-k" d="M24 16 H76 a12 12 0 0 1 12 12 V60 a12 12 0 0 1 -12 12 H46 L28 88 V72 H24 a12 12 0 0 1 -12 -12 V28 a12 12 0 0 1 12 -12Z" fill="url(#${id}g)"/>`
                + `<path class="w-b" pathLength="100" d="M35 34 L50 56 L65 34" fill="none" stroke="#fff" stroke-width="8" ${R}/></g>`,
        };
    },
    // ── Places and worlds ──
    door(id) {
        return {
            defs: lin(`${id}l`, [['0', '#fff7d6'], ['1', '#fbbf24']], 0, 0, 0, 1) + lin(`${id}g`, BV, 0, 0, 1, 1),
            body: `<path class="w-k" d="M34 88 V42 a20 20 0 0 1 40 0 V88Z" fill="url(#${id}l)"/><path d="M34 88 V42 a20 20 0 0 1 40 0 V88" fill="none" stroke="url(#${id}g)" stroke-width="6" stroke-linejoin="round"/>`
                + `<g class="w-a"><path d="M34 34 L16 24 V96 L34 88Z" fill="url(#${id}g)"/><circle cx="21" cy="62" r="2.6" fill="#fff"/></g><path class="w-b" d="M40 88 L74 88 L92 96 H50Z" fill="#fbbf24" opacity=".35"/>`,
        };
    },
    planet(id) {
        return {
            defs: rad(`${id}p`, [['0', '#93c5fd'], ['.55', '#4f7cff'], ['1', '#6d28d9']]) + lin(`${id}r`, [['0', '#c4b5fd'], ['1', '#f0abfc']], 0, 0, 1, 0),
            body: `<g class="w-a"><g transform="rotate(-18 50 50)"><ellipse cx="50" cy="50" rx="42" ry="12" fill="none" stroke="url(#${id}r)" stroke-width="5" opacity=".5"/></g></g>`
                + `<circle class="w-k" cx="50" cy="50" r="25" fill="url(#${id}p)"/>`
                + `<g class="w-a"><g transform="rotate(-18 50 50)"><path d="M8 50 A42 12 0 0 0 92 50" fill="none" stroke="url(#${id}r)" stroke-width="5" stroke-linecap="round"/></g></g>`,
        };
    },
    sunrise(id) {
        return {
            defs: lin(`${id}s`, [['0', '#fde68a'], ['1', '#f97316']], 0, 0, 0, 1) + lin(`${id}m`, [['0', '#8b5cf6'], ['1', '#3b4cca']], 0, 0, 0, 1),
            body: `<circle class="w-a w-k" cx="50" cy="50" r="16" fill="url(#${id}s)"/><path d="M4 88 L27 30 L50 72 L73 30 L96 88Z" fill="url(#${id}m)"/><path d="M27 30 L35 50 L31 47 L27 52 L22 44Z" fill="#fff" opacity=".7"/><path d="M73 30 L81 50 L77 47 L73 52 L68 44Z" fill="#fff" opacity=".7"/>`,
        };
    },
    prism(id) {
        const rays = [['#ef4444', 24], ['#f59e0b', 36], ['#22c55e', 48], ['#22d3ee', 60], ['#8b5cf6', 72]];
        return {
            defs: lin(`${id}g`, [['0', '#4f7cff', 0.55], ['1', '#8b5cf6', 0.85]], 0, 0, 1, 1),
            body: `<path d="M4 44 H34" stroke="#fff" stroke-width="5" stroke-linecap="round"/>${rays.map(([c, y], i) => `<path class="w-a" style="--i:${i}" d="M64 48 L96 ${y}" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`).join('')}`
                + `<path class="w-k" d="M20 20 H80 L50 84Z" fill="url(#${id}g)" stroke="#c4b5fd" stroke-width="3" stroke-linejoin="round"/>`,
        };
    },
    plane(id) {
        return {
            defs: lin(`${id}a`, [['0', '#a5b4fc'], ['1', '#6366f1']]) + lin(`${id}b`, [['0', '#8b5cf6'], ['1', '#4c1d95']]),
            body: `<g class="w-a"><path class="w-k" d="M90 12 L8 44 L42 56Z" fill="url(#${id}a)"/><path d="M90 12 L42 56 L58 88Z" fill="url(#${id}b)"/><path d="M42 56 L40 74 L50 66Z" fill="#4c1d95"/></g>`
                + `<g class="w-b" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round" opacity=".5"><path d="M10 70 H26"/><path d="M16 82 H34"/></g>`,
        };
    },
    // ── Friendly and alive ──
    blob(id) {
        return {
            defs: lin(`${id}g`, [['0', '#22d3ee'], ['.5', '#4f7cff'], ['1', '#8b5cf6']]),
            body: `<g class="w-a"><path class="w-k" d="M54 10 C77 12 93 31 88 53 C84 75 66 92 45 88 C23 85 7 67 12 45 C16 25 32 8 54 10Z" fill="url(#${id}g)"/><ellipse cx="34" cy="28" rx="10" ry="6" fill="#fff" opacity=".28" transform="rotate(-30 34 28)"/>`
                + `<path d="M36 46 L50 64 L64 46" fill="none" stroke="#fff" stroke-width="8" ${R}/></g>`,
        };
    },
    smile(id) {
        return {
            defs: rad(`${id}g`, [['0', '#93c5fd'], ['.6', '#4f7cff'], ['1', '#7c3aed']]),
            body: `<circle class="w-k" cx="50" cy="50" r="40" fill="url(#${id}g)"/><g class="w-a" fill="#fff"><circle cx="37" cy="42" r="5.5"/><circle cx="63" cy="42" r="5.5"/></g><path d="M33 58 Q50 76 67 58" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round"/>`,
        };
    },
    eye(id) {
        return {
            defs: lin(`${id}g`, BV, 0, 0, 1, 0) + rad(`${id}i`, [['0', '#a5f3fc'], ['.6', '#4f7cff'], ['1', '#6d28d9']]),
            body: `<g class="w-b"><path d="M6 50 Q50 10 94 50 Q50 90 6 50Z" fill="#4f7cff" opacity=".12"/><path d="M6 50 Q50 10 94 50 Q50 90 6 50Z" fill="none" stroke="url(#${id}g)" stroke-width="6" stroke-linejoin="round"/>`
                + `<g class="w-a"><circle class="w-k" cx="50" cy="50" r="17" fill="url(#${id}i)"/><circle cx="50" cy="50" r="7" fill="#0b1020"/><circle cx="55" cy="44" r="3.4" fill="#fff"/></g></g>`,
        };
    },
    spark(id) {
        return {
            defs: lin(`${id}g`, [['0', '#4f7cff'], ['.6', '#8b5cf6'], ['1', '#f472b6']]),
            body: `<path class="w-a w-k" d="${star4(44, 54, 36)}" fill="url(#${id}g)"/><path class="w-b" d="${star4(80, 20, 12)}" fill="#f472b6"/><path class="w-c" d="${star4(82, 76, 7)}" fill="#8b5cf6" opacity=".8"/>`,
        };
    },
    overlap() {
        return {
            defs: '',
            body: `<circle class="w-a" cx="37" cy="50" r="27" fill="#4f7cff" opacity=".9"/><circle class="w-b" cx="63" cy="50" r="27" fill="#8b5cf6" opacity=".9"/>`
                + `<path class="w-k" d="M50 26.4 A27 27 0 0 1 50 73.6 A27 27 0 0 1 50 26.4Z" fill="#e0e7ff"/>`,
        };
    },
    // ── Made of parts ──
    stars(id) {
        return {
            defs: lin(`${id}g`, BV, 0, 0, 1, 1),
            body: `<path d="M18 22 L34 50 L50 78 L66 50 L82 22" fill="none" stroke="url(#${id}g)" stroke-width="3.5" stroke-linejoin="round" opacity=".7"/>`
                + `<g fill="url(#${id}g)"><circle class="w-a" style="--i:0" cx="18" cy="22" r="8"/><circle class="w-a" style="--i:2" cx="82" cy="22" r="8"/><circle class="w-a w-k" style="--i:4" cx="50" cy="78" r="9"/><circle class="w-a" style="--i:1" cx="34" cy="50" r="5.5"/><circle class="w-a" style="--i:3" cx="66" cy="50" r="5.5"/></g><circle class="w-b" cx="50" cy="30" r="3" fill="#c4b5fd"/>`,
        };
    },
    pixel() {
        const rows = [[0, 1, 7, 8], [1, 2, 6, 7], [2, 3, 5, 6], [3, 4, 5], [4]];
        const cols = ['#4f7cff', '#5b74fb', '#6a6cf8', '#7a64f7', '#8b5cf6'];
        let k = 0;
        const px = rows.map((cs, r) => cs.map((c) => `<rect class="w-a${r === 4 ? ' w-k' : ''}" style="--i:${k++}" x="${(9 + c * 9.2).toFixed(1)}" y="${18 + r * 13}" width="8.2" height="11" rx="1.6" fill="${cols[r]}"/>`).join('')).join('');
        return { defs: '', body: px };
    },
    ribbon(id) {
        return {
            defs: lin(`${id}a`, [['0', '#6366f1'], ['1', '#4c1d95']], 0, 0, 0, 1) + lin(`${id}b`, [['0', '#93c5fd'], ['1', '#4f7cff']], 0, 0, 0, 1),
            body: `<g class="w-a"><path d="M86 16 H66 L44 78 L54 90Z" fill="url(#${id}a)"/><path class="w-k" d="M14 16 H34 L58 80 L46 90Z" fill="url(#${id}b)"/><path d="M44 78 L46 90 L54 90Z" fill="#3b0764" opacity=".6"/></g>`,
        };
    },
    code(id) {
        return {
            defs: lin(`${id}g`, BV, 0, 0, 1, 0),
            body: `<g fill="none" stroke="#94a3b8" stroke-width="7" ${R}><path class="w-b" d="M28 28 L10 50 L28 72"/><path class="w-c" d="M72 28 L90 50 L72 72"/></g><path class="w-a w-k" d="M37 32 L50 68 L63 32" fill="none" stroke="url(#${id}g)" stroke-width="9" ${R}/>`,
        };
    },
    badge(id) {
        return {
            defs: lin(`${id}g`, BV) + lin(`${id}s`, [['0', '#fff', 0], ['.5', '#fff', 0.45], ['1', '#fff', 0]], 0, 0, 1, 0),
            body: `<clipPath id="${id}c"><rect x="10" y="10" width="80" height="80" rx="26"/></clipPath><rect class="w-k" x="10" y="10" width="80" height="80" rx="26" fill="url(#${id}g)"/><g clip-path="url(#${id}c)"><rect class="w-a" x="-40" y="0" width="30" height="100" fill="url(#${id}s)" transform="skewX(-20)"/></g>`
                + `<circle cx="37" cy="55" r="11.5" fill="none" stroke="#fff" stroke-width="8.5"/><path d="M55 44 L65 67 L75 44" fill="none" stroke="#fff" stroke-width="8.5" ${R}/>`,
        };
    },
    // ── Nature ──
    wave(id) {
        return {
            defs: lin(`${id}g`, [['0', '#22d3ee'], ['1', '#4f7cff']], 0, 0, 1, 1) + lin(`${id}d`, [['0', '#6366f1'], ['1', '#4c1d95']], 0, 0, 0, 1),
            body: `<g class="w-a"><path class="w-k" d="M8 70 C20 70 26 40 46 30 C62 22 80 30 82 46 C70 38 58 44 58 56 C58 66 68 70 92 70 V86 H8Z" fill="url(#${id}g)"/><path d="M8 80 C30 76 60 84 92 78 V90 H8Z" fill="url(#${id}d)"/></g><circle class="w-b" cx="80" cy="24" r="3" fill="#a5f3fc"/><circle class="w-b" style="--i:1" cx="88" cy="34" r="2" fill="#a5f3fc"/>`,
        };
    },
    flame(id) {
        return {
            defs: lin(`${id}g`, [['0', '#fbbf24'], ['.45', '#f97316'], ['1', '#8b5cf6']], 0, 0, 0, 1),
            body: `<g class="w-a"><path class="w-k" d="M50 8 C58 26 76 34 76 58 C76 76 64 90 50 90 C36 90 24 76 24 58 C24 44 32 36 38 28 C40 40 44 44 48 46 C46 32 46 20 50 8Z" fill="url(#${id}g)"/>`
                + `<path d="M40 58 L50 76 L60 58" fill="none" stroke="#fff" stroke-width="6" ${R} opacity=".9"/></g>`,
        };
    },
    leaf(id) {
        return {
            defs: lin(`${id}g`, [['0', '#34d399'], ['1', '#4f7cff']], 0, 0, 1, 1),
            body: `<g class="w-a"><path class="w-k" d="M50 90 C22 76 14 46 24 18 C42 24 82 30 82 58 C82 76 66 90 50 90Z" fill="url(#${id}g)"/><path d="M50 90 L50 70 M50 70 L36 48 M50 70 L64 50" fill="none" stroke="#fff" stroke-width="4.5" ${R} opacity=".85"/></g>`,
        };
    },
    moon(id) {
        return {
            defs: lin(`${id}g`, [['0', '#c4b5fd'], ['1', '#4f7cff']], 0, 0, 1, 1),
            body: `<path class="w-k" d="M58 12 A38 38 0 1 0 88 66 A30 30 0 1 1 58 12Z" fill="url(#${id}g)"/><path class="w-a" d="${star4(70, 30, 9)}" fill="#fde68a"/><circle class="w-b" cx="84" cy="44" r="2.5" fill="#fde68a"/>`,
        };
    },
    bolt(id) {
        return {
            defs: lin(`${id}g`, [['0', '#fde68a'], ['.5', '#f59e0b'], ['1', '#8b5cf6']], 0, 0, 1, 1),
            body: `<path class="w-a w-k" d="M58 6 L22 54 H46 L38 94 L78 40 H54 Z" fill="url(#${id}g)" stroke="#fff" stroke-opacity=".25" stroke-width="2" stroke-linejoin="round"/>`,
        };
    },
    // ── Things you hold ──
    headphones(id) {
        return {
            defs: lin(`${id}g`, BV, 0, 0, 1, 0),
            body: `<path d="M18 60 V50 a32 32 0 0 1 64 0 V60" fill="none" stroke="url(#${id}g)" stroke-width="8" stroke-linecap="round"/><rect class="w-k" x="12" y="54" width="18" height="30" rx="8" fill="url(#${id}g)"/><rect x="70" y="54" width="18" height="30" rx="8" fill="url(#${id}g)"/>`
                + `<g class="w-a" fill="#8b5cf6"><rect style="--i:0" x="39" y="58" width="5" height="18" rx="2.5"/><rect style="--i:1" x="47.5" y="52" width="5" height="30" rx="2.5"/><rect style="--i:2" x="56" y="58" width="5" height="18" rx="2.5"/></g>`,
        };
    },
    play(id) {
        return {
            defs: lin(`${id}g`, BV),
            body: `<circle class="w-k" cx="50" cy="50" r="40" fill="url(#${id}g)"/><circle class="w-b" cx="50" cy="50" r="40" fill="none" stroke="#8b5cf6" stroke-width="3"/><path class="w-a" d="M42 32 Q40 30 40 34 V66 Q40 70 43 68 L68 52 Q71 50 68 48Z" fill="#fff"/>`,
        };
    },
    antenna(id) {
        return {
            defs: lin(`${id}g`, BV, 0, 0, 0, 1),
            body: `<path d="M50 40 L34 90 M50 40 L66 90 M40 72 H60" fill="none" stroke="url(#${id}g)" stroke-width="6" ${R}/><circle class="w-k" cx="50" cy="36" r="7" fill="url(#${id}g)"/>`
                + `<g class="w-a" fill="none" stroke="#8b5cf6" stroke-width="5" stroke-linecap="round"><path style="--i:0" d="M36 22 a20 20 0 0 0 0 28"/><path style="--i:0" d="M64 22 a20 20 0 0 1 0 28"/><path style="--i:1" d="M24 12 a34 34 0 0 0 0 48" opacity=".6"/><path style="--i:1" d="M76 12 a34 34 0 0 1 0 48" opacity=".6"/></g>`,
        };
    },
    gem(id) {
        return {
            defs: lin(`${id}a`, [['0', '#a5b4fc'], ['1', '#4f7cff']]) + lin(`${id}b`, [['0', '#8b5cf6'], ['1', '#4c1d95']]),
            body: `<path d="M26 22 H74 L90 40 L50 88 L10 40Z" fill="url(#${id}b)"/><path class="w-k" d="M26 22 L38 40 H62 L74 22Z" fill="url(#${id}a)"/><path d="M10 40 H90 M38 40 L50 88 L62 40" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" opacity=".55"/>`
                + `<path class="w-a" d="${star4(70, 30, 8)}" fill="#fff"/>`,
        };
    },
    dice(id) {
        const pip = (x, y, i) => `<circle class="w-b" style="--i:${i}" cx="${x}" cy="${y}" r="6.5" fill="#fff"/>`;
        return {
            defs: lin(`${id}g`, BV),
            body: `<g class="w-a"><rect class="w-k" x="14" y="14" width="72" height="72" rx="18" fill="url(#${id}g)"/>${pip(32, 32, 0)}${pip(68, 32, 1)}${pip(41, 50, 2)}${pip(59, 50, 3)}${pip(50, 68, 4)}</g>`,
        };
    },
    // ── Signs and symbols ──
    pin(id) {
        return {
            defs: lin(`${id}g`, BV, 0, 0, 0, 1),
            body: `<ellipse class="w-b" cx="50" cy="91" rx="14" ry="3.5" fill="#4f7cff" opacity=".3"/><g class="w-a"><path class="w-k" d="M50 88 C40 72 20 58 20 38 a30 30 0 0 1 60 0 C80 58 60 72 50 88Z" fill="url(#${id}g)"/><circle cx="50" cy="38" r="11" fill="#fff"/></g>`,
        };
    },
    heart(id) {
        return {
            defs: lin(`${id}g`, [['0', '#4f7cff'], ['.6', '#8b5cf6'], ['1', '#ec4899']]),
            body: `<path class="w-a w-k" d="M50 86 L18 52 C6 38 12 16 30 16 C40 16 46 22 50 30 C54 22 60 16 70 16 C88 16 94 38 82 52Z" fill="url(#${id}g)"/>`,
        };
    },
    shield(id) {
        return {
            defs: lin(`${id}g`, BV, 0, 0, 0, 1) + lin(`${id}s`, [['0', '#fff', 0], ['.5', '#fff', 0.4], ['1', '#fff', 0]], 0, 0, 1, 0),
            body: `<clipPath id="${id}c"><path d="M50 8 L84 20 V48 C84 70 68 84 50 92 C32 84 16 70 16 48 V20Z"/></clipPath><path class="w-k" d="M50 8 L84 20 V48 C84 70 68 84 50 92 C32 84 16 70 16 48 V20Z" fill="url(#${id}g)"/><g clip-path="url(#${id}c)"><rect class="w-a" x="-40" y="0" width="26" height="100" fill="url(#${id}s)" transform="skewX(-20)"/></g>`
                + `<path d="M36 36 L50 64 L64 36" fill="none" stroke="#fff" stroke-width="8" ${R}/>`,
        };
    },
    chevrons(id) {
        const v = (y, i, o) => `<path class="w-a${i === 2 ? ' w-k' : ''}" style="--i:${i}" d="M22 ${y} L50 ${y + 22} L78 ${y}" fill="none" stroke="url(#${id}g)" stroke-width="9" ${R} opacity="${o}"/>`;
        return { defs: lin(`${id}g`, BV, 0, 0, 1, 0), body: `${v(14, 0, 0.35)}${v(36, 1, 0.65)}${v(58, 2, 1)}` };
    },
    infinity(id) {
        return {
            defs: lin(`${id}g`, [['0', '#4f7cff'], ['.5', '#8b5cf6'], ['1', '#4f7cff']], 0, 0, 1, 0),
            body: `<path class="w-k" d="M50 50 C40 34 14 30 14 50 C14 70 40 66 50 50 C60 34 86 30 86 50 C86 70 60 66 50 50Z" fill="none" stroke="url(#${id}g)" stroke-width="10" ${R}/>`
                + `<path class="w-a" pathLength="100" d="M50 50 C40 34 14 30 14 50 C14 70 40 66 50 50 C60 34 86 30 86 50 C86 70 60 66 50 50Z" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-dasharray="8 92" opacity=".85"/>`,
        };
    },
    // ── Play and motion ──
    kite(id) {
        return {
            defs: lin(`${id}a`, [['0', '#93c5fd'], ['1', '#4f7cff']]) + lin(`${id}b`, [['0', '#8b5cf6'], ['1', '#6d28d9']]),
            body: `<g class="w-a"><path class="w-k" d="M50 8 L74 36 L50 64 Z" fill="url(#${id}a)"/><path d="M50 8 L26 36 L50 64Z" fill="url(#${id}b)"/><path d="M26 36 H74" stroke="#fff" stroke-width="2" opacity=".5"/>`
                + `<path class="w-b" d="M50 64 C46 72 56 76 50 84 C46 88 52 92 48 96" fill="none" stroke="#8b5cf6" stroke-width="3" stroke-linecap="round"/><path d="M47 76 l-6 -3 m6 3 l-4 5 M51 88 l6 -2 m-6 2 l4 5" stroke="#f472b6" stroke-width="3" stroke-linecap="round"/></g>`,
        };
    },
    bird(id) {
        return {
            defs: lin(`${id}a`, [['0', '#a5b4fc'], ['1', '#4f7cff']]) + lin(`${id}b`, [['0', '#8b5cf6'], ['1', '#4c1d95']]),
            body: `<path class="w-a" d="M44 52 L18 22 L58 46Z" fill="url(#${id}a)"/><path class="w-k" d="M14 58 L58 46 L88 30 L74 56 L48 72Z" fill="url(#${id}b)"/><path class="w-b" d="M58 46 L82 18 L64 54Z" fill="url(#${id}a)" opacity=".85"/><path d="M88 30 L96 30 L86 36Z" fill="#f59e0b"/>`,
        };
    },
    bounce(id) {
        const dots = [[16, 20], [27, 40], [38, 62], [50, 80], [62, 62], [73, 40], [84, 20]];
        return {
            defs: lin(`${id}g`, BV, 0, 0, 1, 0),
            body: `<path d="M16 20 Q34 70 50 82 Q66 70 84 20" fill="none" stroke="url(#${id}g)" stroke-width="2.5" stroke-dasharray="2 6" stroke-linecap="round" opacity=".55"/>${dots.map(([x, y], i) => `<circle class="w-a" style="--i:${i}" cx="${x}" cy="${y}" r="${i === 3 ? 10 : 5}" fill="url(#${id}g)"${i === 3 ? '' : ' opacity=".55"'}/>`).join('')}<ellipse class="w-k" cx="50" cy="93" rx="12" ry="3" fill="#4f7cff" opacity=".35"/>`,
        };
    },
    orbit(id) {
        return {
            defs: lin(`${id}g`, BV),
            body: `<circle cx="50" cy="50" r="30" fill="none" stroke="url(#${id}g)" stroke-width="10"/><circle cx="50" cy="50" r="42" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-dasharray="3 6" opacity=".55"/>`
                + `<g class="w-a"><circle class="w-k" cx="50" cy="8" r="7" fill="#f472b6"/></g>`,
        };
    },
    cursor(id) {
        return {
            defs: lin(`${id}g`, BV),
            body: `<circle class="w-b" cx="30" cy="28" r="14" fill="none" stroke="#8b5cf6" stroke-width="3"/><g class="w-a"><path class="w-k" d="M30 28 L78 52 L56 58 L68 82 L58 86 L46 62 L30 76Z" fill="url(#${id}g)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></g><path d="${star4(80, 22, 9)}" fill="#f472b6"/>`,
        };
    },
};

/** [name, what the idea is, key, lockup] in eight rows of five. */
const WILD_ROWS = [
    { title: 'Sound and signal', line: 'vibe as in vibration: sound, waves, a heartbeat', items: [
        ['Soundwave', 'a V drawn in sound bars: the bars bounce', 'soundwave', 'under'],
        ['Ripple', 'a dot and its waves going out', 'ripple', 'side'],
        ['Tuning fork', 'a V that rings when it is struck', 'fork', 'stack'],
        ['Pulse', 'a heartbeat line that draws itself: alive, live', 'pulse', 'under'],
        ['Speech bubble', 'a chat bubble the name sits in', 'bubble', 'bubble'],
    ] },
    { title: 'Places and worlds', line: 'somewhere to go: open, wide, bright', items: [
        ['Open door', 'a door that swings open, light coming through', 'door', 'stack'],
        ['Planet', 'a world with a ring: many sites, one place', 'planet', 'side'],
        ['Sunrise', 'a sun rising between two hills: an O in a V', 'sunrise', 'stack'],
        ['Prism', 'a V of glass splitting light into colour', 'prism', 'side'],
        ['Paper plane', 'it glides, and pulls the name behind it', 'plane', 'trail'],
    ] },
    { title: 'Friendly and alive', line: 'a character more than a logo', items: [
        ['Blob', 'a soft shape that breathes and smiles', 'blob', 'pill'],
        ['Smile', 'a friendly face that blinks', 'smile', 'side'],
        ['Eye', 'an open eye that looks around: watch, stream', 'eye', 'side'],
        ['Spark', 'a spark that twinkles: making things', 'spark', 'tag'],
        ['Overlap', 'two circles that meet: people together', 'overlap', 'side'],
    ] },
    { title: 'Made of parts', line: 'built from pieces: stars, pixels, code', items: [
        ['Constellation', 'stars joined into a V, twinkling', 'stars', 'stack'],
        ['Pixel V', 'a V in big pixels that pop in: play', 'pixel', 'side'],
        ['Ribbon', 'a ribbon folded into a V', 'ribbon', 'tag'],
        ['Code', 'a V between brackets: open source', 'code', 'side'],
        ['Badge', 'ov on an app tile, with a shine', 'badge', 'pill'],
    ] },
    { title: 'Nature', line: 'things that move on their own', items: [
        ['Wave', 'a wave that rolls: ride the vibe', 'wave', 'under'],
        ['Flame', 'a flame with a V in its heart, flickering', 'flame', 'side'],
        ['Leaf', 'a leaf with a V vein, swaying', 'leaf', 'side'],
        ['Moon', 'a moon and a star for late streams', 'moon', 'tag'],
        ['Bolt', 'a bolt of energy that flashes', 'bolt', 'side'],
    ] },
    { title: 'Things you hold', line: 'objects that say what OpenVibe does', items: [
        ['Headphones', 'headphones with a beat between them', 'headphones', 'stack'],
        ['Play', 'a play button: watch, stream, go', 'play', 'pill'],
        ['Antenna', 'a tower sending out a signal: live', 'antenna', 'stack'],
        ['Gem', 'a gem with a V cut and a glint', 'gem', 'side'],
        ['Dice', 'five dots in a V on a die: play', 'dice', 'side'],
    ] },
    { title: 'Signs and symbols', line: 'shapes everyone already reads', items: [
        ['Pin', 'a map pin is an O on a V: you are here', 'pin', 'tag'],
        ['Heart', 'a heart whose point is the V, beating', 'heart', 'side'],
        ['Shield', 'a V on a shield: safe, yours', 'shield', 'pill'],
        ['Chevrons', 'three Vs that cascade', 'chevrons', 'stack'],
        ['Infinity', 'a loop with a light running round it: open forever', 'infinity', 'under'],
    ] },
    { title: 'Play and motion', line: 'caught mid-move', items: [
        ['Kite', 'a kite on the wind, its tail waving', 'kite', 'trail'],
        ['Paper bird', 'a folded bird that flaps', 'bird', 'trail'],
        ['Bounce', 'a ball bouncing a V into the air', 'bounce', 'stack'],
        ['Orbit', 'a moon going round an O', 'orbit', 'side'],
        ['Cursor', 'a pointer that clicks: agents doing things', 'cursor', 'tag'],
    ] },
];

/** The drawing for one key: { defs, body }, every id starting with `id`. */
function wildArt(key, id) {
    const draw = ART[key];
    return draw ? draw(id) : { defs: '', body: '' };
}

module.exports = { WILD_ROWS, wildArt, KEYS: Object.keys(ART) };
