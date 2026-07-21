import { describe, it, expect } from 'vitest';
import { computeAutoSettle, computeChargeDues, splitPaymentAllCharges } from '@/lib/auto-settle';

describe('computeChargeDues', () => {
    it('splits pending across hamali -> insurance -> rent', () => {
        expect(computeChargeDues({ hamaliPayable: 1000, insurancePayable: 200, rentBilled: 500, totalPaid: 0 }))
            .toEqual({ hamaliDue: 1000, insuranceDue: 200, rentDue: 500 });
    });

    it('applies payment to hamali first', () => {
        expect(computeChargeDues({ hamaliPayable: 1000, insurancePayable: 200, rentBilled: 500, totalPaid: 600 }))
            .toEqual({ hamaliDue: 400, insuranceDue: 200, rentDue: 500 });
    });

    it('spills over into insurance then rent once hamali is covered', () => {
        expect(computeChargeDues({ hamaliPayable: 1000, insurancePayable: 200, rentBilled: 500, totalPaid: 1300 }))
            .toEqual({ hamaliDue: 0, insuranceDue: 0, rentDue: 400 });
    });

    it('returns all zero when fully paid', () => {
        expect(computeChargeDues({ hamaliPayable: 1000, insurancePayable: 200, rentBilled: 500, totalPaid: 5000 }))
            .toEqual({ hamaliDue: 0, insuranceDue: 0, rentDue: 0 });
    });

    it('per-charge dues sum to the record total outstanding', () => {
        const d = computeChargeDues({ hamaliPayable: 8000, insurancePayable: 870, rentBilled: 1200, totalPaid: 5000 });
        expect(d.hamaliDue + d.insuranceDue + d.rentDue).toBe(8000 + 870 + 1200 - 5000);
    });
});

describe('splitPaymentAllCharges', () => {
    // 4 bills, oldest first, all different (matches the worked example).
    const bills = [
        { id: 'r1', recordNumber: '1', hamaliDue: 10000, insuranceDue: 1000, rentDue: 5000 },
        { id: 'r2', recordNumber: '2', hamaliDue: 8000, insuranceDue: 0, rentDue: 4000 },
        { id: 'r3', recordNumber: '3', hamaliDue: 20000, insuranceDue: 2000, rentDue: 3000 },
        { id: 'r4', recordNumber: '4', hamaliDue: 5000, insuranceDue: 500, rentDue: 2000 },
    ];

    it('collects ALL hamali (oldest first) before any insurance or rent', () => {
        // 40k < total hamali (43k) -> everything is hamali.
        const out = splitPaymentAllCharges(bills, 40000);
        expect(out.every(a => a.type === 'hamali')).toBe(true);
        expect(out.reduce((s, a) => s + a.amount, 0)).toBe(40000);
        // r4 hamali is only partially covered (2k of 5k), r1..r3 fully.
        expect(out).toEqual([
            { recordId: 'r1', recordNumber: '1', amount: 10000, type: 'hamali' },
            { recordId: 'r2', recordNumber: '2', amount: 8000, type: 'hamali' },
            { recordId: 'r3', recordNumber: '3', amount: 20000, type: 'hamali' },
            { recordId: 'r4', recordNumber: '4', amount: 2000, type: 'hamali' },
        ]);
    });

    it('spills into insurance then rent once all hamali is cleared', () => {
        // 50k: 43k hamali (all), then 7k toward insurance (3.5k) then rent.
        const out = splitPaymentAllCharges(bills, 50000);
        const byType = (t: string) => out.filter(a => a.type === t).reduce((s, a) => s + a.amount, 0);
        expect(byType('hamali')).toBe(43000);   // every bill's hamali
        expect(byType('insurance')).toBe(3500); // 1000+0+2000+500
        expect(byType('rent')).toBe(3500);      // remainder
        expect(out.reduce((s, a) => s + a.amount, 0)).toBe(50000);
    });

    it('skips charges with zero due (no r2 insurance slice)', () => {
        const out = splitPaymentAllCharges(bills, 50000);
        expect(out.some(a => a.recordId === 'r2' && a.type === 'insurance')).toBe(false);
    });

    it('stops at the amount, leaving later charges untouched', () => {
        const out = splitPaymentAllCharges(bills, 5000);
        expect(out).toEqual([{ recordId: 'r1', recordNumber: '1', amount: 5000, type: 'hamali' }]);
    });
});

describe('computeAutoSettle', () => {
    it('settles the full amount when nothing is paid', () => {
        expect(computeAutoSettle({ hamaliPayable: 5000, insurancePayable: 500, totalPaid: 0 }))
            .toEqual({ hamaliDue: 5000, insuranceDue: 500 });
    });

    it('does NOT double-charge hamali already paid via a rent-typed bulk payment', () => {
        // Regression: record 162 — hamali 14250 already paid as a "Bulk payment
        // allocation" (type rent). Must not auto-settle again.
        expect(computeAutoSettle({ hamaliPayable: 14250, insurancePayable: 0, totalPaid: 14250 }))
            .toEqual({ hamaliDue: 0, insuranceDue: 0 });
    });

    it('does not double-charge hamali+insurance both covered by total paid', () => {
        // Record 165 — hamali 8000 + insurance 870, paid 8870 total.
        expect(computeAutoSettle({ hamaliPayable: 8000, insurancePayable: 870, totalPaid: 8870 }))
            .toEqual({ hamaliDue: 0, insuranceDue: 0 });
    });

    it('settles only the shortfall when partially paid', () => {
        // Paid 5000 against hamali 14250 + insurance 870.
        expect(computeAutoSettle({ hamaliPayable: 14250, insurancePayable: 870, totalPaid: 5000 }))
            .toEqual({ hamaliDue: 9250, insuranceDue: 870 });
    });

    it('applies leftover after hamali to insurance', () => {
        // Paid 8500: covers hamali 8000, leaves 500 toward insurance 870.
        expect(computeAutoSettle({ hamaliPayable: 8000, insurancePayable: 870, totalPaid: 8500 }))
            .toEqual({ hamaliDue: 0, insuranceDue: 370 });
    });

    it('never returns negative dues (overpaid)', () => {
        expect(computeAutoSettle({ hamaliPayable: 1000, insurancePayable: 200, totalPaid: 5000 }))
            .toEqual({ hamaliDue: 0, insuranceDue: 0 });
    });
});
