import { createClient } from '@/utils/supabase/server';
import { headers } from 'next/headers';
import { logError, logWarning } from './error-logger';
import { AuditAction, AuditEntity } from '@/types/db';

export { AuditAction, AuditEntity };

interface AuditLogParams {
    action: AuditAction;
    entity: AuditEntity;
    entityId: string;
    details?: Record<string, any>;
    warehouseId: string;
    actorUserId?: string;
}

export async function logActivity({
    action,
    entity,
    entityId,
    details = {},
    warehouseId,
    actorUserId
}: AuditLogParams) {
    try {
        const supabase = await createClient();
        
        // Get IP address safely
        const heads = await headers();
        const ip = heads.get('x-forwarded-for') || heads.get('x-real-ip') || 'unknown';
        
        let userId = actorUserId;
        if (!userId) {
            const { data: { user } } = await supabase.auth.getUser();
            userId = user?.id;
        }
        
        if (!userId) {
            logWarning('Attempted to log activity without authenticated user', {
                operation: 'logActivity',
            });
            return;
        }

        const { error } = await supabase.from('audit_logs').insert({
            warehouse_id: warehouseId,
            user_id: userId,
            action,
            entity,
            entity_id: entityId,
            details,
            ip_address: ip
        });

        if (error) {
            logError(error, { operation: 'logActivity:insert' });
            // Don't throw, as auditing shouldn't block the main action
            logError(error, { 
                operation: 'logActivity', 
                metadata: { action, entity, warehouseId } 
            });
        }
    } catch (err) {
        logError(err, { operation: 'logActivity' });
        logError(err, { 
            operation: 'logActivity_Unknown', 
            metadata: { action, entity, warehouseId } 
        });
    }
}
