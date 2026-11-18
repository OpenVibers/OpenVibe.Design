'use strict';

/**
 * A page's markup held to OpenVibe's design checklist and rules: the Design bot's first eyes (plan §AD.25; the owner,
 * 2026-11-17: "have muse and codex or API analyze and review the gui and critique it interconnected with
 * openvibe.design"). The MCP tool openvibe_design_audit_page reads a public page through the guarded path
 * (server/create/egress.js) and answers this.
 *
 * It reads the markup only: what the HTML says before a browser draws it. Overflow, real sizes, contrast and motion
 * need the page drawn at 390 and 1280 px (Link's shot on a person's computer or the shared node), and the answer says
 * so. Each finding names the rule it breaks (an id on openvibe.design/rules) or `checklist` when it is the review
 * checklist's, a severity, what was found, how many, a few examples and the fix in one line.
 *
 *   auditHtml(html, { url }) → { url, title, findings: [{ id, rule, severity, says, fix, count, examples }], checked,
 *                               counts: { high, medium, low }, note }
 */

const RULES = 'https://openvibe.design/rules';
const MAX_EXAMPLES = 3;

const strip = (html) => String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
const textOf = (fragment) => String(fragment || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const attr = (tag, name) => { const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag); return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null; };
const clip = (s, n = 120) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
/** A control kept under one of OpenVibe's own for accessibility, or not shown at all. A checkbox or radio named as a
 *  toggle (fold, tab, scene, menu …) is taken for a CSS-only switch hidden by the stylesheet, which markup cannot see. */
