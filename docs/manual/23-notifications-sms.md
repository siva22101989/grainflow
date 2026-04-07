# Chapter 23: Notifications and SMS

GrainFlow provides two notification channels: **in-app notifications** (the notification center) and **SMS messages** via the TextBee integration. Both channels can be configured per-warehouse.

## In-App Notifications

### Notification Center

The notification center is accessible from the bell icon in the application header. It displays notifications scoped to the current warehouse and the current user.

Notifications have the following properties:

| Field | Description |
|---|---|
| **Title** | Short headline (e.g., "Payment Received") |
| **Message** | Detailed notification body |
| **Type** | `info`, `warning`, `error`, or `success` -- controls the visual style |
| **Category** | Grouping label: `subscription`, `payment`, `storage`, `system` |
| **Read status** | Tracked per-user via the `notification_reads` table |

### Managing Notifications

- **Mark as read:** Click on a notification to mark it as read. The read state is tracked in a separate `notification_reads` join table keyed on `(notification_id, user_id)`.
- **Mark all as read:** Use the "Mark all as read" action to bulk-update all unread notifications. This processes in chunks of 1,000 for performance.

### Notification Preferences

Each user can configure which notification types they receive per warehouse. Navigate to **Settings > Notifications** to toggle:

| Setting | Description | Default |
|---|---|---|
| **Payment Received** | Notify when a payment is recorded | On |
| **Low Stock Alert** | Notify when stock levels are low | On |
| **Pending Dues** | Notify about overdue payments | On |
| **New Inflow** | Notify when new storage is created | On |
| **New Outflow** | Notify when withdrawal occurs | On |

Each setting can be toggled independently for three delivery channels:

| Channel | Description |
|---|---|
| **In-App** | Shows in the notification center |
| **Email** | Sends to the user's registered email |
| **SMS** | Sends via TextBee (requires SMS to be enabled) |

### System-Generated Notifications

The following notifications are generated automatically:

| Event | Type | Category |
|---|---|---|
| Subscription expiring in 7/3/1 days | warning | subscription |
| Subscription entered grace period | warning | subscription |
| Subscription downgraded to Free | error | subscription |
| Subscription activated via payment | success | subscription |

---

## SMS Integration (TextBee)

GrainFlow uses TextBee as its SMS gateway. TextBee works by routing SMS through an Android device registered to your TextBee account, making it cost-effective for Indian phone numbers.

### Prerequisites

Before SMS will work, you need:

1. A TextBee account (sign up at textbee.dev)
2. The TextBee Android app installed on a device
3. The device registered and connected in your TextBee dashboard

### Environment Configuration

Set the following environment variables in your `.env.local` (development) or in your hosting provider's environment settings (production):

| Variable | Description | Example |
|---|---|---|
| `TEXTBEE_API_KEY` | Your TextBee API key from the dashboard | `tb_api_xxxxxxxx` |
| `TEXTBEE_DEVICE_ID` | The device ID from your TextBee dashboard | `64a1b2c3d4e5f6` |

Both values are required. If either is missing, the service logs a warning on startup and all SMS operations return an error.

### SMS Permission Model

SMS is not available to all warehouses by default. Access is controlled through a layered permission check:

1. **Environment whitelist (highest priority):** Set `SMS_ALLOWED_USERS` or `SMS_ALLOWED_WAREHOUSES` as comma-separated IDs in environment variables to grant access regardless of plan.
2. **Plan feature flag:** If the warehouse's subscription plan has `allow_sms: true` in its features JSON, SMS is enabled.
3. **Default:** If neither condition is met, SMS is blocked with the message "SMS service is disabled for trial users."

### Per-Warehouse SMS Settings

Each warehouse can toggle specific SMS message types on or off. Navigate to **Settings > SMS** to configure:

| Setting | Description | Default |
|---|---|---|
| **Payment Reminders** | Send SMS when payment is overdue | On |
| **Inflow Welcome** | Send SMS when new storage is created | Off |
| **Outflow Confirmation** | Send SMS when withdrawal is processed | Off |
| **Payment Confirmation** | Send SMS when payment is received | Off |

These settings are stored in the `sms_settings` table per warehouse. Default settings are created automatically on first access.

### SMS Templates

All SMS messages follow a structured format. The TextBee service formats messages automatically. Phone numbers are validated to 10 digits (Indian format) with the `+91` prefix added automatically.

#### Payment Reminder

```
{WarehouseName}
Payment Due: Rs.{Amount}
Record: {RecordNumber}
Customer: {CustomerName}
Please clear dues at earliest.
```

#### Payment Confirmation

```
{WarehouseName}
Payment Received: Rs.{Amount}
Record: {RecordNumber}
Thank you, {CustomerName}!
```

#### Inflow Welcome (Storage Started)

```
{WarehouseName}
Storage Started
Record: {RecordNumber}
Customer: {CustomerName}
Item: {Commodity}
Bags: {BagCount}
Location: {Location}
Date: {StorageDate}
```

#### Outflow Confirmation (Withdrawal)

```
{WarehouseName}
Withdrawal Confirmed
Invoice: {InvoiceNumber}
Record: {RecordNumber}
Customer: {CustomerName}
Item: {Commodity}
Bags Withdrawn: {BagCount}
Rent: Rs.{RentAmount}
Hamali: Rs.{HamaliAmount}
Total: Rs.{TotalAmount}
Thank you!
```

#### Drying Finalization

```
{WarehouseName}
Drying Finalized
Record: {RecordNumber}
Customer: {CustomerName}
Item: {Commodity}
Final Bags: {BagCount}
Hamali: Rs.{HamaliAmount}
Stock Updated.
```

#### Subscription Payment Link

```
Upgrade to {PlanName} (Rs.{Price}). Pay: {PaymentLink}
- {BusinessName}
```

#### Subscription Activation Confirmation

```
{PlanName} activated! Valid until {ExpiryDate}
- {BusinessName}
```

### Long Message Handling

If an SMS exceeds 160 characters, the TextBee service automatically splits it into multiple parts. Each part is suffixed with a counter (e.g., `(1/2)`, `(2/2)`) and sent sequentially with a 500ms delay between parts.

### Bulk SMS

The service supports bulk sending through `sendBulkSMS()`, which processes all recipients in parallel using `Promise.allSettled()`. Individual failures do not block other messages.

### Troubleshooting SMS

See **Chapter 24** for common SMS issues and their solutions.
