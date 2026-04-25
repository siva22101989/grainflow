'use server';

import { createAdminClient } from '@/utils/supabase/admin';
import { logError } from '@/lib/error-logger';

const DEFAULT_CUSTOMER_PASSWORD = process.env.CUSTOMER_DEFAULT_PASSWORD || '123456';

function customerLoginEmail(phone: string): string | null {
  const last10 = phone.replace(/\D/g, '').slice(-10);
  if (!/^\d{10}$/.test(last10)) return null;
  return `${last10}@rentapp.local`;
}

async function findUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  const perPage = 1000;
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find((u) => u.email === email);
    if (found) return found;
    if (data.users.length < perPage) return null;
    page++;
  }
}

export async function ensureCustomerAuthUser(opts: {
  phone: string;
  fullName?: string;
}): Promise<string | null> {
  const email = customerLoginEmail(opts.phone);
  if (!email) return null;

  const admin = createAdminClient();
  try {
    const existing = await findUserByEmail(admin, email);
    if (existing) return existing.id;
  } catch (error) {
    logError(error, { operation: 'lookup_customer_auth_user', metadata: { phone: opts.phone } });
    return null;
  }

  const last10 = email.split('@')[0];
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEFAULT_CUSTOMER_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: opts.fullName ?? '',
      phone_number: last10,
      role: 'customer',
    },
  });
  if (error || !data.user) {
    logError(error, { operation: 'create_customer_auth_user', metadata: { phone: opts.phone } });
    return null;
  }
  return data.user.id;
}
