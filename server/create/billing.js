'use strict';

/**
 * The person's Balance, for the estimate's "does it cover it" line.
 *
 * A run on a managed model is charged in USD against the person's Billing Balance (the same account AI's
 * credit holds use). Billing answers `/api/me/balance` for the person's own Network token; Design reads only
 * the personal side (`available_nano_usd`, after holds). A missing or disabled Balance is null, never zero:
 * the estimate says it does not know rather than that the person is broke.
 */

const NANO_PER_USD = 1_000_000_000;

function createBalanceReader({ config = {}, fetchImpl = globalThis.fetch, log = console } = {}) {
    const base = String((config.billing && config.billing.internalUrl) || '').replace(/\/+$/, '');
    const timeoutMs = Math.max(500, Number(config.billing && config.billing.timeoutMs) || 3000);

    /** → { currency, balance_usd, held_usd, available_usd } or null. Never throws. */
    async function read(token) {
        if (!token || !base) return null;
        let res;
        try {
            res = await fetchImpl(`${base}/api/me/balance`, {
                headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
                signal: AbortSignal.timeout(timeoutMs),
            });
        } catch {
            return null;
        }
        const body = await res.json().catch(() => null);
        if (!res.ok) {
            // 404 billing.not_enabled and 409 billing.not_authoritative mean "no Balance here", not a person with $0.
            if (res.status !== 404 && res.status !== 409) log.warn('[OpenVibe.Design] Balance read:', res.status);
            return null;
        }
        const personal = body && body.personal;
        if (!personal || personal.available_nano_usd == null) return null;
        const nano = (value) => {
            const n = Number(value);
            return Number.isFinite(n) && n >= 0 ? Math.round(n) / NANO_PER_USD : null;
        };
        const available = nano(personal.available_nano_usd);
        if (available == null) return null;
        return {
            currency: 'USD',
            balance_usd: nano(personal.balance_nano_usd),
            held_usd: nano(personal.held_nano_usd),
            available_usd: available,
        };
    }

    return { read, get enabled() { return Boolean(base); } };
}

module.exports = { createBalanceReader, NANO_PER_USD };
