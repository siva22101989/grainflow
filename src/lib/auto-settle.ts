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

/** A customer's payments split by what charge they were made toward. */
export type PaidByType = { hamali: number; insurance: number; rent: number; general: number };

/**
 * Split a list of payments into per-charge buckets. A payment's TYPE decides
 * which charge it pays down: 'hamali' -> hamali, 'insurance' -> insurance,
 * 'rent' -> rent. Everything else (advance / security_deposit / other / waiver /
 * untyped) is "general" money that falls back to the hamali->insurance->rent
 * waterfall. Caller should pass non-deleted payments.
 */
export function sumPaidByType(payments: { amount: number; type?: string | null }[]): PaidByType {
    const acc: PaidByType = { hamali: 0, insurance: 0, rent: 0, general: 0 };
    for (const p of payments || []) {
        const amt = Math.max(0, p.amount || 0);
        if (p.type === 'hamali') acc.hamali += amt;
        else if (p.type === 'insurance') acc.insurance += amt;
        else if (p.type === 'rent') acc.rent += amt;
        else acc.general += amt; // advance, security_deposit, other, waiver, null
    }
    return acc;
}

/**
 * Distributes a customer's payments across their records oldest-first and returns
 * each record's residual per-charge dues.
 *
 * Respects payment TYPE: a 'hamali' payment reduces hamali, 'rent' reduces rent,
 * etc. — so "I paid rent" actually lowers pending rent, not hamali. Only leftover
 * money (untyped payments, or a charge paid past its billed amount) falls back to
 * the hamali -> insurance -> rent waterfall.
 *
 * Pooling across lots also means a lump paid onto one lot credits the customer's
 * other lots, so the sum of residual dues always equals (total billed − total
 * paid) — matching the customer balance.
 *
 * `records` MUST be oldest-first.
 */
export function poolChargeDuesAcrossRecords<T extends {
    hamaliPayable: number; insurancePayable: number; rentBilled: number;
}>(records: T[], paid: PaidByType): (T & ChargeDues & { totalDue: number })[] {
    // Mutable residual dues per record.
    const rows = records.map((r) => ({
        ref: r,
        hamaliDue: Math.max(0, r.hamaliPayable || 0),
        insuranceDue: Math.max(0, r.insurancePayable || 0),
        rentDue: Math.max(0, r.rentBilled || 0),
    }));

    // Apply a pool against one charge across all lots (oldest-first); return leftover.
    const applyToCharge = (key: 'hamaliDue' | 'insuranceDue' | 'rentDue', amount: number): number => {
        let pool = Math.max(0, amount);
        for (const row of rows) {
            if (pool <= 0) break;
            const applied = Math.min(pool, row[key]);
            row[key] -= applied;
            pool -= applied;
        }
        return pool;
    };

    // 1. Typed payments reduce their own charge first (oldest lot first). Any
    //    overflow (a charge paid past its billed amount) becomes general money.
    let general = Math.max(0, paid.general || 0);
    general += applyToCharge('hamaliDue', paid.hamali || 0);
    general += applyToCharge('insuranceDue', paid.insurance || 0);
    general += applyToCharge('rentDue', paid.rent || 0);

    // 2. General money (untyped payments + typed overflow) fills remaining dues
    //    via the hamali -> insurance -> rent waterfall. Leftover is advance credit.
    general = applyToCharge('hamaliDue', general);
    general = applyToCharge('insuranceDue', general);
    applyToCharge('rentDue', general);

    return rows.map(({ ref, hamaliDue, insuranceDue, rentDue }) => ({
        ...ref,
        hamaliDue,
        insuranceDue,
        rentDue,
        totalDue: hamaliDue + insuranceDue + rentDue,
    }));
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
