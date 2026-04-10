import { NextRequest, NextResponse } from 'next/server';
import { updateStorageRecordSimple } from '@/lib/actions/storage/records';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
    try {
        // Auth check: reject unauthenticated requests
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse request body
        const body = await request.json();
        const { id, ...formData } = body;

        const result = await updateStorageRecordSimple(id, formData);
        
        return NextResponse.json(result);
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
