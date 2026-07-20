import { describe, it, expect } from 'vitest';
import { computeAutoSettle } from '@/lib/auto-settle';

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
