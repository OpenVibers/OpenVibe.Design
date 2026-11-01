'use strict';
/**
 * /brand/explore's picks, saved and counted (migrations/0005_brand_picks.sql). A person's picks replace their last
 * ones; the tally says how many people picked, how many like the Loop and how many the Pair (a person who picks takes
 * from both counts for both: the owner, 11-01, "if they want a combination, that's fine… gauge all of it"), the
 * most-picked takes in each family, and every take's count (to make the next round from what people chose).
 *
 *   picks.voterOf(req, res)     the voter: the signed-in subject, else 'anon:' + a hash of this browser's key
 *   picks.save(voter, codes, { signedIn })   replace their picks (up to 40 codes); returns the tally
 *   picks.mine(voter)           their codes, sorted
 *   picks.tally()               { people, lean: { loop, pair, wild, both }, top: { L, P, W, M, F } (at most 8), all: [{ code, n }] }
 *                               (both: the people who like more than one kind)
 */
const crypto = require('crypto');

const CODE = /^[LPMFW](0[1-9]|[1-9][0-9])$/;
const COOKIE = 'ov_mx_voter';
const MAX = 40;

function createBrandPicks({ db, now = () => Date.now() } = {}) {
    function voterOf(req, res, subject) {
        if (subject) return { voter: subject, signedIn: true };
        let key = req.cookies && req.cookies[COOKIE];
        if (!/^[A-Za-z0-9_-]{32}$/.test(String(key || ''))) {
            if (!res) return null;
            key = crypto.randomBytes(24).toString('base64url');
            res.cookie(COOKIE, key, { httpOnly: true, secure: req.secure || req.get('x-forwarded-proto') === 'https', sameSite: 'lax', maxAge: 365 * 864e5, path: '/' });
        }
        return { voter: `anon:${crypto.createHash('sha256').update(key).digest('base64url').slice(0, 32)}`, signedIn: false };
    }

    const clean = (codes) => [...new Set((Array.isArray(codes) ? codes : []).map(String).filter((c) => CODE.test(c)))].slice(0, MAX).sort();

    async function save(voter, codes, { signedIn = false } = {}) {
        const list = clean(codes);
        await db.tx(async () => {
            await db.exec('DELETE FROM brand_picks WHERE voter = $1', [voter]);
            for (const c of list) await db.exec('INSERT INTO brand_picks (voter, code, signed_in, created_at) VALUES ($1, $2, $3, $4)', [voter, c, !!signedIn, new Date(now()).toISOString()]);
        });
        return list;
    }

    async function mine(voter) {
        if (!voter) return [];
        return (await db.many('SELECT code FROM brand_picks WHERE voter = $1 ORDER BY code', [voter])).map((r) => r.code);
    }

    async function tally() {
        const counts = await db.many('SELECT code, count(*)::int AS n FROM brand_picks GROUP BY code ORDER BY n DESC, code');
        const voters = await db.many(`SELECT count(*) FILTER (WHERE code LIKE 'L%')::int AS l, count(*) FILTER (WHERE code LIKE 'P%')::int AS p,
                                    count(*) FILTER (WHERE code LIKE 'W%')::int AS w FROM brand_picks GROUP BY voter`);
        const people = voters.length;
        let loop = 0, pair = 0, wild = 0, both = 0;
        for (const v of voters) { if (v.l) loop += 1; if (v.p) pair += 1; if (v.w) wild += 1; if ((v.l ? 1 : 0) + (v.p ? 1 : 0) + (v.w ? 1 : 0) > 1) both += 1; }
        const top = { L: [], P: [], W: [], M: [], F: [] };
        for (const r of counts) { const list = top[r.code[0]]; if (list && list.length < 8) list.push({ code: r.code, n: r.n }); }
        return { people, lean: { loop, pair, wild, both }, top, all: counts.slice(0, 250).map((r) => ({ code: r.code, n: r.n })) };
    }

    return { voterOf, save, mine, tally, CODE, COOKIE, MAX };
}

module.exports = { createBrandPicks };
