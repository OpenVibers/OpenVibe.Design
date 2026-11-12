'use strict';

/**
 * The self-hosted fonts: public/fonts (scripts/fetch-fonts.js), GET /fonts/css2, the API and the page.
 *   node test/fonts-selfhosted.test.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { boot, check, done } = require('./helpers/boot');

const ROOT = path.join(__dirname, '..');
const FONTS = require('../public/fonts/fonts.json');

const walk = (dir, out = []) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, out); else out.push(p);
    }
    return out;
};

(async () => {
    const t = await boot();
    try {
        await check('css2 answers one @font-face per requested family and weight, from openvibe.design', async () => {
            const r = await t.get('/fonts/css2?family=Inter:wght@400;700&display=swap');
            assert.equal(r.status, 200);
            assert.match(r.headers.get('content-type'), /^text\/css/);
            assert.equal(r.headers.get('cache-control'), 'public, max-age=86400');
            assert.match(r.text, /font-family: "Inter"/);
            assert.match(r.text, /font-weight: 400/);
            assert.match(r.text, /font-weight: 700/);
            assert.doesNotMatch(r.text, /font-weight: 500/);
            assert.match(r.text, /src: url\("https:\/\/openvibe\.design\/fonts\/inter\/inter-latin-400-normal\.woff2"\) format\("woff2"\)/);
            assert.match(r.text, /unicode-range: U\+0000-00FF/);
            assert.match(r.text, /font-display: swap/);
            const block = await t.get('/fonts/css2?family=Inter:wght@700&display=block');
            assert.match(block.text, /font-display: block/);
            assert.match(block.text, /font-weight: 700/);
            assert.doesNotMatch(block.text, /font-weight: 400/);
        });

        await check('an unknown family is a CSS comment, and a repeated family is another face', async () => {
            const r = await t.get('/fonts/css2?family=No+Such+Face&family=Inter:wght@400');
            assert.equal(r.status, 200);
            assert.match(r.text, /\/\* No Such Face: no self-hosted family by that name \*\//);
            assert.match(r.text, /font-family: "Inter"/);
            assert.equal((await t.get('/fonts/css2?family=No+Such+Face')).status, 200);
        });

        await check('css2 and the woff2 files carry CORS for OpenVibe sites only', async () => {
            const css = await t.get('/fonts/css2?family=Inter', { headers: { origin: 'https://wordmark.openvibe.tools' } });
            assert.equal(css.headers.get('access-control-allow-origin'), 'https://wordmark.openvibe.tools');
            assert.match(css.headers.get('vary') || '', /Origin/i);
            const other = await t.get('/fonts/css2?family=Inter', { headers: { origin: 'https://example.com' } });
            assert.equal(other.headers.get('access-control-allow-origin'), null);
            const file = await t.get('/fonts/inter/inter-latin-400-normal.woff2', { headers: { origin: 'https://openvibe.tools' } });
            assert.equal(file.status, 200);
            assert.equal(file.headers.get('access-control-allow-origin'), 'https://openvibe.tools');
            assert.equal(file.headers.get('cache-control'), 'public, max-age=31536000, immutable');
            assert.match(file.headers.get('content-type') || '', /font\/woff2/);
            const fileOther = await t.get('/fonts/inter/inter-latin-400-normal.woff2', { headers: { origin: 'https://example.com' } });
            assert.equal(fileOther.headers.get('access-control-allow-origin'), null);
        });

        await check('every family in fonts.json has its woff2 files and licence beside it', () => {
            assert.equal(FONTS.length, 54);
            for (const f of FONTS) {
                assert.ok(/^[a-z0-9-]+$/.test(f.slug), f.slug);
                assert.ok(f.family && f.source.startsWith(`@fontsource/${f.slug}@`), f.family);
                assert.ok(f.weights.length >= 1 && f.weights.every((w) => Number.isInteger(w)), f.family);
                assert.ok(['OFL-1.1', 'Apache-2.0', 'UFL-1.0'].includes(f.licence), `${f.family}: ${f.licence}`);
                assert.ok(fs.existsSync(path.join(ROOT, 'public', 'fonts', f.slug, 'LICENSE.txt')), `${f.family}: licence`);
                for (const w of f.weights) {
                    assert.ok(fs.existsSync(path.join(ROOT, 'public', 'fonts', f.slug, `${f.slug}-latin-${w}-normal.woff2`)), `${f.family}: ${w}`);
                }
            }
        });

        await check('GET /api/v1/fonts is fonts.json', async () => {
            const r = await t.get('/api/v1/fonts');
            assert.equal(r.status, 200);
            assert.deepEqual(r.json(), FONTS);
            const bangers = (await t.get('/api/v1/fonts/bangers')).json();
            assert.equal(bangers.family, 'Bangers');
            assert.ok(bangers.files['400-normal'].endsWith('/fonts/bangers/bangers-latin-400-normal.woff2'));
        });

        await check('/fonts shows every self-hosted family, its sample, weights and licence', async () => {
            const r = await t.get('/fonts');
            assert.equal(r.status, 200);
            assert.match(r.text, /Self-hosted by openvibe\.design/);
            assert.match(r.text, /\/fonts\/css2/);
            for (const f of FONTS) assert.ok(r.text.includes(f.family), `${f.family} is on the page`);
            assert.match(r.text, /JetBrains Mono/);
            assert.match(r.text, new RegExp(`${FONTS.length} families`));
        });

        await check('no file under server/ or public/ names a Google font host', () => {
            const files = [...walk(path.join(ROOT, 'server')), ...walk(path.join(ROOT, 'public'))];
            for (const p of files) {
                const text = fs.readFileSync(p, 'utf8');
                assert.doesNotMatch(text, /fonts\.(?:googleapis|gstatic)\.com/, path.relative(ROOT, p));
            }
        });
    } finally { await t.close(); }
    done();
})().catch((e) => { console.error(e); process.exit(1); });
