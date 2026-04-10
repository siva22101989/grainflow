
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const supabase = await createClient(); // This runs as service role if we use the admin client, 
        // But `createClient` from user-utils usually uses headers. 
        // For CRON, we strictly need a SERVICE ROLE client to bypass RLS and delete for ALL users.
        // However, we don't have a direct `createAdminClient` exposed in the snippets I've seen.
        // Let's check if we can rely on standard RLS policies or if we need to implement a secure cleanup function.
        
        // Actually best practice: Call a Database Function (RPC) with `security definer`.
        // This ensures it runs with high privileges regardless of the client content.
        
        const { error } = await supabase.rpc('cleanup_old_notifications');

        if (error) {
             console.error('Cleanup failed:', error);
             return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Old notifications cleaned up' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
