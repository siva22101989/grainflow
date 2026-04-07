# Chapter 5: Payments

This chapter covers how to record payments from customers, view pending balances, allocate payments to specific storage records, and use bulk payment features.

---

## 5.1 Understanding Payments in GrainFlow

In GrainFlow, payments are always linked to a specific **storage record**. When you record a payment, it reduces the outstanding balance on that record.

A customer's total balance is the sum of all charges (rent + hamali) across their records, minus all payments received.

There are two types of payment transactions:

| Type   | Description                                                    |
|--------|----------------------------------------------------------------|
| Rent   | Payment toward storage rent or other charges on a record       |
| Hamali | Additional hamali (labor) charge added to a record             |

---

## 5.2 Viewing Pending Payments

To see all customers with outstanding balances:

1. Go to **Dashboard > Payments** (or **Payments > Pending** in the sidebar).

The Pending Payments page shows a list of customers who owe money, including:
- Customer name.
- Total outstanding balance.

From this page, you can directly record payments for any customer.

[Screenshot: Pending Payments page with customer list]

---

## 5.3 Recording a Payment Against a Single Record

This is the most common payment workflow:

1. Go to the **customer's profile page** (Dashboard > Customers > click the customer).
2. Click the **Record Payment** button.
3. A dialog shows all of the customer's active storage records with their balances:
   - Record number.
   - Inflow date.
   - Commodity.
   - Bags stored.
   - Total billed, total paid, and balance due.
4. Click **Pay** next to the record you want to apply the payment to.

[Screenshot: Record selection dialog for payment]

5. In the payment form:
   - **Type** -- select **Rent/Other** for a regular payment, or **Hamali Charge** to add an additional hamali charge to the record.
   - **Amount** -- enter the payment amount. For rent payments, the maximum is the balance due on that record.
   - **Date** -- defaults to today; change if recording a past payment.
6. Click **Record Transaction**.

[Screenshot: Add Payment dialog]

> **Tip:** The "Pay" button is disabled for records with zero balance. If a record is fully paid, you do not need to record anything.

---

## 5.4 Adding Extra Hamali Charges

Sometimes additional hamali charges arise after the initial inflow (e.g., re-stacking, shifting bags within the warehouse). To add them:

1. Follow the payment recording steps above.
2. In the Type selection, choose **Hamali Charge**.
3. Enter the additional hamali amount.
4. Click **Record Transaction**.

This adds to the record's total billed amount, increasing the customer's balance.

---

## 5.5 Bulk Payment (Paying Across Multiple Records)

When a customer makes a single large payment that should cover multiple records, use Bulk Payment:

1. Open the customer's profile.
2. Click **Bulk Payment**.
3. Enter the **Payment Amount** -- the total amount the customer is paying.
4. Set the **Payment Date**.

### Allocation Strategy

Choose how the payment should be distributed:

- **Auto (FIFO - Oldest First)** -- the system allocates money to the oldest records first, clearing them in order. This is the recommended approach.
- **Manual Distribution** -- you specify exactly how much goes to each record.

[Screenshot: Bulk Payment dialog with FIFO preview]

### FIFO Preview

When using Auto (FIFO), a preview table shows:
- Each record with its current balance.
- How much of the payment will be allocated to each record.
- The remaining balance after allocation.
- A green checkmark for records that will be fully paid off.

### Manual Distribution

When using Manual, each record shows an input field where you type the specific amount to allocate. The system warns you if the sum of your allocations does not match the total payment amount.

5. Review the allocation preview.
6. Click **Process Payment**.

> **Tip:** FIFO allocation is faster and clears old records first. Use Manual only when the customer specifically requests payment toward a particular record.

> **Important:** The payment amount cannot exceed the customer's total outstanding dues.

---

## 5.6 Payment History

To view a customer's complete payment history:

1. Open the customer's profile page.
2. Scroll to the storage records section. Each record shows its payments.

Each payment entry shows:
- Date.
- Amount.
- Type (rent or hamali).

---

## 5.7 Editing a Payment

If a payment was recorded with the wrong amount or date:

1. Find the payment on the customer profile or record detail page.
2. Click the **Edit** button on the payment entry.
3. Update the amount or date.
4. Save the changes.

---

## 5.8 Deleting a Payment

To remove a payment that was entered by mistake:

1. Find the payment entry.
2. Click the **Delete** button.
3. Confirm the deletion.

> **Important:** Deleting a payment increases the customer's outstanding balance. Only delete if the payment was genuinely recorded in error.

---

## 5.9 Razorpay Payment Links

GrainFlow integrates with Razorpay to allow customers to pay online. When this feature is enabled:

- You can generate a payment link and share it with the customer via SMS or WhatsApp.
- The customer clicks the link and pays using UPI, net banking, cards, or other methods.
- Once the payment is confirmed, GrainFlow automatically records it against the customer's account.

This feature requires Razorpay to be configured in your warehouse settings. Contact your administrator for setup.

> **Tip:** Payment links are especially useful for customers who are not physically present at the warehouse. Send them a link and the payment is recorded automatically when they pay.

---

**Next:** [Chapter 6 -- Expenses](./06-expenses.md)
