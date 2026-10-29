'use strict';
/**
 * /tokens and /api/v1/tokens: any public theme as code (openvibe-shared/tokens), its other half along by default,
 * every platform as a tab, a download that names its file, and nothing from the catalog reaching the code unchecked.
 */
const assert = require('assert');
const { boot, check, done } = require('./helpers/boot');

(async () => {
    const themes = [
        { id: 'vibe', name: 'Vibe', slug: 'vibe', mode: 'dark', description: 'The default.', variables: { '--bg-primary': '#0a0f1c', '--bg-card': '#131c2e', '--text-primary': '#e6edf7', '--accent': '#3b82f6', '--border': '#1f2d47' } },
        { id: 'cloud', name: 'Vibe Light', slug: 'cloud', mode: 'light', description: 'Its light half.', variables: { '--bg-primary': '#f5f7fb', '--bg-card': '#ffffff', '--text-primary': '#0f172a', '--accent': '#2563eb', '--border': '#d8dee9' } },
        { id: 'evil', name: 'Evil */ import os //', slug: 'evil', mode: 'dark', description: 'x\n*/ fun pwn() {}', variables: { '--bg-primary': '#000; } body { background: url(https://evil.example) }', '--accent': '#ff0000', '--text-primary': '#ffffff' } },
    ];
    const t = await boot({ network: { themes } });

    await check('/tokens shows the default theme with its other half, the CSS tab open, and is publicly cacheable', async () => {
        const r = await t.get('/tokens');
        assert.strictEqual(r.status, 200);
        assert.match(r.text, /Your theme, as code/);
        assert.match(r.text, /<b>Vibe<\/b><small>Dark<\/small>[\s\S]*<b>Vibe Light<\/b><small>Light<\/small>/, 'both halves');
        assert.match(r.text, /aria-current="page"[^>]*>(<[^>]+>)*<span>CSS<\/span>|<a href="[^"]*format=css" aria-current="page">/);
        assert.match(r.text, /--ov-color-bg-base: #0a0f1c;/);
        assert.match(r.text, /:root\[data-theme-mode=&quot;light&quot;\]/);
        assert.match(r.text, /href="\/api\/v1\/tokens\/vibe\?format=css&amp;download=1"/);
        assert.strictEqual(r.headers.get('cache-control'), 'public, max-age=120');
    });

    await check('every platform is a tab, and Android is a Compose colour scheme for both halves', async () => {
        const r = await t.get('/tokens?theme=vibe&format=compose');
        for (const label of ['CSS', 'Tailwind', 'Android', 'iOS', 'Flutter', 'Figma', 'JSON']) assert.match(r.text, new RegExp(`<span>${label}</span>`), label);
        assert.match(r.text, /val VibeDarkColorScheme: ColorScheme = darkColorScheme\(/);
        assert.match(r.text, /val VibeLightColorScheme: ColorScheme = lightColorScheme\(/);
        assert.match(r.text, /isSystemInDarkTheme\(\)/, 'it says how to use it');
        const one = await t.get('/tokens?theme=vibe&format=swiftui&both=0');
        assert.match(one.text, /public enum VibeTokens \{/);
        assert.doesNotMatch(one.text, /<b>Vibe Light<\/b>/, 'both=0 leaves the other half out');
        const checked = await t.get('/tokens?theme=vibe&format=css&both=1&both=0');
        assert.match(checked.text, /<b>Vibe Light<\/b>/, 'the form sends both=1&both=0 when the box is ticked');
    });

    await check('an unknown theme is a 404 page; an unknown format falls back to CSS', async () => {
        const r = await t.get('/tokens?theme=nope');
        assert.strictEqual(r.status, 404);
        assert.match(r.text, /No theme by that name/);
        const f = await t.get('/tokens?theme=vibe&format=cobol');
        assert.strictEqual(f.status, 200);
        assert.match(f.text, /--ov-color-bg-base/);
    });

    await check('the API: targets, each format with its type, a download with a safe file name', async () => {
        const list = (await t.get('/api/v1/tokens')).json();
        assert.deepStrictEqual(list.targets.map((x) => x.id), ['css', 'tailwind', 'compose', 'swiftui', 'flutter', 'figma', 'json']);
        const css = await t.get('/api/v1/tokens/vibe?format=css');
        assert.match(css.headers.get('content-type'), /^text\/plain; charset=utf-8/);
        assert.match(css.text, /--bg-primary: var\(--ov-color-bg-base\);/);
        const json = (await t.get('/api/v1/tokens/cloud?format=json&both=0')).json();
        assert.strictEqual(json.color.bg.base.$value, '#f5f7fb');
        const fig = (await t.get('/api/v1/tokens/vibe?format=figma')).json();
        assert.deepStrictEqual(fig.modes, ['dark', 'light']);
        const dl = await t.get('/api/v1/tokens/vibe?format=compose&download=1');
        assert.strictEqual(dl.headers.get('content-disposition'), 'attachment; filename="VibeTheme.kt"');
        assert.strictEqual(dl.headers.get('cache-control'), 'public, max-age=600');
        assert.strictEqual((await t.get('/api/v1/tokens/vibe?format=cobol')).status, 400);
        assert.strictEqual((await t.get('/api/v1/tokens/nope?format=css')).status, 404);
    });

    await check('a catalog theme cannot put code into the export', async () => {
        for (const format of ['css', 'compose', 'swiftui', 'flutter']) {
            const r = await t.get(`/api/v1/tokens/evil?format=${format}`);
            assert.strictEqual(r.status, 200);
            assert.doesNotMatch(r.text, /evil\.example/, `${format}: the bad value is dropped`);
            const code = r.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
            assert.doesNotMatch(code, /import os|fun pwn/, `${format}: the name stays inside comments`);
        }
        const page = await t.get('/tokens?theme=evil&format=compose');
        assert.doesNotMatch(page.text, /evil\.example/, 'the dropped value is not on the page either');
        assert.match(page.text, /object EvilImportOsTokens/);
    });

    await check('the studio and a theme page link to the theme as code and to trying it on the real sites', async () => {
        assert.match((await t.get('/studio')).text, /id="ds-code" href="\/tokens"/);
        assert.match((await t.get('/t/vibe')).text, /href="\/tokens\?theme=vibe"/);
        assert.match((await t.get('/developers')).text, /GET \/api\/v1\/tokens\/:theme\?format=/);
        // Try it on the real sites (openvibe-shared 4.41.0 ?ov-try=): the theme page links each site with the theme's name.
        const page = (await t.get('/t/vibe')).text;
        assert.match(page, /href="https:\/\/openvibe\.live\/\?ov-try=vibe"/);
        assert.match(page, /href="https:\/\/openvibe\.chat\/\?ov-try=vibe"/);
        const studioPage = (await t.get('/studio')).text;
        assert.match(studioPage, /id="ds-code" href="\/tokens" data-tokens-src="\/shared\/tokens\.js\?v=[0-9a-f]+"/, 'the studio can compile edits in the page');
        assert.match(studioPage, /<dialog class="ovk-sheet" id="ds-code-sheet"[\s\S]*<option value="compose">Android \(Jetpack Compose\)<\/option>/);
        assert.match((await t.get('/studio')).text, /<div id="ds-try" hidden>[\s\S]*data-try="https:\/\/openvibe\.live\/"/, 'the studio points them at the picked theme');
    });

    await check('/look: the theme worn and the comfort settings, wired to the theme loader', async () => {
        const r = await t.get('/look');
        assert.strictEqual(r.status, 200);
        assert.match(r.text, /Your look, everywhere/);
        for (const name of ['scheme', 'text', 'motion']) assert.match(r.text, new RegExp(`role="radiogroup"[^>]*>(<label><input type="radio" name="${name}"[^<]*<span>[^<]+</span></label>)+`), name);
        assert.match(r.text, /name="seasonal"/);
        assert.match(r.text, /\/js\/look\.js\?v=[0-9a-f]{10}/);
        assert.match(r.text, /<script type="application\/json" id="lk-themes">\[\{"id":"vibe"/);
        assert.match(r.text, /Sign in so it follows you/);
        assert.match((await t.get('/')).text, /href="\/look"/, 'the nav and the home lead to it');
    });

    await check('/components: each component with its parts, tokens, behaviour and code for web, Android and iOS', async () => {
        const r = await t.get('/components?c=card');
        assert.strictEqual(r.status, 200);
        assert.match(r.text, /One design system, drawn natively everywhere/);
        for (const name of ['Button', 'Card', 'Rail', 'Row', 'List', 'Section', 'Fold', 'Tabs', 'Numbers', 'Notice', 'Empty state']) assert.match(r.text, new RegExp(`<span>${name}</span>`), name);
        assert.match(r.text, /<article class="ovk-card is-live ovk-card--stream"/, 'the real card, drawn by the kit');
        assert.match(r.text, /<code>color\.text\.primary<\/code>/, 'its parts name their tokens');
        assert.match(r.text, /&quot;type&quot;: &quot;card&quot;/, 'the Web tab shows the kit document');
        const android = await t.get('/components?c=card&p=android');
        assert.match(android.text, /fun OvCard\(/);
        assert.match(android.text, /enum class OvKind/);
        const ios = await t.get('/components?c=rail&p=ios');
        assert.match(ios.text, /struct OvRail&lt;Content: View&gt;: View/);
        assert.match(ios.text, /typealias OvTokens = VibeDarkTokens/);
        assert.match((await t.get('/components?c=nope')).text, /<h2 id="cp-h">Button<\/h2>/, 'an unknown one shows the first');
    });

    await check('the components API: the contract as JSON, and kit documents checked against it', async () => {
        const spec = (await t.get('/api/v1/components')).json();
        assert.strictEqual(spec.components.length, 11);
        assert.ok(spec.components.find((c) => c.id === 'card').native.swiftui.includes('struct OvCard'));
        const good = await t.get('/api/v1/components/validate', { json: { doc: { type: 'rail', props: { title: 'Live' }, children: [{ type: 'card', props: { href: '/c/1', title: 'x' } }] } } });
        assert.strictEqual(good.status, 200);
        assert.deepStrictEqual(good.json(), { ok: true, errors: [] });
        const bad = await t.get('/api/v1/components/validate', { json: { doc: { type: 'card', props: { href: 'javascript:alert(1)', title: 'x' } } } });
        assert.strictEqual(bad.status, 422);
        assert.match(bad.json().errors.join(' '), /card\.props\.href: expected url/);
    });

    await t.close();
    done();
})();
