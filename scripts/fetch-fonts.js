#!/usr/bin/env node
'use strict';

/**
 * Vendors the open fonts the logo maker and the mark page offer, from the Fontsource npm packages, into
 * public/fonts/<slug>/ so openvibe.design serves them itself (no fonts.googleapis.com, no CDN).
 *
 *   node scripts/fetch-fonts.js
 *
 * For each family: the latin 400 and 700 faces (and 900 where the family has it; a one-weight family keeps its
 * weight), its licence text beside them, and one public/fonts/fonts.json with the family, slug, weights, licence
 * and the exact package and version it came from. The packages are devDependencies pinned to exact versions, so
 * the same run makes the same bytes. The woff2 files are committed: they are small.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'fonts');
const WANTED = [400, 700, 900];

// Every family in OpenVibe.Tools' logo maker (its presets and POPULAR_FONTS) and every family on the mark
// page's FONT_CSS, plus Outfit and JetBrains Mono. The system faces a preset names (Arial Black, Courier New,
// Georgia, Impact) are not on Fontsource and stay system faces; see the report.
const FAMILIES = [
    'Inter', 'Montserrat', 'Playfair Display', 'Oswald', 'Roboto', 'Lato',
    'Raleway', 'Poppins', 'Merriweather', 'Source Sans 3', 'Nunito', 'Ubuntu', 'Rubik', 'Work Sans',
    'Fira Sans', 'Quicksand', 'Bangers', 'Permanent Marker', 'Bebas Neue', 'Righteous', 'Orbitron',
    'Press Start 2P', 'Silkscreen', 'Audiowide', 'Pacifico', 'Dancing Script', 'Lobster', 'Satisfy',
    'Caveat', 'Abril Fatface', 'Alfa Slab One', 'Anton', 'Black Ops One', 'Bungee', 'Bungee Shade',
    'Comfortaa', 'Concert One', 'Creepster', 'Fredoka One', 'Graduate', 'Luckiest Guy', 'Special Elite',
    'Staatliches', 'VT323', 'Zilla Slab',
    // The mark page's FONT_CSS (Quicksand, Rubik, Poppins are already above) and Outfit.
    'Fredoka', 'Outfit', 'Sora', 'Lexend', 'Manrope', 'Plus Jakarta Sans', 'Space Grotesk', 'Unbounded',
    // The code face the tools share.
    'JetBrains Mono',
].sort((a, b) => a.localeCompare(b));

const slugOf = (family) => family.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function main() {
    fs.rmSync(OUT, { recursive: true, force: true });
    fs.mkdirSync(OUT, { recursive: true });
    const fonts = [];
    let bytes = 0;
    const skipped = [];

    for (const family of FAMILIES) {
        const slug = slugOf(family);
        const packageDir = path.join(ROOT, 'node_modules', '@fontsource', slug);
        const pkgFile = path.join(packageDir, 'package.json');
        const metaFile = path.join(packageDir, 'metadata.json');
        if (!fs.existsSync(pkgFile) || !fs.existsSync(metaFile)) {
            skipped.push(`${family} (@fontsource/${slug} is not installed)`);
            continue;
        }
        const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
        if (!meta.license || !['OFL-1.1', 'Apache-2.0', 'UFL-1.0'].includes(meta.license.type)) {
            skipped.push(`${family} (licence ${meta.license && meta.license.type})`);
            continue;
        }
        const files = fs.readdirSync(path.join(packageDir, 'files'));
        let weights = WANTED.filter((w) => files.includes(`${slug}-latin-${w}-normal.woff2`));
        if (!weights.length) weights = [meta.weights[0]];
        const dir = path.join(OUT, slug);
        fs.mkdirSync(dir, { recursive: true });
        for (const weight of weights) {
            const name = `${slug}-latin-${weight}-normal.woff2`;
            const from = path.join(packageDir, 'files', name);
            if (!fs.existsSync(from)) throw new Error(`${family}: @fontsource/${slug}@${pkg.version} has no ${name}`);
            fs.copyFileSync(from, path.join(dir, name));
            bytes += fs.statSync(from).size;
        }
        const licenceFile = path.join(packageDir, 'LICENSE');
        if (!fs.existsSync(licenceFile)) throw new Error(`${family}: @fontsource/${slug}@${pkg.version} has no LICENSE`);
        fs.copyFileSync(licenceFile, path.join(dir, 'LICENSE.txt'));
        bytes += fs.statSync(licenceFile).size;
        fonts.push({
            family: meta.family,
            slug,
            weights,
            licence: meta.license.type,
            source: `@fontsource/${slug}@${pkg.version}`,
        });
    }

    fs.writeFileSync(path.join(OUT, 'fonts.json'), `${JSON.stringify(fonts, null, 2)}\n`);
    const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
    console.log(`${fonts.length} families, ${fonts.reduce((n, f) => n + f.weights.length, 0)} woff2 files, ${kb(bytes)} (fonts + licences)`);
    if (skipped.length) {
        console.log('left out:');
        for (const line of skipped) console.log(`  ${line}`);
        process.exitCode = 1;
    }
}

main();
