'use server';

import { createClient } from '@/utils/supabase/server';
import { logError } from '@/lib/error-logger';


export interface SystemHealth {
    status: 'online' | 'degraded' | 'offline';
    dbLatency: number;
    timestamp: number;
}

export const checkSystemHealth = async (): Promise<SystemHealth> => {
    const start = Date.now();
    try {
        const supabase = await createClient();
        
        // Simple query to check DB connection
        const { error } = await supabase.from('warehouses').select('count', { count: 'exact', head: true }).limit(1);
        
        if (error) throw error;
        
        const latency = Date.now() - start;
        
        return {
            status: latency > 1000 ? 'degraded' : 'online',
            dbLatency: latency,
            timestamp: Date.now()
        };
    } catch (error) {
        logError(error, { operation: 'systemHealthCheck' });
        return {
            status: 'offline',
            dbLatency: -1,
            timestamp: Date.now()
        };
    }
};
