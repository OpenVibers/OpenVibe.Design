'use strict';

/**
 * Elements in Design /create (OpenVibe Elements stage 2, 2026-11-11).
 *
 * An element is one ui.element@1 document: a look drawn from Design's control vocabulary and the theme's
 * tokens, a recipe from the fixed trigger and action catalogs, and the capabilities its actions need. The AI
 * writes the look and the recipe together; the SDK validates the document, an invalid take is asked once more
 * with the reasons, and a second refusal is said plainly.
 *
 * The preview never calls a robot, Live, Chat or AI's models. It runs the recipe against sample data (people of
 * each role pressing, a fake chat, and the robot actions drawn in OpenVibe.Bot's own arena) and lists what
 * would happen and what was refused, with the reason.
 */

const { vocabulary: designVocabulary } = require('../components/registry');

// The control components an element's look may name. Each is data: the component page draws it, the contract
// only checks the shape. `props` are the values the generated sliders move.
const COMPONENTS = Object.freeze([
    { name: 'button', title: 'Button', summary: 'One press action with a label and an icon.', props: { size: ['small', 'medium', 'large'] } },
    { name: 'toggle', title: 'Toggle', summary: 'A control that is on or off.', props: { on: [true, false] } },
    { name: 'slider', title: 'Slider', summary: 'A value between a minimum and a maximum.', props: { min: 0, max: 100, step: 1 } },
    { name: 'meter', title: 'Meter', summary: 'A readout of a value in a range: battery, hype, latency.', props: { value: 0, max: 100 } },
    { name: 'counter', title: 'Counter', summary: 'A count that goes up and down.', props: { start: 0 } },
    { name: 'readout', title: 'Readout', summary: 'One number with its unit.', props: { unit: '' } },
    { name: 'wheel', title: 'Wheel', summary: 'A spinning list whose result is the winner.', props: {} },
    { name: 'sound-pad', title: 'Sound pad', summary: 'A pad that plays one of the streamer\'s sounds.', props: {} },
    { name: 'ticker', title: 'Ticker', summary: 'A scrolling line of text.', props: {} },
    { name: 'alert', title: 'Alert', summary: 'A short call-out on the stream.', props: {} },
]);
const COMPONENT_NAMES = COMPONENTS.map((c) => c.name);
const COMPONENT = new Map(COMPONENTS.map((c) => [c.name, c]));

const TRIGGERS = {
    press: 'The element itself was pressed.',
    chat_command: 'A chat command, e.g. !dance.',
    chat_text: 'Chat says one of the words.',
    hold: 'The element is held down.',
    double_press: 'The element is pressed twice.',
    key: 'A key is pressed.',
    gamepad: 'A gamepad button is pressed.',
    follow: 'A new follower.',
    tip: 'A tip.',
    ai_moment: 'An AI Moment.',
    rundown_topic: 'A Rundown topic.',
    timer: 'A timer.',
    schedule: 'A schedule.',
    robot_telemetry: 'A robot sensor crosses a value.',
    robot_event: 'A robot event.',
    stream_start: 'The stream starts.',
    stream_end: 'The stream ends.',
    viewer_count: 'The viewer count crosses a number.',
    element_event: 'Another element fires.',
};

