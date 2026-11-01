'use strict';
/**
 * One glyph's own page, /icons/<name> (plan L32 I5/I7), and /icons/font-awesome-alternative.
 *
 * A glyph page is what a search for "<name> icon" should land on: the glyph on its 24-unit grid, the Font Awesome names
 * it stands in for, every way to get it (SVG, PNG at any size and colour, the font, the sprite, the drop-in), and the
 * glyphs near it. The PNG maker is a plain GET form, so it works without JavaScript; icon.js previews as you change it.
 * ImageObject JSON-LD carries the licence (MIT) and where to get it, which is what earns an image the "Licensable" mark.
 *
 *   glyphPage({ base, name, opts })     faAlternativePage({ base })     related(name, n)
 */
const kit = require('openvibe-shared/kit');
const glyphs = require('openvibe-shared/glyphs');
const { layout, esc } = require('../render/layout');
const ex = require('../glyphs/export');
const formats = require('../glyphs/formats');
const usage = require('../glyphs/fa-usage.json');

const title = (name) => name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
const faOf = (name) => Object.entries(glyphs.FA).filter(([, g]) => g === name).map(([fa]) => fa).sort();
const drawn = (name) => (glyphs.META[name] && /Opus/.test(glyphs.META[name].by) ? 'Drawn for the set' : 'From the kit');
const glyph = (name, size = 24, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${glyphs.path(name)}</svg>`;
/** The glyph as the sites show it at that size (L50): its solid drawing at 18 px and under when it has one. */
const glyphAt = (name, size) => (glyphs.solid(name) && size <= ex.SOLID_BELOW
    ? `<svg class="is-solid" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">${glyphs.solid(name)}</svg>`
    : glyph(name, size, size <= ex.SOLID_BELOW ? 'is-small' : ''));
const LADDER = [12, 16, 20, 24, 32, 48];

/** The glyphs that share a word with this one (its name or its Font Awesome names), then its neighbours. */
function related(name, n = 12) {
    const words = (g) => new Set([g, ...faOf(g)].flatMap((s) => s.split('-')).filter((w) => w.length > 2));
    const mine = words(name);
    const scored = glyphs.NAMES.filter((g) => g !== name).map((g) => [g, [...words(g)].filter((w) => mine.has(w)).length]).filter(([, s]) => s > 0)
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([g]) => g);
    const i = glyphs.NAMES.indexOf(name);
    const near = [...glyphs.NAMES.slice(i + 1), ...glyphs.NAMES.slice(0, i)].filter((g) => !scored.includes(g));
    return [...scored, ...near].slice(0, n);
}

