'use strict';
/**
 * Icon kits (plan L32 I5): a font with only the glyphs a site uses, the way Font Awesome's paid Kits subset theirs.
 * The person picks glyphs on /icons/kit; the kit is cut from openvibe-shared's ov-glyphs.ttf (harfbuzz, through
 * subset-font) and handed back as one ZIP: WOFF2 for the web, TTF for apps, the CSS (Font Awesome's class names too,
 * if asked), the code points and a short README. Three glyphs weigh under a kilobyte. Nothing is stored: the same
 * choices give the same files.
 *
 *   parse({ names, name, fa })  → { names: [...known, deduped], slug, fa } or throws { status: 422 }
 *   build(choice)               → Promise<{ zip: Buffer, files: { name: bytes } }>
 */
const fs = require('fs');
const path = require('path');
const glyphs = require('openvibe-shared/glyphs');
const ex = require('./export');

const SHARED = path.dirname(require.resolve('openvibe-shared/glyphs'));
const MAX = 200;
let ttf = null;
let subsetFont = null;

function parse({ names, name, fa } = {}) {
    const list = (Array.isArray(names) ? names : String(names || '').split(/[\s,]+/))
        .map((n) => String(n).trim().toLowerCase().replace(/^fa-/, '')).filter(Boolean)
        .map((n) => (glyphs.path(n) ? n : glyphs.fromFa(n)))   // a Font Awesome name picks its glyph
        .filter(Boolean);
    const unique = [...new Set(list)].slice(0, MAX);
    if (!unique.length) throw Object.assign(new Error('pick at least one glyph'), { status: 422 });
    const slug = String(name || 'my-kit').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'my-kit';
    return { names: unique, slug, fa: fa === true || fa === '1' || fa === 'on' };
}

const faOf = (g) => Object.entries(glyphs.FA).filter(([, v]) => v === g).map(([k]) => k).sort();

async function build({ names, slug, fa }) {
    if (!ttf) ttf = fs.readFileSync(path.join(SHARED, 'glyph-fonts', 'ov-glyphs.ttf'));
    if (!subsetFont) subsetFont = require('subset-font');
    const cps = names.map((n) => [n, ex.codepointOf(n)]).filter(([, cp]) => cp);
    const text = cps.map(([, cp]) => String.fromCodePoint(parseInt(cp, 16))).join('');
    const [woff2, truetype] = await Promise.all([
        subsetFont(ttf, text, { targetFormat: 'woff2' }),
        subsetFont(ttf, text, { targetFormat: 'truetype' }),
    ]);
    const family = `OV Glyphs ${slug}`;
    const base = "{display:inline-block;font-family:'" + family + "';font-style:normal;font-weight:400;font-variant:normal;line-height:1;text-rendering:auto;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;speak:never}";
    const rule = (sel, cp) => `${sel}::before{content:"\\${cp.toLowerCase()}"}`;
    const css = [
        `/* ${family}: ${cps.length} OpenVibe glyphs (MIT), made on https://openvibe.design/icons/kit */`,
        `@font-face{font-family:'${family}';src:url(${slug}.woff2) format('woff2'),url(${slug}.ttf) format('truetype');font-display:block}`,
        `.ovi${base}`,
        '.ovi-fw{width:1.25em;text-align:center}',
        ...cps.map(([n, cp]) => rule(`.ovi-${n}`, cp)),
        ...(fa ? [
            '/* Font Awesome\'s class names, for these glyphs only */',
            `.fa,.fas,.far,.fa-solid,.fa-regular${base}`,
            ...cps.flatMap(([n, cp]) => faOf(n).map((f) => rule(`.fa-${f}`, cp))),
        ] : []),
    ].join('\n') + '\n';
    const json = JSON.stringify({ family, glyphs: Object.fromEntries(cps), font_awesome: fa ? Object.fromEntries(cps.map(([n]) => [n, faOf(n)])) : undefined }, null, 2) + '\n';
    const readme = `${family}\n\n${cps.length} glyphs from the OpenVibe glyphs, MIT licence: ${cps.map(([n]) => n).join(', ')}.\n\nOn a page:\n  <link rel="stylesheet" href="${slug}.css">\n  <i class="ovi ovi-${cps[0][0]}"></i>${fa ? `\n  <i class="fa-solid fa-${(faOf(cps[0][0])[0] || cps[0][0])}"></i>   (Font Awesome's names work too)` : ''}\n\nKeep ${slug}.css, ${slug}.woff2 and ${slug}.ttf together. In an app, install ${slug}.ttf and type a glyph's character (${slug}.json lists them).\nMake another: https://openvibe.design/icons/kit\n`;
    const files = { [`${slug}.woff2`]: woff2, [`${slug}.ttf`]: truetype, [`${slug}.css`]: css, [`${slug}.json`]: json, 'README.txt': readme };
    const zip = ex.zipOf(Object.entries(files).map(([name, data]) => ({ name: `${slug}/${name}`, data })));
    return { zip, files };
}

module.exports = { parse, build, MAX };