const ACTIONS = {
    'robot.drive_pulse': 'Drive the robot for a moment, then stop (direction, ms ≤ 3000).',
    'robot.head_preset': 'Take the robot\'s head to a preset (preset).',
    'robot.headlight': 'Turn the robot\'s headlight on or off (on, brightness, colour).',
    'robot.say': 'Make the robot say a line (text, voice).',
    'robot.macro': 'Replay a recorded robot macro (stage 4: the preview says it is not supported yet).',
    'chat.message': 'Send a chat message as the channel bot (text).',
    'chat.pin': 'Pin a chat message (source: trigger | latest).',
    'chat.poll': 'Start a poll (question, options).',
    'screen.alert': 'Show an alert on stream (title, text).',
    'screen.animation': 'Play an animation on screen (name).',
    'screen.confetti': 'Throw confetti (intensity).',
    'screen.sound': 'Play one of the streamer\'s sounds (sound, volume).',
    'screen.tts': 'Speak a line on stream (text, voice).',
    'screen.counter': 'Move one of the element\'s counters (key, by).',
    'screen.state': 'Set one of the element\'s state values (key, value).',
    'screen.visibility': 'Show or hide another element (element, visible).',
    'screen.scene': 'Switch the layout to a scene (scene).',
    'stream.clip': 'Clip the last seconds (seconds ≤ 30).',
    'stream.moment': 'Mark a moment (label).',
    'stream.title': 'Change the stream title (owner only).',
    'stream.category': 'Change the stream category (owner only).',
    'ai.ask': 'Ask an AI model through Exchange (prompt, model, max_cost_usd). THE PREVIEW NEVER RUNS IT.',
    'actor.task': 'Hand a task to an Actor agent (task).',
    'webhook.call': 'Call one of the streamer\'s own endpoints by name (endpoint).',
    'money.tip_goal': 'Update a tip goal\'s display; no money moves without Billing (goal).',
};
const PRODUCT = {
    'robot.drive_pulse': 'bot', 'robot.head_preset': 'bot', 'robot.headlight': 'bot', 'robot.say': 'bot', 'robot.macro': 'bot',
    'chat.message': 'chat', 'chat.pin': 'chat', 'chat.poll': 'chat',
    'screen.alert': 'live', 'screen.animation': 'live', 'screen.confetti': 'live', 'screen.sound': 'live',
    'screen.tts': 'live', 'screen.counter': 'live', 'screen.state': 'live', 'screen.visibility': 'live',
    'screen.scene': 'live', 'stream.clip': 'live', 'stream.moment': 'live', 'stream.title': 'live',
    'stream.category': 'live', 'ai.ask': 'ai', 'actor.task': 'actor', 'webhook.call': 'live', 'money.tip_goal': 'billing',
};

const fail = (message, code = 'element.invalid') => Object.assign(new Error(message), { status: 422, code });
const textOf = (v) => (typeof v === 'string' ? v.trim() : '');

/** The theme's token names, without the leading `--`: tint is a name the theme turns into a colour. */
function themeTokens(variables = {}) {
    return Object.keys(variables)
        .filter((name) => /^--[a-z][a-z0-9-]{1,40}$/.test(name))
        .map((name) => name.slice(2));
}

/** The system prompt for an element: JSON only, the catalogs, the theme's token names and the control set. */
function elementSystemPrompt() {
    return [
        'You are OpenVibe Elements\' designer. You write ONE ui.element@1 element as JSON: a small control for a stream, with a look and a recipe.',
        'Return only a JSON object. No prose, no code fences, no HTML.',
        'The object is: {name, description, look, recipe, capabilities, initial_state?}. The author and sharing are filled by OpenVibe.',
        'look is {component, label, icon?, props?, style?}. component is one of: ' + COMPONENT_NAMES.join(', ') + '.',
        'label is 1–40 characters, the words on the control. icon is a lower-case glyph name.',
        'props holds the component\'s own values (text, number or true/false only). style is {tint, shape, opacity, show_label}:',
        'tint is a theme token NAME without -- (for example accent or bg-card), never a colour; shape is round, pill or square; opacity 0.4–1.',
        'recipe is {triggers, conditions?, actions}. triggers use the kinds and fields below; actions use the kinds and fields below.',
        'Every action must appear in capabilities as its kind. A recipe uses only the catalog: never invent a trigger or action.',
        'Use this catalog:',
        Object.entries(TRIGGERS).map(([k, v]) => `- trigger ${k}: ${v}`).join('\n'),
        Object.entries(ACTIONS).map(([k, v]) => `- action ${k} (product ${PRODUCT[k]}): ${v}`).join('\n'),
        'conditions: {role, cost:{points}, cooldown:{per_person_seconds, overall_seconds}, daily_cap:{per_person, overall}, live_only, robot_turn_only, chance:{one_in}}.',
        'role is everyone, follower, subscriber, vip, operator or owner. Money never moves: only channel points.',
        'The element carries no URL, no HTML and no script. It never adds a power: the product still checks the presser and the limits.',
        'The person\'s words decide the recipe. "once a minute" is cooldown overall_seconds 60; "costs 100 points" is cost.points 100; "the robot spins" is robot.drive_pulse with direction spin_left or spin_right.',
        'For AI, use ai.ask with a short prompt and, when known, a model and a max_cost_usd; the price is looked up live.',
        'If the person asks for something the catalog cannot do, choose the closest real action and say what it does in the description.',
        'OpenVibe design vocabulary (for the look\'s wording, not component names):',
        designVocabulary().slice(0, 4000),
    ].join('\n');
}

