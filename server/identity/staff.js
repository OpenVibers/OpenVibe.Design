'use strict';
/** Is this session viewer OpenVibe staff? The Network role claim, ranked by the contracts' one table. */
const { staff } = require('openvibe-contracts');

function isStaff(viewer) {
    if (!viewer || viewer.kind !== 'user' || typeof viewer.role !== 'string' || !viewer.role) return false;
    try { return staff.atLeast(viewer.role, 'global_mod'); } catch { return false; }
}

module.exports = { isStaff };
