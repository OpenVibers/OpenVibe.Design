'use strict';
// The glyphs as npm packages served from this site (plan L50 step 2; server/glyphs/npm.js): each tarball is a valid
// gzipped tar under package/, with a package.json npm accepts, the drawings and a component; the core draws the solid
// twin at 18 px and under; an unknown file is a 404; /icons shows how to install.
const assert = require('node:assert/strict');
const zlib = require('zlib');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { boot, check, done } = require('./helpers/boot');
const npm = require('../server/glyphs/npm');
const glyphs = require('openvibe-shared/glyphs');

/** The entries of a gzipped tar: { name: Buffer }. */
function untar(tgz) {
    const tar = zlib.gunzipSync(tgz);
    const out = {};
    for (let at = 0; at + 512 <= tar.length;) {
        const name = tar.toString('utf8', at, at + 100).replace(/\0.*$/s, '');
        if (!name) break;
        const size = parseInt(tar.toString('utf8', at + 124, at + 136).replace(/\0.*$/s, '').trim(), 8);
        const head = tar.subarray(at, at + 512);
        let sum = 0;
        for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : head[i];
        assert.equal(parseInt(tar.toString('utf8', at + 148, at + 154), 8), sum, `${name}: the header checksum`);
        out[name] = tar.subarray(at + 512, at + 512 + size);
        at += 512 + Math.ceil(size / 512) * 512;
    }
    return out;
}

(async () => {
    const t = await boot();
    try {
        await check('each package is a tar npm installs: package/package.json with its name and the glyphs\' version', async () => {
            for (const file of Object.keys(npm.PACKAGES)) {
                const entries = untar(npm.tarball(file));
                const pkg = JSON.parse(entries['package/package.json'].toString());
                assert.equal(pkg.name, file.replace(/\.tgz$/, ''), file);
                assert.equal(pkg.version, require('openvibe-shared/package.json').version, `${file}: the version is the glyphs' release`);
                assert.equal(pkg.license, 'MIT');
                assert.ok(entries['package/LICENSE'] && entries['package/README.md'] && entries['package/glyphs.mjs'], `${file}: licence, readme, drawings`);
            }
            assert.equal(npm.tarball('../../etc/passwd'), null);
            assert.equal(npm.tarball('openvibe-icons-angular.tgz'), null);
        });

        await check('the core runs: every glyph, solid at 18 px and under, line above, a title for a named icon', async () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-icons-'));
            try {
                const entries = untar(npm.tarball('openvibe-icons.tgz'));
                for (const [name, body] of Object.entries(entries)) fs.writeFileSync(path.join(dir, name.replace(/^package\//, '')), body);
                const core = require(path.join(dir, 'index.js'));
                assert.equal(core.NAMES.length, glyphs.NAMES.length);
                assert.equal(core.drawingOf('bell', 16).solid, true, 'small: solid');
                assert.equal(core.drawingOf('bell', 24).solid, false, 'large: line');
                assert.equal(core.drawingOf('bell', 24, 'solid').solid, true, 'forced');
                assert.equal(core.drawingOf('check', 14).solid, false, 'a glyph with no solid stays lines');
                assert.equal(core.drawingOf('nope'), null);
                const named = core.svg('bell', { size: 32, title: 'A <bell>' });
                assert.ok(named.includes('role="img"><title>A &lt;bell&gt;</title>'), 'the title is escaped');
                assert.ok(core.svg('mic', { size: 16 }).includes('fill="none" stroke="currentColor" stroke-width="2.6"'), 'class="ln" parts become lines');
            } finally { fs.rmSync(dir, { recursive: true, force: true }); }
        });

        await check('the React package has a component per glyph and peers on React', async () => {
            const entries = untar(npm.tarball('openvibe-icons-react.tgz'));
            const js = entries['package/index.mjs'].toString();
            assert.match(js, /export function Icon\(/);
            assert.match(js, /export const BellIcon = /);
            assert.match(js, /export const MagnifyingGlassIcon = |export const SearchIcon = /);
            assert.equal(JSON.parse(entries['package/package.json'].toString()).peerDependencies.react, '>=17');
            assert.ok(entries['package/index.d.ts'].toString().includes('export declare const BellIcon'));
            assert.ok(untar(npm.tarball('openvibe-icons-svelte.tgz'))['package/Icon.svelte'].toString().includes('{@html d.inner}'));
            assert.match(untar(npm.tarball('openvibe-icons-vue.tgz'))['package/index.mjs'].toString(), /defineComponent\(/);
        });

        await check('served from /icons/npm/, a 404 for anything else, and /icons says how to install', async () => {
            const r = await t.get('/icons/npm/openvibe-icons-react.tgz');
            assert.equal(r.status, 200);
            assert.equal(r.headers.get('content-type'), 'application/gzip');
            assert.equal(r.headers.get('access-control-allow-origin'), '*');
            assert.equal((await t.get('/icons/npm/openvibe-icons-nope.tgz')).status, 404);
            const page = await t.get('/icons');
            assert.ok(page.text.includes('<h3>In React, Vue or Svelte</h3>'));
            assert.ok(page.text.includes('/icons/npm/openvibe-icons-react.tgz'));
        });
    } finally {
        await t.close();
    }
    done();
})().catch((err) => { console.error(err); process.exit(1); });
