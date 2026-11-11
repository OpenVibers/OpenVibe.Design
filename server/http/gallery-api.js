'use strict';

/**
 * The Elements and packs gallery's JSON, for a product that hands a validated element over instead of using
 * the canvas: OpenVibe.Live can publish a streamer's element here with the streamer's own token. The pages use
 * the same gallery store, so a listing made here is on /gallery at once.
 *
 *   GET  /api/v1/gallery/listings?q=&kind=&sort=       public; published only
 *   GET  /api/v1/gallery/listings/:idOrSlug            public; one listing
 *   POST /api/v1/gallery/listings                      a person publishes {document, source, source_id, remix_of?}
 *
 * The person is the credential (their Network token as a Bearer, or their session from this site); no service
 * token publishes for somebody else. The document is validated by the SDK and the gallery's content checks.
 */
const express = require('express');
const { http } = require('openvibe-contracts');
const { asyncRouter } = require('./router');
const { requireSameOrigin } = require('./same-origin');

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function createGalleryApi(ctx) {
    const { config, gallery, log } = ctx;
    const r = asyncRouter();
    r.use(express.json({ limit: '320kb' }));
    const fail = (res, status, code, detail, req) => http.sendProblem(res, status, code, { detail, ctx: req.ov });
    const signedIn = (req) => Boolean(req.viewer && req.viewer.kind === 'user' && req.viewer.subject);
    const sameOrigin = requireSameOrigin(config);

    r.get('/listings', async (req, res) => {
        const q = text(req.query.q, 120);
        const kind = req.query.kind === 'element' || req.query.kind === 'pack' ? req.query.kind : null;
        const sort = ['new', 'installs', 'rating'].includes(String(req.query.sort)) ? String(req.query.sort) : 'new';
        const [listings, count] = await Promise.all([gallery.list({ q, kind, sort, limit: 96 }), gallery.count({ q, kind })]);
        return res.set('Cache-Control', 'public, max-age=30').json({ kind: 'elements', count, listings });
    });

    r.get('/listings/:id', async (req, res) => {
        const listing = await gallery.get(req.params.id);
        if (!listing) return fail(res, 404, 'gallery.missing', 'No such element or pack.', req);
        if (listing.status !== 'published' && !(signedIn(req) && listing.author.subject === req.viewer.subject)) return fail(res, 404, 'gallery.missing', 'No such element or pack.', req);
        return res.set('Cache-Control', listing.status === 'published' ? 'public, max-age=30' : 'private, no-store').json(listing);
    });

    r.post('/listings', sameOrigin, async (req, res) => {
        if (!signedIn(req)) return fail(res, 401, 'gallery.sign_in', 'Sign in to publish an element or pack.', req);
        try {
            const body = req.body || {};
            const listing = await gallery.publish({
                subject: req.viewer.subject,
                authorName: req.viewer.displayName || req.viewer.username || 'A maker',
                authorUsername: req.viewer.username || null,
                document: body.document,
                source: body.source === 'live' ? 'live' : 'design',
                sourceId: text(body.source_id, 120) || null,
                remixOf: text(body.remix_of, 120) || null,
            });
            log.log(`[OpenVibe.Design] gallery listing ${listing.slug} (${listing.kind}) by ${req.viewer.subject}`);
            return res.status(201).json(listing);
        } catch (err) {
            const status = Number(err.status) || 500;
            if (status >= 500) log.error('[OpenVibe.Design] gallery:', err && err.message);
            return fail(res, status, (err && err.code) || 'gallery.error', status >= 500 ? 'The listing could not be saved.' : (err.message || 'That was not accepted.'), req);
        }
    });

    return r;
}

module.exports = { createGalleryApi };
