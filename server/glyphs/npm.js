'use strict';
/**
 * The OpenVibe glyphs as npm packages, served as tarballs (plan L50 step 2). npm, pnpm and yarn install a package
 * straight from an https URL, so there is no registry account to keep and the package is always the set this site
 * draws: npm i https://openvibe.design/icons/npm/openvibe-icons-react.tgz
 *
 *   openvibe-icons         the drawings ({ name: [line, solid] }), svg(name, opts), names (CommonJS and ESM, typed)
 *   openvibe-icons-react   <Icon name="bell" size={16} />, and a component per glyph (<BellIcon />)
 *   openvibe-icons-vue     the same as a Vue 3 component
 *   openvibe-icons-svelte  Icon.svelte
 *
 * Every package draws the solid twin at 18 px and under, as the sites do (variant "auto"); "line" or "solid" forces
 * one. The version is the openvibe-shared release the glyphs come from.
 *
 *   tarball(file) → Buffer (gzip) for 'openvibe-icons.tgz' and the others, or null; built once and kept
 *   PACKAGES      the file names, with a line about each
 */
const zlib = require('zlib');
const glyphs = require('openvibe-shared/glyphs');
const VERSION = require('openvibe-shared/package.json').version;

const BASE = 'https://openvibe.design';
const MTIME = 499162500;   // npm's own fixed date: the same set makes the same bytes
const NAMES = (Array.isArray(glyphs.NAMES) ? glyphs.NAMES : Object.keys(glyphs.NAMES)).slice().sort();
const LICENSE = `MIT License\n\nCopyright (c) OpenVibe (openvibe.design)\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n`;

const PACKAGES = {
    'openvibe-icons.tgz': 'The drawings and an svg() helper, for any JavaScript',
    'openvibe-icons-react.tgz': 'A React component, and one per glyph',
    'openvibe-icons-vue.tgz': 'A Vue 3 component',
    'openvibe-icons-svelte.tgz': 'A Svelte component',
};

const pascal = (n) => n.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
const json = (o) => `${JSON.stringify(o, null, 2)}\n`;

/** The drawings and the one function every package shares: which drawing, and its attributes, for a size. */
function core() {
    const data = {};
    for (const n of NAMES) data[n] = [glyphs.path(n), glyphs.solid(n) || ''];
    return `// The OpenVibe glyphs ${VERSION}, MIT. ${BASE}/icons\n`
        + '// [line, solid]: line is strokes (fill none, stroke currentColor, round); solid is fills, its class="ln" parts stay lines.\n'
        + `export const VERSION = ${JSON.stringify(VERSION)};\n`
        + `export const DATA = ${JSON.stringify(data)};\n`
        + 'export const NAMES = Object.keys(DATA);\n'
        + 'const LN = \'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"\';\n'
        + '/** The drawing for a size: { solid, inner, attrs } (attrs as SVG names), or null for an unknown name. Solid at 18 px and under unless told. */\n'
        + 'export function drawingOf(name, size = 24, variant = "auto", stroke = 2) {\n'
        + '    const g = DATA[name];\n    if (!g) return null;\n'
        + '    const solid = !!g[1] && (variant === "solid" || (variant !== "line" && Number(size) <= 18));\n'
        + '    if (solid) return { solid, inner: g[1].replace(/class="ln"/g, LN), attrs: { fill: "currentColor" } };\n'
        + '    return { solid, inner: g[0], attrs: { fill: "none", stroke: "currentColor", "stroke-width": String(stroke), "stroke-linecap": "round", "stroke-linejoin": "round" } };\n}\n'
        + 'const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", \'"\': "&quot;" })[c]);\n'
        + '/** A standalone SVG: svg("bell", { size: 16, variant: "auto", stroke: 2, title: "" }). */\n'
        + 'export function svg(name, { size = 24, variant = "auto", stroke = 2, title = "" } = {}) {\n'
        + '    const d = drawingOf(name, size, variant, stroke);\n    if (!d) return "";\n'
        + '    const attrs = Object.entries(d.attrs).map(([k, v]) => `${k}="${v}"`).join(" ");\n'
        + '    const a11y = title ? `role="img"><title>${esc(title)}</title>` : \'aria-hidden="true">\';\n'
        + '    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ${attrs} ${a11y}${d.inner}</svg>`;\n}\n';
}

