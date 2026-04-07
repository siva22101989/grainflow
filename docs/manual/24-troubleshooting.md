# Chapter 24: Troubleshooting

This chapter covers common issues administrators encounter, organized by symptom, cause, and fix.

---

## Login and Authentication

### User cannot log in

**Symptoms:** User sees "Invalid credentials" or is redirected back to the login page repeatedly.

**Cause:** The user's Supabase Auth account may not exist, the password may be wrong, or the session cookie may be corrupted.

**Fix:**
1. Verify the user exists in the Supabase Auth dashboard (Authentication > Users).
2. If the account exists, send a password reset email from the Supabase dashboard.
3. If the session seems stuck, have the user clear browser cookies for the application domain and try again.
4. Check that the `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variables are correctly set in production.

---

### User logs in but sees an empty dashboard

**Symptoms:** The user authenticates successfully but the dashboard shows no data -- no customers, no records, no warehouse name.

**Cause:** The user's `profiles` record may not have a `warehouse_id` set, or they may not have an active entry in `warehouse_assignments`.

**Fix:**
1. Check the `profiles` table for the user's row -- verify `warehouse_id` is populated.
2. Check the `warehouse_assignments` table for an active assignment (where `deleted_at IS NULL`).
3. If the assignment was soft-deleted, restore it via **Settings > Team** in the target warehouse or by using `toggleWarehouseAccess()`.

---

## Missing Records (Row Level Security)

### User reports data is missing but it exists in the database

**Symptoms:** A user says they cannot see certain customers, storage records, or payments. A super_admin can see the same data without issues.

**Cause:** Row Level Security (RLS) policies restrict data access based on the user's warehouse assignment. If a user's `warehouse_id` does not match the record's `warehouse_id`, the database returns zero rows -- not an error.

**Fix:**
1. Confirm the user's warehouse assignment in the `warehouse_assignments` table.
2. Confirm the records in question belong to the same `warehouse_id`.
3. If the user was recently moved between warehouses, they will only see data for their current warehouse.
4. RLS never throws an error for missing access -- it silently returns no rows. This is by design to prevent data leakage between tenants.

> **Warning:** Do not disable RLS policies to "fix" missing data issues. Instead, correct the user's warehouse assignment. Disabling RLS would expose all tenant data system-wide.

---

### Newly created record does not appear

**Symptoms:** A user creates a customer or storage record but it does not show in their list immediately.

**Cause:** The record may have been created with the wrong `warehouse_id`, or the page cache has not revalidated.

**Fix:**
1. Hard-refresh the page (Ctrl+Shift+R / Cmd+Shift+R).
2. If still missing, check the database directly -- look for the record and verify its `warehouse_id` matches the user's assignment.
3. Check that the `revalidatePath()` call is present in the server action that created the record.

---

## Permission Errors

### User gets "Forbidden" or "You do not have permission"

**Symptoms:** User clicks an action button and sees a permission error toast or a 403 page.

**Cause:** The user's role does not have the required permission for that action. This check happens both in the UI (button visibility) and in the server action (authorization check).

**Fix:**
1. Check the user's role in `warehouse_assignments` for the current warehouse.
2. Refer to the permission matrix in Chapter 22 to confirm whether the role should have access.
3. If the role should have access, check for a bug in the server action's authorization logic.
4. To change the user's role: go to **Settings > Team**, find the user, and select the appropriate role from the dropdown.

---

### Super admin sees 403 on Admin Panel

**Symptoms:** A user who should be a super_admin gets the "403 Forbidden" page when navigating to `/admin`.

**Cause:** The Admin Panel checks `profiles.role` (the global profile role), not `warehouse_assignments.role`. The user may have `admin` or `owner` as their warehouse role but not `super_admin` or `owner` on their profile.

**Fix:**
1. Check the `profiles` table directly: `SELECT role FROM profiles WHERE id = '<user_id>'`.
2. If the role is not `super_admin` or `owner`, update it directly in the database: `UPDATE profiles SET role = 'super_admin' WHERE id = '<user_id>'`.
3. The user must log out and log back in for the profile role change to take effect.

---

## Payment Link Failures

### Payment link creation fails

**Symptoms:** Clicking "Send Payment Link" shows an error toast. No SMS is sent.

**Cause:** Multiple possible causes in the payment link creation chain.

**Fix:** Check each step in order:

1. **Razorpay credentials:** Verify `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set in environment variables.
2. **Owner phone number:** The system fetches the warehouse owner's phone from `profiles.phone` via the `user_warehouses` join. If the owner has no phone number, the link creation fails with "Owner phone number not available."
3. **Plan configuration:** Verify the target plan exists in the `plans` table and has a valid `price` value.
4. **Razorpay API errors:** Check the error logs (Sentry) for the operation `createSubscriptionPaymentLink`. Razorpay may be rejecting the request due to invalid amount, expired API keys, or account issues.

---

### Payment completed but subscription not activated

