'use strict';

/**
 * The first official pack (OpenVibe Elements stage 2): the LOOI pack, published by OpenVibe, free.
 *
 * LOOI is the tracked desk robot whose head is a phone. The pack gives its owner a Viewer Deck: head presets,
 * say lines and the headlights. The robot actions are requests through Bot's existing command path; the
 * headlights need a LOOI profile with the headlight action (dsh:looi-headlights-1111d), and a preset the robot's
 * profile does not have is refused by Bot, never invented here. A "look around" macro is stage 4 because the
 * action catalog does not carry robot macros yet.
 *
 * Seeded once on Design's own start, by OpenVibe (author_subject NULL), never for a person. The seed is
 * idempotent: an existing `looi-pack` slug (the official one, or one that took the name) is left alone.
 */
const author = { name: 'OpenVibe' };
const button = (label) => ({ component: 'button', label, props: { size: 'large' }, style: { tint: 'accent', shape: 'pill', opacity: 1, show_label: true } });

const el = (name, description, look, action) => ({
    name,
    description,
    author,
    sharing: 'gallery',
    look,
    recipe: {
        triggers: [{ kind: 'press' }],
        conditions: { role: 'everyone', cooldown: { per_person_seconds: 5, overall_seconds: 2 } },
        actions: [action],
    },
    capabilities: [action.kind],
});

function looiPack() {
    return {
        pack: 'ui.element-pack@1',
        name: 'LOOI pack',
        description: 'Head presets, say lines and the headlights for the LOOI desk robot. Free; every action still goes through Bot\'s checks and your own limits.',
        author,
        sharing: 'gallery',
        items: [
            el('Look up', 'Tilt the head up.', button('Look up'), { kind: 'robot.head_preset', product: 'bot', preset: 'up' }),
            el('Look down', 'Tilt the head down.', button('Look down'), { kind: 'robot.head_preset', product: 'bot', preset: 'down' }),
            el('Look level', 'Bring the head back to level.', button('Look level'), { kind: 'robot.head_preset', product: 'bot', preset: 'center' }),
            el('Say hello', 'The robot says hello to chat.', button('Say hello'), { kind: 'robot.say', product: 'bot', text: 'Hello, chat!' }),
            el('Say nice', 'The robot says something nice.', button('Say nice'), { kind: 'robot.say', product: 'bot', text: 'You are doing great.' }),
            el('Say bye', 'The robot says goodbye.', button('Say bye'), { kind: 'robot.say', product: 'bot', text: 'See you next stream!' }),
            el('Headlights on', 'Turn the headlights on.', { component: 'toggle', label: 'Headlights on', icon: 'spark', props: { on: true }, style: { tint: 'accent', shape: 'pill', opacity: 1, show_label: true } }, { kind: 'robot.headlight', product: 'bot', on: true }),
            el('Headlights off', 'Turn the headlights off.', { component: 'toggle', label: 'Headlights off', icon: 'spark', props: { on: false }, style: { tint: 'surface', shape: 'pill', opacity: 1, show_label: true } }, { kind: 'robot.headlight', product: 'bot', on: false }),
        ],
    };
}

/** Publish the official pack once on this service's start; a failure is logged and never blocks the boot. */
async function seedOfficial(gallery, log = console) {
    try {
        const listing = await gallery.ensureOfficial({ slug: 'looi-pack', document: looiPack() });
        if (listing) log.log(`[OpenVibe.Design] official Elements pack ready: ${listing.slug} (${listing.kind})`);
        return listing;
    } catch (err) {
        log.warn('[OpenVibe.Design] the official LOOI pack was not seeded:', (err && err.message) || err);
        return null;
    }
}

module.exports = { looiPack, seedOfficial };
