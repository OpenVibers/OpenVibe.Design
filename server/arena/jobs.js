'use strict';

/**
 * The Arena's generation worker. A round is created as `queued` by the request; this loop claims it, asks AI for
 * three outputs, stores each (sanitized) with its reported provider, model, cost, time and tokens, then marks the
 * round `ready` (at least two usable outputs) or `failed`.
 *
 * The loop starts in server/index.js and never under DESIGN_DRILL=1. Tests call tick() explicitly.
 */
const ERROR_MAX = 500;

function createArenaJobs({ s, arena, ai, config, log = console }) {
    let timer = null;
    let running = false;
    let stopped = false;

    async function claim() {
        return await s.tx(async () => {
            const r = await s.db.maybe("SELECT * FROM arena_rounds WHERE status = 'queued' ORDER BY created_at, id LIMIT 1 FOR UPDATE");
            if (!r) return null;
            await s.db.exec("UPDATE arena_rounds SET status = 'generating' WHERE id = $1", [r.id]);
            return { ...r, status: 'generating' };
        });
    }

    async function generateRound(round) {
        let plan;
        try {
            plan = typeof ai.slotPlan === 'function' ? await ai.slotPlan() : { slots: await ai.slots(), pool_fallback: false };
        } catch (err) {
            log.warn('[OpenVibe.Design] AI slots unavailable:', (err && err.message) || err);
            plan = { slots: [{ provider: 'ai', model: null }], pool_fallback: true };
        }
        const slots = (Array.isArray(plan.slots) ? plan.slots : []).slice(0, 3);
        while (slots.length < 3) slots.push({ provider: 'ai', model: null });
        // Say on the round what was asked for, and whether (and why) the pool filled a slot.
        await s.db.exec('UPDATE arena_rounds SET offers = $1::jsonb, pool_fallback = $2 WHERE id = $3',
            [JSON.stringify(slots), Boolean(plan.pool_fallback), round.id]);
        let ok = 0;
        for (let i = 0; i < 3; i++) {
            const slot = slots[i] || { provider: 'ai', model: null };
            try {
                const out = await ai.generate({ prompt: round.prompt, category: round.category, slot, roundId: round.id, index: i });
                await s.db.exec(`INSERT INTO arena_outputs (id, "round", model, provider, html, cost_usd, ms, tokens, error, ui_check, created_at)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9, $10::timestamptz)`,
                [`aro_${require('openvibe-contracts').ids.ulid(s.now())}`, round.id, out.model, out.provider, out.html,
                    out.cost_usd, out.ms, out.tokens, out.ui_check == null ? null : JSON.stringify(out.ui_check), s.iso()]);
                ok++;
            } catch (err) {
                const detail = String((err && (err.detail || err.message)) || err).slice(0, ERROR_MAX);
                log.warn(`[OpenVibe.Design] Arena round ${round.id} output ${i} failed:`, detail);
                await s.db.exec(`INSERT INTO arena_outputs (id, "round", model, provider, html, cost_usd, ms, tokens, error, ui_check, created_at)
                                 VALUES ($1, $2, $3, $4, '', 0, 0, 0, $5, NULL, $6::timestamptz)`,
                [`aro_${require('openvibe-contracts').ids.ulid(s.now())}`, round.id,
                    String((slot && slot.model) || 'unknown').slice(0, 120), String((slot && slot.provider) || 'ai').slice(0, 80), detail, s.iso()]);
            }
        }
        await s.db.exec('UPDATE arena_rounds SET status = $1 WHERE id = $2', [ok >= 2 ? 'ready' : 'failed', round.id]);
        return ok;
    }

    async function tick() {
        if (running || stopped) return null;
        running = true;
        try {
            const round = await claim();
            if (!round) return null;
            try {
                await generateRound(round);
                return await arena.getRound(round.id);
            } catch (err) {
                log.warn('[OpenVibe.Design] Arena round failed:', (err && err.message) || err);
                await s.db.exec("UPDATE arena_rounds SET status = 'failed' WHERE id = $1", [round.id]).catch(() => {});
                throw err;
            }
        } finally {
            running = false;
        }
    }

    function start() {
        if (timer || stopped || config.drill) return null;
        const run = () => tick().catch((err) => log.warn('[OpenVibe.Design] Arena job:', (err && err.message) || err));
        timer = setInterval(run, config.arena.intervalMs);
        if (timer.unref) timer.unref();
        run();
        return timer;
    }

    function stop() {
        stopped = true;
        if (timer) clearInterval(timer);
        timer = null;
    }

    return { tick, start, stop, claim, generateRound, get running() { return running; } };
}

module.exports = { createArenaJobs };