const cssToggle = (tag) => /^(checkbox|radio)$/i.test(String(attr(tag, 'type') || '')) && /(toggle|fold|tab|scene|switch|state|hack|menu|drawer|open|parts)/i.test(`${attr(tag, 'class') || ''} ${attr(tag, 'id') || ''} ${attr(tag, 'name') || ''}`);
const tucked = (tag) => cssToggle(tag) || /\sdata-ov-native\b|\shidden\b|aria-hidden\s*=\s*["']?true|class\s*=\s*["'][^"']*\b(sr-only|visually-hidden|ov-native)\b|style\s*=\s*["'][^"']*(display\s*:\s*none|opacity\s*:\s*0\b|visibility\s*:\s*hidden)/i.test(tag);

function auditHtml(html, { url = null } = {}) {
    const raw = String(html || '');
    const page = strip(raw);
    const findings = [];
    const checked = [];
    const add = (f) => { if (f.count > 0) findings.push({ ...f, examples: (f.examples || []).slice(0, MAX_EXAMPLES).map((x) => clip(x)) }); };
    // A tag written inside an attribute (a template in data-*, quotes escaped as &quot;) is no element.
    const tags = (re) => [...page.matchAll(re)].map((m) => m[0]).filter((t) => !/&quot;|&#34;/.test(t));
    // OpenVibe's shared runtime on the page (11-17: the room check bounced Live's own home for what it draws). Shared's
    // navbar.js brings ov-forms.js, which takes every <select> (the native one kept under it, data-ov-native), and
    // ov-glyphs.js, which draws Font Awesome markup as OpenVibe glyphs and brand logos. Markup alone cannot see either.
    const loads = (name) => new RegExp(`<script\\b[^>]*\\bsrc\\s*=\\s*["'][^"']*/${name}(\\.[a-f0-9]{6,})?\\.js\\b`, 'i').test(raw);
    const sharedForms = loads('navbar') || loads('ov-forms');
    const sharedGlyphs = loads('navbar') || loads('ov-glyphs');

    // A phone: the page says its width is the device's.
    checked.push('viewport');
    const vp = /<meta\b[^>]*name\s*=\s*["']?viewport["']?[^>]*>/i.exec(raw);
    if (!vp || !/width\s*=\s*device-width/i.test(vp[0])) {
        add({ id: 'viewport', rule: 'works-at-320', severity: 'high', count: 1, says: 'No viewport meta with width=device-width: a phone draws the page at desktop width and shrinks it.',
            fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.', examples: vp ? [vp[0]] : [] });
    }

    // OpenVibe's own controls: no native select, checkbox, radio, range or file button showing.
    checked.push('native-controls');
    const natives = [...(sharedForms ? [] : tags(/<select\b[^>]*>/gi)), ...tags(/<input\b[^>]*>/gi).filter((t) => /type\s*=\s*["']?(checkbox|radio|range|file|color|date)\b/i.test(t))].filter((t) => !tucked(t));
    add({ id: 'native-controls', rule: 'every-control-is-ours', severity: 'high', count: natives.length,
        says: `${natives.length} native control${natives.length === 1 ? '' : 's'} (select, checkbox, radio, range, file, colour or date) showing.`,
        fix: 'Use the shared picker, switch or chips, and keep the native element underneath with data-ov-native.', examples: natives });

    // Lists load themselves: no "Load more" button.
    checked.push('load-more');
    const more = [...page.matchAll(/<(button|a)\b[^>]*>([\s\S]{0,300}?)<\/\1>/gi)].filter((m) => /^(load|show|see)\s+more\b/i.test(textOf(m[2]))).map((m) => m[0]);
    add({ id: 'load-more', rule: 'checklist', severity: 'medium', count: more.length, says: `${more.length} "Load more" button${more.length === 1 ? '' : 's'}: a list should load its next page as the end comes near.`,
        fix: 'Load the next page with an IntersectionObserver near the end; no button.', examples: more });

    // Pictures say what they are; buttons say what they do.
    checked.push('img-alt');
    const noAlt = tags(/<img\b[^>]*>/gi).filter((t) => attr(t, 'alt') === null);
    add({ id: 'img-alt', rule: 'checklist', severity: 'medium', count: noAlt.length, says: `${noAlt.length} picture${noAlt.length === 1 ? '' : 's'} without alt.`,
        fix: 'Give each picture alt words, or alt="" when it only decorates.', examples: noAlt });
    checked.push('unnamed-buttons');
    const unnamed = [...page.matchAll(/<button\b([^>]*)>([\s\S]{0,600}?)<\/button>/gi)]
        .filter((m) => !/aria-label(ledby)?\s*=|\stitle\s*=|aria-hidden\s*=\s*["']?true/i.test(m[1]) && !textOf(m[2]) && !/<img\b[^>]*\balt\s*=\s*["'][^"']+/i.test(m[2])).map((m) => m[0]);
    add({ id: 'unnamed-buttons', rule: 'checklist', severity: 'medium', count: unnamed.length, says: `${unnamed.length} button${unnamed.length === 1 ? '' : 's'} with no name a screen reader can say.`,
        fix: 'Give an icon-only button aria-label (and title for the tooltip).', examples: unnamed });

    // OpenVibe's glyphs, drawn without a font; the mark for waiting; arrows drawn, not typed.
    checked.push('icon-fonts');
    // A Font Awesome name that OpenVibe's glyph shim draws (data-ovg, data-ov-icon) is ours.
    const iconFonts = tags(/<(i|span|link|script)\b[^>]*>/gi).filter((t) => !/\sdata-ov(g|-icon)\b/i.test(t)).filter((t) => /font-?awesome|\bfa-(solid|regular|brands|[a-z]+-[a-z])|\bfa\s+fa-|lucide|material-(icons|symbols)|bootstrap-icons|\bbi-[a-z]/i.test(t));
    // With ov-glyphs.js on the page a Font Awesome name is drawn as OpenVibe's glyph or brand logo: no font, only markup
    // still to write the network's way, which a release of the shim will stop reading.
    const faOnly = sharedGlyphs ? iconFonts.filter((t) => !/\bfa-(solid|regular|brands)\b|\bfab?\s+fa-/i.test(t)) : iconFonts;
    add({ id: 'icon-fonts', rule: 'icons-draw-without-a-font', severity: 'medium', count: faOnly.length, says: `${faOnly.length} icon${faOnly.length === 1 ? '' : 's'} from another icon set or an icon font.`,
        fix: 'Use OpenVibe\'s glyphs (<i data-ov-icon="…">; openvibe.design/icons finds one by any set\'s name).', examples: faOnly });
    const shimmed = iconFonts.filter((t) => !faOnly.includes(t));
    add({ id: 'icon-markup', rule: 'icons-draw-without-a-font', severity: 'low', count: shimmed.length, says: `${shimmed.length} icon${shimmed.length === 1 ? '' : 's'} written as Font Awesome markup: ov-glyphs.js draws ${shimmed.length === 1 ? 'it' : 'them'} as OpenVibe's own for now.`,
        fix: 'Write <i data-ov-icon="…"> or <i data-ov-brand="…"> (openvibe-shared scripts/fa-to-ov.js rewrites a repository).', examples: shimmed });
    checked.push('spinners');
    // A box named for a spinner that holds the mark itself (<div class="loading-spinner"><span class="ov-mark" …>) waits
    // the network's way.
    const spinners = [...page.matchAll(/<[a-z][a-z0-9-]*\b[^>]*class\s*=\s*["'][^"']*\b(spinner|loader|loading-spinner|fa-spin|animate-spin|lds-[a-z]+)\b[^"']*["'][^>]*>/gi)]
        .filter((m) => !/&quot;|&#34;/.test(m[0]) && !/^\s*<[a-z][a-z0-9-]*\b[^>]*class\s*=\s*["'][^"']*\bov-mark\b/i.test(page.slice(m.index + m[0].length, m.index + m[0].length + 300)))
        .map((m) => m[0]);
    add({ id: 'spinners', rule: 'no-spinners', severity: 'medium', count: spinners.length, says: `${spinners.length} spinner${spinners.length === 1 ? '' : 's'}: the only thing that goes round is the mark's own O.`,
        fix: 'Wait with the mark: <span class="ov-mark" data-state="busy"> (ov-mark.js).', examples: spinners });
    checked.push('text-arrows');
    const arrows = [...page.matchAll(/<(button|a)\b[^>]*>([\s\S]{0,300}?)<\/\1>/gi)].filter((m) => /[→←↑↓↗↘»«]|->|<-/.test(textOf(m[2]))).map((m) => m[0]);
    add({ id: 'text-arrows', rule: 'glyphs-not-arrows', severity: 'low', count: arrows.length, says: `${arrows.length} arrow character${arrows.length === 1 ? '' : 's'} typed into buttons or links.`,
        fix: 'Draw the arrow with a glyph from the registry (data-ov-icon="arrow-right").', examples: arrows });

    // Words: real content, readable sizes, the page's language and title.
    checked.push('fake-content');
    const body = textOf(page.replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/i, ' '));
    // Filler as it is pasted ("Lorem ipsum dolor sit amet"), not a page that names it (11-18: openvibe.tools' Lorem Ipsum
    // Generator was flagged for describing itself).
    const fake = body.match(/lorem ipsum dolor[^.]{0,60}|\bcoming soon\b[^.]{0,40}/gi) || [];
    add({ id: 'fake-content', rule: 'no-fake-content', severity: 'high', count: fake.length, says: `${fake.length} piece${fake.length === 1 ? '' : 's'} of filler or "coming soon" content.`,
        fix: 'Show only what is real; an empty place says it is empty and offers one way forward.', examples: fake });
    checked.push('tiny-text');
    const tiny = tags(/<[a-z][a-z0-9-]*\b[^>]*style\s*=\s*["'][^"']*font-size\s*:\s*(\d+(?:\.\d+)?)px[^"']*["'][^>]*>/gi).filter((t) => Number(/font-size\s*:\s*(\d+(?:\.\d+)?)px/i.exec(t)[1]) < 12);
    add({ id: 'tiny-text', rule: 'checklist', severity: 'medium', count: tiny.length, says: `${tiny.length} element${tiny.length === 1 ? '' : 's'} set below 12 px.`,
        fix: 'Text is at least 12 px; body text 14 to 16 px.', examples: tiny });
    checked.push('literal-colours');
    const colours = tags(/<[a-z][a-z0-9-]*\b[^>]*style\s*=\s*["'][^"']*(?:color|background)\s*:\s*(#[0-9a-f]{3,8}|rgba?\()[^"']*["'][^>]*>/gi);
    add({ id: 'literal-colours', rule: 'own-tokens', severity: 'low', count: colours.length, says: `${colours.length} inline style${colours.length === 1 ? '' : 's'} with a literal colour: it will not follow the person's theme.`,
        fix: 'Use the theme\'s tokens (var(--accent), var(--text-primary)…), defined for light and dark.', examples: colours });
    checked.push('lang-title');
    const lang = /<html\b[^>]*\slang\s*=\s*["']?[a-z]/i.test(raw);
    const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(raw);
    const title = titleMatch ? textOf(titleMatch[1]).slice(0, 200) : '';
    add({ id: 'lang-title', rule: 'checklist', severity: 'low', count: (lang ? 0 : 1) + (title ? 0 : 1),
        says: [lang ? '' : 'The page does not say its language (<html lang>).', title ? '' : 'The page has no title.'].filter(Boolean).join(' '),
        fix: 'Set <html lang="en"> (or the page\'s language) and a <title> that names the page.', examples: [] });

    const order = { high: 0, medium: 1, low: 2 };
    findings.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);
    const counts = { high: 0, medium: 0, low: 0 };
    for (const f of findings) counts[f.severity] += 1;
    return {
        url, title,
        findings: findings.map((f) => ({ ...f, ...(f.rule !== 'checklist' ? { rule_url: `${RULES}#${f.rule}` } : {}) })),
        checked, counts,
        note: 'Markup only: what the HTML says before a browser draws it. Sideways overflow, real sizes, contrast, motion and how it looks need the page drawn at 390 and 1280 px, light and dark.',
    };
}

module.exports = { auditHtml };
