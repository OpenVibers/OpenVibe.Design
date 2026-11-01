'use strict';
/**
 * /brand/explore's picks, saved and counted (migrations/0005_brand_picks.sql). A person's picks replace their last
 * ones; the tally says how many people picked, which way they lean (the Loop or the Pair: whichever they picked more
 * of, a tie counting half each way), and the most-picked takes in each family.
 *
 *   picks.voterOf(req, res)     the voter: the signed-in subject, else 'anon:' + a hash of this browser's key
 *   picks.save(voter, codes, { signedIn })   replace their picks (up to 40 codes); returns the tally
 *   picks.mine(voter)           their codes, sorted
 *   picks.tally()               { people, lean: { loop, pair }, top: { L, P, M } } (top: [{ code, n }], at most 6)
 */
const crypto = require('crypto');

const CODE = /^[LPMF](0[1-9]|[1-9][0-9])$/;
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
        const lean = await db.many(`SELECT count(*) FILTER (WHERE code LIKE 'L%')::int AS l, count(*) FILTER (WHERE code LIKE 'P%')::int AS p
                                    FROM brand_picks GROUP BY voter`);
        const people = lean.length;
        let loop = 0, pair = 0;
        for (const v of lean) { if (v.l > v.p) loop += 1; else if (v.p > v.l) pair += 1; else if (v.l) { loop += 0.5; pair += 0.5; } }
        const top = { L: [], P: [], M: [], F: [] };
        for (const r of counts) { const list = top[r.code[0]]; if (list && list.length < 6) list.push({ code: r.code, n: r.n }); }
        return { people, lean: { loop, pair }, top };
    }

    return { voterOf, save, mine, tally, CODE, COOKIE, MAX };
}

module.exports = { createBrandPicks };
