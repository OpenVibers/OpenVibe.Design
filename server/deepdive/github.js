'use strict';

/**
 * The one write a rule approval makes: a pull request against server/rules/register.js, never a direct change.
 *
 * A proposed rule is appended to the register's `RULES` array with its id, area, sentence, detail, the day it was
 * approved, why, and a link to the deep dive that proposed it. The change is made on a branch and opened as a PR;
 * the register on main is never written by this service. Without a GitHub token the approval is recorded and the
 * page says a pull request still needs the token.
 */

const fail = (status, code, detail) => Object.assign(new Error(detail), { status, code, detail });
const API = 'https://api.github.com';

function jsq(value) {
    return `'${String(value == null ? '' : value)
        .replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n')}'`;
}
function slug(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'proposed-rule';
}
function today() { return new Date().toISOString().slice(0, 10); }

/** The source with one rule appended before the `RULES` array's closing bracket. Idempotent by rule id. */
function addRule(source, proposal, { id, area, decided, reportUrl = null }) {
    const text = String(source || '');
    const marker = 'const RULES = Object.freeze([';
    const start = text.indexOf(marker);
    if (start === -1) throw fail(500, 'rules.register_shape', 'The rules register could not be read: its RULES array was not found.');
    let close = text.indexOf('\n]);', start);
    if (close === -1) close = text.indexOf(']);', start);
    if (close === -1) throw fail(500, 'rules.register_shape', 'The rules register could not be read: the RULES array has no closing bracket.');
    if (text.includes(`R(${jsq(id)},`)) throw fail(409, 'rules.duplicate', `Rule ${id} is already in the register.`);
    const see = reportUrl ? `, [{ label: 'Read the deep dive', href: ${jsq(reportUrl)} }]` : '';
    const line = `    R(${jsq(id)}, ${jsq(area)}, ${jsq(proposal.rule)},
        ${jsq(proposal.detail || '')},
        ${jsq(decided)}, ${jsq(proposal.why || '')}${see}),
`;
    const gap = text[close - 1] === '\n' ? '' : '\n';
    return `${text.slice(0, close)}${gap}${line}${text.slice(close + 1)}`;
}

async function gh(fetchImpl, token, method, path, body = null) {
    let res;
    try {
        res = await fetchImpl(`${API}${path}`, {
            method,
            headers: {
                Accept: 'application/vnd.github+json', 'User-Agent': 'OpenVibe.Design rules proposals',
                Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(20_000),
        });
    } catch (err) {
        throw fail(502, 'rules.github_unreachable', err && err.name === 'TimeoutError' ? 'GitHub did not answer in time.' : 'GitHub could not be reached.');
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
        const detail = (json && json.message) || `GitHub answered ${res.status}.`;
        throw fail(res.status === 401 || res.status === 403 ? 502 : 502, `rules.github_${res.status}`, String(detail).slice(0, 500));
    }
    return json;
}

function createRulePr({ config, fetchImpl = globalThis.fetch, log = console, now = () => new Date() }) {
    const dd = config.deepDive || {};
    async function open({ proposal, reportUrl = null, decidedBy = null }) {
        const token = dd.githubToken;
        if (!token) throw fail(503, 'rules.github_token', 'Approving a rule records it, but opening the pull request needs DESIGN_RULES_GITHUB_TOKEN on this service.');
        const repo = String(dd.repo || 'OpenVibers/OpenVibe.Design');
        if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw fail(500, 'rules.repo', 'The rules repository is not configured.');
        const path = String(dd.registerPath || 'server/rules/register.js').replace(/^\/+/, '');
        if (!/^[A-Za-z0-9._/-]+$/.test(path) || path.includes('..')) throw fail(500, 'rules.path', 'The register path is not valid.');
        const meta = await gh(fetchImpl, token, 'GET', `/repos/${repo}`);
        const base = String((meta && meta.default_branch) || 'main');
        const ref = await gh(fetchImpl, token, 'GET', `/repos/${repo}/git/ref/heads/${encodeURIComponent(base)}`);
        const baseSha = ref && ref.object && ref.object.sha;
        if (!baseSha) throw fail(502, 'rules.github_answer', 'GitHub did not say which commit main is at.');
        const file = await gh(fetchImpl, token, 'GET', `/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(base)}`);
        const source = Buffer.from(String(file && file.content || ''), 'base64').toString('utf8');
        const id = `research-${slug(proposal.id || proposal.rule)}`;
        const date = now().toISOString().slice(0, 10);
        const updated = addRule(source, proposal, { id, area: proposal.area || 'products', decided: date, reportUrl });
        const branch = `${String(dd.branchPrefix || 'rules/research').replace(/\/+$/, '')}-${id.replace(/^research-/, '')}`.slice(0, 200);
        try {
            await gh(fetchImpl, token, 'POST', `/repos/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: baseSha });
        } catch (err) {
            // A retry after a failed pull request reuses its branch instead of failing on the second create.
            if (!/already exists/i.test(String(err.detail || err.message))) throw err;
        }
        await gh(fetchImpl, token, 'PUT', `/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
            message: `Rules: ${proposal.rule}`.slice(0, 200),
            content: Buffer.from(updated, 'utf8').toString('base64'),
            sha: file && file.sha,
            branch,
        });
        const pull = await gh(fetchImpl, token, 'POST', `/repos/${repo}/pulls`, {
            title: `Rules: ${String(proposal.rule).slice(0, 160)}`,
            head: branch, base,
            body: [
                '## What this adds', '',
                `Rule \`${id}\` in \`${path}\`: **${proposal.rule}**`, '',
                proposal.detail || '',
                proposal.why ? `Why: ${proposal.why}` : '',
                reportUrl ? `Proposed by a deep dive: ${reportUrl}` : '',
                `Approved by @${decidedBy || 'the owner'} on ${date}.`, '',
                'Nothing is added to the register by itself: merging this pull request is the decision.',
            ].filter(Boolean).join('\n'),
        });
        return { url: pull && pull.html_url, number: pull && pull.number, branch, id };
    }
    return { open };
}

module.exports = { createRulePr, addRule, jsq, slug };
