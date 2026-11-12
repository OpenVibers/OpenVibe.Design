'use strict';
/**
 * The typefaces and vectors a person makes with the model (plan R1 item 8).
 *
 * Four things are proved here:
 *   - the sanitisers refuse hostile input: a script, an event handler, an external reference, a path that
 *     is not closed, an outline that leaves the em box
 *   - the font compiles: the same glyph fixtures always give the same font, with the metrics the compiler
 *     promises and the model named in the font's name table
 *   - the cap holds: a person runs out of runs for the day and is told so in plain words
 *   - the outputs stay private: another person cannot read them, and they are not in the sitemap
 */
const assert = require('node:assert/strict');
const { boot, check, done } = require('./helpers/boot');
const { signDeliveryHeaders } = require('openvibe-sdk/events');
const { clean } = require('../server/typefaces/glyph');
const { compile } = require('../server/typefaces/compile');
const { sanitize } = require('../server/vectors/svg');

/**
 * Compile with the clock frozen. opentype.js stamps the font's head table with the build time when it writes
 * the file, so two compiles either side of a second would differ in those bytes alone; freezing the clock
 * makes the determinism check about the glyphs, the metrics and the names, which is what must not change.
 */
async function compileAt(fixedNow, input) {
    const RealDate = Date;
    class FrozenDate extends RealDate {
        constructor(...args) { super(...(args.length ? args : [fixedNow])); }
        static now() { return fixedNow; }
    }
    global.Date = FrozenDate;
    try { return await compile(input); } finally { global.Date = RealDate; }
}

/** The letters the fake model draws. Every one of them is a closed path inside the em box. */
const LETTERS = {
    A: 'M100 0 L300 700 L500 0 L420 0 L340 180 L160 180 L80 0 Z',
    B: 'M100 0 L100 700 L350 700 L500 540 L500 390 L330 370 L500 0 Z M180 80 L180 620 L330 620 L420 540 L420 460 L330 460 L180 460 Z',
    C: 'M450 0 L380 70 L340 30 L300 0 L200 0 L100 150 L100 550 L200 700 L300 700 L340 670 L380 630 L450 700 L330 800 L220 800 L100 720 L0 550 L0 150 L100 -20 L220 -100 L330 -100 Z',
    D: 'M100 0 L100 700 L300 700 L450 570 L450 130 L300 0 Z M190 90 L190 610 L290 610 L360 540 L360 160 L290 90 Z',
    E: 'M100 0 L100 700 L450 700 L450 610 L200 610 L200 400 L400 400 L400 310 L200 310 L200 90 L450 90 L450 0 Z',
};
/** The letters the fake model draws for everything else: a plain block, so every character has an outline. */
const block = (x) => 'M100 0 L100 700 L400 700 L400 0 Z';

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** The fake model: it draws letters when it is asked for a typeface, and a drawing when it is asked for a vector. */
function fakeAi(overrides = {}) {
    return {
        enabled: true,
        text: async ({ prompt }) => {
            if (String(prompt).includes('Draw these characters')) {
                const wanted = /Draw these characters, and only these: (.+)/.exec(String(prompt));
                const chars = wanted ? wanted[1].trim() : CHARSET;
                const glyphs = {};
                for (const c of chars) glyphs[c] = LETTERS[c] || block(c);
                return { text: JSON.stringify({ glyphs }), provider: 'anthropic', model: 'claude-opus-5-5' };
            }
            if (String(prompt).includes('Draw:') || String(prompt).includes('Now draw ONE letter')) {
                const svg = '<svg viewBox="0 0 24 24"><path d="M4 4 L20 4 L20 20 L4 20 Z"/></svg>';
                return { text: svg, provider: 'anthropic', model: 'claude-opus-5-5' };
            }
            return { text: '{}', provider: 'anthropic', model: 'claude-opus-5-5' };
        },
        ...overrides,
    };
}

