# Chapter 4: Storage Outflow

This chapter covers how to process stock withdrawals, understand rent calculation, apply discounts, collect payment, and handle bulk outflows.

---

## 4.1 What Is an Outflow?

An outflow is the process of withdrawing bags from storage. When a customer collects their stock, you process an outflow to:

- Record how many bags are leaving.
- Calculate the rent owed based on how long the bags were stored.
- Collect payment (fully or partially).
- Generate a final bill / receipt.

---

## 4.2 Processing a Single Record Outflow

1. Go to **Dashboard > Outflow**.
2. In the **Search Record** field, search for the storage record by record number, customer name, or commodity.
3. Select the record from the search results. The system loads the record details and shows the inflow date.

[Screenshot: Outflow form with record selected]

4. Enter the **Bags to Withdraw**. The maximum is the number of bags currently stored in that record.
5. Set the **Withdrawal Date**. It defaults to today.

### Billing Summary

Once you enter the bags and date, the system automatically calculates:

- **Storage Duration** -- how many months the bags were stored (rounded up -- even 1 day into a new month counts as a full month).
- **Standard Rent** -- the total rent based on tiered rates (see section 4.3 below).
- **Discount** -- enter a discount amount if applicable. The discount is subtracted from the standard rent.
- **Net Rent Due** -- standard rent minus any discount.
- **Pending Hamali Charges** -- any unpaid hamali from the original inflow.
- **Prior Credit / Advance** -- if the customer has overpaid hamali or has credit, it is deducted here.
- **Total Payable** -- the final amount the customer owes (net rent + pending hamali - advance).

6. Enter the **Total Paid Now** -- the amount the customer is paying today. Leave blank if the customer will pay later.
7. Click **Process Outflow**.

[Screenshot: Outflow billing summary showing all calculated fields]

> **Important:** If you withdraw all remaining bags from a record, the record is automatically closed and marked as "Withdrawn." If you withdraw only some bags, the record stays open with the remaining bag count updated.

---

## 4.3 How Rent Is Calculated (Tiered Rates)

GrainFlow uses a tiered pricing model based on storage duration. The default rates are:

| Duration         | Rate Per Bag         |
|------------------|----------------------|
| 1 to 6 months    | Rs. 36 per bag       |
| 7 to 12 months   | Rs. 55 per bag       |

These are flat rates for the entire period, not monthly charges. For example:
- 100 bags stored for 3 months = 100 x Rs. 36 = **Rs. 3,600**
- 100 bags stored for 9 months = 100 x Rs. 55 = **Rs. 5,500**

> **Important:** The rate per bag applies to the full tier. Storing for 1 month costs the same as storing for 6 months (both Rs. 36 per bag). The jump to Rs. 55 happens only if storage exceeds 6 months.

### Multi-Year Storage

For storage beyond 12 months, rent is calculated in yearly blocks:

- **Year 1** (months 1-12): Rs. 55 per bag (the 1-year rate).
- **Each additional year**: The rate resets and follows the same tier logic.

Example: 100 bags stored for 14 months (1 year + 2 months):
- Year 1 (12 months): 100 x Rs. 55 = Rs. 5,500
- Remaining 2 months (falls in the 0-6 month tier): 100 x Rs. 36 = Rs. 3,600
- **Total: Rs. 9,100**

### Month Rounding Rule

Even 1 day into a new month counts as a full month. For example:
- Storage from January 1 to July 2 = 7 months (not 6), so the 1-year rate of Rs. 55 applies.

### Dynamic Pricing

Your warehouse may have custom rates configured per crop. If a crop has custom pricing set up in Settings, GrainFlow uses those rates instead of the defaults shown above. The billing summary always shows the actual rate being applied.

> **Tip:** Review the billing summary carefully before confirming an outflow. Once processed, the rent is recorded on the storage record.

---

## 4.4 Applying a Discount

To apply a discount:

1. In the outflow form, after the system shows the Standard Rent, enter the discount amount in the **Discount** field.
2. The **Net Rent Due** updates automatically.

