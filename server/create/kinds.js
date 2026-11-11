'use strict';

/**
 * What a create request is asking for, in one place.
 *
 * A kind is ONE entry here: its id, the plain name the screen shows, a short hint, the instruction the
 * generator adds for it, and the frames it allows. Adding a kind is adding one object; the options API,
 * the request validation, the stored design and the generation prompt all read this file.
 *
 * A frame is the shape the frame is judged in (the width and height the screen draws and the prompt
 * names). `instructionFor` stitches the kind and the frame into the text the generator receives.
 */

const FRAMES = [
    { id: 'desktop', name: 'Desktop', width: 1280, height: 900 },
    { id: 'phone', name: 'Phone', width: 390, height: 844 },
    { id: 'tablet', name: 'Tablet', width: 834, height: 1112 },
    { id: 'slide', name: 'Slide 16:9', width: 1920, height: 1080 },
    { id: 'email', name: 'Email 600', width: 600, height: 1200 },
    { id: 'square', name: 'Social square', width: 1080, height: 1080 },
    { id: 'story', name: 'Story 9:16', width: 1080, height: 1920 },
    { id: 'mark', name: 'Mark', width: 512, height: 512 },
];

const KINDS = [
    {
        id: 'page', name: 'Page', hint: 'A landing or content page', frames: ['desktop', 'phone', 'tablet'],
        instruction: 'Build one complete, responsive page: a clear first screen, real content, a primary action, and a sensible reading order. It must hold together at every allowed frame width.',
    },
    {
        id: 'screen', name: 'App screen', hint: 'A phone-first app screen or flow', frames: ['phone', 'tablet'],
        instruction: 'Build one complete app screen or a short flow: one clear task, thumb-sized controls, safe areas, and a bottom bar only when it helps the task. Every control has a visible state.',
    },
    {
        id: 'component', name: 'Component', hint: 'One interface component with its states', frames: ['desktop', 'phone'],
        instruction: 'Build one self-contained interface component and show its states side by side (default, hover or focus where relevant, empty, and one busy or error state). Name the component in the page and keep its anatomy and keyboard behaviour clear.',
    },
    {
        id: 'slide', name: 'Slide', hint: 'One 16:9 presentation slide', frames: ['slide'],
        instruction: 'Build one presentation slide at 16:9: a title, the few lines that carry the point, and one visual that earns its place. Everything must be readable when the slide is shown, not scrolled.',
    },
    {
        id: 'email', name: 'Email', hint: 'A 600 px email that survives a mail client', frames: ['email'],
        instruction: 'Build one email at 600 px wide: table-friendly markup, inline styling, no scripts, no external stylesheet, and one clear action. It must read well with images off; use text and colour, not remote images.',
    },
    {
        id: 'social-card', name: 'Social card', hint: 'A square or story card for sharing', frames: ['square', 'story'],
        instruction: 'Build one share card at the chosen frame: a single idea, a short headline, a supporting line and the OpenVibe mark. It must be legible at a glance and stay inside the safe margins of the frame.',
    },
    {
        id: 'mark', name: 'Mark', hint: 'A logo or small brand mark sheet', frames: ['mark'],
        instruction: 'Build one brand mark sheet: the mark, a wordmark, a small palette and two or three lockups. The mark must stay recognisable at 16 px and be drawn with inline SVG, not a remote image.',
    },
    {
        id: 'element', name: 'Element', hint: 'A control or stream widget with a recipe', frames: ['phone', 'desktop'],
        instruction: 'Write one ui.element@1 element as JSON: its look (a control component and the theme tokens) and its recipe (triggers, conditions and actions from the fixed catalogs). Return the JSON object only.',
    },
];

const BY_ID = new Map(KINDS.map((kind) => [kind.id, kind]));
const FRAME_BY_ID = new Map(FRAMES.map((frame) => [frame.id, frame]));

/** The one kind with this id, or null. */
function kindOf(id) {
    return BY_ID.get(String(id == null ? '' : id).trim()) || null;
}

/** The one frame with this id, or null. */
function frameOf(id) {
    return FRAME_BY_ID.get(String(id == null ? '' : id).trim()) || null;
}

/** The frames a kind allows, as full frame objects. */
function framesFor(kindId) {
    const kind = kindOf(kindId);
    if (!kind) return [];
    return kind.frames.map((id) => FRAME_BY_ID.get(id)).filter(Boolean);
}

/** The instruction the generator adds for a kind at a frame. */
function instructionFor(kindId, frameId) {
    const kind = kindOf(kindId);
    if (!kind) return '';
    const frame = frameOf(frameId);
    const shape = frame
        ? `The frame is ${frame.name}: ${frame.width} × ${frame.height} px. Draw for that frame exactly; do not add a device mockup around it.`
        : '';
    return [kind.instruction, shape].filter(Boolean).join('\n');
}

/** The category name the Arena's system prompt knows for a kind (server/arena/ai.js CATEGORY_BRIEF). */
function categoryFor(kindId) {
    switch (String(kindId || 'page')) {
        case 'screen': return 'mobile_app';
        case 'component': return 'component';
        case 'slide': return 'slides';
        case 'email': return 'email';
        case 'social-card': return 'social';
        case 'mark': return 'mark';
        case 'element': return 'component';
        default: return 'landing';
    }
}

const KIND_IDS = KINDS.map((kind) => kind.id);
const FRAME_IDS = FRAMES.map((frame) => frame.id);

module.exports = { KINDS, FRAMES, KIND_IDS, FRAME_IDS, kindOf, frameOf, framesFor, instructionFor, categoryFor };