const readme = (pkg, install, usage) => `# ${pkg}\n\nThe OpenVibe glyphs (${NAMES.length} icons, MIT): ${BASE}/icons\n\n\`\`\`sh\nnpm i ${BASE}/icons/npm/${pkg}.tgz\n\`\`\`\n\n${install}\n\n\`\`\`\n${usage}\n\`\`\`\n\nAt 18 px and under each icon draws its solid twin, as the OpenVibe sites do; \`variant="line"\` or \`"solid"\` forces one. The version is the openvibe-shared release the drawings come from.\n`;

function files(file) {
    const pkgName = file.replace(/\.tgz$/, '');
    const meta = { name: pkgName, version: VERSION, description: `The OpenVibe glyphs${pkgName === 'openvibe-icons' ? '' : ` for ${pkgName.split('-').pop()}`}: ${NAMES.length} icons, line and solid`, license: 'MIT', homepage: `${BASE}/icons`, keywords: ['icons', 'svg', 'openvibe'], sideEffects: false };
    const base = [{ name: 'LICENSE', data: LICENSE }, { name: 'glyphs.mjs', data: core() }];
    if (pkgName === 'openvibe-icons') {
        const cjs = core().replace(/^export const /gm, 'const ').replace(/^export function /gm, 'function ')
            + 'module.exports = { VERSION, DATA, NAMES, drawingOf, svg };\n';
        return [...base,
            { name: 'index.mjs', data: 'export * from "./glyphs.mjs";\n' },
            { name: 'index.js', data: cjs },
            { name: 'index.d.ts', data: 'export declare const VERSION: string;\nexport declare const NAMES: string[];\nexport declare const DATA: Record<string, [string, string]>;\nexport type Variant = "auto" | "line" | "solid";\nexport declare function drawingOf(name: string, size?: number, variant?: Variant, stroke?: number): { solid: boolean; inner: string; attrs: Record<string, string> } | null;\nexport declare function svg(name: string, opts?: { size?: number; variant?: Variant; stroke?: number; title?: string }): string;\n' },
            { name: 'README.md', data: readme(pkgName, 'CommonJS or ESM, no dependencies.', 'import { svg } from "openvibe-icons";\n\ndocument.body.insertAdjacentHTML("beforeend", svg("bell", { size: 16 }));') },
            { name: 'package.json', data: json({ ...meta, main: './index.js', module: './index.mjs', types: './index.d.ts', exports: { '.': { types: './index.d.ts', import: './index.mjs', require: './index.js' } } }) },
        ];
    }
    if (pkgName === 'openvibe-icons-react') {
        const each = NAMES.map((n) => `export const ${pascal(n)}Icon = (props) => createElement(Icon, { ...props, name: ${JSON.stringify(n)} });`).join('\n');
        return [...base,
            { name: 'index.mjs', data: 'import { createElement } from "react";\nimport { drawingOf } from "./glyphs.mjs";\nexport { NAMES, VERSION } from "./glyphs.mjs";\n'
                + 'const camel = (k) => k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());\n'
                + '/** <Icon name="bell" size={16} variant="auto" title="Notifications" /> */\n'
                + 'export function Icon({ name, size = 24, variant = "auto", stroke = 2, title, ...rest }) {\n'
                + '    const d = drawingOf(name, size, variant, stroke);\n    if (!d) return null;\n'
                + '    const attrs = Object.fromEntries(Object.entries(d.attrs).map(([k, v]) => [camel(k), v]));\n'
                + '    const t = title ? `<title>${String(title).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</title>` : "";\n'
                + '    return createElement("svg", { xmlns: "http://www.w3.org/2000/svg", width: size, height: size, viewBox: "0 0 24 24", ...attrs, ...(title ? { role: "img" } : { "aria-hidden": true }), ...rest, dangerouslySetInnerHTML: { __html: t + d.inner } });\n}\n'
                + `${each}\n` },
            { name: 'index.d.ts', data: 'import type { SVGProps, ReactElement } from "react";\nexport type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & { name: string; size?: number; variant?: "auto" | "line" | "solid"; stroke?: number; title?: string };\nexport declare function Icon(props: IconProps): ReactElement | null;\nexport declare const NAMES: string[];\nexport declare const VERSION: string;\n'
                + NAMES.map((n) => `export declare const ${pascal(n)}Icon: (props: Omit<IconProps, "name">) => ReactElement | null;`).join('\n') + '\n' },
            { name: 'README.md', data: readme(pkgName, 'React 17 or later.', 'import { Icon, BellIcon } from "openvibe-icons-react";\n\n<Icon name="bell" size={16} />\n<BellIcon size={24} title="Notifications" />') },
            { name: 'package.json', data: json({ ...meta, type: 'module', main: './index.mjs', module: './index.mjs', types: './index.d.ts', exports: { '.': { types: './index.d.ts', import: './index.mjs', default: './index.mjs' } }, peerDependencies: { react: '>=17' } }) },
        ];
    }
    if (pkgName === 'openvibe-icons-vue') {
        return [...base,
            { name: 'index.mjs', data: 'import { defineComponent, h } from "vue";\nimport { drawingOf } from "./glyphs.mjs";\nexport { NAMES, VERSION } from "./glyphs.mjs";\n'
                + '/** <Icon name="bell" :size="16" variant="auto" title="Notifications" /> */\n'
                + 'export const Icon = defineComponent({\n    name: "OvIcon",\n    props: { name: { type: String, required: true }, size: { type: [Number, String], default: 24 }, variant: { type: String, default: "auto" }, stroke: { type: [Number, String], default: 2 }, title: { type: String, default: "" } },\n'
                + '    setup(props) {\n        return () => {\n            const d = drawingOf(props.name, Number(props.size), props.variant, props.stroke);\n            if (!d) return null;\n'
                + '            const t = props.title ? `<title>${props.title.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</title>` : "";\n'
                + '            return h("svg", { xmlns: "http://www.w3.org/2000/svg", width: props.size, height: props.size, viewBox: "0 0 24 24", ...d.attrs, ...(props.title ? { role: "img" } : { "aria-hidden": "true" }), innerHTML: t + d.inner });\n        };\n    },\n});\nexport default Icon;\n' },
            { name: 'README.md', data: readme(pkgName, 'Vue 3.', 'import { Icon } from "openvibe-icons-vue";\n\n<Icon name="bell" :size="16" />') },
            { name: 'package.json', data: json({ ...meta, type: 'module', main: './index.mjs', module: './index.mjs', exports: { '.': { import: './index.mjs', default: './index.mjs' } }, peerDependencies: { vue: '>=3' } }) },
        ];
    }
    if (pkgName === 'openvibe-icons-svelte') {
        return [...base,
            { name: 'Icon.svelte', data: '<script>\n  import { drawingOf } from "./glyphs.mjs";\n  export let name;\n  export let size = 24;\n  export let variant = "auto";\n  export let stroke = 2;\n  export let title = "";\n  $: d = drawingOf(name, Number(size), variant, stroke);\n</script>\n\n'
                + '{#if d}<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" {...d.attrs} role={title ? "img" : undefined} aria-hidden={title ? undefined : "true"} {...$$restProps}>{#if title}<title>{title}</title>{/if}{@html d.inner}</svg>{/if}\n' },
            { name: 'index.js', data: 'export { default as Icon } from "./Icon.svelte";\nexport { NAMES, VERSION } from "./glyphs.mjs";\n' },
            { name: 'README.md', data: readme(pkgName, 'Svelte 3, 4 or 5.', '<script>\n  import { Icon } from "openvibe-icons-svelte";\n</script>\n\n<Icon name="bell" size={16} />') },
            { name: 'package.json', data: json({ ...meta, type: 'module', svelte: './index.js', main: './index.js', exports: { '.': { svelte: './index.js', default: './index.js' } }, peerDependencies: { svelte: '>=3' } }) },
        ];
    }
    return null;
}

