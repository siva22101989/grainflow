import { NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { ensureCustomerAuthUser } from '@/lib/customer-auth';
import { logError } from '@/lib/error-logger';

const ALLOWED_ROLES = ['super_admin', 'owner', 'admin'] as const;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: customers, error } = await admin
    .from('customers')
    .select('id, phone, name, linked_user_id')
    .is('deleted_at', null)
    .is('linked_user_id', null);

  if (error) {
    logError(error, { operation: 'backfill_list_customers' });
    return NextResponse.json({ error: 'Failed to list customers' }, { status: 500 });
  }

  const summary = { total: customers?.length ?? 0, linked: 0, skipped: 0, errors: 0 };

  for (const c of customers ?? []) {
    if (!c.phone) {
      summary.skipped++;
      continue;
    }
    const userId = await ensureCustomerAuthUser({ phone: c.phone, fullName: c.name });
    if (!userId) {
      summary.errors++;
      continue;
    }
    const { data: refreshed } = await admin
      .from('customers')
      .select('linked_user_id')
      .eq('id', c.id)
      .single();
    if (refreshed?.linked_user_id) {
      summary.linked++;
      continue;
    }
    const { error: linkErr } = await admin
      .from('customers')
      .update({ linked_user_id: userId })
      .eq('id', c.id);
    if (linkErr) {
      logError(linkErr, { operation: 'backfill_link_customer', metadata: { customerId: c.id } });
      summary.errors++;
    } else {
      summary.linked++;
    }
  }

  return NextResponse.json(summary);
}
