# `/customers` Component Module

This directory contains the user interface components specific to managing Customers and their associated Storage Records.

## Key Components

### `CustomerActivityClient`

The primary operational page for a single customer. It aggregates several critical flows:

- Displays the active storage list (`ActiveStorageList`).
- Provides buttons to initiate Single Inflow, Bulk Outflow, and Bulk Payment.
- Contains the core state for managing side-panels or dialogs associated with these actions.

### Active Storage View (`ActiveStorageList.tsx` & `CustomerDetails.tsx`)

- **Purpose:** Shows all currently stored inventory for a specific customer.
- **Key Functionality:**
  - Provides quick actions per-record (Add Inflow, Outflow, Edit, Add Payment, View Receipts).
  - Often involves complex client-side filtering or sorting.
  - Uses dynamic stock calculation to display _Current Available Bags_ (`bags_in - bags_out`) reliably.

### Bulk Operations

**1. `BulkOutflowDialog.tsx`**

- **Scenario:** A customer withdraws a large quantity of a specific commodity (e.g., 500 bags of Maize), but those bags were deposited across 3 different initial drops over a month.
- **Functionality:**
  - Allows user to input total bags to withdraw for a specific commodity.
  - Shows a "Preview" calculated on the client-side of which specific storage records will be impacted based on a FIFO (First In, First Out) strategy.
  - Calculates proportional rent and accepts a discount applied proportionally across the affected records.
  - Submits to the `processBulkOutflow` server action.

**2. `BulkPaymentDialog.tsx`**

- **Scenario:** A customer pays a lump sum (e.g., ₹50,000) against their total outstanding balance rather than paying individual receipts.
- **Functionality:**
  - Calculates the total pending rent across all active records.
  - Distributes the entered lump sum payment proportionally across all records with a balance.
  - Submits the payment distribution to the backend action.

### Report Generation

- **`StatementOfAccount.tsx` / SOA Generation:** Components responsible for generating the financial ledger for a customer, showing chronological history of deposits, withdrawals, and rent paid versus due.

## Interaction with Backend

These UI components rely strictly on Next.js Server Actions (defined in `src/lib/actions/*`) to perform any database mutations. They never write to the DB directly in the client. Forms use standard `action={formAction}` pointing to server actions, and rely on `useActionState` to handle loading states and display error/success messages.
