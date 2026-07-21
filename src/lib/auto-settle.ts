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
