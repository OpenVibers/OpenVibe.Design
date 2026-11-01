'use strict';
/**
 * The token files: GET /tokens/<theme>.<ext> — a theme as the file every tool can read. Every format parses, says the
 * theme's own values and the kit's motion; a built-in theme is immutable and a community one is not; both are open to
 * any origin; a theme or a format that is not there is a 404, and a catalogue theme cannot put code into a file.
 */
const assert = require('assert');
const fs = require('fs');
const { boot, check, done } = require('./helpers/boot');
const { FORMATS } = require('../server/tokens/exports');

// The kit's own motion, read from the file the kit ships (openvibe-shared/ov-fx.js).
const KIT_CSS = /:root\{([^}]*)\}/.exec(fs.readFileSync(require.resolve('openvibe-shared/ov-fx'), 'utf8'))[1];
const KIT_VARS = Object.fromEntries([...KIT_CSS.matchAll(/(--ov-[\w-]+):([^;]+)/g)].map((m) => [m[1], m[2].trim()]));
const msOf = (v) => { const m = /^([\d.]+)(ms|s)$/.exec(String(v).trim()); return m ? Number(m[1]) * (m[2] === 's' ? 1000 : 1) : NaN; };
const curveOf = (v) => { const m = /cubic-bezier\(([^)]+)\)/.exec(String(v)); return m ? m[1].split(',').map((n) => Number(n.trim())) : null; };