function glyphPage({ base = 'https://openvibe.design', name, opts = ex.options() }) {
    const fa = faOf(name);
    const cp = ex.codepointOf(name);
    const T = title(name);
    const q = ex.query(opts);
    const svgUrl = `/icons/${name}.svg`;
    const pngUrl = `/icons/${name}.png${q}`;
    const faLine = fa.length ? `In place of Font Awesome&rsquo;s ${fa.slice(0, 6).map((f) => `<code>fa-${esc(f)}</code>`).join(', ')}${fa.length > 6 ? ` and ${fa.length - 6} more` : ''}.` : '';
    const sel = (field, list, cur, label) => `<label class="gp-field"><span>${label}</span><select name="${field}" data-gp="${field}">${list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
    const range = (field, min, max, step, cur, label, unit) => `<label class="gp-field"><span>${label} <output data-gp-out="${field}">${cur}${unit}</output></span><input type="range" name="${field}" min="${min}" max="${max}" step="${step}" value="${cur}" data-gp="${field}"></label>`;

    const hero = `<nav class="gp-crumbs" aria-label="Breadcrumb"><a href="/icons">Icons</a><span aria-hidden="true">/</span><span>${esc(name)}</span></nav>
<header class="gp-hero">
  <figure class="gp-stage">${glyph(name, 168, 'gp-big')}<figcaption>On the 24-unit grid, strokes two units wide</figcaption></figure>
  <div class="gp-say">
    <p class="ic-eye">The OpenVibe glyphs</p>
    <h1 class="gp-h1">${esc(T)}</h1>
    <p class="gp-lede">A free ${esc(T.toLowerCase())} icon in the OpenVibe hand, as SVG, PNG and a font. ${faLine}</p>
    <dl class="gp-facts">
      <div><dt>Name</dt><dd><code>${esc(name)}</code></dd></div>
      ${cp ? `<div><dt>Character</dt><dd><code>U+${esc(cp)}</code></dd></div>` : ''}
      <div><dt>Drawn</dt><dd>${esc(drawn(name))}</dd></div>
      <div><dt>Licence</dt><dd>MIT, free for any use</dd></div>
    </dl>
    <div class="ic-acts">
      <a class="ic-btn is-go" href="${svgUrl}" download="${esc(name)}.svg">${kit.icon('download')} SVG</a>
      <a class="ic-btn" href="#png">${kit.icon('image')} Make a PNG</a>
      <button type="button" class="ic-btn" data-gp-copy="${svgUrl}" hidden>Copy the SVG</button>
      <a class="ic-btn" href="/icons/kit?names=${encodeURIComponent(name)}">Put it in a kit</a>
    </div>
  </div>
</header>
<section class="gp-ladder" aria-labelledby="gp-ladder-h">
  <h2 class="gp-ladder-h" id="gp-ladder-h">Every size by itself</h2>
  <p class="gp-ladder-p">${glyphs.solid(name)
        ? `At ${ex.SOLID_BELOW} px and under it switches to its solid drawing, which stays clear when small; above that it is the line. Sites do it with no code, and the files below do it on <code>style=auto</code>.`
        : 'Its lines grow a little heavier when small, so it stays clear; it has no solid drawing because it is made of lines.'}</p>
  ${['light', 'dark'].map((t) => `<div class="gp-sizes is-${t}" role="img" aria-label="${esc(name)} at ${LADDER.join(', ')} pixels, on ${t}">${LADDER.map((sz) => `<span style="font-size:${sz}px">${glyphAt(name, sz)}<i>Aa</i><small>${sz}</small></span>`).join('')}</div>`).join('')}
</section>`;

    const maker = `<section class="ic-sec" id="png" aria-labelledby="gp-png">
  <div class="ic-sec-head"><h2 id="gp-png">Make a PNG</h2><p>Any size up to 1024 pixels at 1×, 2× or 3×, in any colour or the mark&rsquo;s two, a lighter or heavier line, flat or with the mark&rsquo;s depth and glow, room around it and a ground behind it. The link rebuilds the same file every time.</p></div>
  <form class="gp-maker" method="get" action="/icons/${esc(name)}#png" data-gp-form>
    <div class="gp-preview" data-gp-preview data-ground="${esc(opts.ground)}"><img src="${esc(pngUrl)}" alt="${esc(T)} icon, ${opts.size} pixels" width="${Math.min(opts.size, 256)}" height="${Math.min(opts.size, 256)}" data-gp-img></div>
    <div class="gp-controls">
      ${sel('size', ex.SIZES.map((s) => [s, `${s} px`]), opts.size, 'Size')}
      ${sel('scale', [[1, '1×'], [2, '2× (sharp screens)'], [3, '3×']], opts.scale, 'Density')}
      <label class="gp-field"><span>Colour</span><span class="gp-colour"><input type="color" value="#${esc(opts.color === 'mark' ? '4f7cff' : opts.color)}" data-gp-colour aria-label="Line colour"><input type="text" name="color" value="${esc(opts.color)}" maxlength="6" pattern="mark|[0-9a-fA-F]{3}|[0-9a-fA-F]{6}" spellcheck="false" data-gp="color"><button type="button" class="gp-chip" data-gp-mark aria-pressed="${opts.color === 'mark'}">The mark&rsquo;s</button></span></label>
      ${range('stroke', 1, 3, 0.25, opts.stroke, 'Line', '')}
      ${range('pad', 0, 40, 1, opts.pad, 'Room around it', '%')}
      ${sel('style', [['auto', `Auto: ${glyphs.solid(name) ? `solid at ${ex.SOLID_BELOW} px and under` : 'the line (it has no solid)'}`], ['line', 'Line'], ['solid', glyphs.solid(name) ? 'Solid' : 'Solid (it has none: the line)']], opts.style, 'Style')}
      ${sel('fx', [['flat', 'Flat'], ['depth', 'Depth: light to deep'], ['glow', 'A glow behind it'], ['depth-glow', 'Depth and a glow']], opts.fx, 'Finish')}
      ${sel('ground', [['none', 'None, transparent'], ['circle', 'A circle'], ['squircle', 'A rounded square'], ['square', 'A square']], opts.ground, 'Ground')}
      <label class="gp-field" data-gp-bg-field${opts.ground === 'none' ? ' hidden' : ''}><span>Ground colour</span><span class="gp-colour"><input type="color" value="#${esc(opts.bg)}" data-gp-bgpick aria-label="Ground colour"><input type="text" name="bg" value="${esc(opts.bg)}" maxlength="6" pattern="[0-9a-fA-F]{3}|[0-9a-fA-F]{6}" spellcheck="false" data-gp="bg"></span></label>
      <div class="gp-go">
        <noscript><button type="submit" class="ic-btn">Show it</button></noscript>
        <a class="ic-btn is-go" href="${esc(pngUrl)}" download="${esc(name)}-${opts.size * opts.scale}.png" data-gp-png>${kit.icon('download')} PNG, ${opts.size * opts.scale} px</a>
        <a class="ic-btn" href="${esc(`/icons/${name}.svg${q}`)}" download="${esc(name)}.svg" data-gp-svg>SVG with these choices</a>
      </div>
    </div>
  </form>
</section>`;

    const faTag = fa.length ? `<i class="fa-solid fa-${esc(fa[0])}"></i>` : `<svg><use href="${base}/shared/ov-glyphs.svg#ovg-${esc(name)}"/></svg>`;
    // L50 step 3: every form people paste, built from the same drawing (server/glyphs/formats.js). The four most asked
    // for show; the rest sit in a counted fold, never behind tabs.
    const at24 = ex.options({ size: 24 });
    const way = (h, code, id, note = '') => `<div class="gp-way"><h3>${h}</h3>${note ? `<p class="gp-note">${note}</p>` : ''}${kit.snippet({ code, id, label: 'Copy' })}</div>`;
    const first = [
        way('Any page', `<script src="${base}/ov-icon.js" defer></script>\n<ov-icon name="${name}"></ov-icon>`, 'gp-wc', 'No sign-in. It follows the text&rsquo;s size and colour, and turns solid when small.'),
        way('Inline SVG', formats.inlineSvg(name, at24), 'gp-inline', 'HTML, Vue, Svelte, Solid, Angular.'),
        way('React', formats.jsx(name, at24), 'gp-jsx'),
        way('A link', `${base}/icons/${name}.svg\n${base}/icons/${name}.png?size=512&color=mark${glyphs.solid(name) ? `\n${base}/icons/${name}.svg?style=solid` : ''}`, 'gp-url'),
    ];
    const more = [
        fa.length ? way('Font Awesome markup', `<script src="${base}/shared/ov-glyphs.js" defer></script>\n${faTag}`, 'gp-fa', 'Keep your markup; the drop-in draws ours.') : '',
        cp ? way('The font', `<link rel="stylesheet" href="${base}/shared/ov-glyphs-font.css">\n<i class="ovi ovi-${name}"></i>`, 'gp-font') : '',
        way('The sprite', `<svg width="24" height="24"><use href="${base}/shared/ov-glyphs.svg#ovg-${name}"/></svg>`, 'gp-sprite'),
        way('CSS, no markup', formats.cssMask(name, at24), 'gp-mask', 'A mask painted in the text&rsquo;s colour: <code>&lt;span class="icon-${esc(name)}"&gt;&lt;/span&gt;</code>.'),
        way('Data URI', formats.dataUri(name, at24), 'gp-data', 'For an <code>&lt;img&gt;</code> or a CSS <code>url()</code>, in a fixed colour.'),
        way('ES module', `import ${name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())} from '${base}/icons/${name}.mjs';\n// { name, line, solid }: the drawings, for a component of your own`, 'gp-mjs'),
        way('Node', `require('openvibe-shared/glyphs').svg('${name}', { size: 24 })`, 'gp-node'),
        way('Android', `<!-- res/drawable/ic_${name.replace(/-/g, '_')}.xml -->\n${base}/icons/${name}.xml`, 'gp-android', `A VectorDrawable: <a href="/icons/${esc(name)}.xml" download="ic_${esc(name.replace(/-/g, '_'))}.xml">download the XML</a>. iOS: Xcode takes the SVG as it is (keep &ldquo;Preserve Vector Data&rdquo; on).`),
    ].filter(Boolean);
    const use = `<section class="ic-sec" aria-labelledby="gp-use">
  <div class="ic-sec-head"><h2 id="gp-use">Use it</h2><p>Every way is the same drawing, free to use with no sign-in. On an OpenVibe site the navbar already loads the drop-in, so Font Awesome&rsquo;s markup shows it.</p></div>
  <div class="gp-use">${first.join('')}</div>
  <details class="gp-more"><summary>${more.length} more ways <span>${more.map((m) => /<h3>([^<]+)<\/h3>/.exec(m)[1]).join(' · ')}</span></summary><div class="gp-use">${more.join('')}</div></details>
  <div class="gp-files"><span>Files:</span>
    <a class="ic-btn" href="/icons/${esc(name)}.svg" download="${esc(name)}.svg">SVG</a>
    ${[1, 2, 3].map((x) => `<a class="ic-btn" href="/icons/${esc(name)}.png?size=24&amp;scale=${x}" download="${esc(name)}-24@${x}x.png">PNG ${x}×</a>`).join('')}
    <a class="ic-btn" href="/icons/${esc(name)}.xml" download="ic_${esc(name.replace(/-/g, '_'))}.xml">Android XML</a>
    <a class="ic-btn" href="/icons/${esc(name)}/favicon.zip${esc(q)}" data-gp-fav download="${esc(name)}-favicon.zip">Favicon set</a>
  </div>
</section>`;

    const near = related(name);
    const rel = `<section class="ic-sec" aria-labelledby="gp-rel">
  <div class="ic-sec-head"><h2 id="gp-rel">Near it</h2><p>Glyphs that share a word with ${esc(name)}, then its neighbours. <a href="/icons">All ${glyphs.NAMES.length}</a>.</p></div>
  <div class="ic-grid" style="--ic-size:24px">${near.map((g) => `<a class="ic-tile" href="/icons/${esc(g)}">${glyph(g)}<span>${esc(g)}</span></a>`).join('')}</div>
</section>`;

    const jsonLd = [
        {
            '@context': 'https://schema.org', '@type': 'ImageObject', name: `${T} icon`, caption: `${T} icon from the OpenVibe glyphs`,
            contentUrl: `${base}${svgUrl}`, thumbnailUrl: `${base}/icons/${name}.png?size=256`, encodingFormat: 'image/svg+xml',
            license: 'https://opensource.org/license/mit', acquireLicensePage: `${base}/icons/${name}`,
            creditText: 'OpenVibe', copyrightNotice: 'OpenVibe, MIT licence', creator: { '@type': 'Organization', name: 'OpenVibe', url: 'https://openvibe.network' },
            keywords: [name, ...fa.map((f) => `fa-${f}`), 'icon', 'svg', 'png', 'font'].join(', '),
        },
        { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Icons', item: `${base}/icons` },
            { '@type': 'ListItem', position: 2, name: T, item: `${base}/icons/${name}` },
        ] },
    ];
    const head = `${T} icon: free SVG, PNG and font`;
    return layout({
        title: head.length <= 40 ? head : `${T} icon: SVG, PNG, font`,
        description: `A free ${T.toLowerCase()} icon: download the SVG, make a PNG at any size and colour, or use the font.${fa.length ? ` A drop-in for Font Awesome's fa-${fa[0]}.` : ''} MIT.`.slice(0, 160),
        path: `/icons/${name}`, active: '/icons', styles: ['css/icons.css'], scripts: ['js/icon.js'], jsonLd,
        image: `${base}/icons/${name}.png?size=512&color=mark&pad=18&ground=squircle&bg=0b1020`, imageAlt: `The ${T.toLowerCase()} icon`,
        body: `<article class="ic gp">${hero}${maker}${use}${rel}</article>`,
    });
}

