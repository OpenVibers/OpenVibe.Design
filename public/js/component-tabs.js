'use strict';
// The Tabs page's specimen: each row's tabs pick on a press, and ov-tabs.js (openvibe-shared 4.284.0) moves the ink.
(function () {
    const go = () => {
        document.querySelectorAll('[data-ovtb]').forEach((row, i) => {
            row.addEventListener('click', (e) => {
                const t = e.target.closest('[role="tab"]');
                if (!t) return;
                row.querySelectorAll('[role="tab"]').forEach((x) => x.setAttribute('aria-selected', String(x === t)));
            });
            if (window.OVTabs) window.OVTabs.ink(row, { kind: row.dataset.ovtb, key: `spec-${i}` });
        });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
