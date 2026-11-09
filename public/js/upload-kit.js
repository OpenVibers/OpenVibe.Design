(function () {
    'use strict';
    if (!window.OVUpload) return;
    document.querySelectorAll('[data-demo-state]').forEach(function (el) {
        var state = el.dataset.demoState;
        var meter = OVUpload.progress(el, { onRetry: function () { meter.update({ state: 'sending', done: 12 * 1024 * 1024, total: 32 * 1024 * 1024 }); } });
        meter.update({ state: state, done: state === 'done' || state === 'processing' ? 32 * 1024 * 1024 : state === 'waiting' ? 0 : 12 * 1024 * 1024,
            total: 32 * 1024 * 1024, message: state === 'failed' ? 'The connection timed out.' : state === 'processing' ? 'Making thumbnails' : '' });
        if (state === 'sending') {
            var bytes = 12 * 1024 * 1024;
            setInterval(function () { bytes = bytes >= 30 * 1024 * 1024 ? 12 * 1024 * 1024 : bytes + 1024 * 1024; meter.update({ state: 'sending', done: bytes }); }, 1100);
        }
    });
    var demo = document.querySelector('[data-demo-picker]');
    if (demo) OVUpload.picker(demo, { label: 'Choose a file', multiple: true });
})();
