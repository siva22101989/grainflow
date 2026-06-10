import { describe, it, expect } from 'vitest';
import { summarizePayments, isWaiver } from '@/lib/payment-summary';

describe('payment-summary', () => {
    describe('isWaiver', () => {
        it('should be true only for the waiver type', () => {
            expect(isWaiver('waiver')).toBe(true);
            expect(isWaiver('rent')).toBe(false);
            expect(isWaiver('hamali')).toBe(false);
            expect(isWaiver(undefined)).toBe(false);
            expect(isWaiver(null)).toBe(false);
        });
    });

    describe('summarizePayments', () => {
        it('should return zeros for no payments', () => {
            expect(summarizePayments([])).toEqual({ cashPaid: 0, waived: 0, totalCredit: 0 });
            expect(summarizePayments()).toEqual({ cashPaid: 0, waived: 0, totalCredit: 0 });
        });

        it('should count rent/hamali/other as cash, not waived', () => {
            const result = summarizePayments([
                { amount: 100, type: 'rent' },
                { amount: 50, type: 'hamali' },
                { amount: 25, type: 'other' },
                { amount: 10, type: undefined },
            ]);
            expect(result.cashPaid).toBe(185);
            expect(result.waived).toBe(0);
            expect(result.totalCredit).toBe(185);
        });

        it('should separate waivers from cash but include both in totalCredit', () => {
            const result = summarizePayments([
                { amount: 800, type: 'rent' },
                { amount: 200, type: 'waiver' },
            ]);
            expect(result.cashPaid).toBe(800);
            expect(result.waived).toBe(200);
            // totalCredit is what reduces the balance: billed - totalCredit
            expect(result.totalCredit).toBe(1000);
        });

        it('should handle a pure waiver (full balance forgiven)', () => {
            const result = summarizePayments([{ amount: 500, type: 'waiver' }]);
            expect(result.cashPaid).toBe(0);
            expect(result.waived).toBe(500);
            expect(result.totalCredit).toBe(500);
        });

        it('should tolerate missing amounts', () => {
            const result = summarizePayments([
                { amount: 0, type: 'rent' },
                { amount: undefined as unknown as number, type: 'waiver' },
            ]);
            expect(result.cashPaid).toBe(0);
            expect(result.waived).toBe(0);
            expect(result.totalCredit).toBe(0);
        });
    });
});
