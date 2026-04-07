# Chapter 20: Admin Dashboard

The Admin Panel is the central control surface for super_admin and owner users. It provides a system-wide view of all warehouses, users, subscriptions, and platform activity. Access it from the sidebar under **Admin Panel**, or navigate directly to `/admin`.

## Access Requirements

Only users with the `super_admin` or `owner` role on their profile can access the Admin Panel. All other roles receive a **403 Forbidden** page. This check runs server-side before any data is loaded.

## Dashboard Overview

When the Admin Panel loads, the top section displays five summary cards:

| Card | Description |
|---|---|
| **Total Warehouses** | Count of active tenants on the platform |
| **Registered Users** | System-wide user accounts |
| **Total Customers** | Farmers and businesses across all warehouses |
| **Active Records** | Storage records currently in storage (not withdrawn) |
| **Total Stock** | Aggregated bag count across the entire platform |

Below the stats cards, the dashboard is organized into six tabs: **Warehouses**, **Users**, **Audit Logs**, **Analytics**, **Subscriptions**, and **Codes**.

---

## Warehouses Tab

The Warehouses tab lists every warehouse on the platform with their name, location, and metadata.

### Creating a New Warehouse

1. Click the **Create Warehouse** button in the page header (top-right).
2. In the dialog, fill in:
   - **Name** -- the warehouse display name
   - **Location** -- physical address or city
   - **Capacity** -- maximum storage capacity in bags
   - **GST Number** -- optional tax identifier
3. Click **Create**.

The new warehouse is created immediately. An owner must then be assigned through the Users tab or through the team settings of that warehouse.

> **Warning:** Creating a warehouse does not automatically assign a subscription plan. The warehouse starts on the Free tier with limited capacity. See Chapter 21 for subscription activation.

### Editing a Warehouse

Click the edit icon on any warehouse row to modify its name, location, capacity, or GST number. Changes take effect immediately and are reflected across all users of that warehouse.

---

## Users Tab

The Users tab displays a directory of all registered users across the platform. Each row shows the user's name, email, role, and associated warehouse.

### Viewing User Details

The table shows each user's:
- Full name and email address
- Global profile role (super_admin, owner, admin, manager, staff)
- Warehouse assignment(s)
- Account creation date

### Deactivating a User

User deactivation is handled through warehouse assignment management. To remove a user's access:

1. Navigate to the warehouse's **Settings > Team** page.
2. Find the user in the team list.
3. Click the toggle to revoke warehouse access.

This performs a soft delete on the `warehouse_assignments` record (sets `deleted_at`), preserving the assignment history for audit purposes. The user's authentication account remains intact but they lose access to warehouse data.

> **Warning:** Revoking the last owner's access to a warehouse can leave it without an administrator. Always ensure at least one owner remains assigned.

---

## Audit Logs Tab

The Audit Logs tab displays the Global Audit Log -- a chronological feed of all significant actions across every warehouse on the platform.

### Log Entry Fields

Each audit log entry records:

| Field | Description |
|---|---|
| **Action** | CREATE, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, BULK_ACTION |
| **Entity** | STORAGE_RECORD, CUSTOMER, PAYMENT, INFLOW, OUTFLOW, USER, SETTINGS, SUBSCRIPTION |
| **Entity ID** | The specific record that was affected |
| **User** | Who performed the action |
| **Warehouse** | Which warehouse the action occurred in |
| **IP Address** | The IP address of the actor |
| **Timestamp** | When the action occurred |
| **Details** | A JSON object with action-specific context |

### Filtering Logs

The audit log supports two filtering mechanisms:

- **Search (q):** Free-text search across log entries.
- **Type filter:** Filter by importance level. The default filter is `important`, which shows only significant operations.

Results are paginated at 50 entries per page. Use the page navigation at the bottom to browse older entries.

### Audit Log Retention

Audit logs are append-only and immutable. They cannot be edited or deleted through the application. The `audit_logs` table has no `Update` type defined in the schema -- entries are write-once.

---

## Analytics Tab

The Analytics tab provides platform-wide metrics and visual charts covering:

- Warehouse growth trends
- User registration patterns
- Storage utilization across the platform
- Revenue and subscription distribution

This data is sourced from the `getPlatformAnalytics()` query and rendered in the Analytics Section component with interactive charts.

---

## Subscriptions Tab

See **Chapter 21: Subscription Management** for full details on this tab, including plan management, manual activation, and subscription code generation.

---

## Codes Tab

The Codes tab manages activation codes for manual subscription distribution. Super admins can:

- Generate new activation codes tied to specific plans
- View all codes with their status (available, used, revoked)
- See which warehouse redeemed each code

See **Chapter 21** for the complete code generation workflow.
