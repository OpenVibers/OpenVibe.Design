'use strict';
// /components/metrics: each part of openvibe-shared/ov-metrics.js, drawn by the real module this site pins, with the
// example numbers the page labels as examples. Nothing here draws a number itself.
(function () {
    const M = window.OVMetrics;
    const slot = (name) => document.querySelector(`[data-ovm="${name}"]`);
    if (!M) return;
    const f = M.format;
    const put = (name, node) => { const s = slot(name); if (s && node) s.replaceChildren(node); };

    put('tiles', M.tiles([
        { label: 'Calls', value: f.count(18420), delta: 0.12, trend: [3, 5, 4, 8, 9, 11, 12] },
        { label: 'Time to first token', value: f.ms(540), sub: 'p95 1.3 s', delta: 0.08, better: 'down' },
        { label: 'Speed', value: f.tps(86), sub: 'output tokens a second, p50' },
        { label: 'Succeeded', value: f.rate(0.9941), delta: -0.002 },
        { label: 'Charged', value: f.usd(61.2), sub: 'last 30 days' },
        { label: 'Not measured', value: f.ms(null), sub: 'unknown is a dash, never 0' },
    ]));
    put('spark', M.spark([12, 14, 11, 18, 22, 19, 26, 31, 28, 35], { label: 'Calls a day', width: 280, height: 56 }));
    put('bars', M.bars([
        { label: 'Actor', value: 24.1 }, { label: 'Chat', value: 18.6 }, { label: 'Live', value: 9.3 },
        { label: 'Codes', value: 6.8 }, { label: 'a-product-with-a-very-long-name-that-must-not-push-the-page', value: 2.4 },
    ], { format: f.usd }));
    put('percentiles', M.percentiles({ p50: 540, p90: 980, p95: 1310, n: 13080 }, { label: 'Time to first token' }));
    put('split', M.split([
        { label: 'Charged', value: 61.2 }, { label: 'Saved by cache', value: 19.8 },
    ], { format: f.usd }));
    put('table', M.table([
        { model: 'deepseek-flash', ttft: 540, tps: 86, ok: 0.994, usd: 0.0042 },
        { model: 'gpt-5-mini', ttft: 820, tps: 61, ok: 0.998, usd: 0.0061 },
        { model: 'gemini-4-hydrogen', ttft: null, tps: null, ok: null, usd: null },
        { model: 'glm-5.3', ttft: 1150, tps: 133, ok: 0.989, usd: 0.0118 },
    ], [
        { key: 'model', label: 'Model' },
        { key: 'ttft', label: 'First token p50', numeric: true, format: f.ms },
        { key: 'tps', label: 'Speed p50', numeric: true, bar: true, format: f.tps },
        { key: 'ok', label: 'Succeeded', numeric: true, format: f.rate },
        { key: 'usd', label: 'Per call', numeric: true, format: f.usd },
    ], { caption: 'Example models: a click on a heading sorts, a second click turns it' }));
    for (const s of document.querySelectorAll('[data-ovm-wait]')) s.hidden = true;
}());
