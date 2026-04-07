# Chapter 21: Subscription Management

GrainFlow uses a tiered subscription model to control feature access and usage limits per warehouse. The super_admin manages all subscriptions through the Admin Panel's **Subscriptions** and **Codes** tabs.

## Plan Tiers and Limits

The platform defines four plan tiers. Each tier controls two primary limits and gates access to specific features:

### Usage Limits

| Resource | Free | Starter | Professional | Enterprise |
|---|---|---|---|---|
| **Storage Records** | 100 | 10,000 | 100,000 | 1,000,000 |
| **Team Members** | 1 | 3 | 10 | 50 |

### Feature Gates

| Feature | Minimum Tier |
|---|---|
| Advanced Reports Export | Starter |
| WhatsApp Notifications | Starter |
| Analytics Dashboard | Professional |
| Multiple Warehouses | Professional |
| API Access | Enterprise |

Plans can be billed monthly or yearly (e.g., `starter_monthly`, `professional_yearly`). The billing period does not affect limits -- only the pricing and renewal cycle differ.

## Subscription Statuses

Each subscription has a status that determines access level:

| Status | Meaning |
|---|---|
| `active` | Paid and operational. Full access to plan features. |
| `incomplete` | Subscription request logged but not yet paid or activated. |
| `trialing` / `trailing_trial` | Trial period active. Full feature access. |
| `past_due` | Payment overdue. Features still accessible temporarily. |
| `grace_period` | Subscription expired. 7-day window to renew before downgrade. |
| `expired` | Grace period ended. Queued for downgrade to Free. |
| `canceled` | Manually canceled by admin or user. |
| `unpaid` | Payment failed repeatedly. |

## Viewing All Subscriptions

Navigate to **Admin Panel > Subscriptions** tab. The table displays every warehouse with:

- Warehouse name and location
- Current plan name and tier
- Subscription status (color-coded badge)
- Expiry date (current_period_end)

Warehouses without a subscription show "No Plan" with no status badge.

## Manually Editing a Subscription

1. Click the **pencil icon** (or **Edit Subscription** on mobile) for the target warehouse.
2. The edit dialog opens with two tabs: **Details** and **Payments**.
3. On the Details tab, set:
   - **Plan** -- select from the dropdown of all available plans
   - **Status** -- choose: Active, Incomplete, Past Due, Canceled, Unpaid, or Trialing
   - **Expiry Date** -- the date when the subscription period ends
4. Click **Save Changes**.

### Activation Safeguards

The system applies automatic safeguards when you save:

- **Setting status to `active` with a future expiry date:** Clears any grace period data and resets the `grace_period_notified` flag. This handles manual renewals during a grace period.
- **Setting status to `grace_period`:** Automatically calculates a `grace_period_end` date 7 days after the expiry date.
- **Changing from `grace_period` to any non-expired status:** Clears all grace period data.

> **Warning:** Setting a subscription to `active` without an expiry date means it has no automatic expiration. The warehouse will remain on the selected plan indefinitely until manually changed.

## Subscription Code Generation

Activation codes allow offline or manual subscription distribution. Codes follow the format `XXXX-XXXX-XXXX` using an unambiguous character set (no I/1/O/0 confusion).

### Generating Codes

1. Go to **Admin Panel > Codes** tab.
2. Click **Generate Codes**.
3. In the dialog, configure:
   - **Plan** -- which plan the code activates
   - **Duration (Days)** -- how many days the subscription lasts after redemption
   - **Quantity** -- number of codes to generate (1-50)
   - **Notes (Internal)** -- optional reference like "Bulk order for Client X, Payment Ref #123"
4. Click **Generate**.
5. The generated codes appear in a list. Click **Copy All** to copy them to clipboard.

### Code Lifecycle

| Status | Meaning |
|---|---|
| `available` | Code is valid and can be redeemed |
| `used` | Code has been redeemed by a warehouse |
| `revoked` | Code was manually disabled by admin |

### Code Redemption (User Side)

When a warehouse owner redeems a code:

1. The code is validated against the `subscription_codes` table.
2. If valid and `available`, it is marked as `used` with optimistic locking (`WHERE status = 'available'`).
3. The subscription is upserted for the warehouse with the code's plan and duration.
4. If the warehouse already has an active subscription with a future expiry date, the new duration is **added** to the existing end date (stacking).

> **Warning:** If the subscription upsert fails after the code is marked as used, the code is burned. The error message instructs the user to contact support with the code string. Monitor error logs for `redeemCodeAction_subUpdate` failures.

## Handling Expired Subscriptions

Subscription expiry is processed automatically by a cron job / edge function that calls `processExpiredSubscriptions()`. The lifecycle is:

```
active (past expiry) --> grace_period (7 days) --> expired --> downgrade to Free
```

### Grace Period

When a subscription's `current_period_end` passes:

1. Status changes to `grace_period`.
2. A `grace_period_end` is set to 7 days after the original expiry.
3. An in-app notification is sent to the warehouse: "Your subscription expired. You have X days to renew."
4. The `grace_period_notified` flag prevents duplicate notifications.

### Expiry and Downgrade

When the grace period ends:

1. Status changes to `expired`.
2. The subscription is downgraded to the Free plan.
3. A downgrade notification is sent: "Your subscription has been downgraded to the Free plan."

### Proactive Expiry Warnings

A daily cron job calls `sendExpiryWarnings()` to notify warehouses **before** expiry. Warnings are sent at:

- 7 days before expiry
- 3 days before expiry
- 1 day before expiry

### Manual Expiry Processing

In emergencies or for testing, super admins can trigger expiry processing manually. This is restricted to the `super_admin` role and calls the same `auto_expire_subscriptions` database function.

## Razorpay Payment Integration

Subscription payments are processed through Razorpay payment links:

1. A payment link is created with the plan price and warehouse owner's details.
2. The link is sent via SMS to the owner's phone number.
3. The link expires after 3 days.
4. On successful payment, a webhook activates the subscription automatically.

The webhook handler performs idempotency checks (prevents double-activation) and validates the payment amount against the plan price with a tolerance of 1 rupee.

After activation, a confirmation SMS is sent to the owner with the plan name and validity period.