/** The person's words, the theme and the frame, as one user message. */
function elementPrompt({ prompt, variables = {}, component = null }) {
    const tokens = themeTokens(variables);
    return [
        `Make this element: ${String(prompt || '').trim()}`,
        component ? `Use the component "${component}".` : 'Choose the component that fits the job.',
        tokens.length ? `The theme's token names: ${tokens.join(', ')}. Use ONLY these as the look's tint.` : 'Use tint accent.',
        'Return the JSON object only.',
    ].join('\n');
}

/** The first JSON object in a model's answer: fences and a sentence before it are allowed; nothing else is. */
function parseElement(answer) {
    let text = String(answer || '').trim().replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    if (!text) throw fail('The AI returned nothing.');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw fail('The AI did not return a JSON object.');
    let doc;
    try { doc = JSON.parse(text.slice(start, end + 1)); } catch (err) { throw fail(`The AI's JSON could not be read: ${String(err.message).slice(0, 120)}.`); }
    if (doc && doc.element && typeof doc.element === 'object' && !Array.isArray(doc.element)) doc = doc.element;
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw fail('The AI did not return one element object.');
    return doc;
}

let sdk = null;
try { sdk = require('openvibe-sdk/elements'); } catch { /* the SDK release that carries elements is not pinned yet */ }
const contracts = require('openvibe-contracts');
const HAS_CONTRACT = (() => { try { return Boolean(contracts.schema('ui.element@1')); } catch { return false; } })();

const reasonsOf = (r) => {
    if (!r) return ['the validator gave no reason'];
    if (Array.isArray(r)) return r.map(String);
    if (Array.isArray(r.reasons)) return r.reasons.map(String);
    if (Array.isArray(r.errors)) return r.errors.map((e) => (e && (e.message || e.detail)) || String(e));
    if (r.message) return [String(r.message)];
    return ['the validator gave no reason'];
};

/**
 * Validate one element. The SDK's `elements.validate` is the authority when this Design's pinned SDK has it; the
 * contracts schema is next; the local shape check keeps a take from being accepted before either is released.
 * The Design-only rules (a component in the control set, a tint that is a theme token) are added on top.
 */
function validateElement(doc) {
    const reasons = [];
    if (sdk && typeof sdk.validate === 'function') {
        let out;
        try { out = sdk.validate(doc); } catch (err) { out = { valid: false, errors: [{ message: err.message }] }; }
        if (!(out === true || (out && (out.ok === true || out.valid === true)))) reasons.push(...reasonsOf(out));
    } else if (HAS_CONTRACT) {
        const out = contracts.validate('ui.element@1', doc);
        if (!out.valid) reasons.push(...(out.errors || []).map((e) => `${e.path === '/' ? '' : `${e.path} `}${String(e.message).replace(/^must /, '')}`));
    } else {
        reasons.push(...localReasons(doc));
    }
    const look = doc && doc.look;
    if (look && !COMPONENT.has(look.component)) reasons.push(`look.component must be one of ${COMPONENT_NAMES.join(', ')}.`);
    if (look && look.style && look.style.tint && !/^[a-z][a-z0-9-]{0,39}$/.test(look.style.tint)) reasons.push('look.style.tint must be a theme token name, never a colour.');
    return { ok: reasons.length === 0, reasons: [...new Set(reasons)].slice(0, 8) };
}

/** The smallest shape check, used only before the SDK or the contracts carry the schema. */
function localReasons(doc) {
    const out = [];
    if (!doc || typeof doc !== 'object') return ['the answer is not an object'];
    for (const key of ['name', 'author', 'sharing', 'look', 'recipe', 'capabilities']) if (doc[key] == null) out.push(`${key} is required`);
    if (doc.look && typeof doc.look !== 'object') out.push('look must be an object');
    if (doc.recipe) {
        if (!Array.isArray(doc.recipe.triggers) || !doc.recipe.triggers.length) out.push('recipe.triggers needs at least one trigger');
        if (!Array.isArray(doc.recipe.actions) || !doc.recipe.actions.length) out.push('recipe.actions needs at least one action');
        const actions = Array.isArray(doc.recipe.actions) ? doc.recipe.actions : [];
        const declared = new Set(Array.isArray(doc.capabilities) ? doc.capabilities : []);
        for (const a of actions) {
            if (!a || !ACTIONS[a.kind]) out.push(`action ${a && a.kind} is not in the catalog`);
            else if (a.product !== PRODUCT[a.kind]) out.push(`${a.kind} is authorised by ${PRODUCT[a.kind]}`);
            else if (!declared.has(a.kind)) out.push(`${a.kind} is not in capabilities`);
        }
        for (const t of Array.isArray(doc.recipe.triggers) ? doc.recipe.triggers : []) if (!t || !TRIGGERS[t.kind]) out.push(`trigger ${t && t.kind} is not in the catalog`);
    }
    return out;
}

