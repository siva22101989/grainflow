# Chapter 7: Reports

Generate financial and operational reports to track revenue, monitor stock, and keep your records audit-ready.

---

## Overview

GrainFlow provides three categories of reports, accessible from **Reports** in the sidebar:

- **Financial Analytics** -- Revenue, collections, outstanding dues, and expense tracking
- **Operational Analytics** -- Warehouse capacity, turnover, commodity breakdown, and customer behaviour
- **Custom Reports** -- On-demand reports with date ranges, filters, and PDF/Excel export

[Screenshot: Reports landing page showing the three report category cards]

---

## 7.1 Financial Analytics

Navigate to **Reports > Financial Analytics**.

The financial dashboard is organized into five tabs:

### Overview Tab

This is the default view. It shows four headline metrics at the top:

| Metric | What It Means |
|---|---|
| Total Revenue | All rent + hamali charges billed across all records |
| Total Collected | Amount actually received from customers |
| Outstanding Dues | Billed amount that has not been paid yet |
| Avg. Days to Payment | How long customers typically take to pay |

Below the metrics you will find:

1. **Revenue Trends (Last 12 Months)** -- A line chart breaking down monthly Rent vs. Hamali revenue. A dashed line shows the combined total.
2. **Top 10 Customers by Revenue** -- A ranked list of your highest-revenue customers, showing amount paid and any outstanding balance. Click a name to jump to that customer's profile.
3. **Outstanding Dues Aging** -- A pie chart showing how old your unpaid dues are (for example, 0-30 days, 31-60 days, 61-90 days, 90+ days). Use this to prioritize collections.

[Screenshot: Financial Overview tab with revenue trends chart and aging pie chart]

### Unloading (Ops) Tab

A table listing all unloading activities: date, customer name, commodity, lorry number, bags unloaded, and hamali amount charged.

### Hamali (Rev) Tab

Hamali revenue grouped by customer. Click a customer row to expand and see individual transactions with dates, bag counts, billed amounts, and balance due.

### Receivables Tab

A per-customer breakdown of rent and hamali dues:

- Rent Billed / Rent Paid / Rent Due
- Hamali Billed / Hamali Paid / Hamali Due
- Total Pending

This is the report to check when following up on outstanding payments.

### Expenses Tab

A log of unloading-related expenses with date, description, and amount.

---

## 7.2 Operational Analytics

Navigate to **Reports > Operational Analytics**.

Four headline metrics appear at the top:

| Metric | What It Means |
|---|---|
| Capacity Utilization | Percentage of total warehouse space currently in use |
| Turnover Rate | Ratio of completed outflows to total inflows |
| Avg. Storage Duration | Average number of days items stay in your warehouse |
| Repeat Customer Rate | Percentage of customers who have stored more than once |

Below the metrics:

1. **Lot-wise Capacity Utilization** -- A bar chart comparing current stock against total capacity for each lot/zone. Use this to spot lots that are full or underused.
2. **Commodity Distribution** -- A pie chart of the top 6 commodities by total bags stored, with average storage duration per commodity.
3. **Customer Insights** -- Visual breakdown of active vs. total customers, repeat rate, and average bags per transaction.

[Screenshot: Operational Analytics page with lot utilization bar chart]

---

## 7.3 Custom Reports

Navigate to **Reports > Custom Reports**.

The custom report generator lets you build specific reports for compliance, audits, or daily operations.

### Available Report Types

| Report Type | What It Contains | Date Range Needed? |
|---|---|---|
| All Customers List | Every registered customer with active bag counts | No |
| Customer Dues Statement | Detailed rent + hamali dues for one customer | No (customer selection needed) |
| Active Inventory | All items currently stored in the warehouse | No |
| Pending Dues List | Customers with outstanding balances | No |
| Inflow Register | Items received during a date range | Yes |
| Outflow Register | Items withdrawn during a date range | Yes |
| Payment Register | Payments received during a date range | Yes |
| Lot Inventory | Mapping of lots to customers and items in stock | No |
| Recent Transactions | Last 1,000 inflow/outflow entries | No |

### Generating a Custom Report

1. Go to **Reports > Custom Reports**.
2. Select a **Report Type** from the dropdown.
3. If the report requires a date range, set the **From Date** and **To Date**.
4. If using the Customer Dues Statement, select the specific customer. You can also choose whether to show All dues or Hamali Only, and whether to include settled/closed records.
5. Choose the **Export Format**: PDF Document or Excel Spreadsheet.
6. Click **Generate Report**.
7. The file downloads to your device automatically.

[Screenshot: Custom report generator with report type dropdown and date fields]

> **Important:** Custom reports require the Starter plan or above. Free plan users will see a message asking them to upgrade.

---

## 7.4 Exporting Data

### Exporting from Financial Analytics

1. Open **Reports > Financial Analytics**.
2. Switch to the tab you want to export (Overview, Unloading, Hamali, Receivables, or Expenses).
3. Click the **Export Data** button in the top-right corner.
4. An Excel file containing that tab's data will download.

### Export Format Details

- **Excel exports** include formatted columns, headers, and totals where applicable.
- **PDF exports** from Custom Reports include the warehouse name, report title, and generation timestamp.

> **Tip:** Use the Inflow Register and Outflow Register exports as supporting documents during APMC inspections or audits. The date-range filter makes it easy to match a specific inspection period.

> **Important:** The Export button only appears if your subscription plan includes export access (Starter plan and above). On the Free plan, you will see a note that says "Export unavailable on current plan."

---

## Tips for Using Reports Effectively

- **Check Receivables weekly.** Sort mentally by total pending to focus collection efforts on the largest outstanding amounts.
- **Review Aging monthly.** If the 90+ days segment is growing, tighten your payment follow-up process.
- **Use Lot Utilization before accepting new stock.** It shows exactly which zones have space.
- **Export before month-end.** Generate the Payment Register for the full month to reconcile with your bank statements.
