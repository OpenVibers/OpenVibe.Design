'use strict';
/**
 * The typefaces and vectors a person makes with the model (plan R1 item 8, Seven Domains §11).
 *
 * Two makers and two pages. Every page is server-rendered and shows its content: the form, the drawings,
 * the specimen and the downloads are all in the HTML, and nothing is behind a tab.
 *
 * The specimen shows the face in its own voice: the font is written into the page as a data URL, so the
 * letters on screen are the letters the person just made.
 */
const { layout, esc } = require('../render/layout');

/** The stylesheet both pages share. */
const STYLES = ['css/typefaces.css'];

/** The font as a data URL the page can use: the specimen is drawn in the face it just made. */
function fontFace(woff2) {
    if (!woff2) return '';
    return '@font-face{font-family:"OpenVibe Made";src:url(data:font/woff2;base64,' + woff2.toString('base64') + ') format("woff2");font-weight:400;font-style:normal;font-display:swap}';
}

/** The maker: describe a face, start from an open one. */
function make({ bases = [], mine = [], signedIn = false, left = 0, perDay = 0 } = {}) {
    const options = bases.map((b) => '<option value="' + esc(b.id) + '">' + esc(b.family) + ' — ' + esc(b.category) + '</option>').join('');
    const owned = mine.length
        ? '<section class="tf-owned"><h2>Your typefaces</h2><ul>' + mine.map((f) => '<li><a href="/fonts/made/' + esc(f.id) + '">' + esc(f.name) + '</a><span>' + esc(f.glyphs.length) + ' letters' + (f.model ? ' · ' + esc(f.model) : '') + '</span></li>').join('') + '</ul></section>'
        : '';
    const body = '<div class="tf"><header class="tf-hero"><p class="tf-eyebrow">AI typefaces</p><h1>Describe a typeface.</h1>'
        + '<p>The model draws the letters, one batch at a time. You get the outlines, the font files and the licence.</p></header>'
        + (signedIn
            ? '<form class="tf-form" method="post" action="/fonts/make"><label for="tf-prompt">What kind of typeface?</label>'
              + '<textarea id="tf-prompt" name="prompt" required maxlength="600" placeholder="rounded geometric sans for a kids\' app, high x-height, open apertures"></textarea>'
              + '<label for="tf-name">Name it <small>optional</small></label><input id="tf-name" name="name" maxlength="60" placeholder="Bubble Sans">'
              + '<label for="tf-base">Start from an open font <small>optional</small></label><select id="tf-base" name="base" data-ov-native><option value="">No base, just the description</option>' + options + '</select>'
              + '<button type="submit">Draw the typeface</button>'
              + '<p class="tf-cap">' + esc(perDay) + ' model runs a day. You have ' + esc(left) + ' left today.</p></form>'
            : '<p class="tf-signin"><a href="/auth/login">Sign in</a> to draw a typeface. The runs are charged to your own allowance.</p>')
        + owned
        + '</div>';
    return layout({ title: 'Make a typeface', description: 'Describe a typeface and the model draws it: the outlines, a WOFF2 and an OTF, under the SIL Open Font License.',
        path: '/fonts/make', active: '/fonts', styles: STYLES, body });
}

/** The specimen: the face in its own voice, the download, and the redraw. */
function specimen({ face, compiled, chars = '' } = {}) {
    const glyphs = Array.isArray(face.glyphs) ? face.glyphs : [];
    const css = compiled && compiled.ok ? fontFace(compiled.woff2) : '';
    const sample = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const rows = chars.split('').map((c) => {
        const g = glyphs.find((x) => x.char === c);
        return '<option value="' + esc(c) + '"' + (g ? '' : ' disabled') + '>' + esc(c) + '</option>';
    }).join('');
    const letters = sample.split('').map((c) => {
        const g = glyphs.find((x) => x.char === c);
        return '<span class="tf-letter' + (g ? '' : ' tf-missing') + '">' + esc(c) + '</span>';
    }).join('');
    const body = '<div class="tf tf-specimen"><a class="tf-back" href="/fonts/make">← Make another</a>'
        + '<header class="tf-hero"><p class="tf-eyebrow">' + esc(face.license) + (face.model ? ' · drawn by ' + esc(face.model) : '') + '</p>'
        + '<h1 class="tf-name" style="font-family:\'OpenVibe Made\',sans-serif">' + esc(face.name) + '</h1>'
        + '<p>' + esc(face.prompt) + '</p></header>'
        + '<p class="tf-sample" style="font-family:\'OpenVibe Made\',sans-serif">' + esc(sample) + '</p>'
        + '<p class="tf-sample tf-words" style="font-family:\'OpenVibe Made\',sans-serif">The quick brown fox jumps over the lazy dog.</p>'
        + '<div class="tf-letters">' + letters + '</div>'
        + '<section class="tf-download"><h2>Take it with you</h2><p>'
        + (compiled && compiled.ok
            ? '<a href="/api/v1/typefaces/' + esc(face.id) + '/font.woff2" download>Download the WOFF2</a> · <a href="/api/v1/typefaces/' + esc(face.id) + '/font.otf" download>Download the OTF</a>'
            : 'The font files are being compiled. Try again in a moment.')
        + '</p><p class="tf-note">The font is yours, offered under the ' + esc(face.license) + '. The name table says which model drew it.</p></section>'
        + '<section class="tf-redraw"><h2>Redraw one letter</h2><p>Say what to change and the model draws that letter again, in the same style.</p>'
        + '<form method="post" action="/fonts/made/' + esc(face.id) + '/glyph"><label for="tf-char">Letter</label>'
        + '<select id="tf-char" name="char" data-ov-native>' + rows + '</select>'
        + '<label for="tf-note">What to change</label><input id="tf-note" name="note" required maxlength="400" placeholder="make the tail longer and curl it up">'
        + '<button type="submit">Redraw the letter</button></form>'
        + (face.note ? '<p class="tf-lastnote">Last note: ' + esc(face.note) + '</p>' : '')
        + '</section></div>';
    return layout({ title: face.name + ' — a typeface you made', description: 'A typeface you described, drawn by the model, with the outlines and the font files.',
        path: '/fonts/made/' + face.id, active: '/fonts', styles: STYLES, robots: 'noindex, nofollow',
        inlineStyles: css ? [css] : [], body });
}

