/**
 * Charge allocation for a storage record.
 *
 * Payments are not reliably tagged with what they paid (bulk payments were
 * historically recorded as type 'rent' regardless), so we can't trust
 * per-type sums. Instead we apply the record's TOTAL paid against its charges
 * in a fixed order: hamali -> insurance -> rent.
 *
 * This single waterfall is the source of truth for:
 *   - what's still pending per charge (Collect Payment screen)
 *   - how much hamali/insurance to auto-settle when a record closes
 * so both always agree and we never charge for something already paid.
 */
export type ChargeDues = {
    hamaliDue: number;
    insuranceDue: number;
    rentDue: number;
};

export function computeChargeDues(opts: {
    hamaliPayable: number;
    insurancePayable: number;
    rentBilled: number;
    totalPaid: number; // sum of ALL non-deleted payments on the record
}): ChargeDues {
    const hamali = Math.max(0, opts.hamaliPayable || 0);
    const insurance = Math.max(0, opts.insurancePayable || 0);
    const rent = Math.max(0, opts.rentBilled || 0);
    let paid = Math.max(0, opts.totalPaid || 0);

    const hamaliDue = Math.max(0, hamali - paid);
    paid = Math.max(0, paid - hamali);

    const insuranceDue = Math.max(0, insurance - paid);
    paid = Math.max(0, paid - insurance);

    const rentDue = Math.max(0, rent - paid);

    return { hamaliDue, insuranceDue, rentDue };
}

/**
 * How much hamali / insurance to auto-settle when a record is fully closed.
 * Delegates to the same waterfall so a charge already covered by ANY payment
 * (including a bulk payment recorded as 'rent') is never charged again.
 */
export function computeAutoSettle(opts: {
    hamaliPayable: number;
    insurancePayable: number;
    totalPaid: number;
}): { hamaliDue: number; insuranceDue: number } {
    const { hamaliDue, insuranceDue } = computeChargeDues({
        hamaliPayable: opts.hamaliPayable,
        insurancePayable: opts.insurancePayable,
        rentBilled: 0,
        totalPaid: opts.totalPaid,
    });
    return { hamaliDue, insuranceDue };
}

/**
 * Names what a net "still-owed" figure actually consists of, so the UI can show
 * an honest label instead of a generic "Old Balance". If only one charge remains
 * it's named directly (e.g. "Insurance (pending)"); a mix stays "Old balance
 * (pending)". Insurance/hamali are billed at inflow, so a single leftover charge
 * is usually this lot's own insurance — not a leftover from a past deal.
 */
export function pendingChargeLabel(dues: { hamaliDue: number; insuranceDue: number; rentDue: number }): string {
    const active: string[] = [];
    if (dues.hamaliDue > 0.005) active.push('Hamali');
    if (dues.insuranceDue > 0.005) active.push('Insurance');
    if (dues.rentDue > 0.005) active.push('Old rent');
    if (active.length === 1) return `${active[0]} (pending)`;
    return 'Old balance (pending)';
}

/**
 * "Everything" bulk payment split. Spreads one amount CHARGE-FIRST: all hamali
 * across every bill (oldest first) is collected before any insurance, and all
 * insurance before any rent. Each slice is returned tagged with its true type
 * so per-charge pending stays exact. Records must be passed oldest-first.
 */
export function splitPaymentAllCharges(
    records: { id: string; recordNumber: string; hamaliDue: number; insuranceDue: number; rentDue: number }[],
    amount: number
): { recordId: string; recordNumber: string; amount: number; type: 'hamali' | 'insurance' | 'rent' }[] {
    let remaining = Math.max(0, amount || 0);
    const out: { recordId: string; recordNumber: string; amount: number; type: 'hamali' | 'insurance' | 'rent' }[] = [];
    const order: { type: 'hamali' | 'insurance' | 'rent'; dueOf: (r: (typeof records)[number]) => number }[] = [
        { type: 'hamali', dueOf: (r) => r.hamaliDue },
        { type: 'insurance', dueOf: (r) => r.insuranceDue },
        { type: 'rent', dueOf: (r) => r.rentDue },
    ];
    for (const charge of order) {
        if (remaining <= 0.01) break;
        for (const r of records) { // oldest first
            if (remaining <= 0.01) break;
            const due = Math.max(0, charge.dueOf(r) || 0);
            if (due <= 0) continue;
            const slice = Math.min(remaining, due);
            out.push({ recordId: r.id, recordNumber: r.recordNumber, amount: slice, type: charge.type });
            remaining -= slice;
        }
    }
    return out;
}