Discounts are useful for:
- Long-standing customers.
- Bulk withdrawals.
- Goodwill gestures for damaged goods.

The discount is recorded on the outflow transaction for your records.

---

## 4.5 Collecting Payment at Outflow

The **Total Paid Now** field allows you to record payment at the time of outflow:

- If the customer pays in full, enter the Total Payable amount.
- If the customer pays partially, enter the partial amount. The remainder becomes an outstanding balance on the customer's account.
- If the customer will pay later, leave the field blank or enter 0.

> **Tip:** You can always record additional payments later through the Payments section (see Chapter 5).

---

## 4.6 Bulk Outflow (FIFO)

When a customer wants to withdraw a large quantity of bags that spans multiple storage records, use **Bulk Outflow** instead of processing each record individually.

### What Is FIFO?

FIFO stands for **First In, First Out**. It means the system withdraws from the oldest storage records first. This is the standard practice in warehouse management -- stock that arrived first should leave first.

### How to Process a Bulk Outflow

1. Go to the **customer's profile page** (Dashboard > Customers > click the customer name).
2. Click the **Bulk Outflow** button.
3. Select the **Commodity** from the dropdown. Only commodities the customer currently has in storage will appear.
4. Set the **Withdrawal Date**.
5. Enter the **Bags to Withdraw**. The system shows the total available bags for that commodity. Click **Max** to withdraw everything.

[Screenshot: Bulk outflow dialog with commodity selected and bags entered]

### Preview Plan

As soon as you enter a valid bag count, the system shows a preview table:

- Each row represents a storage record that will be affected.
- Records are listed in FIFO order (oldest first).
- For each record, you see:
  - **Record Number** and inflow date.
  - **Current Stock** -- bags currently in that record.
  - **Withdraw** -- how many bags will be taken from this record.
  - **Rent** -- the calculated rent for the withdrawn bags.
  - **CLOSE** label if the entire record is being emptied.

You can **uncheck** any record to exclude it from the bulk withdrawal. This is useful if certain bags should not be touched.

### Summary

Above the table, a summary shows:
- **Total Bags** being withdrawn.
- **Standard Rent** across all affected records.
- **Pending Hamali** from those records.
- **Prior Credit / Advance** if any.
- **Total Payable Today** -- the grand total.

6. Optionally enter a **Discount** amount (distributed across records).
7. Optionally enter a **Rent Payment** amount (distributed proportionally across records).
8. Click **Confirm & Process**.

> **Important:** Bulk outflow is a powerful operation. Double-check the preview before confirming. Make sure the right records are selected and the bag counts are correct.

> **Tip:** Bulk outflow saves significant time when a customer has many records of the same commodity (e.g., 15 records of paddy accumulated over a season).

---

## 4.7 Outflow Receipt

After processing an outflow (single or bulk), a receipt is generated showing:

- Customer name and details.
- Record number(s).
- Commodity and bags withdrawn.
- Storage duration and rate applied.
- Rent charged, discount (if any), hamali charges, and total payable.
- Amount paid and remaining balance.

You can print or download this receipt to hand to the customer.

[Screenshot: Outflow receipt]

---

## 4.8 Reversing an Outflow

If an outflow was processed by mistake, you can reverse it:

1. Find the outflow in the Outflow page list or on the customer's profile.
2. Click the **Delete** (trash icon) button on the outflow entry.
3. Confirm the reversal.

Reversing an outflow:
- Restores the bags to the original storage record.
- Removes the rent charge from the record.
- Reopens the record if it was closed by the outflow.

> **Important:** Only reverse an outflow if the stock was not actually taken by the customer. Reversals affect financial records, so use them carefully.

---

## 4.9 Editing an Outflow

If you need to correct the bag count or other details on an existing outflow:

1. Find the outflow transaction.
2. Click the **Edit** button.
3. Update the fields as needed.
4. Save the changes.

The system recalculates rent and updates the storage record accordingly.

> **Important:** You cannot increase the bags withdrawn beyond what was available in the record at the time. If you need to withdraw more, process a new outflow instead.

---

**Next:** [Chapter 5 -- Payments](./05-payments.md)