function faAlternativePage({ base = 'https://openvibe.design' } = {}) {
    const covered = usage.names.filter((n) => glyphs.fromFa(n.name)).reduce((a, n) => a + n.uses, 0);
    const total = usage.names.reduce((a, n) => a + n.uses, 0);
    const share = Math.round((100 * covered) / Math.max(1, total));
    const rows = [
        ['Your markup, unchanged', '<code>&lt;i class="fa-solid fa-eye"&gt;</code> shows the glyph', 'yes'],
        ['Sizes', '<code>fa-2xs</code> … <code>fa-2xl</code>, <code>fa-1x</code> … <code>fa-10x</code>, <code>fa-fw</code>', 'yes'],
        ['Lists, borders, pulls', '<code>fa-ul</code>, <code>fa-li</code>, <code>fa-border</code>, <code>fa-pull-left</code>, <code>fa-pull-right</code>', 'yes'],
        ['Turns and flips', '<code>fa-rotate-90/180/270</code>, <code>fa-rotate-by</code>, <code>fa-flip-*</code>', 'yes'],
        ['Stacks and layers', '<code>fa-stack</code>, <code>fa-inverse</code>, <code>fa-layers</code> with counters and text', 'yes'],
        ['Animations', '<code>fa-beat</code>, <code>fa-bounce</code>, <code>fa-fade</code>, <code>fa-beat-fade</code>, <code>fa-flip</code>, <code>fa-shake</code>, with Font Awesome&rsquo;s variables', 'yes'],
        ['Spinners', '<code>fa-spin</code> breathes instead of spinning, and a spinner icon is three dots that take turns', 'ours'],
        ['Weights', '<code>fa-thin</code> and <code>fa-light</code> draw thinner lines from the same drawing', 'yes'],
        ['Power Transforms', '<code>data-fa-transform</code>: grow, shrink, up, down, left, right, rotate, flip', 'yes'],
        ['Web font', '<code>ov-glyphs.woff2</code>, with Font Awesome&rsquo;s class names on it (<code>ov-glyphs-fa.css</code>)', 'yes'],
        ['Desktop fonts', 'TTF and OTF, free', 'yes'],
        ['Subset fonts (kits)', '<a href="/icons/kit">Pick your icons, get a font with only those</a>: WOFF2, TTF and the CSS', 'yes'],
        ['Brand logos', 'Not ours to draw: keep Font Awesome Brands for those', 'no'],
        ['Price', 'Free, MIT, for everything above', 'yes'],
    ];
    const mark = { yes: ['ok', 'Yes'], ours: ['ours', 'Our way'], soon: ['soon', 'Soon'], no: ['no', 'Keep theirs'] };
    const faqs = [
        ['Is it free?', 'Yes. The glyphs, the fonts, the drop-in and the PNG maker are free for any use under the MIT licence.'],
        ['Do I change my HTML?', 'No. Add one script tag and your Font Awesome markup shows the OpenVibe glyphs, with its classes and animations working. Or use the font with Font Awesome\'s class names on it.'],
        ['What about icons you have not drawn?', `They stay Font Awesome's until they are drawn, so nothing goes blank. ${share}% of what OpenVibe's own pages ask Font Awesome for is covered today, and anyone signed in can ask OpenVibe.AI to draw a missing one.`],
        ['Brand logos?', 'Logos belong to their brands: keep Font Awesome Brands (or Simple Icons) for those.'],
        ['Does it work without JavaScript?', 'The font does: link ov-glyphs-fa.css and the font replaces Font Awesome\'s. The drop-in needs JavaScript and loads after the page has drawn.'],
        ['Desktop apps and design tools?', 'Download the TTF or OTF and type the character, or use the SVGs.'],
    ];
    const body = `<article class="ic fa-alt">
<header class="ic-hero">
  <p class="ic-eye">A Font Awesome alternative</p>
  <h1 class="ic-h1">Keep your markup. Change your icons.</h1>
  <p class="ic-lede">One script tag, and every <code>fa-</code> icon on your page becomes an OpenVibe glyph: one hand, the mark&rsquo;s, in your text&rsquo;s colour and size. Font Awesome&rsquo;s classes, animations and transforms keep working. Free, MIT, with the fonts too.</p>
  <div class="ic-acts">${kit.button({ href: '#switch', label: 'Switch in a minute', icon: 'code' })}${kit.button({ href: '/icons', label: `See all ${glyphs.NAMES.length}`, kind: 'quiet', icon: 'grid' })}</div>
</header>
<section class="ic-sec" id="switch" aria-labelledby="fa-switch">
  <div class="ic-sec-head"><h2 id="fa-switch">Switch in a minute</h2><p>${Object.keys(glyphs.FA).length} Font Awesome names map to ${glyphs.NAMES.length} glyphs today. A name we have not drawn stays Font Awesome&rsquo;s, so nothing goes blank.</p></div>
  <ol class="fa-steps">
    <li><b>Add the drop-in.</b>${kit.snippet({ code: `<script src="${base}/shared/ov-glyphs.js" defer></script>`, id: 'fa-step1', label: 'Copy' })}</li>
    <li><b>Check what your pages use</b> against <a href="/icons#ic-left">what is still Font Awesome</a>. Missing one? <a href="/icons#draw">Draw it</a>.</li>
    <li><b>Drop Font Awesome&rsquo;s stylesheet</b> once every name is covered: one less stylesheet and font on every first visit. Or use the font with Font Awesome&rsquo;s names on it:${kit.snippet({ code: `<link rel="stylesheet" href="${base}/shared/ov-glyphs-fa.css">`, id: 'fa-step3', label: 'Copy' })}</li>
  </ol>
</section>
<section class="ic-sec" aria-labelledby="fa-parity">
  <div class="ic-sec-head"><h2 id="fa-parity">What keeps working</h2><p>Font Awesome&rsquo;s documented features, with its class names and CSS variables.</p></div>
  <div class="fa-table" role="table" aria-label="Font Awesome features">${rows.map(([what, how, m]) => `<div role="row"><span role="cell" class="fa-what">${what}</span><span role="cell" class="fa-how">${how}</span><span role="cell" class="fa-mark is-${mark[m][0]}">${mark[m][1]}</span></div>`).join('')}</div>
</section>
<section class="ic-sec" aria-labelledby="fa-faq">
  <div class="ic-sec-head"><h2 id="fa-faq">Questions</h2><p>Short answers.</p></div>
  <div class="fa-faq">${faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
</section>
</article>`;
    return layout({
        title: 'A free Font Awesome alternative: same markup',
        description: `Keep your Font Awesome markup and show the OpenVibe glyphs: one script, the same classes, animations and transforms, plus free web and desktop fonts. MIT.`,
        path: '/icons/font-awesome-alternative', active: '/icons', styles: ['css/icons.css'], scripts: [],
        jsonLd: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }],
        body,
    });
}

