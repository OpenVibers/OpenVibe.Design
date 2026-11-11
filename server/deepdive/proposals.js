'use strict';

/**
 * "Proposed from research" (owner only): the rules a deep dive proposes, with their evidence, and the one
 * decision the owner makes about each. Approval opens a pull request on the register and marks the proposal
 * approved; dismissal keeps it out of the way. Nothing is written to server/rules/register.js here.
 */

const fail = (status, code, detail) => Object.assign(new Error(detail), { status, code, detail });

function createRuleProposals({ store, rulePr, config = {}, log = console }) {
    const ownerName = String((config.deepDive && config.deepDive.ownerUsername) || config.ownerUsername || 'goosely').toLowerCase();
    const isOwner = (viewer) => Boolean(viewer && viewer.kind === 'user' && (
        viewer.role === 'owner' || String(viewer.username || '').toLowerCase() === ownerName));

    async function list({ state = 'proposed' } = {}) {
        const rows = await store.listProposals({ state: state || null });
        return await Promise.all(rows.map((r) => store.publicProposal(r, { research: true })));
    }

    async function decide(id, action, viewer) {
        if (!isOwner(viewer)) throw fail(403, 'rules.owner_only', 'Only the owner decides a proposed rule.');
        const proposal = await store.proposal(id);
        if (!proposal) throw fail(404, 'rules.not_found', 'That proposed rule was not found.');
        if (action === 'dismiss') {
            const row = await store.decideProposal(id, { state: 'dismissed', by: viewer.username });
            return { proposal: await store.publicProposal(row), action: 'dismissed' };
        }
        if (action !== 'approve') throw fail(422, 'rules.action', 'Approve or dismiss a proposed rule.');
        if (proposal.state === 'approved' && proposal.pr_url) {
            return { proposal: await store.publicProposal(proposal), action: 'approved', already: true };
        }
        if (proposal.state === 'dismissed') throw fail(409, 'rules.dismissed', 'That proposed rule was dismissed already.');
        const research = await store.get(proposal.research_id);
        let opened;
        try {
            opened = await rulePr.open({ proposal, reportUrl: research && research.report_url, decidedBy: viewer.username });
        } catch (err) {
            await store.decideProposal(id, { state: proposal.state === 'approved' ? 'approved' : 'proposed', by: null, prError: String(err.detail || err.message).slice(0, 500) }).catch(() => {});
            throw err;
        }
        const row = await store.decideProposal(id, { state: 'approved', by: viewer.username, prUrl: opened.url, prBranch: opened.branch, prError: null });
        return { proposal: await store.publicProposal(row), action: 'approved', pull: opened };
    }

    return { isOwner, list, decide, ownerName };
}

module.exports = { createRuleProposals };
