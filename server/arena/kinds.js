'use strict';

/**
 * The nine design kinds OpenVibe.Bench judges (plan L51 step 1). Design's /arena is a view of them: a blind pair of
 * any kind, judged on the page, and each kind's board.
 *
 *   viewports  the entry is a whole page, so it is compared at desktop (1280 px) and phone (390 px) widths;
 *              the others are one piece of art, drawn once in a 4:3 frame.
 *   glyph      the Shared glyph the kind's chip wears.
 */
const DESIGN_KINDS = Object.freeze([
    { id: 'design.page', name: 'Pages', line: 'Whole landing pages', glyph: 'window', viewports: true },
    { id: 'design.ui', name: 'Screens', line: 'App and dashboard screens', glyph: 'computer', viewports: true },
    { id: 'design.interface', name: 'Systems', line: 'Components that belong together', glyph: 'layers', viewports: true },
    { id: 'design.component', name: 'Components', line: 'One component or a logo', glyph: 'shapes', viewports: false },
    { id: 'design.svg', name: 'Illustration', line: 'SVG art and icon sets', glyph: 'pencil', viewports: false },
    { id: 'design.motion', name: 'Motion', line: 'Animation and effects', glyph: 'film', viewports: false },
    { id: 'design.dataviz', name: 'Charts', line: 'Data drawn to be read', glyph: 'chart', viewports: false },
    { id: 'design.model3d', name: '3D models', line: 'Models you can turn', glyph: 'cubes', viewports: false },
    { id: 'design.shader', name: 'Shaders', line: 'Light and colour in GLSL', glyph: 'wave', viewports: false },
].map(Object.freeze));

const BY_ID = new Map(DESIGN_KINDS.map((k) => [k.id, k]));
const DEFAULT_KIND = 'design.page';

/** The kind a query names, by id ('design.svg') or short name ('svg'); anything else is the default. */
function kindOf(value) {
    const v = String(value == null ? '' : value).trim().toLowerCase();
    if (BY_ID.has(v)) return BY_ID.get(v);
    if (BY_ID.has(`design.${v}`)) return BY_ID.get(`design.${v}`);
    return BY_ID.get(DEFAULT_KIND);
}

const isKind = (value) => BY_ID.has(String(value == null ? '' : value));

module.exports = { DESIGN_KINDS, DEFAULT_KIND, kindOf, isKind };
