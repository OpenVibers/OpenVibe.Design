'use strict';

/**
 * The deep dives Design knows: the runs it started for a person, the report's numbered points and brief, and
 * the rules those reports propose. A dive is kept even when its run fails, because the person paid for a dive
 * and a failed one still says why; a report template is never stored, only the run's own answer.
 */

const fail = (status, code, detail) => Object.assign(new Error(detail), { status, code, detail });
const PUBLIC = new Set(['quick', 'thorough', 'expert']);

function createDeepDiveStore({ s, log = console }) {
    const db = s.db;

    function publicRow(row, { points = false } = {}) {
        if (!row) return null;
        const out = {
            id: row.id, question: row.question, depth: row.depth, sites: Array.isArray(row.sites) ? row.sites : [],
            status: row.status, runId: row.run_id || null, url: `/research/${encodeURIComponent(row.id)}`,
            priceUsd: (row.report && row.report.receipt && row.report.receipt.price_usd != null)
                ? Number(row.report.receipt.price_usd) : (row.estimate && row.estimate.price_usd != null ? Number(row.estimate.price_usd) : null),
            reportUrl: row.report_url || null, progress: row.progress && typeof row.progress === 'object' ? row.progress : {},
            estimate: row.estimate || null, error: row.error || null,
            createdAt: row.created_at, updatedAt: row.updated_at,
            pointsCount: Array.isArray(row.points) ? row.points.length : 0,
        };
        if (points) out.points = Array.isArray(row.points) ? row.points : [];
        return out;
    }

    async function create({ owner, question, depth = 'thorough', sites = [], estimate = null, runId = null, status = 'starting' }) {
        const id = s.newId('rsr');
        const at = s.iso();
        await db.exec(`INSERT INTO design_research(id,owner,question,depth,sites,run_id,status,progress,estimate,created_at,updated_at)
            VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,'{}'::jsonb,$8::jsonb,$9::timestamptz,$9::timestamptz)`,
        [id, owner, String(question || '').slice(0, 2000), PUBLIC.has(depth) ? depth : 'thorough', JSON.stringify(Array.isArray(sites) ? sites.slice(0, 30) : []),
            runId, status, estimate ? JSON.stringify(estimate) : null, at]);
        return await get(id);
    }

    async function get(id) { return await db.maybe('SELECT * FROM design_research WHERE id=$1', [id]); }

    async function owned(id, owner) {
        const row = await get(id);
        if (!row) throw fail(404, 'deep_dive.not_found', 'Deep dive not found.');
        if (row.owner !== owner) throw fail(403, 'deep_dive.forbidden', 'That deep dive belongs to someone else.');
        return row;
    }

    async function patch(id, fields = {}) {
        const columns = [];
        const values = [id];
        const put = (name, value) => { values.push(value); columns.push(`${name}=$${values.length}`); };
        if (fields.status != null) put('status', fields.status);
        if (fields.runId != null) put('run_id', fields.runId);
        if (fields.progress != null) put('progress', JSON.stringify(fields.progress));
        if (fields.report != null) put('report', JSON.stringify(fields.report));
        if (fields.points != null) put('points', JSON.stringify(fields.points));
        if (fields.brief != null) put('brief', String(fields.brief).slice(0, 20000));
        if (fields.reportUrl != null) put('report_url', fields.reportUrl);
        if (fields.error != null) put('error', String(fields.error).slice(0, 500));
        if (fields.estimate != null) put('estimate', JSON.stringify(fields.estimate));
        if (!columns.length) return await get(id);
        values.push(s.iso());
        columns.push(`updated_at=$${values.length}::timestamptz`);
        return await db.maybe(`UPDATE design_research SET ${columns.join(', ')} WHERE id=$1 RETURNING *`, values);
    }

    async function list(owner, { limit = 8 } = {}) {
        const size = Math.max(1, Math.min(30, Number(limit) || 8));
        return await db.many(`SELECT * FROM design_research WHERE owner=$1 ORDER BY created_at DESC, id DESC LIMIT $2`, [owner, size]);
    }

    async function recentDone(owner, { limit = 6 } = {}) {
        return await db.many(`SELECT * FROM design_research WHERE owner=$1 AND status='done' ORDER BY created_at DESC, id DESC LIMIT $2`,
            [owner, Math.max(1, Math.min(20, Number(limit) || 6))]);
    }

    async function byRun(runId) { return await db.maybe('SELECT * FROM design_research WHERE run_id=$1 ORDER BY created_at DESC LIMIT 1', [runId]); }

    async function allDone({ limit = 50, owner = null } = {}) {
        const size = Math.max(1, Math.min(200, Number(limit) || 50));
        if (owner) return await db.many("SELECT * FROM design_research WHERE status='done' AND report IS NOT NULL AND owner=$1 ORDER BY created_at DESC, id DESC LIMIT $2", [owner, size]);
        return await db.many("SELECT * FROM design_research WHERE status='done' AND report IS NOT NULL ORDER BY created_at DESC, id DESC LIMIT $1", [size]);
    }

    // ── Rules a report proposes ─────────────────────────────
    async function proposalsFor(researchId) {
        return await db.many('SELECT * FROM rule_proposals WHERE research_id=$1 ORDER BY created_at', [researchId]);
    }

    async function addProposals(research, items = []) {
        const out = [];
        for (const item of items) {
            const rule = String(item && item.rule || '').trim().slice(0, 300);
            if (!rule) continue;
            const existing = await db.maybe("SELECT * FROM rule_proposals WHERE research_id=$1 AND lower(rule)=lower($2) AND state IN ('proposed','approved') LIMIT 1",
                [research.id, rule]);
            if (existing) { out.push(existing); continue; }
            const id = s.newId('rpp');
            const at = s.iso();
            const row = await db.maybe(`INSERT INTO rule_proposals(id,research_id,owner,rule,detail,why,area,evidence,state,created_at,updated_at)
                VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'proposed',$9::timestamptz,$9::timestamptz) RETURNING *`,
            [id, research.id, research.owner, rule, String(item.detail || '').slice(0, 1500), String(item.why || '').slice(0, 1500),
                String(item.area || 'products').slice(0, 40),
                JSON.stringify(Array.isArray(item.evidence) ? item.evidence.slice(0, 8) : []), at]);
            if (row) out.push(row);
        }
        return out;
    }

    async function listProposals({ state = null, limit = 100 } = {}) {
        const size = Math.max(1, Math.min(300, Number(limit) || 100));
        if (state) return await db.many('SELECT * FROM rule_proposals WHERE state=$1 ORDER BY created_at DESC LIMIT $2', [state, size]);
        return await db.many('SELECT * FROM rule_proposals ORDER BY CASE state WHEN \'proposed\' THEN 0 ELSE 1 END, created_at DESC LIMIT $1', [size]);
    }

    async function proposal(id) { return await db.maybe('SELECT * FROM rule_proposals WHERE id=$1', [id]); }

    async function decideProposal(id, { state, by = null, prUrl = null, prBranch = null, prError = null }) {
        const at = s.iso();
        return await db.maybe(`UPDATE rule_proposals SET state=$2, decided_by=$3, decided_at=$4::timestamptz, pr_url=COALESCE($5,pr_url),
            pr_branch=COALESCE($6,pr_branch), pr_error=$7, updated_at=$4::timestamptz WHERE id=$1 RETURNING *`,
        [id, state, by, at, prUrl, prBranch, prError]);
    }

    async function publicProposal(row, { research = false } = {}) {
        if (!row) return null;
        const out = {
            id: row.id, researchId: row.research_id, owner: row.owner, rule: row.rule, detail: row.detail, why: row.why,
            area: row.area, evidence: Array.isArray(row.evidence) ? row.evidence : [], state: row.state,
            prUrl: row.pr_url || null, prBranch: row.pr_branch || null, prError: row.pr_error || null,
            decidedAt: row.decided_at || null, createdAt: row.created_at,
        };
        if (research) {
            const r = await get(row.research_id);
            out.research = r ? publicRow(r) : null;
        }
        return out;
    }

    return { create, get, owned, patch, list, recentDone, byRun, allDone, publicRow, proposalsFor, addProposals, listProposals, proposal, decideProposal, publicProposal };
}

module.exports = { createDeepDiveStore };