**Symptoms:** The customer paid via the Razorpay link, but the subscription still shows as "incomplete" or "unpaid."

**Cause:** The webhook from Razorpay may not have been received or processed successfully.

**Fix:**
1. Check Sentry for errors tagged with operation `activateSubscriptionPayment`.
2. Verify the webhook URL is correctly configured in the Razorpay dashboard (should point to `/api/razorpay/webhook`).
3. Verify the `RAZORPAY_WEBHOOK_SECRET` environment variable matches the secret configured in Razorpay.
4. Check for idempotency: if the `subscription_payments` table already has a record for this `razorpay_payment_id`, the payment was already processed.
5. As a workaround, manually activate the subscription through **Admin Panel > Subscriptions** -- edit the warehouse, set the plan, status to `active`, and set the expiry date.

---

## SMS Not Sending

### SMS fails with "SMS service is disabled for trial users"

**Symptoms:** Attempting to send any SMS returns this error message.

**Cause:** The warehouse does not have SMS permission. SMS requires either an environment whitelist entry or a plan with `allow_sms: true`.

**Fix:**
1. Add the warehouse ID to the `SMS_ALLOWED_WAREHOUSES` environment variable (comma-separated).
2. Or add the user's ID to `SMS_ALLOWED_USERS`.
3. Or ensure the warehouse's subscription plan includes `"allow_sms": true` in its features JSON column.

---

### SMS fails with "TextBee Device ID not configured"

**Symptoms:** SMS operations fail with this specific error.

**Cause:** The `TEXTBEE_DEVICE_ID` environment variable is not set.

**Fix:**
1. Log in to your TextBee dashboard at textbee.dev.
2. Navigate to Devices and find your registered Android device.
3. Copy the Device ID.
4. Add it to your environment: `TEXTBEE_DEVICE_ID=<your_device_id>`.
5. Restart the application for the change to take effect.

---

### SMS fails with "Invalid phone number"

**Symptoms:** SMS returns "Invalid phone number. Must be 10 digits."

**Cause:** The customer's phone number in the database is not a valid 10-digit Indian number. The system strips the `+91` prefix and non-digit characters before validation.

**Fix:**
1. Edit the customer record and correct the phone number to a valid 10-digit number.
2. Avoid storing country codes or special characters in the phone field -- the system adds `+91` automatically.

---

### SMS sent but customer did not receive it

**Symptoms:** The system reports SMS sent successfully (no error), but the recipient did not get the message.

**Cause:** The TextBee Android device may be offline, out of SMS credits, or have poor network connectivity.

**Fix:**
1. Check the TextBee dashboard for the message delivery status.
2. Verify the Android device is powered on, connected to the internet, and has mobile network signal.
3. Check the `sms_logs` table for the message record and its status.
4. Try sending a test SMS from the TextBee dashboard directly to rule out API issues.

---

## Subscription Not Activating

### Code redemption fails with "Invalid code"

**Symptoms:** A warehouse owner enters an activation code and gets "Invalid code."

**Cause:** The code may be mistyped, already used, or not in the database.

**Fix:**
1. Check the `subscription_codes` table for the code string (codes are case-insensitive -- the system converts to uppercase).
2. Verify the code's `status` is `available`. If it is `used` or `revoked`, it cannot be redeemed again.
3. Have the admin generate a new code if needed.

---

### Code redeemed but subscription shows wrong end date

**Symptoms:** After redeeming a code, the subscription end date is earlier than expected.

**Cause:** If the warehouse had no active subscription (or an expired one), the duration starts from today. If it had an active subscription with a future end date, the duration is added to the existing end date. The issue may be that the admin expected stacking but the current subscription was already expired.

**Fix:**
1. Check the `subscriptions` table for the warehouse's `current_period_end`.
2. If incorrect, manually adjust via **Admin Panel > Subscriptions** -- edit the warehouse and set the correct expiry date.

---

## Performance and General Issues

### Admin Panel loads slowly

**Symptoms:** The Admin Panel takes several seconds to render.

**Cause:** The Admin Panel loads all warehouses, all users, analytics data, all subscriptions, and all codes in a single server-side render. On large platforms, this can be slow.

**Fix:**
1. This is expected for platforms with many warehouses. The data is fetched server-side so the user sees a complete page on load.
2. Monitor Sentry performance traces for the `/admin` route to identify the slowest query.
3. Consider adding database indexes if specific queries are slow.

---

### Audit log shows "unknown" IP address

**Symptoms:** Some audit log entries show "unknown" instead of an IP address.

**Cause:** The `x-forwarded-for` and `x-real-ip` headers were not present in the request. This can happen with certain proxy configurations or when actions are triggered by cron jobs / background processes.

**Fix:**
1. For web requests, ensure your hosting provider (Vercel, etc.) forwards the `x-forwarded-for` header.
2. For cron-triggered actions, "unknown" is expected since there is no client IP.