/** Add what Design owns (the author and the private sharing) and keep the model's words. */
function prepareElement(doc, { authorName = 'A maker' } = {}) {
    const out = JSON.parse(JSON.stringify(doc));
    delete out.element;
    out.author = { name: authorName };
    out.sharing = 'private';
    if (!out.description) out.description = '';
    return out;
}

/** The tweak sliders an element gets: size, tint and label, drawn from its own look and the theme. */
function tweaksFor(doc, variables = {}) {
    const tokens = themeTokens(variables);
    const look = doc && doc.look ? doc.look : {};
    const props = look.props || {};
    const sizes = (COMPONENT.get(look.component) || {}).props && COMPONENT.get(look.component).props.size;
    const tweaks = [];
    if (Array.isArray(sizes) && sizes.length) {
        const at = Math.max(0, sizes.indexOf(props.size));
        tweaks.push({ name: 'size', label: 'Size', kind: 'range', min: 0, max: sizes.length - 1, step: 1, value: at, options: sizes });
    }
    if (tokens.length) {
        const current = (look.style && look.style.tint) || 'accent';
        const choices = (tokens.includes(current) ? tokens : [current, ...tokens]).slice(0, 24);
        tweaks.push({ name: 'tint', label: 'Tint', kind: 'range', min: 0, max: choices.length - 1, step: 1, value: Math.max(0, choices.indexOf(current)), options: choices });
    }
    tweaks.push({ name: 'label', label: 'Label', kind: 'text', value: look.label || '', maxlength: 40 });
    tweaks.push({ name: 'show_label', label: 'Show label', kind: 'checkbox', value: !(look.style && look.style.show_label === false) });
    return tweaks;
}

