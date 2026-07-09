import { describe, it, expect } from 'vitest';
import { mapRecords } from '@/lib/queries/storage';

/**
 * Regression: mapRecords used to map hamaliPayable and totalRentBilled but NOT
 * insurancePayable, so insurance charges were silently dropped from every
 * per-record billing surface (outflow, bulk outflow, customer statement),
 * under-billing customers by their insurance amount.
 */
describe('mapRecords insurance mapping', () => {
    const rawRow = {
        id: 'rec-1',
        record_number: 181,
        customer_id: 'cust-1',
        commodity_description: 'Maize',
        location: 'C4',
        storage_start_date: '2026-04-20T00:00:00Z',
        storage_end_date: null,
        bags_in: 283,
        bags_stored: 283,
        hamali_payable: 7075,
        insurance_payable: 1698,
        total_rent_billed: 0,
        payments: [],
        withdrawal_transactions: [],
    };

    it('maps insurance_payable to insurancePayable', () => {
        const [mapped] = mapRecords([rawRow]);
        expect(mapped!.insurancePayable).toBe(1698);
    });

    it('still maps hamali and rent alongside insurance', () => {
        const [mapped] = mapRecords([rawRow]);
        expect(mapped!.hamaliPayable).toBe(7075);
        expect(mapped!.totalRentBilled).toBe(0);
    });

    it('defaults insurance to 0 when the column is null/absent', () => {
        const [mapped] = mapRecords([{ ...rawRow, insurance_payable: null }]);
        expect(mapped!.insurancePayable).toBe(0);
    });

    it('includes insurance in the outstanding balance (billed - paid)', () => {
        // The exact scenario from record #181: hamali 7075 + insurance 1698 = 8773
        // billed at inflow, 7100 paid, so 1673 is still pending. Before the fix
        // insurance was dropped and this looked like a 25 advance instead.
        const [mapped] = mapRecords([rawRow]);
        const billed =
            mapped!.hamaliPayable +
            (mapped!.insurancePayable || 0) +
            (mapped!.totalRentBilled || 0);
        const paid = 7100;
        expect(billed - paid).toBe(1673);
    });
});
