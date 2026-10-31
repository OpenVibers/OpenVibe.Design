#!/usr/bin/env node
'use strict';
/**
 * scripts/render-mark-motion.js — the OpenVibe mark's intro as the files people download from /brand.
 *
 * The animation is not drawn here: it is the real openvibe-shared/ov-mark.js (the copy this site pins and serves
 * at /shared/ov-mark.js), played in headless Chrome. We open the mark, ask ov-mark.js for its intro
 * (OVMark.intro), and then drive that intro's own CSS animations frame by frame, so every frame is the mark as it
 * really looks. ffmpeg turns the frames into the files below.
 *
 *   ov-mark-intro.webm        VP9, 512 × 512, on the brand ground (ffmpeg on this host cannot put an alpha channel
 *                              into a WebM, so the transparent ground is in the GIF and the APNG)
 *   ov-mark-intro.mp4         H.264, 1080 × 1080, on the brand dark ground #0a0f1c
 *   ov-mark-intro.gif         256 × 256, transparent
 *   ov-mark-intro.png         APNG, 256 × 256
 *   ov-mark-live-intro.*      the same four for the Live variant (data-variant="live": its record light in the O)
 *   ov-mark-poster.png        the rested mark with its glow, 1024 × 1024
 *   ov-mark-live-poster.png   the same, for the Live variant
 *
 * Run it by hand — the outputs are committed and CI never runs it:
 *
 *   node scripts/render-mark-motion.js                 # everything
 *   node scripts/render-mark-motion.js --frames 12     # a quick look (a short clip)
 *   node scripts/render-mark-motion.js --only intro    # one variant
 *
 * It needs the host's ffmpeg, Google Chrome (/usr/bin/google-chrome) and Playwright. The outputs land in
 * public/brand/motion/, which /brand serves.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'brand', 'motion');
const MARK_JS = path.join(ROOT, 'node_modules', 'openvibe-shared', 'ov-mark.js');
const PLAYWRIGHT = process.env.OV_PLAYWRIGHT || '/home/workstation/openvibe/work/OpenVibe.Games/node_modules/playwright';
const CHROME = process.env.OV_CHROME || '/usr/bin/google-chrome';
const FFMPEG = process.env.OV_FFMPEG || 'ffmpeg';

const FPS = 60;
const SECONDS = 2.2;
const GROUND = '#0a0f1c';
const WEBM_SIZE = 512;
const SMALL_SIZE = 256;
const MP4_SIZE = 1080;
const POSTER_SIZE = 1024;
const GIF_FPS = 30;

const VARIANTS = [
    { key: 'intro', file: 'ov-mark-intro', variant: '' },
    { key: 'live', file: 'ov-mark-live-intro', variant: 'live' },
];

const args = process.argv.slice(2);
const opt = (name, fallback) => {
    const i = args.indexOf('--' + name);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const FRAMES = Math.max(2, parseInt(opt('frames', String(Math.round(FPS * SECONDS))), 10) || 132);
const ONLY = opt('only', '');

const log = (...a) => console.log(...a);
const run = (cmd, argv) => execFileSync(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'] });

/** The page the mark is played in: nothing but the mark, on a transparent ground. */
const harness = (size, variant) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;background:transparent}
#stage{width:${size}px;height:${size}px;display:grid;place-items:center;background:transparent}
</style></head>
<body><div id="stage"><span class="ov-mark" data-size="${size}" data-glow${variant ? ' data-variant="' + variant + '"' : ''}></span></div>
<script>
/* The mark's own timers are muted: they only restart the intro, and we place the frames ourselves. */
(function () {
  var real = window.setTimeout.bind(window);
  window.setTimeout = function (fn, delay) {
    var args = Array.prototype.slice.call(arguments, 2);
    return (typeof delay === 'number' && delay > 1200) ? 0 : real.apply(null, [fn, delay].concat(args));
  };
})();
</script>
</body></html>`;

/**
 * The page script: ov-mark.js's own intro, started for real, and then a seek that puts the intro's animations at
 * any point of its timeline. The mark's own timers are muted first (they only restart the intro), so the frames
 * are ours to place.
 */
const harnessScript = () => `(() => {
  const el = document.querySelector('.ov-mark');
  window.__el = el;
  window.OVMark.intro(el);
  // Put the intro's own animations at a point of its timeline. The mark's timers are muted in the page, and the
  // intro is asked for again before every frame, so nothing takes the attributes away mid-frame.
  window.__seek = async (t) => {
    window.OVMark.intro(el);
    el.setAttribute('data-ovm-intro', '');
    el.setAttribute('data-ovm-run', '');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    el.setAttribute('data-ovm-intro', '');
    el.setAttribute('data-ovm-run', '');
    const anims = el.getAnimations({ subtree: true });
    for (const a of anims) { try { a.pause(); a.currentTime = t; } catch (e) { /* not seekable */ } }
    return anims.length;
  };
})();`;

async function capture(context, size, variant, frames) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov-mark-motion-'));
    // A page of its own for every pass: ov-mark.js only mounts once per window.
    const page = await context.newPage();
    try {
        await page.setViewportSize({ width: size, height: size });
        await page.setContent(harness(size, variant), { waitUntil: 'load' });
        await page.addScriptTag({ content: fs.readFileSync(MARK_JS, 'utf8') });
        await page.waitForFunction(() => !!window.OVMark && !!window.OVMark.intro);
        await page.evaluate(harnessScript());
        // Let the mark settle (its own intro has run) before the frames start.
        await page.waitForTimeout(400);
        for (let i = 0; i < frames; i++) {
            const t = Math.round((i * 1000) / FPS);
            const anims = await page.evaluate((ms) => window.__seek(ms), t);
            if (i === 0 && !anims) throw new Error('the mark has no animations to play');
            const file = path.join(dir, String(i + 1).padStart(5, '0') + '.png');
            await page.screenshot({ path: file, omitBackground: true });
        }
        return { dir };
    } catch (err) {
        fs.rmSync(dir, { recursive: true, force: true });
        throw err;
    } finally {
        await page.close();
    }
}

/** The rested mark, with its glow, on a transparent ground. */
async function poster(context, size, variant) {
    const page = await context.newPage();
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(harness(size, variant), { waitUntil: 'load' });
    await page.addScriptTag({ content: fs.readFileSync(MARK_JS, 'utf8') });
    await page.waitForFunction(() => !!window.OVMark);
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const el = document.querySelector('.ov-mark');
      el.removeAttribute('data-ovm-intro');
      el.removeAttribute('data-ovm-run');
    });
    await page.waitForTimeout(120);
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ov-mark-poster-')), 'poster.png');
    await page.screenshot({ path: file, omitBackground: true });
    await page.close();
    return file;
}

const ffmpeg = (argv) => {
    try {
        run(FFMPEG, argv);
    } catch (err) {
        const detail = (err.stderr && err.stderr.toString()) || err.message;
        throw new Error('ffmpeg failed: ' + detail.slice(-1200));
    }
};

/** VP9 on the brand's own dark ground: the WebM every browser plays. */
const webm = (frames, out) => ffmpeg([
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', `color=c=${GROUND.replace('#', '0x')}:s=${WEBM_SIZE}x${WEBM_SIZE}:r=${FPS}:d=${(FRAMES / FPS).toFixed(3)}`,
    '-framerate', String(FPS), '-i', path.join(frames, '%05d.png'),
    '-filter_complex', `[0:v][1:v]overlay=format=auto:shortest=1,scale=${WEBM_SIZE}:${WEBM_SIZE}:flags=lanczos,format=yuv420p[out]`,
    '-map', '[out]', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-deadline', 'good', '-cpu-used', '3',
    '-row-mt', '1', '-auto-alt-ref', '0',
    out,
]);

/** H.264 on the brand's own dark ground, for anywhere that will not play WebM. */
const mp4 = (frames, out) => ffmpeg([
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', `color=c=${GROUND.replace('#', '0x')}:s=${MP4_SIZE}x${MP4_SIZE}:r=${FPS}:d=${(FRAMES / FPS).toFixed(3)}`,
    '-framerate', String(FPS), '-i', path.join(frames, '%05d.png'),
    '-filter_complex', `[0:v][1:v]overlay=format=auto:shortest=1,scale=${MP4_SIZE}:${MP4_SIZE}:flags=lanczos,format=yuv420p[out]`,
    '-map', '[out]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    out,
]);

/** A GIF: its own palette, its own transparency, small enough to post anywhere. */
const gif = (frames, out) => ffmpeg([
    '-y', '-hide_banner', '-loglevel', 'error',
    '-framerate', String(FPS), '-i', path.join(frames, '%05d.png'),
    '-vf', `fps=${GIF_FPS},scale=${SMALL_SIZE}:${SMALL_SIZE}:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle`,
    '-loop', '0',
    out,
]);

/** An APNG: the same clip, for everywhere a GIF is too few colours. */
const apng = (frames, out) => ffmpeg([
    '-y', '-hide_banner', '-loglevel', 'error',
    '-framerate', String(FPS), '-i', path.join(frames, '%05d.png'),
    '-vf', `fps=${GIF_FPS},scale=${SMALL_SIZE}:${SMALL_SIZE}:flags=lanczos`,
    '-plays', '0', '-f', 'apng',
    out,
]);

const kb = (bytes) => (bytes / 1024).toFixed(1) + ' KB';

(async () => {
    if (!fs.existsSync(MARK_JS)) throw new Error('openvibe-shared/ov-mark.js is not installed: ' + MARK_JS);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const { chromium } = require(PLAYWRIGHT);
    const browser = await chromium.launch({ executablePath: CHROME });
    const context = await browser.newContext({ viewport: { width: WEBM_SIZE, height: WEBM_SIZE }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    const written = [];
    try {
        for (const v of VARIANTS) {
            if (ONLY && ONLY !== v.key) continue;
            log('· the ' + v.key + ' mark');
            const small = await capture(context, WEBM_SIZE, v.variant, FRAMES);
            const large = await capture(context, POSTER_SIZE, v.variant, FRAMES);
            const files = [
                [path.join(OUT_DIR, v.file + '.webm'), () => webm(small.dir, path.join(OUT_DIR, v.file + '.webm'))],
                [path.join(OUT_DIR, v.file + '.mp4'), () => mp4(large.dir, path.join(OUT_DIR, v.file + '.mp4'))],
                [path.join(OUT_DIR, v.file + '.gif'), () => gif(small.dir, path.join(OUT_DIR, v.file + '.gif'))],
                [path.join(OUT_DIR, v.file + '.png'), () => apng(small.dir, path.join(OUT_DIR, v.file + '.png'))],
            ];
            for (const [out, make] of files) { make(); written.push(out); }
            const posterFile = path.join(OUT_DIR, v.key === 'live' ? 'ov-mark-live-poster.png' : 'ov-mark-poster.png');
            fs.copyFileSync(await poster(context, POSTER_SIZE, v.variant), posterFile);
            written.push(posterFile);
            fs.rmSync(small.dir, { recursive: true, force: true });
            fs.rmSync(large.dir, { recursive: true, force: true });
        }
    } finally {
        await browser.close();
    }
    for (const f of written) log('  ' + path.relative(ROOT, f).padEnd(38) + kb(fs.statSync(f).size));
})().catch((err) => { console.error(err); process.exit(1); });
