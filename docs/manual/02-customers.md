# Chapter 2: Customers

This chapter covers how to add, view, edit, search, and manage your customer records.

---

## 2.1 Viewing the Customer List

To see all your customers:

1. Click **Customers** in the sidebar menu.

You will see a table (on desktop) or card list (on mobile) showing:

| Column          | Description                                      |
|-----------------|--------------------------------------------------|
| Name            | Customer's full name                              |
| Phone           | Contact number                                    |
| Village         | Customer's village                                |
| Active Records  | Number of open storage records for this customer  |
| Total Billed    | Total amount billed across all records            |
| Paid            | Total amount the customer has paid                |
| Balance Due     | Outstanding amount (Billed minus Paid)            |

[Screenshot: Customer list page with table]

---

## 2.2 Adding a New Customer

1. Go to **Dashboard > Customers**.
2. Click the **Add Customer** button in the top right.
3. Fill in the customer details:
   - **Name** (required) -- the customer's full name.
   - **Father's Name** -- helps identify customers with similar names (common in rural areas).
   - **Village** -- the customer's village. Useful for filtering later.
   - **Address** (required) -- full address for records and receipts.
   - **Phone** (required) -- 10-15 digit mobile number. You may include +91 or leave it off.
   - **Email** (optional) -- if the customer has an email, entering it here lets them access the self-service Customer Portal to view their own stock and payments.
4. Click **Save Customer**.

[Screenshot: Add Customer dialog with fields]

> **Important:** The phone number must be unique. You cannot add two customers with the same phone number.

> **Tip:** Even if a customer does not use email, always enter their phone number accurately. It is used for sending SMS notifications about inflows and outflows.

---

## 2.3 Viewing a Customer Profile (360-Degree View)

Click any customer's name in the list to open their full profile. The customer profile page gives you a complete picture:

- **Customer Details** -- name, father's name, village, phone, address.
- **Active Storage Records** -- all open records showing commodity, bags stored, lot location, and storage start date.
- **Payment History** -- a list of all payments made against each record.
- **Balance Summary** -- total billed, total paid, and outstanding balance at a glance.
- **Statement** -- generate a PDF statement for the customer.

[Screenshot: Customer 360 profile page]

From the customer profile, you can:
- Record a payment (click **Record Payment**).
- Process a bulk outflow (click **Bulk Outflow**).
- View or download a statement.
- Edit or delete the customer.

---

## 2.4 Editing a Customer

1. Open the customer's profile page.
2. Click the **Edit** button.
3. Update the fields you need to change (name, phone, village, address, etc.).
4. Click **Save** to apply changes.

---

## 2.5 Deleting a Customer

1. Open the customer's profile page.
2. Click the **Delete** button.
3. Confirm the deletion.

> **Important:** Deleting a customer does not permanently erase them. They are soft-deleted and can be restored later using the **Restore Customer** option on the Customers page. However, a deleted customer will not appear in dropdowns for new inflows or payments.

To restore a deleted customer:
1. Go to **Dashboard > Customers**.
2. Click **Restore Customer** (next to the Add Customer button).
3. Select the customer from the list and confirm.

---

## 2.6 Searching and Filtering Customers

### Search
Use the search bar at the top of the Customers page to find customers by name. The search runs on the server, so it works even with a large number of customers.

### Filters
Click the **Filter** button to narrow down the list:
- **Village** -- select one or more villages.
- **Balance Range** -- set a minimum and/or maximum balance to find customers who owe within a specific range.

### Sort
Click the **Sort** dropdown to order customers by:
- Highest or Lowest Balance
- Name (A-Z or Z-A)
- Most or Least Billed
- Most or Least Active Records

### Share Filters
After applying filters, use the **Share** button to copy a URL with your current filter settings. Share this link with a colleague so they see the same filtered view.

### Export
Click **Export** to download the filtered customer list as an Excel file. The export includes all columns visible in the table.

[Screenshot: Customer list with search bar, filter, and sort controls]

> **Tip:** To quickly find customers with overdue payments, sort by "Highest Balance" and look at the top of the list.

---

## 2.7 Customer Statements

A customer statement is a summary document showing all of a customer's storage records, charges, and payments.

To generate a statement:

1. Open the customer's profile page.
2. Click **Statement** or the statement icon.
3. Optionally select a date range to limit the statement period.
4. Click **Download PDF** to save the statement to your device.

You can print this PDF and hand it to the customer as a record of their account.

[Screenshot: Customer statement PDF preview]

---

**Next:** [Chapter 3 -- Storage Inflow](./03-storage-inflow.md)
