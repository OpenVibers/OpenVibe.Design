#!/usr/bin/env node
'use strict';
/**
 * Screenshot the specimen pages a release names, at 390 and 1280, dark and light, as small webp plates.
 *
 *   node scripts/capture-release.js 4.195.0 4.196.0 …      (a local app boots itself, as the tests do)
 *   node scripts/capture-release.js --base https://openvibe.design 4.200.0
 *
 * One plate per component and width and scheme: public/changes/<version>/<component>-<390|1280>-<dark|light>.webp.
 * The page is the component page Design already renders (its [data-specimen], else the demo stage); a release that
 * names only a non-component page gets no plate. Chrome is the estate's own CDP launcher (tools/cdp.js); the plate is
 * converted with cwebp. No network is asked for the changelog: server/changes.js reads the pinned package.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'changes');
const CDP = process.env.OV_CDP || path.resolve(ROOT, '..', 'tools', 'cdp.js');
const WIDTHS = [390, 1280];
const SCHEMES = ['dark', 'light'];
const SELECTORS = ['[data-specimen]', '.cp-stage', '.cr-demo', 'main'];

function usage() {
    console.error('usage: node scripts/capture-release.js [--base URL] [--force] <version> [version …]');
    process.exit(2);
}

function args() {
    const out = { base: null, force: false, versions: [] };
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--base') out.base = argv[++i];
        else if (argv[i] === '--force') out.force = true;
        else if (argv[i] === '--help' || argv[i] === '-h') usage();
        else out.versions.push(argv[i]);
    }
    if (!out.versions.length) usage();
    return out;
}

async function waitFor(page, selector, ms = 8000) {
    const started = Date.now();
    while (Date.now() - started < ms) {
        const found = await page.eval(`!!document.querySelector(${JSON.stringify(selector)})`).catch(() => false);
        if (found) return true;
        await page.wait(200);
    }
    return false;
}

async function plate(page, url, width, scheme, file) {
    await page.send('Emulation.setDeviceMetricsOverride', {
        width, height: 900, deviceScaleFactor: 1, mobile: width < 500,
    });
    await page.go(url);
    // The page's own theme comes from Network; the plate is the built-in theme, whichever the person wears.
    await page.eval(`fetch('/scheme.css?scheme=${scheme}').then(function (r) { return r.text(); }).then(function (css) {
        var s = document.getElementById('ov-capture-scheme') || document.createElement('style');
        s.id = 'ov-capture-scheme'; s.textContent = css; document.head.appendChild(s);
        // The bar and the footer are fixed; they would sit over a plate captured past the viewport.
        var chrome = document.getElementById('ov-capture-chrome') || document.createElement('style');
        chrome.id = 'ov-capture-chrome';
        chrome.textContent = '#navbar-mount,.openvibe-navbar,.ovnav-appbar,.ovf-bar,#ov-footer{display:none!important}';
        document.head.appendChild(chrome);
    })`).catch(() => {});
    let selector = null;
    for (const sel of SELECTORS) {
        if (await waitFor(page, sel, sel === 'main' ? 4000 : 8000)) { selector = sel; break; }
    }
    if (!selector) throw new Error(`${url}: no specimen`);
    await page.wait(500);
    const box = await page.eval(`(function () {
        var el = document.querySelector(${JSON.stringify(selector)});
        var r = el.getBoundingClientRect();
        return { x: Math.max(0, r.left + window.scrollX), y: Math.max(0, r.top + window.scrollY), width: Math.min(${width}, r.width), height: r.height };
    })()`);
    const shot = await page.send('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: true,
        clip: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height), scale: 1 },
    });
    const png = `${file}.png`;
    fs.writeFileSync(png, Buffer.from(shot.data, 'base64'));
    const max = width === 390 ? 640 : 900;
    execFileSync('cwebp', ['-quiet', '-q', '74', '-resize', String(max), '0', png, '-o', file]);
    fs.unlinkSync(png);
    return { file, bytes: fs.statSync(file).size };
}

(async () => {
    const o = args();
    const { releaseOf, componentsOf } = require('../server/changes');
    const wanted = [];
    for (const v of o.versions) {
        const release = releaseOf(v);
        if (!release) { console.error(`no release ${v} in the pinned changelog`); process.exitCode = 1; continue; }
        const pages = componentsOf(release).filter((c) => c.href.startsWith('/components/'));
        if (!pages.length) console.error(`${v}: no component page to shoot`);
        for (const c of pages) wanted.push({ version: release.version, key: c.key, href: c.href });
    }
    if (!wanted.length) process.exit(1);

    let booted = null;
    let base = o.base;
    if (!base) {
        const { boot } = require('../test/helpers/boot');
        booted = await boot();
        base = booted.base;
        console.log(`local app: ${base}`);
    }
    if (!fs.existsSync(CDP)) throw new Error(`the estate's CDP launcher is not at ${CDP}; set OV_CDP to tools/cdp.js`);
    const cdp = require(CDP);
    const browser = await cdp.launch({ width: 1280, height: 900 });
    let made = 0;
    try {
        for (const item of wanted) {
            const dir = path.join(OUT, item.version);
            fs.mkdirSync(dir, { recursive: true });
            for (const scheme of SCHEMES) {
                for (const width of WIDTHS) {
                    const file = path.join(dir, `${item.key}-${width}-${scheme}.webp`);
                    if (!o.force && fs.existsSync(file)) { console.log(`kept ${path.relative(ROOT, file)}`); continue; }
                    const got = await plate(browser.page, `${base}${item.href}`, width, scheme, file);
                    made++;
                    console.log(`${path.relative(ROOT, file)} ${Math.round(got.bytes / 1024)} KB`);
                }
            }
        }
    } finally {
        browser.close();
        if (booted) await booted.close();
    }
    console.log(`\n${made} plate${made === 1 ? '' : 's'} written for ${[...new Set(wanted.map((x) => x.version))].join(', ')}`);
    process.exit(process.exitCode || 0);
})().catch((err) => { console.error(err && err.stack || err); process.exit(1); });
