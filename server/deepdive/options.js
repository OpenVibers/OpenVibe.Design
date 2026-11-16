'use strict';
/**
 * The design deep dive's options (11-15, the owner: "fully configurable"), from the /deep-dive form to AI's
 * ai.deep-dive@1 input.options. A field left at its default is not sent, so the depth decides it.
 *
 *   vp=390, vp=1280            the viewports to capture (both by default)
 *   th=light, th=dark          the themes (both where the site supports dark, by default)
 *   sites, writeups            how many sites to capture and design write-ups to read
 *   extras=1                   Expert extras (menus, hover and focus, axe-core, LCP/CLS/INP) at any depth
 *   images=0                   no image search; else recency, per_sheet, sheets, img_q (one query a line) and
 *   eng=…                      the image engines (none: every engine OpenVibe runs)
 */
const RECENCY = ['any', 'day', 'week', 'month', 'year'];
const ENGINES = ['searxng', 'openverse', 'commons', 'nasa', 'serpapi-images', 'serper-images', 'searchapi-images', 'dataforseo-images', 'brave-images'];
const list = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]).map(String);
const int = (v, lo, hi) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };

function fromForm(body = {}) {
    const out = {};
    if (body.custom !== '1') return null;   // the options fold was never opened: the depth's defaults
    const vp = list(body.vp).map(Number).filter((v) => v === 390 || v === 1280);
    if (vp.length === 1) out.viewports = vp;
    const th = list(body.th).filter((t) => t === 'light' || t === 'dark');
    if (th.length === 1) out.themes = th;
    const sites = int(body.sites, 1, 30);
    if (sites != null) out.sites = sites;
    const writeups = int(body.writeups, 0, 12);
    if (writeups != null) out.writeups = writeups;
    if (body.extras === '1') out.extras = true;
    const images = {};
    if (body.images === '0') images.enabled = false;
    else {
        if (RECENCY.includes(body.recency) && body.recency !== 'year') images.recency = body.recency;
        const per = int(body.per_sheet, 8, 60);
        if (per != null && per !== 40) images.per_sheet = per;
        const sheets = int(body.sheets, 1, 8);
        if (sheets != null) images.sheets = sheets;
        const qs = String(body.img_q || '').split(/\r?\n/).map((x) => x.replace(/\s+/g, ' ').trim().slice(0, 200)).filter(Boolean).slice(0, 4);
        if (qs.length) images.queries = qs;
        const eng = list(body.eng).filter((e) => ENGINES.includes(e));
        if (eng.length) images.engines = [...new Set(eng)];
    }
    if (Object.keys(images).length) out.images = images;
    return Object.keys(out).length ? out : null;
}

module.exports = { fromForm, RECENCY, ENGINES };
