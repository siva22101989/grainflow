import { redirect } from 'next/navigation';

import { createClient } from '@/utils/supabase/server';

/**
 * If the current customer still has the default password, send them to the
 * change-password screen before they can use the rest of the portal.
 * Call from any portal page except `/portal/change-password` and `/portal/login`.
 */
export async function requireCustomerPasswordChanged() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data } = await supabase
    .from('customers')
    .select('must_change_password')
    .eq('linked_user_id', user.id)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (data?.must_change_password) {
    redirect('/portal/change-password');
  }
}