/** /icons/kit: pick glyphs, name the kit, get a font with only those (server/glyphs/kits.js). A plain form. */
function kitPage({ picked = [], name = '', fa = true, error = '' } = {}) {
    const on = new Set(picked);
    const tiles = glyphs.NAMES.map((n) => `<label class="kit-tile" data-name="${esc(n)}" data-fa="${esc(faOf(n).join(' '))}"><input type="checkbox" name="names" value="${esc(n)}"${on.has(n) ? ' checked' : ''}>${glyph(n)}<span>${esc(n)}</span></label>`).join('');
    const body = `<article class="ic kit">
<nav class="gp-crumbs" aria-label="Breadcrumb"><a href="/icons">Icons</a><span aria-hidden="true">/</span><span>Make a kit</span></nav>
<header class="ic-hero"><p class="ic-eye">Icon kits</p><h1 class="ic-h1">Only the icons you use.</h1>
<p class="ic-lede">Pick them, name the kit, and get a font with just those: three icons weigh under a kilobyte. WOFF2 for the web, TTF for apps, the CSS (with Font Awesome&rsquo;s class names if you like) and each icon&rsquo;s character, in one ZIP. Free, MIT, nothing to sign up for.</p></header>
${error ? kit.notice({ kind: 'error', text: error }) : ''}
<form class="kit-form" method="post" action="/icons/kit" data-kit-form>
  <div class="kit-opts">
    <label class="kit-name"><span>Kit name</span><input name="name" value="${esc(name || 'my-kit')}" maxlength="40" pattern="[A-Za-z0-9 _-]{1,40}" autocomplete="off" spellcheck="false"></label>
    <label class="kit-fa"><input type="checkbox" name="fa" value="1"${fa ? ' checked' : ''}><span>Font Awesome&rsquo;s class names too</span></label>
  </div>
  <div class="ic-tools" data-kit-tools hidden><label class="ic-find">${kit.icon('search')}<span class="ovk-sr">Find a glyph</span><input type="search" placeholder="Find: a name, or a Font Awesome name" autocomplete="off" data-kit-find></label><button type="button" class="ic-btn" data-kit-clear>Clear</button></div>
  <div class="kit-grid">${tiles}</div>
  <div class="kit-bar"><span class="kit-sum" data-kit-sum>${on.size ? `${on.size} picked` : 'Tick the icons you use'}</span><button type="submit" class="ic-btn is-go" data-kit-go>${kit.icon('download')} Download the kit</button></div>
</form>
<section class="ic-sec" aria-labelledby="kit-api"><div class="ic-sec-head"><h2 id="kit-api">As a link</h2><p>The same kit from a URL, for a build step or an agent: the names, the kit&rsquo;s name and whether to include Font Awesome&rsquo;s classes.</p></div>
${kit.snippet({ code: 'https://openvibe.design/icons/kit.zip?names=eye,live,heart&name=my-kit&fa=1', id: 'kit-url', label: 'Copy' })}</section>
</article>`;
    return layout({
        title: 'Make an icon kit: a font with only your icons',
        description: 'Pick the OpenVibe glyphs your site uses and get a font with only those: WOFF2, TTF, CSS with Font Awesome class names, free and MIT.',
        path: '/icons/kit', active: '/icons', styles: ['css/icons.css'], scripts: ['js/kit.js'], body,
    });
}

module.exports = { glyphPage, faAlternativePage, kitPage, related, faOf, title };
