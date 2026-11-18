'use strict';
/**
 * The page audit's `auth` (plan §AD.25 previews): a token goes only to an OpenVibe Connect preview
 * (https://….openvibe.link, no port), only while the request stays on the origin it started at, never across a redirect
 * to another host; anywhere else it is refused before any lookup. Without one, nothing changes.
 */
const assert = require('assert/strict');
const { EventEmitter } = require('events');

// No DNS in a test: every address counts as public, and https.request answers from a script.
const sharedEgress = require('openvibe-shared/egress');
sharedEgress.assertPublicUrl = async () => {};
const https = require('https');
const seen = [];
let script = [];
https.request = (url, opts, onResponse) => {
    seen.push({ url: String(url), auth: (opts.headers && opts.headers.Authorization) || null });
    const step = script.shift() || { status: 200, body: '<html></html>' };
    const req = new EventEmitter();
    req.destroy = () => {};
    req.end = () => process.nextTick(() => {
        const res = new EventEmitter();
        res.statusCode = step.status;
        res.headers = step.headers || {};
        res.resume = () => {};
        onResponse(res);
        if (!(step.status >= 300 && step.status < 400)) {
            res.emit('data', Buffer.from(step.body || ''));
            res.emit('end');
        }
    });
    return req;
};

const { fetchPageHtml } = require('../server/create/egress');
const TOKEN = 'preview-token-example-not-a-secret';

(async () => {
    // To a preview, the token is sent.
    script = [{ status: 200, body: '<html><title>Built</title></html>' }];
    let page = await fetchPageHtml('https://pa1b2c3--01jabc.openvibe.link/', { auth: TOKEN });
    assert.match(page.html, /Built/);
    assert.deepEqual(seen.map((x) => x.auth), [`Bearer ${TOKEN}`]);

    // A redirect on the same origin keeps it; one to another host goes without it.
    seen.length = 0;
    script = [
        { status: 302, headers: { location: '/app/' } },
        { status: 302, headers: { location: 'https://elsewhere.example/landing' } },
        { status: 200, body: '<html></html>' },
    ];
    await fetchPageHtml('https://pa1b2c3--01jabc.openvibe.link/', { auth: TOKEN });
    assert.deepEqual(seen.map((x) => [new URL(x.url).host, x.auth]), [
        ['pa1b2c3--01jabc.openvibe.link', `Bearer ${TOKEN}`],
        ['pa1b2c3--01jabc.openvibe.link', `Bearer ${TOKEN}`],
        ['elsewhere.example', null],
    ], 'the token never follows a redirect to another host');

    // Anywhere but a preview, a token is refused before anything is asked.
    seen.length = 0;
    for (const url of ['https://example.com/', 'https://openvibe.link/', 'https://a.b.openvibe.link/', 'https://pa1b2c3--x.openvibe.link:8443/', 'https://evil-openvibe.link/']) {
        await assert.rejects(fetchPageHtml(url, { auth: TOKEN }), (err) => err.code === 'start_url_auth', url);
    }
    await assert.rejects(fetchPageHtml('https://pa1b2c3--x.openvibe.link/', { auth: 'short' }), (err) => err.code === 'start_url_auth', 'not a token');
    await assert.rejects(fetchPageHtml('https://pa1b2c3--x.openvibe.link/', { auth: `${TOKEN}\r\nX-Evil: 1` }), (err) => err.code === 'start_url_auth', 'no header injection');
    assert.equal(seen.length, 0, 'nothing was asked');

    // Without a token nothing changes.
    script = [{ status: 200, body: '<html></html>' }];
    await fetchPageHtml('https://example.com/');
    assert.deepEqual(seen.map((x) => x.auth), [null]);

    console.log('page audit auth: preview hosts only, same origin only, refused elsewhere before any lookup');
})().catch((err) => { process.stderr.write(`${err && err.stack || err}\n`); process.exit(1); });
