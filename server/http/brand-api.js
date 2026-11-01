'use strict';
/**
 * /brand/explore's picks (server/brand-picks.js), for the page's own script:
 *
 *   GET /api/v1/brand/picks   { tally, mine }   what everyone picked so far, and this person's (or browser's) picks
 *   PUT /api/v1/brand/picks   { picks: ['L03', 'P17', 'M09'] } → { tally, mine }   replaces their picks
 *
 * A PUT must come from this site (Sec-Fetch-Site: same-origin, or this site's Origin), signed in or not, so another
 * page cannot cast a ballot for a visitor. Anyone may pick: a signed-in person once per account, a guest once per
 * browser (an httpOnly cookie key, stored only as a hash).
 */
const { http } = require('openvibe-contracts');
const { asyncRouter } = require('./router');
const { sameOrigin } = require('./same-origin');

const subjectOf = (req) => (req.viewer && req.viewer.kind === 'user' ? req.viewer.subject : null);

function createBrandApi(ctx) {
    const { picks, config } = ctx;
    const r = asyncRouter();
    r.get('/picks', async (req, res) => {
        const who = picks.voterOf(req, null, subjectOf(req));
        res.set('Cache-Control', 'private, no-store');
        res.json({ tally: await picks.tally(), mine: who ? await picks.mine(who.voter) : [] });
    });
    r.put('/picks', async (req, res) => {
        if (!sameOrigin(req, config)) return http.sendProblem(res, 403, 'design.cross_site', { detail: 'Picks are saved from openvibe.design itself.', ctx: req.ov });
        const list = req.body && req.body.picks;
        if (!Array.isArray(list) || list.length > 60) return http.sendProblem(res, 400, 'design.picks_invalid', { detail: 'Send { picks: ["L03", "P17"] }, up to 40 codes.', ctx: req.ov });
        const who = picks.voterOf(req, res, subjectOf(req));
        const mine = await picks.save(who.voter, list, { signedIn: who.signedIn });
        res.set('Cache-Control', 'private, no-store');
        res.json({ tally: await picks.tally(), mine });
    });
    return r;
}

module.exports = { createBrandApi };
