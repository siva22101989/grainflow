/**
 * How much hamali / insurance to auto-settle when a record is fully closed.
 *
 * The old logic compared each charge against payments of the SAME type
 * (hamali paid = sum of type='hamali' payments). But bulk payments are recorded
 * as type 'rent' regardless of what they actually pay, so a hamali already paid
 * via a bulk payment looked unpaid and got charged AGAIN — a double payment.
 *
 * Instead, apply the record's TOTAL paid (any type) against hamali first, then
 * insurance. If the customer has already paid enough overall, nothing is
 * auto-settled. This never over-charges.
 */
export function computeAutoSettle(opts: {
    hamaliPayable: number;
    insurancePayable: number;
    totalPaid: number; // sum of ALL non-deleted payments on the record
}): { hamaliDue: number; insuranceDue: number } {
    const hamaliPayable = Math.max(0, opts.hamaliPayable || 0);
    const insurancePayable = Math.max(0, opts.insurancePayable || 0);
    const totalPaid = Math.max(0, opts.totalPaid || 0);

    const hamaliDue = Math.max(0, hamaliPayable - totalPaid);
    const paidAfterHamali = Math.max(0, totalPaid - hamaliPayable);
    const insuranceDue = Math.max(0, insurancePayable - paidAfterHamali);

    return { hamaliDue, insuranceDue };
}
