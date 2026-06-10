/**
 * Payment vs. waiver accounting.
 *
 * A "waiver" (a.k.a. discount) is stored as a payment row so that it reduces a
 * record's balance automatically wherever balance is computed as
 * `billed - sum(payments)`. But a waiver is NOT cash received — it must never
 * be reported as money collected. This helper is the single source of truth
 * for splitting a record's payment rows into actual cash vs. waived amount.
 */

export type PaymentLike = {
    amount: number;
    type?: string | null;
};

export type PaymentSummary = {
    /** Real money received (everything except waivers). */
    cashPaid: number;
    /** Amount forgiven via discount/waiver. Reduces balance, not cash. */
    waived: number;
    /** Total credit against the bill (cashPaid + waived) — i.e. what reduces balance. */
    totalCredit: number;
};

export function isWaiver(type?: string | null): boolean {
    return type === 'waiver';
}

/**
 * Split a set of payment rows into cash received vs. waived (discounted).
 * Deleted rows must be filtered out by the caller (this mirrors existing
 * call sites that already apply `.is('deleted_at', null)` / filter deleted).
 */
export function summarizePayments(payments: readonly PaymentLike[] = []): PaymentSummary {
    let cashPaid = 0;
    let waived = 0;

    for (const p of payments) {
        const amount = p.amount || 0;
        if (isWaiver(p.type)) {
            waived += amount;
        } else {
            cashPaid += amount;
        }
    }

    return { cashPaid, waived, totalCredit: cashPaid + waived };
}