(async () => {
    // ── The sanitisers, on their own ──
    await check('a glyph is one closed path inside the em box', () => {
        const good = clean('M100 0 L400 0 L400 700 L100 700 Z');
        assert.ok(good.ok);
        assert.equal(good.glyph.d, 'M100 0 L400 0 L400 700 L100 700 Z');
        assert.equal(good.glyph.advance, 420);
        // An open contour is not an outline.
        assert.equal(clean('M100 0 L400 0 L400 700').ok, false);
        // An outline that leaves the em box is refused.
        assert.equal(clean('M100 0 L4000 0 L4000 700 L100 700 Z').ok, false);
        // A path with nothing in it is refused.
        assert.equal(clean('M100 100 L101 100 L101 101 Z').ok, false);
    });

    await check('a glyph carries no script, handler or reference', () => {
        for (const hostile of [
            '<script>alert(1)</script>',
            '<path onload="alert(1)" d="M0 0 L100 100 Z"/>',
            '<path href="http://example.com/x" d="M0 0 L100 100 Z"/>',
            '<path style="x" d="M0 0 L100 100 Z"/>',
            '<foreignObject><b>x</b></foreignObject>',
            '<image href="http://example.com/x.png"/>',
            'javascript:alert(1)',
            'M0 0 L10 10 url(http://example.com)',
            '<path d="M0 0 L100 100 Z"/><path d="M0 0 L100 100 Z"/>',
        ]) {
            const r = clean(hostile);
            assert.equal(r.ok, false, hostile);
            assert.ok(typeof r.why === 'string' && r.why.length > 0, hostile);
        }
    });

    await check('a drawing is made of shapes and nothing else', () => {
        const good = sanitize('<svg viewBox="0 0 24 24"><g fill="#333"><path d="M4 4 L20 4 L20 20 L4 20 Z"/></g></svg>');
        assert.ok(good.ok);
        assert.ok(good.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'));
        assert.ok(good.svg.includes('<path d="M4 4 L20 4 L20 20 L4 20 Z"/>'));
        assert.ok(!good.svg.includes('http://example.com'));
        for (const hostile of [
            '<svg viewBox="0 0 24 24"><script>alert(1)</script></svg>',
            '<svg viewBox="0 0 24 24" onload="alert(1)"><path d="M0 0 L10 10 Z"/></svg>',
            '<svg viewBox="0 0 24 24"><path onclick="x()" d="M0 0 L10 10 Z"/></svg>',
            '<svg viewBox="0 0 24 24"><foreignObject><b>x</b></foreignObject></svg>',
            '<svg viewBox="0 0 24 24"><image href="http://example.com/x.png"/></svg>',
            '<svg viewBox="0 0 24 24"><use href="#x"/></svg>',
            '<svg viewBox="0 0 24 24"><path href="http://example.com" d="M0 0 L10 10 Z"/></svg>',
            '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg viewBox="0 0 24 24"><path d="M0 0 L10 10 Z"/></svg>',
            '<svg viewBox="0 0 24 24"><![CDATA[x]]></svg>',
            '<svg viewBox="0 0 24 24"><path fill="url(http://example.com/x)" d="M0 0 L10 10 Z"/></svg>',
            '<svg viewBox="0 0 24 24"><path d="M0 0 L10 10 javascript"/></svg>',
        ]) {
            const r = sanitize(hostile);
            assert.equal(r.ok, false, hostile);
            assert.ok(typeof r.why === 'string' && r.why.length > 0, hostile);
        }
        // A drawing without a size cannot be shown.
        assert.equal(sanitize('<svg><path d="M0 0 L10 10 Z"/></svg>').ok, false);
    });

    // ── The compiler, on fixed fixtures ──
    await check('the same glyphs always compile to the same font', async () => {
        const glyphs = Object.entries(LETTERS).map(([char, d]) => ({ char, d }));
        const first = await compileAt(Date.UTC(2026, 10, 12), { familyName: 'Fixture Sans', glyphs, model: 'claude-opus-5-5', designer: 'Made on OpenVibe.Design' });
        const second = await compileAt(Date.UTC(2026, 10, 12), { familyName: 'Fixture Sans', glyphs, model: 'claude-opus-5-5', designer: 'Made on OpenVibe.Design' });
        assert.ok(first.ok, first.why);
        assert.ok(second.ok);
        assert.deepEqual(first.otf, second.otf);
        assert.deepEqual(first.woff2, second.woff2);
        // The files are what they say they are.
        assert.equal(first.woff2.slice(0, 4).toString('latin1'), 'wOF2');
        assert.equal(first.otf.slice(0, 4).toString('latin1'), 'OTTO');
        // The metrics are the face's own.
        assert.equal(first.metrics.unitsPerEm, 1000);
        assert.equal(first.metrics.glyphs, 5);
        assert.ok(first.metrics.ascender >= 400 && first.metrics.ascender <= 800);
        assert.ok(first.metrics.descender >= -200 && first.metrics.descender <= -100);
    });

    await check('a font says which model drew it', async () => {
        const out = await compile({ familyName: 'Named Face', glyphs: [{ char: 'A', d: LETTERS.A }], model: 'claude-opus-5-5', designer: 'Made on OpenVibe.Design', license: 'OFL-1.1' });
        assert.ok(out.ok);
        const names = out.font.names.unicode;
        assert.equal(names.fontFamily.en, 'Named Face');
        assert.equal(names.license.en, 'OFL-1.1');
        assert.match(names.description.en, /claude-opus-5-5/);
    });

    await check('a font without a name or without glyphs is refused', async () => {
        assert.equal((await compile({ familyName: '', glyphs: [{ char: 'A', d: LETTERS.A }] })).ok, false);
        assert.equal((await compile({ familyName: '../../etc/passwd', glyphs: [{ char: 'A', d: LETTERS.A }] })).ok, false);
        assert.equal((await compile({ familyName: 'Fine', glyphs: [] })).ok, false);
        // A glyph that is not an outline does not become one on the way in.
        assert.equal((await compile({ familyName: 'Fine', glyphs: [{ char: 'A', d: '<script>alert(1)</script>' }] })).ok, false);
    });

    // ── The service, over HTTP ──
    const t = await boot({ ai: fakeAi() });
    try {
        const user = t.network.addUser('ada');
        const other = t.network.addUser('bob');

        await check('the maker page is public and the work is not', async () => {
            const page = await t.get('/fonts/make');
            assert.equal(page.status, 200);
            assert.match(page.text, /Describe a typeface/);
            assert.match(page.text, /Sign in/);
            const vectorPage = await t.get('/vectors/make');
            assert.equal(vectorPage.status, 200);
            assert.match(vectorPage.text, /Describe a drawing/);
            // The tools are pages a crawler may read; the drawings are not.
            const sitemap = (await t.get('/sitemap.xml')).text;
            assert.ok(sitemap.includes('/fonts/make'));
            assert.ok(sitemap.includes('/vectors/make'));
            assert.ok(!sitemap.includes('/fonts/made/'));
            assert.ok(!sitemap.includes('/vectors/made/'));
            const llms = (await t.get('/llms.txt')).text;
            assert.ok(llms.includes('/fonts/make'));
            assert.ok(llms.includes('/vectors/make'));
        });

        await check('a typeface is drawn, compiled and downloadable', async () => {
            const made = await t.get('/fonts/make', { as: user, method: 'POST',
                body: new URLSearchParams({ prompt: 'rounded geometric sans for a kids app', name: 'Bubble Sans' }).toString(),
                headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://openvibe.design' } });
            assert.equal(made.status, 303, made.text);
            const id = made.headers.get('location').split('/').pop();
            const row = (await t.store.db.many('SELECT * FROM ai_typefaces WHERE id=$1', [id]))[0];
            assert.ok(row);
            assert.equal(row.owner, user.subject);
            assert.equal(row.name, 'Bubble Sans');
            assert.equal(row.license, 'OFL-1.1');
            assert.equal(row.model, 'claude-opus-5-5');
            assert.ok(row.glyphs.length > 50, 'every letter is drawn');
            assert.ok(row.glyphs.every(g => g.d && g.char && g.advance));

            const specimen = await t.get('/fonts/made/' + id, { as: user });
            assert.equal(specimen.status, 200);
            assert.match(specimen.text, /Bubble Sans/);
            assert.match(specimen.text, /font\/woff2;base64/);
            assert.match(specimen.text, /Redraw one letter/);

            const woff2 = await t.get('/api/v1/typefaces/' + id + '/font.woff2', { as: user });
            assert.equal(woff2.status, 200);
            assert.equal(woff2.buffer.slice(0, 4).toString('latin1'), 'wOF2');
            assert.match(woff2.headers.get('content-disposition') || '', /attachment/);
            const otf = await t.get('/api/v1/typefaces/' + id + '/font.otf', { as: user });
            assert.equal(otf.status, 200);
            assert.equal(otf.buffer.slice(0, 4).toString('latin1'), 'OTTO');
        });

        await check('another person cannot read a typeface or its files', async () => {
            const rows = await t.store.db.many('SELECT id FROM ai_typefaces LIMIT 1');
            const id = rows[0].id;
            assert.equal((await t.get('/api/v1/typefaces/' + id)).status, 401);
            assert.equal((await t.get('/api/v1/typefaces/' + id, { as: other })).status, 404);
            assert.equal((await t.get('/api/v1/typefaces/' + id + '/font.woff2', { as: other })).status, 404);
            assert.equal((await t.get('/fonts/made/' + id, { as: other })).status, 404);
            assert.equal((await t.get('/api/v1/typefaces/' + id + '/font.woff2')).status, 401);
        });

        await check('one letter is redrawn with a note', async () => {
            const rows = await t.store.db.many('SELECT id, glyphs FROM ai_typefaces LIMIT 1');
            const id = rows[0].id;
            const before = rows[0].glyphs.length;
            const redrawn = await t.get('/fonts/made/' + id + '/glyph', { as: user, method: 'POST',
                body: new URLSearchParams({ char: 'A', note: 'make the apex rounder' }).toString(),
                headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://openvibe.design' } });
            assert.equal(redrawn.status, 303, redrawn.text);
            const after = await t.store.db.many('SELECT glyphs, note FROM ai_typefaces WHERE id=$1', [id]);
            assert.equal(after[0].glyphs.length, before);
            assert.ok(after[0].glyphs.some(g => g.char === 'A'));
            assert.equal(after[0].note, 'make the apex rounder');
            // The font still compiles after the redraw.
            const file = await t.get('/api/v1/typefaces/' + id + '/font.woff2', { as: user });
            assert.equal(file.status, 200);
        });

        await check('a vector is drawn, saved and downloadable as SVG and PNG', async () => {
            const made = await t.get('/vectors/make', { as: user, method: 'POST',
                body: new URLSearchParams({ prompt: 'a paper plane folded from a single sheet', kind: 'icon' }).toString(),
                headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://openvibe.design' } });
            assert.equal(made.status, 303, made.text);
            const id = made.headers.get('location').split('/').pop();
            const row = (await t.store.db.many('SELECT * FROM ai_vectors WHERE id=$1', [id]))[0];
            assert.ok(row);
            assert.equal(row.owner, user.subject);
            assert.ok(row.svg.startsWith('<svg'));
            assert.ok(!row.svg.includes('<script'));

            const page = await t.get('/vectors/made/' + id, { as: user });
            assert.equal(page.status, 200);
            assert.match(page.text, /Download the SVG/);
            const svg = await t.get('/vectors/made/' + id + '.svg', { as: user });
            assert.equal(svg.status, 200);
            assert.match(svg.headers.get('content-type') || '', /image\/svg\+xml/);
            assert.match(svg.headers.get('content-security-policy') || '', /default-src 'none'.*sandbox/, 'a saved drawing runs nothing when opened on its own');
            const png = await t.get('/vectors/made/' + id + '.png', { as: user });
            assert.equal(png.status, 200);
            assert.equal(png.buffer.slice(1, 4).toString('latin1'), 'PNG');
        });

        await check('another person cannot read a vector', async () => {
            const rows = await t.store.db.many('SELECT id FROM ai_vectors LIMIT 1');
            const id = rows[0].id;
            assert.equal((await t.get('/api/v1/vectors/' + id)).status, 401);
            assert.equal((await t.get('/api/v1/vectors/' + id, { as: other })).status, 404);
            assert.equal((await t.get('/vectors/made/' + id + '.svg', { as: other })).status, 404);
        });

        await check('the drawing is redrawn with a note', async () => {
            const rows = await t.store.db.many('SELECT id FROM ai_vectors LIMIT 1');
            const id = rows[0].id;
            const edited = await t.get('/vectors/made/' + id + '/edit', { as: user, method: 'POST',
                body: new URLSearchParams({ note: 'make the wings longer' }).toString(),
                headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://openvibe.design' } });
            assert.equal(edited.status, 303, edited.text);
            const after = await t.store.db.many('SELECT note FROM ai_vectors WHERE id=$1', [id]);
            assert.equal(after[0].note, 'make the wings longer');
        });

        await check('MCP can make a typeface and a vector, and needs a signed-in person', async () => {
            const anonymous = await t.get('/mcp', { method: 'POST', json: { jsonrpc: '2.0', id: 1, method: 'tools/call',
                params: { name: 'openvibe_design_make_vector', arguments: { prompt: 'a small bird' } } } });
            assert.equal(anonymous.json().result.isError, true);
            assert.match(anonymous.json().result.content[0].text, /Sign in/);

            const made = await t.get('/mcp', { as: user, method: 'POST', json: { jsonrpc: '2.0', id: 2, method: 'tools/call',
                params: { name: 'openvibe_design_make_typeface', arguments: { prompt: 'a plain geometric sans', name: 'Grid Sans' } } } });
            assert.equal(made.json().result.isError, false, made.text);
            const out = made.json().result.structuredContent;
            assert.equal(out.name, 'Grid Sans');
            assert.ok(out.glyphs > 50);
            assert.equal(out.model, 'claude-opus-5-5');
            assert.ok(out.download.woff2.includes('/font.woff2'));

            const list = await t.get('/mcp', { method: 'POST', json: { jsonrpc: '2.0', id: 3, method: 'tools/list' } });
            const names = list.json().result.tools.map(x => x.name);
            assert.ok(names.includes('openvibe_design_make_typeface'));
            assert.ok(names.includes('openvibe_design_make_vector'));
            // The tools that write are not marked read only.
            const vector = list.json().result.tools.find(x => x.name === 'openvibe_design_make_vector');
            assert.equal(vector.annotations.readOnlyHint, false);
        });

        await check('the API makes a typeface for a signed-in person', async () => {
            const made = await t.get('/api/v1/typefaces', { as: user, method: 'POST', json: { prompt: 'a condensed sans' } });
            assert.equal(made.status, 201, made.text);
            assert.ok(made.json().glyphs.length > 50);
            assert.equal(made.json().license, 'OFL-1.1');
            const anon = await t.get('/api/v1/typefaces', { method: 'POST', json: { prompt: 'a condensed sans' } });
            assert.equal(anon.status, 401);
        });
    } finally { await t.close(); }

    // ── The cap ──
    await check('a person runs out of runs for the day and is told in plain words', async () => {
        const capped = await boot({ ai: fakeAi(), env: { DESIGN_AI_MAKE_PER_DAY: '1' } });
        try {
            const user = capped.network.addUser('cleo');
            const first = await capped.get('/api/v1/vectors', { as: user, method: 'POST', json: { prompt: 'a small bird' } });
            assert.equal(first.status, 201, first.text);
            const second = await capped.get('/api/v1/vectors', { as: user, method: 'POST', json: { prompt: 'another bird' } });
            assert.equal(second.status, 429);
            assert.match(second.json().error, /today|tomorrow/i);
            // The cap is per person: somebody else may still make one.
            const other = capped.network.addUser('dara');
            const theirs = await capped.get('/api/v1/vectors', { as: other, method: 'POST', json: { prompt: 'a small bird' } });
            assert.equal(theirs.status, 201, theirs.text);
            // The runs are counted, so the cap is measured against something.
            const runs = await capped.store.db.many('SELECT owner, kind FROM ai_make_runs');
            assert.equal(runs.length, 2);
            assert.deepEqual(new Set(runs.map(r => r.kind)), new Set(['vector']));
        } finally { await capped.close(); }
    });

    // ── The account the work belongs to (ADR-033) ──
    await check('an export carries the person\'s own typefaces and vectors; deleting the account takes them away', async () => {
        const calls = [];
        const secret = `fixture_${'design'.repeat(8)}`;
        const t2 = await boot({ ai: fakeAi(), env: { DESIGN_EVENTS_SECRET: secret },
            accountSend: async (path, body) => { calls.push({ path, body }); return { ok: true, status: 201, json: async () => ({}) }; } });
        try {
            const owner = t2.network.addUser('ida');
            const stranger = t2.network.addUser('eve');
            await t2.get('/api/v1/typefaces', { as: owner, method: 'POST', json: { prompt: 'a plain geometric sans', name: 'Kept Sans' } });
            await t2.get('/api/v1/vectors', { as: owner, method: 'POST', json: { prompt: 'a small bird' } });
            await t2.get('/api/v1/vectors', { as: stranger, method: 'POST', json: { prompt: 'another bird' } });

            const exportEvent = { event_id: 'evt_01JZ0000000000000000000E11', event_type: 'network.account.export_requested', source: 'network',
                payload: { export_id: 'exp_01JZ0000000000000000000EX2', subject: owner.subject } };
            const raw = JSON.stringify({ event: exportEvent, seq: 1 });
            const res = await t2.get('/internal/events', { method: 'POST', body: raw,
                headers: { 'content-type': 'application/json', ...signDeliveryHeaders(raw, secret) } });
            assert.equal(res.status, 200, res.text);
            const part = calls.find((c) => c.path.startsWith('/internal/account-exports/'));
            assert.ok(part, 'the part was pushed to Network');
            const names = part.body.files.map((f) => f.name).sort();
            assert.ok(names.includes('ai_typefaces.json'), names.join(', '));
            assert.ok(names.includes('ai_vectors.json'), names.join(', '));
            assert.ok(names.includes('ai_make_runs.json'), names.join(', '));
            const all = JSON.stringify(part.body);
            assert.ok(all.includes('Kept Sans'), 'the typeface travels with the person');
            assert.ok(!all.includes(stranger.subject), 'another account is never named');

            const deleteEvent = { event_id: 'evt_01JZ0000000000000000000D11', event_type: 'network.account.deleted', source: 'network',
                payload: { deletion_id: 'del_01JZ0000000000000000000DE2', subject: owner.subject, aliases: [] } };
            const rawDelete = JSON.stringify({ event: deleteEvent, seq: 1 });
            const gone = await t2.get('/internal/events', { method: 'POST', body: rawDelete,
                headers: { 'content-type': 'application/json', ...signDeliveryHeaders(rawDelete, secret) } });
            assert.equal(gone.status, 200, gone.text);
            assert.equal(gone.json().outcome, 'erased');
            const db = t2.ctx.s.db;
            assert.equal(Number(await db.value('SELECT COUNT(*) FROM ai_typefaces WHERE owner = $1', [owner.subject])), 0);
            assert.equal(Number(await db.value('SELECT COUNT(*) FROM ai_vectors WHERE owner = $1', [owner.subject])), 0);
            assert.equal(Number(await db.value('SELECT COUNT(*) FROM ai_make_runs WHERE owner = $1', [owner.subject])), 0);
            assert.ok(Number(await db.value('SELECT COUNT(*) FROM ai_vectors WHERE owner = $1', [stranger.subject])) > 0, 'another person\'s drawing stays');
        } finally { await t2.close(); }
    });

    // ── When the model is not there ──
    await check('a plain word when the model is not configured', async () => {
        const off = await boot({ ai: { enabled: false, text: async () => { throw new Error('no'); } } });
        try {
            const user = off.network.addUser('fay');
            const made = await off.get('/api/v1/vectors', { as: user, method: 'POST', json: { prompt: 'a small bird' } });
            assert.equal(made.status, 503);
            assert.match(made.json().error, /not configured/i);
            assert.ok(!/Error:|at Object/.test(made.json().error));
        } finally { await off.close(); }
    });

    done();
})();
