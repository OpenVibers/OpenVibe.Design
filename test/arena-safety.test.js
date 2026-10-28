'use strict';
/**
 * The output safety rules: the sanitizer strips scripts, event handlers and javascript: URLs and caps at 200 KB;
 * the only renderer is a strict sandboxed iframe whose srcdoc carries a CSP that blocks every network fetch.
 */
const assert = require('assert');
const { sanitizeHtml, frameDocument, iframeHtml, MAX_BYTES } = require('../server/arena/sanitize');
const { check, done } = require('./helpers/boot');

(async () => {
    await check('scripts, event handlers and javascript: URLs never reach storage', async () => {
        const cases = [
            '<h1>ok</h1><script>alert(1)</script>',
            '<SCRIPT SRC="https://evil.example/x.js"></SCRIPT><p>after</p>',
            '<script>one</script><script>two</script>',
            '<p>before<script src=x>unclosed',
            '<img src="x" onerror="alert(1)">',
            '<svg onload=alert(1)><circle/></svg>',
            '<div onclick = "x" OnMouseOver="y">safe</div>',
            '<img alt="x>y" onerror="alert(1)">',
            '<a href="javascript:alert(1)">x</a>',
            '<a href="JaVaScRiPt&#58;alert(1)">x</a>',
            '<a href="java\nscript:alert(1)">x</a>',
            '<a href="&#106;avascript:alert(1)">x</a>',
            '<a href="java&#9;script:alert(1)">x</a>',
            '<a href="java&Tab;script:alert(1)">x</a>',
        ];
        for (const input of cases) {
            const out = sanitizeHtml(input);
            assert.ok(!/<script/i.test(out), `script remains in ${JSON.stringify(out)}`);
            assert.ok(!/\son[a-z]+\s*=/i.test(out), `handler remains in ${JSON.stringify(out)}`);
            assert.ok(!/javascript\s*:/i.test(out), `javascript: remains in ${JSON.stringify(out)}`);
        }
        assert.match(sanitizeHtml('<h1>keep me</h1><script>bad()</script>'), /keep me/);
    });

    await check('a page larger than 200 KB is cut to the cap', async () => {
        const huge = `<style>${'body{color:red}'.repeat(20_000)}</style><p>${'a'.repeat(300 * 1024)}</p>`;
        const out = sanitizeHtml(huge);
        assert.ok(Buffer.byteLength(out, 'utf8') <= MAX_BYTES, `${Buffer.byteLength(out, 'utf8')} bytes`);
        assert.strictEqual(MAX_BYTES, 200 * 1024);
    });

    await check('the frame document carries the blocking CSP before any model content', async () => {
        const doc = frameDocument('<h1>x</h1><script>bad()</script>');
        assert.ok(doc.startsWith('<meta charset="utf-8">'));
        assert.match(doc, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">/);
        assert.ok(!/<script/i.test(doc));
    });

    await check('iframe markup is sandboxed with no scripts and no same-origin, and cannot break out', async () => {
        const html = iframeHtml({ html: '<h1>hello</h1>', width: 390, height: 844, title: 'phone' });
        assert.match(html, /<iframe /);
        assert.match(html, /sandbox=""/);
        assert.doesNotMatch(html, /allow-scripts/);
        assert.doesNotMatch(html, /allow-same-origin/);
        assert.match(html, /width="390"/);
        assert.match(html, /srcdoc="/);
        const evil = iframeHtml({ html: '</iframe><script>window.top.location="https://evil.example"</script>', width: 1280 });
        assert.strictEqual((evil.match(/<iframe /g) || []).length, 1);
        assert.ok(!evil.includes('</iframe><script>'));
        assert.match(evil, /width="1280"/);
        assert.match(evil, /default-src 'none'/);
    });

    done();
})().catch((err) => { console.error(err); process.exit(1); });
