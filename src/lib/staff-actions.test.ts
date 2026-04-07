import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toggleWarehouseAccess } from './staff-actions';

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

// Mock audit-service to avoid headers() call outside request scope
vi.mock('@/lib/audit-service', () => ({
    logActivity: vi.fn().mockResolvedValue(undefined),
}));

// Mock next/cache
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

// Mock subscription-service
vi.mock('@/services/subscription-service', () => ({
    checkSubscriptionLimits: vi.fn().mockResolvedValue({ allowed: true }),
}));

describe('toggleWarehouseAccess', () => {
    const mockUserId = 'user_123';
    const mockWarehouseId = 'wh_123';
    const mockOwnerId = 'owner_123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return unauthorized if no user logged in', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

        const result = await toggleWarehouseAccess(mockUserId, mockWarehouseId);
        expect(result.success).toBe(false);
        expect(result.message).toBe('Unauthorized');
    });

    it('should grant access if owner requests it and no access exists', async () => {
        // 1. Mock logged in user (Owner)
        mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: mockOwnerId } } });

        // 2. Mock Owner Permission Check on Warehouse
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                eq: () => ({
                    eq: () => ({
                        single: () => Promise.resolve({ data: { role: 'owner' } }) // Current user is owner
                    })
                })
            })
        });

        // 3. Mock Check for Existing Access (target user) -> returns null (not found)
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                eq: () => ({
                    eq: () => ({
                        single: () => Promise.resolve({ data: null }) // No existing access
                    })
                })
            })
        });

        // 4. Mock Insert
        mockSupabase.from.mockReturnValueOnce({
            insert: () => Promise.resolve({ error: null })
        });

        const result = await toggleWarehouseAccess(mockUserId, mockWarehouseId, 'staff');
        
        expect(result.success).toBe(true);
        expect(result.message).toContain('granted successfully');
    });

    it('should revoke access if it already exists', async () => {
        // 1. Mock logged in user (Owner)
        mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: mockOwnerId } } });

        // 2. Mock Owner Permission Check
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                eq: () => ({
                    eq: () => ({
                        single: () => Promise.resolve({ data: { role: 'owner' } })
                    })
                })
            })
        });

        // 3. Mock Check for Existing Warehouse Assignment -> Found
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                eq: () => ({
                    eq: () => ({
                         single: () => Promise.resolve({ data: { id: 'assignment_1' } })
                    })
                })
            })
        });

        // 4. Mock Soft Delete (Update)
        mockSupabase.from.mockReturnValueOnce({
            update: () => ({
                eq: () => Promise.resolve({ error: null })
            })
        });

        const result = await toggleWarehouseAccess(mockUserId, mockWarehouseId);

        expect(result.success).toBe(true);
        expect(result.message).toContain('revoked successfully');
    });

    it('should deny access if current user is not owner/admin', async () => {
        // 1. Mock logged in user (Staff)
        mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'staff_user' } } });

        // 2. Mock Permission Check -> Returns staff role (insufficient)
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                eq: () => ({
                    eq: () => ({
                        single: () => Promise.resolve({ data: { role: 'staff' } }) 
                    })
                })
            })
        });

        // 3. Mock Profile Check (fallback for super_admin check) -> Not super admin
        mockSupabase.from.mockReturnValueOnce({
            select: () => ({
                eq: () => ({
                    single: () => Promise.resolve({ data: { role: 'staff' } })
                })
            })
        });

        const result = await toggleWarehouseAccess(mockUserId, mockWarehouseId);
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('Forbidden');
    });
});
