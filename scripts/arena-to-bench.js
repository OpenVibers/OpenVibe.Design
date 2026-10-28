#!/usr/bin/env node
'use strict';

/** One-off legacy Arena import. Dry run is the default. No identity is sent with judgements. */
const { createBenchClient } = require('../server/arena/bench');
const { load } = require('../server/config');
const { createDb } = require('openvibe-sdk/db');

async function readLegacy(db) {
    const rounds = await db.many('SELECT id, category, prompt, status, created_at FROM arena_rounds ORDER BY created_at, id');
    const outputs = await db.many('SELECT id, "round", model, provider, html, cost_usd, ms, tokens, error, ui_check, created_at FROM arena_outputs ORDER BY created_at, id');
    const votes = await db.many('SELECT "round", left_output, right_output, winner, at FROM arena_votes ORDER BY at, "round"');
    return { rounds, outputs, votes };
}

function preflight({ rounds, outputs, votes }) {
    const problems = [];
    const ids = new Set(rounds.map((r) => r.id));
    const outputById = new Map(outputs.map((o) => [o.id, o]));
    for (const v of votes) {
        const left = outputById.get(v.left_output);
        const right = outputById.get(v.right_output);
        if (!ids.has(v.round) || !left || !right || left.round !== v.round || right.round !== v.round || left.error || right.error) {
            problems.push(`vote on ${v.round} has a missing, failed or foreign entry`);
        }
    }
    return problems;
}

async function migrate({ db, bench, apply = false }) {
    const legacy = await readLegacy(db);
    const problems = preflight(legacy);
    const summary = { dry_run: !apply, rounds: legacy.rounds.length, entries: legacy.outputs.length, judgements: legacy.votes.length, problems };
    if (!apply) return summary;
    if (problems.length) throw new Error(`Import refused: ${problems.join('; ')}`);
    const outputMap = new Map();
    for (const r of legacy.rounds) {
        const { round } = await bench.createRound({ category: r.category, prompt: r.prompt });
        for (const o of legacy.outputs.filter((e) => e.round === r.id)) {
            const result = await bench.addEntry({ roundId: round.id, provider: o.provider, model: o.model,
                route: {}, payload: { html: o.html }, costUsd: o.cost_usd, ms: o.ms, tokens: o.tokens,
                error: o.error, uiCheck: o.ui_check });
            outputMap.set(o.id, result.entry.id);
        }
        for (const v of legacy.votes.filter((j) => j.round === r.id)) {
            await bench.castImportedVote({ roundId: round.id,
                pair: { left: outputMap.get(v.left_output), right: outputMap.get(v.right_output) }, winner: v.winner });
        }
    }
    return summary;
}

async function main() {
    const apply = process.argv.includes('--apply');
    const config = load();
    if (!config.db.url) throw new Error('DATABASE_URL is required for the one-off import');
    config.bench.scope = `${config.bench.scope} bench.entry.create`;
    const db = createDb({ url: config.db.url, service: 'design-arena-import', max: 1 });
    try {
        const bench = apply ? createBenchClient({ config }) : null;
        const summary = await migrate({ db, bench, apply });
        process.stdout.write(`${JSON.stringify(summary)}\n`);
        if (summary.problems.length) process.exitCode = 2;
    } finally { await db.close(); }
}

if (require.main === module) main().catch((err) => { console.error(err.message); process.exitCode = 1; });
module.exports = { readLegacy, preflight, migrate };
