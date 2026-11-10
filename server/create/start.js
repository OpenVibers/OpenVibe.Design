'use strict';

/** A starting point's stored shape and the text it adds to the generator's prompt. No I/O here. */

function publicStart(start = {}) {
    return {
        ...(start.url ? { url: start.url } : {}),
        ...(start.title ? { title: start.title } : {}),
        ...(start.design_id ? { design_id: start.design_id } : {}),
        ...(start.image ? { image: start.image } : {}),
        ...(start.image_url ? { image_url: start.image_url } : {}),
        ...(start.source_design_id ? { source_design_id: start.source_design_id } : {}),
    };
}

function containsStart(start) {
    return Boolean(start && (start.url || start.design_id || start.image));
}

/** The text a starting point adds to the generator's prompt. */
function startPrompt(start = {}) {
    const parts = [];
    if (start.url) parts.push(`Use this page as the starting point. Keep what is useful and make the design the person asked for.\nStarting page: ${start.title || start.url}\n${start.excerpt || ''}`.trim());
    if (start.design_id) parts.push(`Start from this existing design. Keep its structure and content unless the request asks otherwise.\n<<<START_DESIGN\n${start.excerpt || ''}\nSTART_DESIGN>>>`);
    if (start.image) parts.push(`The person added a reference image on OpenVibe.Media: ${start.image_url || start.image}. Use it for visual direction.`);
    return parts.join('\n\n');
}

module.exports = { publicStart, containsStart, startPrompt };
