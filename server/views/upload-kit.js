'use strict';
const kit = require('openvibe-shared/kit');
const { layout } = require('../render/layout');

const styles = ['ov-upload.css'];
const shared = ['ov-upload.js'];
const scripts = ['js/upload-kit.js'];
const states = [
    ['waiting', 'Waiting', 'A file is ready to send.'],
    ['sending', 'Sending', 'Bytes, speed and time left update while the file travels.'],
    ['paused', 'Paused', 'The connection dropped; the upload resumes when it returns.'],
    ['processing', 'Processing', 'The server is making the file playable.'],
    ['done', 'Done', 'The check draws when the upload finishes.'],
    ['failed', 'Failed', 'A plain reason and Retry appear together.'],
];

function progressPage() {
    const body = `<article class="uk-wrap"><header><p class="uk-kicker">Components</p><h1>Progress that tells you what is happening</h1>
<p>One <code>ov-progress</code> follows a file from selection through transfer and processing. It shows bytes, speed and an estimated time, then a drawn check when the file is ready.</p>
<p><a href="/uploader">See the uploader ${kit.icon('forward')}</a></p></header>
<div class="uk-grid">${states.map(([id, name, explanation]) => `<section class="uk-card"><h2>${name}</h2><p>${explanation}</p><ov-progress data-demo-state="${id}"></ov-progress></section>`).join('')}</div>
<section class="uk-card"><h2>Use it</h2>${kit.snippet({ code: `<link rel="stylesheet" href="/shared/ov-upload.css">\n<script src="/shared/ov-upload.js" defer></script>\n<ov-progress id="transfer"></ov-progress>\n<script>\n  const p = OVUpload.progress(document.querySelector('#transfer'), { onRetry: retry });\n  p.update({ state: 'sending', done: 8388608, total: 33554432 });\n  p.update({ state: 'processing', message: 'Making thumbnails' });\n  p.update({ state: 'done' });\n</script>`, id: 'uk-progress-code', label: 'Copy progress code' })}
<p>States: waiting, sending, paused, processing, done and failed. The server can name each processing step through <code>message</code>.</p>
<p>Tokens: <code>--ov-accent</code> for focus and Retry, <code>--ov-line</code> for the track and borders, <code>--ov-surface</code> for the card. The gradient is OpenVibe blue, purple and rose. Reduced motion stops the sheen, pulse and check animation.</p></section></article>`;
    return layout({ title: 'Progress component', description: 'Every state and token of OpenVibe upload progress.', path: '/progress', active: '/progress', body,
        sharedStyles: styles, shared, scripts, styles: ['css/upload-kit.css'] });
}

function uploaderPage() {
    const body = `<article class="uk-wrap"><header><p class="uk-kicker">Components</p><h1>Choose a file and keep going</h1>
<p>The picker opens the system chooser on a phone and accepts a drop on a computer. A chosen file gets its preview, name, size and Remove control. Sites pass the transfer function that reaches Media.</p>
<p><a href="/progress">See progress states ${kit.icon('forward')}</a></p></header>
<section class="uk-card"><h2>Try the picker</h2><div data-demo-picker></div><p class="uk-note">This example stays on your device; it does not upload the file.</p></section>
<section class="uk-card"><h2>Use it</h2>${kit.snippet({ code: `<link rel="stylesheet" href="/shared/ov-upload.css">\n<script src="/shared/ov-upload.js" defer></script>\n<div id="files"></div>\n<script>\n  OVUpload.queue(document.querySelector('#files'), {\n    label: 'Choose files', multiple: true, concurrency: 3,\n    upload: (file, { onProgress, signal }) => media.upload(file, { onProgress, signal })\n  });\n</script>`, id: 'uk-picker-code', label: 'Copy uploader code' })}
<p>Use <code>OVUpload.picker</code> for a single file. Use <code>OVUpload.queue</code> for multiple files and a total progress bar. The transport owns retry and resume; Media's multipart API supports both.</p>
<p>Tokens: <code>--ov-accent</code> for focus, <code>--ov-line</code> for the drop card, <code>--ov-surface</code> for its background. The native input is labelled and visually hidden.</p></section></article>`;
    return layout({ title: 'Uploader component', description: 'The shared OpenVibe file picker and queue.', path: '/uploader', active: '/uploader', body,
        sharedStyles: styles, shared, scripts, styles: ['css/upload-kit.css'] });
}

module.exports = { progressPage, uploaderPage };
