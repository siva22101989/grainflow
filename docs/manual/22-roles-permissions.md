# Chapter 22: Roles and Permissions

GrainFlow uses Role-Based Access Control (RBAC) to govern what each user can see and do. Roles are assigned at two levels: a **global profile role** (on the `profiles` table) and a **warehouse-level role** (on the `warehouse_assignments` table).

## Role Definitions

| Role | Scope | Description |
|---|---|---|
| `super_admin` | Global | Platform operator. Full access to all warehouses and the Admin Panel. |
| `owner` | Warehouse | Warehouse owner. Full control over their warehouse(s), billing, and team. Can also access the Admin Panel. |
| `admin` | Warehouse | Warehouse administrator. Can manage staff, customers, storage, and settings. Cannot manage billing. |
| `manager` | Warehouse | Operational manager. Can handle day-to-day storage, customers, and payments. Limited settings access. |
| `staff` | Warehouse | Basic operator. Can view and create records but cannot delete or manage team. |
| `customer` | External | External party (farmer/business). No application login -- represented as data records only. |

## Permission Matrix

The following table shows access for each role across all application modules. Permissions are: **Full** (read + write + delete), **Write** (read + write), **Read** (view only), or **None** (no access).

### Dashboard and Navigation

| Module | super_admin | owner | admin | manager | staff |
|---|---|---|---|---|---|
| Main Dashboard | Full | Full | Full | Read | Read |
| Admin Panel | Full | Full | None | None | None |
| Warehouse Switcher | Full | Full | None | None | None |

### Customer Management

| Action | super_admin | owner | admin | manager | staff |
|---|---|---|---|---|---|
| View customers | Full | Full | Full | Full | Read |
| Create customer | Full | Full | Full | Full | None |
| Edit customer | Full | Full | Full | Full | None |
| Delete customer | Full | Full | Full | None | None |

### Storage Records

| Action | super_admin | owner | admin | manager | staff |
|---|---|---|---|---|---|
| View records | Full | Full | Full | Full | Read |
| Create inflow | Full | Full | Full | Full | Write |
| Process outflow | Full | Full | Full | Full | None |
| Bulk outflow | Full | Full | Full | None | None |
| Edit record | Full | Full | Full | Write | None |
| Delete record | Full | Full | Full | None | None |
| Export records | Full | Full | Full | Full | None |

### Payments

| Action | super_admin | owner | admin | manager | staff |
|---|---|---|---|---|---|
| View payments | Full | Full | Full | Full | Read |
| Record payment | Full | Full | Full | Full | None |
| Send payment link | Full | Full | Full | Full | None |
| Send SMS reminder | Full | Full | Full | Full | None |
| Delete payment | Full | Full | None | None | None |

### Expenses

| Action | super_admin | owner | admin | manager | staff |
|---|---|---|---|---|---|
| View expenses | Full | Full | Full | Full | None |
| Create expense | Full | Full | Full | Write | None |
| Edit expense | Full | Full | Full | None | None |
| Delete expense | Full | Full | None | None | None |

### Reports and Analytics

| Action | super_admin | owner | admin | manager | staff |
|---|---|---|---|---|---|
| View reports | Full | Full | Full | Read | None |
| Export reports (PDF/Excel) | Full | Full | Full | Read | None |
| Analytics dashboard | Full | Full | Full | None | None |
| Platform analytics | Full | Full | None | None | None |

### Settings

| Action | super_admin | owner | admin | manager | staff |
|---|---|---|---|---|---|
| View warehouse settings | Full | Full | Full | None | None |
| Edit warehouse settings | Full | Full | Write | None | None |
| Manage team (add/remove users) | Full | Full | Full | None | None |
| Change user roles | Full | Full | Full | None | None |
| Notification preferences | Full | Full | Full | Full | Full |
| SMS settings | Full | Full | Full | None | None |
| Billing / Subscription | Full | Full | None | None | None |

### Admin Panel (super_admin and owner only)

| Action | super_admin | owner | admin | manager | staff |
|---|---|---|---|---|---|
| View all warehouses | Full | Full | None | None | None |
| Create warehouse | Full | Full | None | None | None |
| View all users | Full | Full | None | None | None |
| View audit logs | Full | Full | None | None | None |
| View analytics | Full | Full | None | None | None |
| Manage subscriptions | Full | Full | None | None | None |
| Generate activation codes | Full | None | None | None | None |
| Process expired subscriptions | Full | None | None | None | None |

## How Roles Are Assigned

### Global Role (profiles.role)

Set when a user account is created. The `super_admin` role is assigned directly in the database and should not be changed through the UI. The `owner` role is typically set during warehouse onboarding.

### Warehouse Role (warehouse_assignments.role)

Assigned when a user is granted access to a specific warehouse. A user can have different roles in different warehouses.

To change a warehouse role:

1. Go to **Settings > Team** in the target warehouse.
2. Find the user in the team list.
3. Select the new role from the dropdown.
4. The change takes effect immediately.

All role changes are recorded in the audit log with the `UPDATE` action on the `USER` entity.

## Role Enforcement Layers

Roles are enforced at three layers:

1. **UI Layer:** Navigation items and action buttons are conditionally rendered based on the user's role. Users never see UI elements they cannot use.

2. **Server Action Layer:** Every server action (`'use server'` function) verifies the authenticated user's role before performing any operation. Unauthorized requests return an error.

3. **Database Layer (RLS):** Row Level Security policies on Supabase ensure that even if the UI and server action layers are bypassed, the database will not return data the user is not authorized to see. See Chapter 25 for details.

## Subscription-Based Limits

In addition to role-based permissions, subscription tier limits are checked before certain actions:

- **Adding a team member:** The system checks the `USERS` limit for the warehouse's plan before allowing a new `warehouse_assignments` record.
- **Creating a storage record:** The system checks the `STORAGE_RECORDS` limit.
- **Accessing gated features:** Features like Analytics Dashboard or API Access require a minimum plan tier.

When a limit is reached, the user sees an "Upgrade Required" message with the feature name and the minimum tier needed.
