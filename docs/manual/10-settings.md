# Chapter 10: Settings

Configure your warehouse details, manage storage lots, and control team access.

---

## Overview

The Settings page is organized into tabs. Navigate to **Settings** in the sidebar to access:

- **Profile** -- Your personal account details
- **Warehouse** -- Warehouse name, location, contact, GST, and capacity
- **Crops & Rates** -- Commodity types and rental rate configuration
- **Data** -- Data management and export tools
- **Notifications** -- Alert preferences
- **SMS** -- SMS notification settings
- **Billing** -- Quick link to subscription management

This chapter covers the Warehouse, Lots, and Team sections in detail.

[Screenshot: Settings page showing the tab navigation bar]

---

## 10.1 Warehouse Details

### Viewing Warehouse Information

1. Go to **Settings**.
2. Click the **Warehouse** tab.
3. The form shows your current warehouse details.

### Updating Warehouse Details

1. Go to **Settings > Warehouse**.
2. Edit any of these fields:

| Field | Description | Example |
|---|---|---|
| Warehouse Name | The display name used on reports and receipts | Srilakshmi Warehouse |
| Location | Physical address or area | Kurnool, Andhra Pradesh |
| Phone Number | Contact number for the warehouse | 9703503423 |
| Email | Contact email address | contact@warehouse.com |
| GST Number | Your GSTIN for tax compliance | 37AABCU9603R1ZM |
| Capacity (Bags) | Total storage capacity in bags | 50000 |

3. Click **Save Changes**.

> **Important:** The warehouse name and GST number appear on printed receipts and PDF reports. Make sure they are accurate.

### Switching Between Warehouses

If you manage multiple warehouses (Professional plan and above), a warehouse switcher appears at the top of the Warehouse tab. Select a different warehouse to view and edit its settings.

[Screenshot: Warehouse settings form with name, location, phone, GST fields]

---

## 10.2 Warehouse Lots (Storage Zones)

Lots are physical zones or compartments within your warehouse. Setting up lots helps you track where specific goods are stored and monitor space utilization per zone.

### Viewing Lots

1. Go to **Settings > Warehouse** tab.
2. Under **Lot Configuration**, click **Manage Lots**.
   - Or navigate directly to **Settings > Lots** from the breadcrumb.
3. You will see a table listing all lots with:
   - Lot Name
   - Capacity (in bags)
   - Current utilization (a progress bar showing how full the lot is)
   - Status

[Screenshot: Lots page showing a table with lot names, capacities, and utilization bars]

### Creating a New Lot

**Adding one lot at a time:**

1. Go to **Settings > Lots**.
2. Click **Add Lot**.
3. Enter the lot name (for example, "Zone A" or "Godown 1").
4. Enter the capacity in bags.
5. Click **Save**.

**Adding multiple lots at once:**

1. Click **Bulk Add** on the Lots page.
2. Enter the number of lots and a naming pattern.
3. Click **Create**.

**Pasting a lot list:**

1. Click the paste option on the Lots page.
2. Paste a list of lot names (one per line).
3. Confirm to create all listed lots.

### Editing a Lot

1. Find the lot in the table.
2. Click the **Edit** button (pencil icon) next to it.
3. Update the name or capacity.
4. Click **Save**.

### Deleting a Lot

1. Find the lot in the table.
2. Click the **Delete** button next to it.
3. Confirm the deletion.

> **Important:** Deleting a lot does not delete the storage records assigned to it. However, those records will no longer display a lot name. Reassign records to another lot before deleting if possible.

### Understanding Utilization

Each lot shows a progress bar:
- **Green bar** -- The lot is within capacity.
- **Red bar** -- The lot has exceeded its configured capacity. This means more bags are assigned to it than it should hold. Reduce stock or increase the lot's capacity.

> **Tip:** Set lot capacities to match their real physical limits. This makes the utilization indicators accurate and helps you avoid overfilling a zone.

---

## 10.3 Team Management

Team management lets you add staff members who can access your GrainFlow account with controlled permissions.

### Accessing Team Settings

1. Go to **Settings**.
2. Click the **Manage Team** button in the top-right corner.
   - Or navigate to **Settings > Team** directly.

The team page shows a two-panel layout:
- **Left panel:** List of all team members
- **Right panel:** Details of the selected member, or the add-member form

[Screenshot: Team management page showing the member list and detail panel]

### Roles Explained

| Role | What They Can Do |
|---|---|
| **Staff** | Manage storage records (inflow, outflow, payments). Cannot access settings or team management. |
| **Manager** | Everything Staff can do, plus manage team members below their level. |
| **Admin** | Full access to all features, settings, and team management. |
| **Owner** | Account owner. Highest access level. Cannot be removed by others. |

### Adding a New Team Member

1. Go to **Settings > Team**.
2. Click **Add Member** at the bottom of the member list.
3. Fill in the form:
   - **Full Name** -- The person's display name
   - **Email** -- Their email address (used to log in)
   - **Role** -- Staff, Manager, or Admin
   - **Assign to Warehouse** -- Which warehouse they can access
   - **Initial Password** -- A temporary password (they can change it after first login)
4. Click **Create User**.

The new member can now log in with their email and the password you set.

[Screenshot: Add team member form with name, email, role, and warehouse fields]

### Using Invite Links

As an alternative to creating accounts directly, you can generate an invite link:

1. Go to **Settings > Team > Add Member**.
2. Scroll down to the **Invite Link** section.
3. Click **Generate Invite Link**.
4. Share the link with the person (via WhatsApp, SMS, etc.).
5. They click the link and complete registration.

### Viewing Member Details

1. Click any member in the left panel.
2. The right panel shows their:
   - Name and role
   - Email address
   - Account creation date
   - Current status (active or suspended)
   - Warehouse access

### Editing a Team Member

1. Select the member.
2. Click **Edit Profile**.
3. Update their name, role, or warehouse assignment.
4. Save changes.

> **Important:** You can only edit members who have a lower role than yours. Admins cannot edit other Admins. Only Owners can edit Admins.

### Removing Access

1. Select the member.
2. Click the deactivate option.
3. Confirm the action.

The member's account is suspended. They can no longer log in. Their past activity and records remain in the system.

### Handling Join Requests

If someone uses an invite link to request access, their request appears as a yellow notification at the top of the team panel. You can:

- Click **Accept** to add them to your warehouse.
- Click the **X** button to reject the request.

---

## Plan Limits for Team Members

The number of team members you can add depends on your plan:

| Plan | Maximum Team Members |
|---|---|
| Free | 1 (owner only) |
| Starter | 3 |
| Professional | 10 |
| Enterprise | 50 |

If you have reached your plan's limit, you will need to upgrade before adding more members. See Chapter 9 for upgrade instructions.

---

## Tips

- **Set up lots before your first inflow.** When you assign incoming stock to a lot, the utilization tracking starts working immediately.
- **Use descriptive lot names.** Names like "Godown 1 - Left Side" are more useful than "Lot A" when directing labourers.
- **Give staff the minimum role needed.** Most warehouse workers only need the Staff role. Reserve Admin for people who manage billing and settings.
- **Review team access quarterly.** Remove accounts for people who no longer work at the warehouse.