/** The vector maker: one drawing from a prompt. */
function vectorMake({ mine = [], signedIn = false, left = 0, perDay = 0 } = {}) {
    const owned = mine.length
        ? '<section class="tf-owned"><h2>Your drawings</h2><ul>' + mine.map((v) => '<li><a href="/vectors/made/' + esc(v.id) + '">' + esc(v.prompt.slice(0, 80)) + '</a><span>' + esc(v.kind) + (v.model ? ' · ' + esc(v.model) : '') + '</span></li>').join('') + '</ul></section>'
        : '';
    const body = '<div class="tf"><header class="tf-hero"><p class="tf-eyebrow">AI vectors</p><h1>Describe a drawing.</h1>'
        + '<p>One clean SVG: an icon, an illustration or a pattern. You can draw it again, change it with a note, and take it away.</p></header>'
        + (signedIn
            ? '<form class="tf-form" method="post" action="/vectors/make"><label for="tv-prompt">What should it be?</label>'
              + '<textarea id="tv-prompt" name="prompt" required maxlength="600" placeholder="a paper plane folded from a single sheet, mid-flight, flat two-colour"></textarea>'
              + '<label for="tv-kind">What kind</label><select id="tv-kind" name="kind" data-ov-native><option value="icon">Icon</option><option value="illustration">Illustration</option><option value="pattern">Pattern</option></select>'
              + '<button type="submit">Draw it</button>'
              + '<p class="tf-cap">' + esc(perDay) + ' model runs a day. You have ' + esc(left) + ' left today.</p></form>'
            : '<p class="tf-signin"><a href="/auth/login">Sign in</a> to draw a vector. The runs are charged to your own allowance.</p>')
        + owned + '</div>';
    return layout({ title: 'Make a vector', description: 'Describe an icon, an illustration or a pattern and the model draws it as one clean SVG you can download.',
        path: '/vectors/make', active: '/fonts', styles: STYLES, body });
}

/** The drawing: the SVG, the downloads and the notes. */
function vector({ vector: v } = {}) {
    const body = '<div class="tf tf-vector"><a class="tf-back" href="/vectors/make">← Make another</a>'
        + '<header class="tf-hero"><p class="tf-eyebrow">' + esc(v.kind) + (v.model ? ' · drawn by ' + esc(v.model) : '') + '</p>'
        + '<h1>' + esc(v.prompt) + '</h1></header>'
        + '<figure class="tf-figure">' + v.svg + '</figure>'
        + '<section class="tf-download"><h2>Take it with you</h2><p>'
        + '<a href="/vectors/made/' + esc(v.id) + '.svg" download>Download the SVG</a> · <a href="/vectors/made/' + esc(v.id) + '.png" download>Download the PNG</a>'
        + '</p><p class="tf-note">The drawing is yours, offered under the ' + esc(v.license) + '.</p></section>'
        + '<section class="tf-redraw"><h2>Change it</h2><p>Say what to change, or leave the note empty to draw it again.</p>'
        + '<form method="post" action="/vectors/made/' + esc(v.id) + '/edit"><label for="tv-note">What to change</label>'
        + '<input id="tv-note" name="note" maxlength="400" placeholder="make the wings longer and add a shadow">'
        + '<button type="submit" name="regenerate" value="1">Draw it again</button></form>'
        + (v.note ? '<p class="tf-lastnote">Last note: ' + esc(v.note) + '</p>' : '')
        + '</section></div>';
    return layout({ title: 'A drawing you made', description: 'An SVG the model drew for you, clean and ready to use.',
        path: '/vectors/made/' + v.id, active: '/fonts', styles: STYLES, robots: 'noindex, nofollow', body });
}

module.exports = { make, specimen, vectorMake, vector };