/** Apply the sliders' values to a copy of the element. Values are indices or text, never a colour or markup. */
function applyTweaks(doc, values = {}, variables = {}) {
    const out = JSON.parse(JSON.stringify(doc));
    out.look = out.look && typeof out.look === 'object' ? out.look : {};
    const look = out.look;
    look.props = look.props && typeof look.props === 'object' ? look.props : {};
    look.style = look.style && typeof look.style === 'object' ? look.style : {};
    const sizes = (COMPONENT.get(look.component) || {}).props && COMPONENT.get(look.component).props.size;
    if (values.size != null && Array.isArray(sizes)) {
        const at = Number(values.size);
        if (!Number.isInteger(at) || at < 0 || at >= sizes.length) throw fail('Choose a size from the list.');
        look.props.size = sizes[at];
    }
    const tokens = themeTokens(variables);
    if (values.tint != null && tokens.length) {
        const current = look.style.tint || 'accent';
        const choices = tokens.includes(current) ? tokens : [current, ...tokens];
        const at = Number(values.tint);
        if (!Number.isInteger(at) || at < 0 || at >= Math.min(24, choices.length)) throw fail('Choose a tint from the theme.');
        look.style.tint = choices[at];
    }
    if (values.label != null) {
        const label = textOf(values.label);
        if (!label || label.length > 40) throw fail('The label must be 1 to 40 characters.');
        if (/https?:\/\//i.test(label) || /<[a-z!/]/i.test(label)) throw fail('The label cannot carry a link or markup.');
        look.label = label;
    }
    if (values.show_label != null) look.style.show_label = values.show_label === true || values.show_label === 'on' || values.show_label === '1';
    return out;
}

/** The look as plain markup on the page's tokens. The real component is drawn on the live surface. */
function renderLook(doc) {
    const look = (doc && doc.look) || {};
    const style = look.style || {};
    const tint = `var(--${String(style.tint || 'accent').replace(/[^a-z0-9-]/g, '')}, var(--accent))`;
    const shape = style.shape === 'round' ? '50%' : style.shape === 'square' ? '8px' : '999px';
    const opacity = style.opacity != null ? Math.max(0.4, Math.min(1, Number(style.opacity))) : 1;
    const label = style.show_label === false ? '' : String(look.label || '');
    const component = String(look.component || 'button');
    const props = look.props || {};
    let inner = '';
    switch (component) {
        case 'meter': {
            const max = Math.max(1, Number(props.max) || 100);
            const pct = Math.max(0, Math.min(100, Math.round((Number(props.value) || 0) / max * 100)));
            inner = `<span class="dv-elx-bar"><span style="width:${pct}%"></span></span>`;
            break;
        }
        case 'counter': inner = `<span class="dv-elx-number">${Number(props.start) || 0}</span>`; break;
        case 'readout': inner = `<span class="dv-elx-number">0<small>${String(props.unit || '')}</small></span>`; break;
        case 'toggle': inner = `<span class="dv-elx-switch" aria-hidden="true"></span>`; break;
        case 'slider': inner = `<span class="dv-elx-slider" aria-hidden="true"></span>`; break;
        case 'wheel': inner = '<span class="dv-elx-wheel" aria-hidden="true">✦</span>'; break;
        case 'ticker': inner = '<span class="dv-elx-ticker" aria-hidden="true">· · ·</span>'; break;
        case 'alert': inner = '<span class="dv-elx-alert" aria-hidden="true">!</span>'; break;
        case 'sound-pad': inner = '<span class="dv-elx-pad" aria-hidden="true">♪</span>'; break;
        default: inner = '';
    }
    return `<span class="dv-elx" data-component="${component}" style="--el-tint:${tint};--el-radius:${shape};opacity:${opacity}">${inner}${label ? `<span class="dv-elx-label">${esc(label)}</span>` : ''}<small>${component}</small></span>`;
}

function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── The sample run (never a robot, Live, Chat or AI) ──────────────────────
const ROLE_RANK = { everyone: 0, follower: 1, subscriber: 2, vip: 3, operator: 4, owner: 5 };
const SAMPLE_PEOPLE = [
    { name: 'Ada', role: 'everyone', points: 250 },
    { name: 'Ben', role: 'follower', points: 250 },
    { name: 'Cy', role: 'subscriber', points: 250 },
    { name: 'Dee', role: 'vip', points: 250 },
    { name: 'Eve', role: 'operator', points: 250 },
    { name: 'The owner', role: 'owner', points: 250 },
];

const effectOf = (action) => {
    switch (action.kind) {
        case 'robot.drive_pulse': return { kind: 'robot', text: `The robot drives ${String(action.direction || 'forward').replace(/_/g, ' ')} for ${(Number(action.ms) || 0) / 1000}s (simulated).`, robot: action };
        case 'robot.head_preset': return { kind: 'robot', text: `The robot's head goes to "${action.preset}" (simulated).` };
        case 'robot.headlight': return { kind: 'robot', text: `The robot's headlight turns ${action.on ? 'on' : 'off'} (simulated).`, headlight: Boolean(action.on) };
        case 'robot.say': return { kind: 'robot', text: `The robot says: "${action.text}" (simulated).`, say: action.text };
        case 'robot.macro': return { kind: 'robot', text: `The macro "${action.macro}" is not supported yet; the preview leaves it for stage 4.`, unsupported: true };
        case 'chat.message': return { kind: 'chat', text: `Chat, as the channel bot: "${action.text}".` };
        case 'chat.pin': return { kind: 'chat', text: `Pins the ${action.source === 'latest' ? 'newest message' : 'message that fired it'}.` };
        case 'chat.poll': return { kind: 'chat', text: `Starts a poll: "${action.question}" (${(action.options || []).join(' / ')}).` };
        case 'screen.alert': return { kind: 'screen', text: `Alert on stream: "${action.title}"${action.text ? ` — ${action.text}` : ''}.` };
        case 'screen.animation': return { kind: 'screen', text: `Plays the animation "${action.name}".` };
        case 'screen.confetti': return { kind: 'screen', text: `Throws confetti (${action.intensity || 'medium'}).` };
        case 'screen.sound': return { kind: 'screen', text: `Plays the sound "${action.sound}".` };
        case 'screen.tts': return { kind: 'screen', text: `Speaks on stream: "${action.text}".` };
        case 'screen.counter': return { kind: 'state', text: `Counter ${action.key} moves by ${action.by}.`, state: { key: action.key, by: action.by } };
        case 'screen.state': return { kind: 'state', text: `State ${action.key} becomes ${JSON.stringify(action.value)}.`, state: { key: action.key, value: action.value } };
        case 'screen.visibility': return { kind: 'screen', text: `${action.visible ? 'Shows' : 'Hides'} element ${action.element}.` };
        case 'screen.scene': return { kind: 'screen', text: `Switches to the scene "${action.scene}".` };
        case 'stream.clip': return { kind: 'stream', text: `Clips the last ${action.seconds || 30} seconds.` };
        case 'stream.moment': return { kind: 'stream', text: `Marks the moment${action.label ? ` "${action.label}"` : ''}.` };
        case 'stream.title': return { kind: 'stream', text: `Changes the stream title (owner only).` };
        case 'stream.category': return { kind: 'stream', text: `Changes the stream category (owner only).` };
        case 'ai.ask': return { kind: 'ai', text: `Would ask ${action.model || 'the routed model'} on Exchange: "${action.prompt}". The preview never runs it.`, ai: action };
        case 'actor.task': return { kind: 'ai', text: 'Would hand a task to an Actor agent. The preview never runs it.' };
        case 'webhook.call': return { kind: 'stream', text: `Would call the streamer's endpoint "${action.endpoint}". The preview never sends it.` };
        case 'money.tip_goal': return { kind: 'money', text: `Updates the tip goal "${action.goal}"'s display; no money moves.` };
        default: return { kind: 'unknown', text: `The action ${action.kind} is not one the preview knows.` };
    }
};

/**
 * Run one element on sample data. Every person of each role presses once, a fake chat says the command (when the
 * trigger is a chat command) and the role, cooldown, points, chance and daily-cap conditions are applied by the
 * same rules the host will. The robot actions are only drawn, never sent.
 */
function simulateElement(doc, { price = null } = {}) {
    const recipe = (doc && doc.recipe) || {};
    const conditions = recipe.conditions || {};
    const role = conditions.role || 'everyone';
    const required = ROLE_RANK[role] == null ? 0 : ROLE_RANK[role];
    const points = conditions.cost && Number(conditions.cost.points) > 0 ? Number(conditions.cost.points) : 0;
    const cool = conditions.cooldown || {};
    const overall = Number(cool.overall_seconds) || 0;
    const perPerson = Number(cool.per_person_seconds) || 0;
    const oneIn = conditions.chance && Number(conditions.chance.one_in) > 1 ? Number(conditions.chance.one_in) : 0;
    const events = [];
    let at = 0;
    let lastBy = null;
    let lastOverall = null;
    let state = { ...(doc.initial_state || {}) };
    let headlights = false;
    let robot = null;
    const push = (kind, text, extra = {}) => { at += 1; events.push({ at, kind, text, ...extra }); };

    const allowed = (person) => {
        if (ROLE_RANK[person.role] < required) {
            push('refused', `${person.name} (${person.role}) cannot: this element is for ${role}s.`);
            return false;
        }
        if (lastOverall != null && overall && at - lastOverall < overall) {
            push('refused', `${person.name} is refused: the overall cooldown is ${overall}s and only ${at - lastOverall}s have passed.`);
            return false;
        }
        if (lastBy === person.name && perPerson) {
            push('refused', `${person.name} is refused: their own cooldown is ${perPerson}s.`);
            return false;
        }
        if (points && person.points < points) {
            push('refused', `${person.name} cannot afford ${points} points.`);
            return false;
        }
        if (oneIn) {
            // A real host draws the lot; the sample run is deterministic and says which side it landed on.
            push('chance', `A 1-in-${oneIn} draw: the sample lands on "go" (a real run may refuse and cost nothing).`);
        }
        return true;
    };

    const fire = (person, trigger) => {
        if (!allowed(person)) return;
        lastBy = person.name;
        lastOverall = at;
        if (points) push('cost', `${person.name} spends ${points} channel points (${person.points} → ${person.points - points}).`, { person: person.name });
        for (const action of recipe.actions || []) {
            const effect = effectOf(action);
            if (effect.state) {
                if (effect.state.by != null) state[effect.state.key] = (Number(state[effect.state.key]) || 0) + effect.state.by;
                else state[effect.state.key] = effect.state.value;
            }
            if (effect.headlight != null) headlights = effect.headlight;
            if (effect.robot && action.kind === 'robot.drive_pulse') robot = { direction: action.direction, ms: Number(action.ms) || 0 };
            push(effect.kind, effect.text, { person: person.name, trigger, ...(effect.robot ? { robot: effect.robot } : {}), ...(effect.headlight != null ? { headlight: effect.headlight } : {}), ...(effect.say ? { say: effect.say } : {}), ...(effect.unsupported ? { unsupported: true } : {}) });
        }
    };

    const command = (recipe.triggers || []).find((t) => t.kind === 'chat_command');
    if (command) {
        const lines = [`${command.command}`, 'hello!', `${command.command}`];
        for (const [i, line] of lines.entries()) {
            at += 5;
            const person = SAMPLE_PEOPLE[(i + 2) % SAMPLE_PEOPLE.length];
            events.push({ at, kind: 'chat', person: person.name, role: person.role, text: `Chat: ${person.name}: ${line}` });
            if (line === command.command) fire(person, 'chat_command');
        }
    } else {
        for (const person of SAMPLE_PEOPLE) {
            at += 2;
            events.push({ at, kind: 'press', person: person.name, role: person.role, text: `${person.name} (${person.role}) presses.` });
            fire(person, (recipe.triggers || [])[0] ? recipe.triggers[0].kind : 'press');
        }
    }

    return {
        role, points, cooldown: { per_person: perPerson, overall }, chance: oneIn,
        people: SAMPLE_PEOPLE.map((p) => ({ name: p.name, role: p.role })),
        events, state, headlights, robot,
        price,
        note: 'Sample data only: no robot, no Live channel, no chat and no AI call. The robot picture is drawn in Bot\'s simulated arena.',
    };
}

/** The price line for an element: the AI it would call, from Exchange's live catalogue, and its own budget cap. */
function aiCallsOf(doc) {
    return ((doc && doc.recipe && doc.recipe.actions) || []).filter((a) => a && a.kind === 'ai.ask');
}

/**
 * Price the element's AI calls from the live catalogue. Returns one row per action: the model, its in/out prices
 * per million tokens, and the action's own cap. Nothing here is estimated beyond the catalogue's own numbers.
 */
async function priceOf(elementDoc, ai) {
    const calls = aiCallsOf(elementDoc);
    if (!calls.length) return { calls: [], text: 'No AI it calls: it runs from the recipe alone.' };
    let models = [];
    try { models = (await ai.exchangeCatalog({ kind: 'chat' })).models || []; } catch { /* the page says unavailable */ }
    const rows = calls.map((call) => {
        const wanted = String(call.model || '');
        const found = models.find((m) => m.slug === wanted || m.id === wanted || m.canonical === wanted)
            || models.find((m) => wanted && String(m.name || '').toLowerCase().includes(wanted.toLowerCase()))
            || models.find((m) => (m.offers || []).some((o) => o.price));
        const offers = (found && found.offers) || [];
        const priced = offers.filter((o) => o.price && Number.isFinite(Number(o.price.in)) && Number.isFinite(Number(o.price.out)));
        priced.sort((a, b) => (Number(a.price.in) + Number(a.price.out)) - (Number(b.price.in) + Number(b.price.out)));
        const offer = priced[0] || offers[0] || null;
        return {
            prompt: call.prompt, model: found ? (found.name || found.slug) : (wanted || 'Router choice'),
            price_in: offer && offer.price ? Number(offer.price.in) : null,
            price_out: offer && offer.price ? Number(offer.price.out) : null,
            max_cost_usd: call.max_cost_usd == null ? null : Number(call.max_cost_usd),
            available: Boolean(found && offer),
        };
    });
    const known = rows.filter((r) => r.price_in != null);
    const text = known.length
        ? rows.map((r) => `${r.model}: $${r.price_in}/M in · $${r.price_out}/M out${r.max_cost_usd != null ? ` · at most $${r.max_cost_usd} a press` : ''}`).join(' · ')
        : 'The AI it calls is not on the live catalogue right now; the price is unknown until it is.';
    return { calls: rows, text };
}

module.exports = {
    COMPONENTS, COMPONENT_NAMES, COMPONENT, TRIGGERS, ACTIONS, PRODUCT,
    elementSystemPrompt, elementPrompt, parseElement, validateElement, prepareElement,
    tweaksFor, applyTweaks, renderLook, simulateElement, priceOf, aiCallsOf, themeTokens,
};
