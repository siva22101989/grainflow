import { describe, it, expect } from 'vitest';
import { resolveInflowLotLocation } from '@/lib/storage-location';

describe('resolveInflowLotLocation', () => {
    it('uses the assigned lot name as the printed LOT NO. (source of truth)', () => {
        // Regression: changing the Lot dropdown to C4 must update the printed
        // location even though the stale form text still says the old lot "C3".
        expect(resolveInflowLotLocation('C3', 'C4')).toBe('C4');
    });

    it('keeps location in sync when the lot is unchanged', () => {
        expect(resolveInflowLotLocation('C4', 'C4')).toBe('C4');
    });

    it('falls back to free-text location when no lot is linked', () => {
        expect(resolveInflowLotLocation('Shed-7', null)).toBe('Shed-7');
        expect(resolveInflowLotLocation('Shed-7', undefined)).toBe('Shed-7');
    });

    it('does not let a blank lot name override the typed location', () => {
        expect(resolveInflowLotLocation('Shed-7', '')).toBe('Shed-7');
    });
});
