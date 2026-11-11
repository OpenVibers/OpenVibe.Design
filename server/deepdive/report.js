'use strict';

/**
 * A deep dive's report, read for Design (contract ai.deep-dive@1 on OpenVibe.AI).
 *
 * The report is evidence, not content: Design takes the numbered points (patterns, do and don't, reference
 * tokens, the rules a report follows), a compact brief for the generator, the crops a component's page shows
 * with their attribution and dates, and the rules a report proposes. No site's HTML, CSS or assets are ever
 * stored in a design or copied into a prompt: a crop is shown as commentary with its source, and a reference
 * token is a direction, never a palette to copy.
 *
 * The shape of a report is read leniently (the dive is written by another service and may grow): the usual
 * names are used when present and a missing part is simply empty.
 */

const str = (v, max = 4000) => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim().slice(0, max);
const list = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const object = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

/** Text of a pattern, a do, a rule or a recommendation, whichever shape the report used. */
function textOf(item) {
    if (typeof item === 'string') return str(item, 600);
    if (!item || typeof item !== 'object') return '';
    return str(item.text || item.title || item.rule || item.name || item.pattern || item.detail || item.description || item.advice, 600);
}

/** The evidence behind one item, flattened to what a page can show. */
function evidenceOf(item) {
    if (!item || typeof item !== 'object') return [];
    const raw = [
        ...list(item.evidence), ...list(item.citations), ...list(item.sources), ...list(item.sites),
        ...(item.site ? [item] : []), ...(item.url ? [item] : []),
    ];
    const out = [];
    for (const e of raw) {
        if (typeof e === 'string') { if (/^https?:\/\//.test(e)) out.push({ url: e, site: hostOf(e) }); continue; }
        if (!e || typeof e !== 'object') continue;
        const url = str(e.url || e.source_url || e.href || e.link, 2000);
        const site = str(e.site || e.name || e.publisher || e.title || e.source || e.domain, 200) || (url ? hostOf(url) : '');
        const crop = str(e.crop_url || e.crop || e.image_url || e.screenshot_url || e.shot_url || e.image, 2000);
        const captured = str(e.read_at || e.captured_at || e.retrieved_at || e.date || e.capture_date, 40);
        const note = str(e.claim || e.note || e.quote || e.detail || e.text, 400);
        if (url || site || crop || e.crop_id || e.capture_id) out.push({ site, url: url || null, crop: crop || null,
            cropId: str(e.crop_id, 80) || null, captureId: str(e.capture_id, 80) || null,
            capturedAt: captured || null, note });
    }
    return out.slice(0, 8);
}
function hostOf(url) { try { return new URL(String(url)).hostname.replace(/^www\./, ''); } catch { return ''; } }

/** Turn the report into a numbered list a take can follow and a page can link to. */
const STEP_LABEL = { plan: 'Planning', search: 'Searching', choose: 'Choosing sites', capture: 'Capturing', analyse: 'Analysing', synthesise: 'Writing it up', report: 'Writing it up' };
function pointsOf(report) {
    const source = object(report);
    const synth = object(source.synthesis);
    const explicit = list(source.points).length ? list(source.points) : list(synth.points);
    const points = [];
    const add = (group, text, item, extra = {}) => {
        const t = textOf(text);
        if (!t) return;
        points.push({ n: points.length + 1, group, text: t, evidence: evidenceOf(item), ...extra });
    };
    if (explicit.length) {
        for (const p of explicit) {
            if (typeof p === 'string') add('point', p);
            else add(str(p.group || p.kind || 'point', 40), textOf(p), p, { rule: str(p.rule || p.rule_id, 80) || null });
        }
    } else {
        // ai.deep-dive@1: patterns say what and how many sites; do/don't are sentences; the reference tokens are
        // per source and are inspiration only; a recommendation states whether it follows or would change a rule.
        for (const item of list(synth.patterns || source.patterns)) {
            const name = str(item && (item.name || item.title), 160);
            const what = str(item && (item.what || item.text || item.description), 600);
            const count = item && Number.isFinite(Number(item.usage_count)) ? Number(item.usage_count) : (Array.isArray(item && item.sites) ? item.sites.length : 0);
            add('pattern', count ? `${count} of the sites: ${name}${what ? ` — ${what}` : ''}` : (name || what), item);
        }
        for (const item of list(synth.dos || synth.do || source.dos || source.do)) add('do', item, item);
        for (const item of list(synth.donts || synth.dont || source.donts || source.dont)) add("don't", item, item);
        const tokens = object(synth.reference_tokens || synth.tokens || source.reference_tokens || source.tokens);
        for (const p of list(tokens.palettes)) add('reference token', `Palette, as direction only: ${list(p && p.colours).join(', ')}`, p);
        for (const p of list(tokens.type_scales)) add('reference token', `Type scale, as direction only: ${list(p && p.families).join(', ')}${list(p && p.sizes).length ? ` at ${list(p.sizes).join(', ')}` : ''}`, p);
        for (const p of list(tokens.spacing)) add('reference token', `Spacing steps, as direction only: ${list(p && p.steps).join(', ')}`, p);
        for (const item of list(synth.best ? [synth.best] : [])) add('pattern', item.what, item);
        for (const item of list(synth.mistakes || source.mistakes)) add("don't", item.what || item.text, item);
        for (const item of list(synth.rules || source.rules_followed || source.rules)) add('rule', item, item);
        for (const item of list(source.recommendations || synth.recommendations)) {
            const rule = item && item.rule && typeof item.rule === 'object' ? item.rule : null;
            if (rule && rule.text && rule.status !== 'none') add('rule', rule.text, item, { rule: rule.id || null });
        }
        for (const item of list(source.recommendations || synth.recommendations)) add('recommendation', item && (item.what || item.text), item);
    }
    if (!points.length && (source.summary || source.verdict)) add('summary', source.summary || source.verdict);
    return points.slice(0, 60);
}
/** What the generator reads: the points, plainly, with the copying rule stated once. */
function briefOf(report, points, fallbackQuestion = '') {
    const r = object(report);
    const synth = object(r.synthesis);
    const input = object(r.input);
    const question = str(r.question || input.question || r.query || synth.question || fallbackQuestion, 300);
    const sites = list(r.sites || r.sources || r.captures).length;
    const by = (group) => points.filter((p) => p.group === group);
    const lines = [`Research first: ${question || 'expert design research'}${sites ? `, from ${sites} sites read at phone and computer sizes` : ''}.`];
    if (by('pattern').length) lines.push('What the better sites do:', ...by('pattern').map((p) => `- ${p.text}`));
    if (by('do').length) lines.push('Do:', ...by('do').map((p) => `- ${p.text}`));
    if (by("don't").length) lines.push('Do not:', ...by("don't").map((p) => `- ${p.text}`));
    if (by('reference token').length) lines.push('Reference tokens, as direction only (never copy a palette, typeface, spacing scale or asset):', ...by('reference token').map((p) => `- ${p.text}`));
    if (by('rule').length) lines.push('OpenVibe rules this follows:', ...by('rule').map((p) => `- ${p.text}`));
    lines.push('Use the research as direction for this design. Never copy a site\'s assets, code, markup, CSS, words or an exact palette. Do not reproduce or load any reference image.');
    return lines.join('\n');
}

/** The rules a report proposes for the register. Only an explicit "would change" becomes one; nothing is inferred. */
function proposedRulesOf(report) {
    const r = object(report);
    const synth = object(r.synthesis);
    const out = [];
    for (const item of [...list(r.recommendations), ...list(synth.recommendations), ...list(r.proposed_rules)]) {
        if (!item) continue;
        const rule = object(item.rule);
        if (!(rule.status === 'would_change' || item.proposed_rule || item.proposes_rule)) continue;
        const text = str(item.proposed_rule || item.rule_text || item.what || (typeof item === 'string' ? item : ''), 300);
        if (!text) continue;
        out.push({
            rule: text,
            detail: str(rule.text || item.detail || item.description || item.what, 1200),
            why: str(item.why || item.reason || item.evidence_note, 1200),
            area: str(item.area || item.group, 40),
            evidence: evidenceOf(item),
            ruleId: str(rule.id, 120) || null,
        });
    }
    return out.slice(0, 12);
}
/** The component pages' "How others do it": the points and per-site analysis whose words name a component. */
function findsFor(report, component, limit = 6) {
    const name = str(component, 80).toLowerCase();
    if (!name) return [];
    const wordy = new RegExp(`(^|[^a-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i');
    const out = [];
    const push = (text, evidence, extra = {}) => {
        if (!text || !wordy.test(text)) return;
        const ev = Array.isArray(evidence) ? evidence : [];
        out.push({
            title: str(text, 400), detail: '', evidence: ev,
            crop: (ev.find((e) => e.crop) || {}).crop || null,
            cropId: (ev.find((e) => e.cropId) || {}).cropId || null,
            captureId: (ev.find((e) => e.captureId) || {}).captureId || null,
            site: (ev.find((e) => e.site) || {}).site || null,
            capturedAt: (ev.find((e) => e.capturedAt) || {}).capturedAt || null,
            url: (ev.find((e) => e.url) || {}).url || null,
            ...extra,
        });
    };
    // The capture worker's component inventory, when the DOM facts carry one: the same component seen on a site,
    // with the crop that shows it. The capitalised name is what the inventory uses; the check is case-insensitive.
    const sources = new Map(list(object(report).sources).map((x) => [x && x.id, x || {}]));
    for (const cap of list(object(report).captures)) {
        if (!cap || typeof cap !== 'object') continue;
        const dom = object(cap.dom);
        const inventory = list(dom.components || dom.component_inventory || dom.inventory || dom.ui_components);
        const hit = inventory.find((c) => {
            const label = typeof c === 'string' ? c : (c && (c.name || c.component || c.kind));
            return label && wordy.test(String(label));
        });
        if (!hit) continue;
        const src = sources.get(cap.source_id) || {};
        const crop = list(cap.crops)[0] || null;
        const label = typeof hit === 'string' ? hit : (hit.name || hit.component || hit.kind);
        push(`A ${label} appears on ${src.title || host(cap.url)}.`, [{ site: host(src.url || cap.url), url: src.url || cap.url || null,
            cropId: crop && crop.id || null, captureId: cap.id || null, capturedAt: cap.captured_at || null,
            note: hit && typeof hit === 'object' ? str(hit.note || hit.usage || '', 300) : '' }]);
    }
    // The contract's per-site analysis: a summary, strengths and weaknesses, each with evidence.
    for (const a of list(object(report).analysis)) {
        if (!a || typeof a !== 'object') continue;
        const ev = evidenceOf(a);
        for (const text of [a.summary, ...list(a.strengths), ...list(a.weaknesses)]) {
            if (text && wordy.test(String(text))) push(text, ev, { sourceUrl: a.url || null });
        }
    }
    for (const p of pointsOf(report)) {
        if (wordy.test(p.text) || p.evidence.some((e) => wordy.test(e.note || '') || wordy.test(e.site || ''))) {
            const ev = p.evidence.length ? p.evidence : [];
            out.push({ n: p.n, title: p.text, detail: '', evidence: ev,
                crop: (ev.find((e) => e.crop) || {}).crop || null,
                cropId: (ev.find((e) => e.cropId) || {}).cropId || null,
                captureId: (ev.find((e) => e.captureId) || {}).captureId || null,
                site: (ev.find((e) => e.site) || {}).site || null,
                capturedAt: (ev.find((e) => e.capturedAt) || {}).capturedAt || null,
                url: (ev.find((e) => e.url) || {}).url || null });
        }
    }
    const seen = new Set();
    return out.filter((x) => { const k = `${x.title}|${x.cropId || x.crop || ''}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, limit);
}
/** The live step list for a running dive: the contract's seven steps, in order, as the words the brief names. */
const CONTRACT_STEPS = ['plan', 'search', 'choose', 'capture', 'analyse', 'synthesise', 'report'];
const STEP_NAMES = CONTRACT_STEPS.map((k) => STEP_LABEL[k]);
function progressOf(run) {
    const r = object(run);
    const out = object(r.explain).deep_dive || object(r.explain).deepDive || r.progress || {};
    const report = object(r.output);
    const raw = list(out.steps || r.steps || report.steps);
    let steps;
    if (raw.length && raw[0] && (raw[0].key || raw[0].name || raw[0].step)) {
        steps = raw.map((s, i) => {
            const key = str(s.key || s.name || s.step, 40);
            const state = String(s.status || s.state || '').toLowerCase();
            return { key, name: STEP_LABEL[key] || str(s.title, 80) || STEP_NAMES[i] || `Step ${i + 1}`,
                state: /done|complete|succeed/i.test(state) ? 'done' : /fail|error/i.test(state) ? 'failed' : /run|active|work/i.test(state) ? 'running' : /skip/i.test(state) ? 'skipped' : 'waiting' };
        });
    } else {
        const index = Number(out.step_index || out.step || 0);
        steps = STEP_NAMES.map((name, i) => ({ key: CONTRACT_STEPS[i], name, state: i < index ? 'done' : i === index ? 'running' : 'waiting' }));
    }
    return { steps, current: str(out.current || out.label || out.step_name, 120) || null, percent: Number(out.percent || out.progress) || null };
}
function normalizeReport(input, { question = '', depth = 'thorough' } = {}) {
    let report = input;
    if (typeof report === 'string') { try { report = JSON.parse(report); } catch { report = { summary: report }; } }
    if (report && typeof report === 'object' && report.deep_dive) report = report.deep_dive;
    else if (report && typeof report === 'object' && report.report) report = report.report;
    report = object(report);
    const points = pointsOf(report);
    return {
        question: str(report.question || object(report.input).question || report.query || question, 300),
        depth: str(report.depth || depth, 20) || 'thorough',
        summary: str(report.summary || report.verdict || object(report.synthesis).summary, 2000),
        points,
        brief: briefOf(report, points, question),
        proposedRules: proposedRulesOf(report),
        report,
    };
}

module.exports = { normalizeReport, pointsOf, briefOf, proposedRulesOf, findsFor, progressOf, evidenceOf, textOf, STEP_NAMES };
