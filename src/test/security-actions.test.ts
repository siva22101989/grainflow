import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteStorageRecord } from '../lib/data';

// Mock Supabase
const mockSupabase = {
    auth: {
        getUser: vi.fn(),
    },
    from: vi.fn(),
};

// Mock createClient
vi.mock('@/utils/supabase/server', () => ({
    createClient: () => Promise.resolve(mockSupabase),
}));

// Mock revalidatePath
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

describe('Security: Server Actions', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('deleteStorageRecord', () => {
        it('should block unauthenticated users', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
            
            // Mock record existence so it proceeds to auth check
            mockSupabase.from.mockReturnValueOnce({
                select: () => ({
                    eq: () => ({
                        is: () => ({
                            single: () => Promise.resolve({
                                data: { id: 'rec_123', warehouse_id: 'wh_A' },
                                error: null
                            })
                        })
                    })
                })
            });
            
            // Should throw Unauthorized
            try {
                await deleteStorageRecord('rec_123');
                // If it doesn't throw, fail the test
                expect(true).toBe(false); 
            } catch (e: any) {
                expect(e.message).toMatch(/Unauthorized/i);
            }
        });

        it('should block unauthorized deletion attempt', async () => {
             // 1. Mock logged in user (Staff)
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'staff_1' } } });
            
            // 2. Mock Fetch Record with warehouse_id (includes .is('deleted_at', null))
            mockSupabase.from.mockReturnValueOnce({
                select: () => ({
                    eq: () => ({
                        is: () => ({
                            single: () => Promise.resolve({
                                data: { id: 'rec_123', warehouse_id: 'wh_A', lot_id: 'lot_1', bags_stored: 10 },
                                error: null
                            })
                        })
                    })
                })
            });

            // 3. Mock Assignments Check (User role in warehouse)
            mockSupabase.from.mockReturnValueOnce({
                select: () => ({
                    eq: () => ({
                        eq: () => ({
                            single: () => Promise.resolve({ data: { role: 'staff' }, error: null }) 
                        })
                    })
                })
            });

             // 4. Mock Profile Check (fallback for super_admin)
            mockSupabase.from.mockReturnValueOnce({
                select: () => ({
                    eq: () => ({
                        single: () => Promise.resolve({ data: { role: 'user' }, error: null }) 
                    })
                })
            });

            await expect(deleteStorageRecord('rec_123')).rejects.toThrow(/don't have permission/i);
        });
    });
});