/** A gzipped tar of the files under package/, the shape npm installs. */
function tgz(list) {
    const parts = [];
    for (const f of list) {
        const data = Buffer.from(f.data);
        const h = Buffer.alloc(512, 0);
        h.write(`package/${f.name}`, 0, 100, 'utf8');
        h.write('0000644\0', 100);
        h.write('0000000\0', 108);
        h.write('0000000\0', 116);
        h.write(`${data.length.toString(8).padStart(11, '0')}\0`, 124);
        h.write(`${MTIME.toString(8).padStart(11, '0')}\0`, 136);
        h.write('        ', 148);
        h.write('0', 156);
        h.write('ustar\0', 257);
        h.write('00', 263);
        let sum = 0;
        for (const b of h) sum += b;
        h.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
        parts.push(h, data, Buffer.alloc((512 - (data.length % 512)) % 512));
    }
    parts.push(Buffer.alloc(1024));
    return zlib.gzipSync(Buffer.concat(parts), { level: 9 });
}

const built = new Map();
function tarball(file) {
    if (!Object.prototype.hasOwnProperty.call(PACKAGES, file)) return null;
    if (!built.has(file)) built.set(file, tgz(files(file)));
    return built.get(file);
}

module.exports = { tarball, files, PACKAGES, VERSION };
