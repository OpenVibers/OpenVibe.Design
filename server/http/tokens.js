'use strict';
/**
 * The token files: GET /tokens/<theme>.<ext> — a theme's colours, the kit's motion and the mark's colours, as the file
 * each tool reads (the DTCG JSON, the CSS, the Tailwind preset, the Style Dictionary source, the Swift, the Kotlin, the
 * Android XML).
 *
 * A built-in theme does not change, so its file is immutable for a year; a community theme may be edited, so its file
 * is cached for ten minutes. Every file is open to any origin: a design tool fetches it from its own page.
 */
const { asyncRouter } = require('./router');
const tokenFiles = require('../tokens/exports');

const IMMUTABLE = 'public, max-age=31536000, immutable';
const SHORT = 'public, max-age=600';

function createTokenFileRoutes(ctx) {
    const { catalog, log } = ctx;
    const r = asyncRouter();

    r.get('/:file', async (req, res) => {
        const parsed = tokenFiles.parse(req.params.file);
        if (!parsed) return missing(res);
        let list = [];
        try {
            list = (await catalog.list()).themes || [];
        } catch (err) {
            // The built-in themes still answer; only a community theme needs the catalogue.
            log.warn('[OpenVibe.Design] token file: the catalogue did not answer:', (err && err.message) || err);
        }
        const found = tokenFiles.findTheme(list, parsed.themeId);
        if (!found) return missing(res);
        const body = tokenFiles.render(parsed.format.id, found.theme);
        if (!body) return missing(res);
        res.set('Cache-Control', found.builtin ? IMMUTABLE : SHORT);
        res.set('Access-Control-Allow-Origin', '*');
        res.type(`${parsed.format.type}; charset=utf-8`);
        return res.send(body);
    });

    return r;
}

function missing(res) {
    return res.status(404).set('Cache-Control', 'no-store').type('text/plain').send('No such theme file.');
}

module.exports = { createTokenFileRoutes };