(async () => {
    const themes = [
        { id: 'aurora', name: 'Aurora', slug: 'aurora', mode: 'dark', description: 'A community theme.', variables: { '--bg-primary': '#101820', '--bg-card': '#16212c', '--text-primary': '#f2f7f5', '--accent': '#00e0a4', '--border': '#243240' } },
        { id: 'evil', name: 'Evil */ import os //', slug: 'evil', mode: 'dark', description: 'x\n*/ fun pwn() {}', variables: { '--bg-primary': '#000; } body { background: url(https://evil.example) }', '--accent': '#ff0000', '--text-primary': '#ffffff' } },
    ];
    const t = await boot({ network: { themes } });

    await check('the default theme is Vibe, and every format is served', async () => {
        const d = await t.get('/tokens/default.tokens.json');
        assert.strictEqual(d.status, 200);
        assert.match(d.headers.get('content-type'), /^application\/json/);
        const doc = d.json();
        assert.strictEqual(doc.$extensions['network.openvibe'].slug, 'vibe');
        assert.strictEqual(doc.color.bg.base.$value, '#0a0f1c');
        for (const f of FORMATS) {
            const r = await t.get(`/tokens/default.${f.ext}`);
            assert.strictEqual(r.status, 200, f.id);
            assert.ok(r.text.length > 40, `${f.id} has content`);
        }
    });

    await check('a look\'s shape: the quiet looks square, Neon round, the rest the kit\'s own corners', async () => {
        const kitTokens = require('../server/tokens/kit');
        const px = (theme) => kitTokens.radiusList(kitTokens.tokenDocument(theme)).map((r) => r.px);
        assert.deepStrictEqual(px({ slug: 'paper' }), [4, 6, 10]);
        assert.deepStrictEqual(px({ slug: 'neon-tokyo' }), [14, 20, 28]);
        assert.deepStrictEqual(px({ slug: 'vibe' }), [10, 14, 20]);
        assert.strictEqual(kitTokens.tokenDocument({ slug: 'paper' }).shape.radius['1'].$extensions['network.openvibe'].shape, 'square');
    });

    await check('the motion tokens are exactly the kit\'s', async () => {
        assert.deepStrictEqual(Object.keys(KIT_VARS).sort(), ['--ov-dur-1', '--ov-dur-2', '--ov-dur-3', '--ov-dur-4', '--ov-ease-in-out', '--ov-ease-out', '--ov-ease-spring']);
        assert.strictEqual(msOf(KIT_VARS['--ov-dur-1']), 120);
        assert.strictEqual(msOf(KIT_VARS['--ov-dur-2']), 200);
        assert.strictEqual(msOf(KIT_VARS['--ov-dur-3']), 320);
        assert.strictEqual(msOf(KIT_VARS['--ov-dur-4']), 520);
        assert.deepStrictEqual(curveOf(KIT_VARS['--ov-ease-out']), [0.2, 0.8, 0.2, 1]);
        assert.deepStrictEqual(curveOf(KIT_VARS['--ov-ease-spring']), [0.34, 1.56, 0.64, 1]);
        assert.deepStrictEqual(curveOf(KIT_VARS['--ov-ease-in-out']), [0.65, 0, 0.35, 1]);
        // and our files say the same
        const css = (await t.get('/tokens/vibe.css')).text;
        for (const [name, value] of Object.entries(KIT_VARS)) {
            const ours = new RegExp(`${name}: ([^;]+);`).exec(css);
            assert.ok(ours, `${name} is in the CSS`);
            if (value.startsWith('cubic-bezier')) assert.deepStrictEqual(curveOf(ours[1]), curveOf(value), name);
            else assert.strictEqual(msOf(ours[1]), msOf(value), name);
        }
        const doc = (await t.get('/tokens/vibe.tokens.json')).json();
        assert.strictEqual(doc.motion.duration['1'].$value, '120ms');
        assert.strictEqual(doc.motion.duration['2'].$value, '200ms');
        assert.strictEqual(doc.motion.duration['3'].$value, '320ms');
        assert.strictEqual(doc.motion.duration['4'].$value, '520ms');
        assert.strictEqual(doc.motion.easing.out.$type, 'cubicBezier');
        assert.deepStrictEqual(doc.motion.easing.out.$value, [0.2, 0.8, 0.2, 1]);
        assert.deepStrictEqual(doc.motion.easing.spring.$value, [0.34, 1.56, 0.64, 1]);
        assert.deepStrictEqual(doc.motion.easing['in-out'].$value, [0.65, 0, 0.35, 1]);
    });

    await check('every format parses and says the theme\'s own values', async () => {
        const doc = (await t.get('/tokens/vibe.tokens.json')).json();
        assert.strictEqual(doc.color.bg.base.$value, '#0a0f1c');
        assert.strictEqual(doc.color.accent.base.$value, '#3b82f6');
        assert.strictEqual(doc.color.text.primary.$value, '#e6edf7');
        assert.strictEqual(doc.brand.o.$value, '#4f7cff');
        assert.strictEqual(doc.brand.v.$value, '#8b5cf6');
        assert.strictEqual(doc.color.bg.base.$extensions['network.openvibe'].css, '--bg-primary');

        const css = (await t.get('/tokens/vibe.css')).text;
        assert.match(css, /:root \{/);
        assert.match(css, /--bg-primary: #0a0f1c;/);
        assert.match(css, /--accent: #3b82f6;/);
        assert.match(css, /--ov-dur-1: 120ms;/);
        assert.match(css, /--ov-ease-out: cubic-bezier\(0\.2, 0\.8, 0\.2, 1\);/);
        assert.match(css, /--ov-brand-o: #4f7cff;/);

        const tw = (await t.get('/tokens/vibe.tailwind.js')).text;
        const mod = { exports: {} };
        new Function('module', 'exports', tw)(mod, mod.exports);
        const preset = mod.exports.theme.extend;
        assert.strictEqual(preset.colors.bg.base, '#0a0f1c');
        assert.strictEqual(preset.colors.accent.base, '#3b82f6');
        assert.strictEqual(preset.colors.brand.o, '#4f7cff');
        assert.strictEqual(preset.transitionDuration['3'], '320ms');
        assert.strictEqual(preset.transitionTimingFunction.spring, 'cubic-bezier(0.34, 1.56, 0.64, 1)');

        const sd = (await t.get('/tokens/vibe.style-dictionary.json')).json();
        assert.strictEqual(sd.color.bg.base.value, '#0a0f1c');
        assert.strictEqual(sd.color.bg.base.type, 'color');
        assert.strictEqual(sd.motion.duration['2'].value, '200ms');
        assert.strictEqual(sd.motion.duration['2'].type, 'duration');
        assert.strictEqual(sd.motion.easing.out.type, 'cubicBezier');
        assert.deepStrictEqual(sd.motion.easing.out.value, [0.2, 0.8, 0.2, 1]);
        assert.strictEqual(sd.brand.v.value, '#8b5cf6');

        const swift = (await t.get('/tokens/vibe.swift')).text;
        assert.match(swift, /public enum OVTokens \{/);
        assert.match(swift, /public static let bgBase = Color\(hex: 0xFF0A0F1C\)/);
        assert.match(swift, /public static let accentBase = Color\(hex: 0xFF3B82F6\)/);
        assert.match(swift, /public static let duration1: TimeInterval = 0\.12/);
        assert.match(swift, /public static let easeSpring = Animation\.timingCurve\(0\.34, 1\.56, 0\.64, 1\)/);

        const kt = (await t.get('/tokens/vibe.kt')).text;
        assert.match(kt, /object OVTokens \{/);
        assert.match(kt, /val bgBase = Color\(0xFF0A0F1C\)/);
        assert.match(kt, /const val duration1 = 120L/);
        assert.match(kt, /val easeOut = CubicBezierEasing\(0\.2f, 0\.8f, 0\.2f, 1f\)/);

        // The kit's shape (openvibe-shared 4.81.0): Vibe has the kit's own corners in every format.
        assert.match(css, /--ov-radius-1: 10px;\n    --ov-radius-2: 14px;\n    --ov-radius-3: 20px;/);
        assert.strictEqual(preset.borderRadius['ov-2'], '14px');
        assert.strictEqual(sd.shape.radius['3'].value, '20px');
        assert.strictEqual(sd.shape.radius['3'].type, 'dimension');
        assert.match(swift, /public static let radius1: CGFloat = 10/);
        assert.match(kt, /val radius2 = 14\.dp/);
        const xml = (await t.get('/tokens/vibe.xml')).text;
        assert.match(xml, /<dimen name="ov_radius_3">20dp<\/dimen>/);
        assert.match(xml, /<color name="ov_bg_base">#0A0F1C<\/color>/);
        assert.match(xml, /<color name="ov_accent_base">#3B82F6<\/color>/);
        assert.match(xml, /<color name="ov_brand_v">#8B5CF6<\/color>/);
        assert.match(xml, /<\/resources>\s*$/);
        assert.strictEqual((xml.match(/<color /g) || []).length, (xml.match(/<\/color>/g) || []).length, 'every colour is closed');
        const names = [...xml.matchAll(/name="([^"]*)"/g)].map((m) => m[1]);
        assert.ok(names.length > 10, 'every colour is named');
        for (const n of names) assert.match(n, /^[a-z][a-z0-9_]*$/, n);
    });

    await check('a community theme is a theme too, by its slug and by its id', async () => {
        const bySlug = await t.get('/tokens/aurora.css');
        assert.strictEqual(bySlug.status, 200);
        assert.match(bySlug.text, /--bg-primary: #101820;/);
        assert.match(bySlug.text, /--accent: #00e0a4;/);
        const byId = await t.get('/tokens/aurora.tokens.json');
        assert.strictEqual(byId.status, 200);
        assert.strictEqual(byId.json().color.bg.base.$value, '#101820');
    });

    await check('a community theme cannot write into the files people paste', async () => {
        const formats = require('../server/tokens/formats');
        const doc = {
            $extensions: { 'network.openvibe': { name: 'Evil */ body{display:none} /* --> <x>', slug: 'evil', mode: 'dark */ a{}' } },
            color: { bg: { base: { $value: '#101820', $extensions: { 'network.openvibe': { css: '--bg-primary' } } }, bad: { $value: 'red;} body{display:none', $extensions: { 'network.openvibe': { css: '--accent' } } } } },
        };
        const out = formats.css(doc);
        const first = out.split('\n')[0];
        assert.strictEqual(out.indexOf('*/'), first.length - 2, 'the name stays inside its comment: the first */ is the one that ends the line');
        assert.ok(!out.includes('red;}'), 'a value cannot close the rule');
        assert.match(out, /^\/\* Evil \* \/ body\{display:none\} \/\* - -> <x> \(dark\)/, 'the name is kept, harmless');
        assert.match(out, /--bg-primary: #101820;/, 'a real colour passes');
        assert.ok(!/--accent:/.test(out), 'anything that is not a colour is left out');
        assert.ok(!formats.androidXml(doc).includes('--> <x>'), 'nor can it close an XML comment');
    });
    await check('a built-in theme is immutable, a community one is not, and both are open to any origin', async () => {
        const b = await t.get('/tokens/vibe.css');
        assert.strictEqual(b.headers.get('cache-control'), 'public, max-age=31536000, immutable');
        assert.strictEqual(b.headers.get('access-control-allow-origin'), '*');
        const c = await t.get('/tokens/aurora.css');
        assert.strictEqual(c.status, 200);
        assert.match(c.headers.get('cache-control'), /^public, max-age=\d+$/);
        assert.doesNotMatch(c.headers.get('cache-control'), /immutable/);
        assert.strictEqual(c.headers.get('access-control-allow-origin'), '*');
    });

    await check('the /tokens page links every file for the theme it shows', async () => {
        const html = (await t.get('/tokens?theme=aurora')).text;
        const fs = require('fs'); const path = require('path');
        assert.match(fs.readFileSync(path.join(__dirname, '..', 'server/views/tokens.js'), 'utf8'), /filesRow\(slug\)/, 'the page draws the row');
        assert.match(fs.readFileSync(path.join(__dirname, '..', 'server/http/tokens.js'), 'utf8'), /Access-Control-Allow-Origin/, 'files open to any origin');
        assert.match(fs.readFileSync(path.join(__dirname, '..', 'server/app.js'), 'utf8'), /createTokenFileRoutes/, 'mounted');
        assert.ok(html.includes('Files your tools can fetch'));
        ['tokens.json', 'css', 'tailwind.js', 'style-dictionary.json', 'swift', 'kt', 'xml'].forEach((ext) => assert.ok(html.includes(`href="/tokens/aurora.${ext}"`), ext));
    });
    await check('an unknown theme or an unknown format is a 404', async () => {
        assert.strictEqual((await t.get('/tokens/nope.css')).status, 404);
        assert.strictEqual((await t.get('/tokens/nope.tokens.json')).status, 404);
        assert.strictEqual((await t.get('/tokens/vibe.cobol')).status, 404);
        assert.strictEqual((await t.get('/tokens/vibe')).status, 404);
    });

    await check('a catalogue theme cannot put code into a file', async () => {
        for (const f of FORMATS) {
            const r = await t.get(`/tokens/evil.${f.ext}`);
            assert.strictEqual(r.status, 200, f.id);
            assert.doesNotMatch(r.text, /evil\.example/, `${f.id}: the bad value is dropped`);
        }
        const swift = (await t.get('/tokens/evil.swift')).text.replace(/\/\/[^\n]*/g, '');
        assert.doesNotMatch(swift, /import os|fun pwn/);
        const kt = (await t.get('/tokens/evil.kt')).text.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
        assert.doesNotMatch(kt, /import os|fun pwn/);
    });

    await check('the format list is the one a page lists', async () => {
        assert.deepStrictEqual(FORMATS.map((f) => f.id), ['tokens', 'css', 'tailwind', 'style-dictionary', 'swift', 'kotlin', 'android']);
        for (const f of FORMATS) {
            assert.ok(f.ext && f.label && f.type, f.id);
            assert.match(f.ext, /^[a-z0-9.-]+$/, f.id);
        }
    });

    await t.close();
    done();
})();
