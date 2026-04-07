# Chapter 8: Analytics Dashboard

Understand your warehouse performance at a glance with real-time charts and business metrics.

---

## Overview

GrainFlow offers two levels of analytics:

1. **Dashboard home page** -- Quick summary cards visible every time you log in.
2. **Business Analytics page** -- Detailed charts for financial performance, stock movement, and year-over-year trends.

---

## 8.1 Dashboard Metrics

When you log in, the top of your dashboard shows four summary cards:

| Card | What It Shows |
|---|---|
| **Total Stock** | Number of bags currently stored, with the occupancy percentage of your total warehouse capacity |
| **Active Records** | Count of storage records that are currently open (goods still in the warehouse) |
| **Available Space** | Remaining capacity in bags -- how much more you can accept |
| **Pending Revenue** | Total outstanding dues (Rs.) across all customers |

[Screenshot: Dashboard home page with the four summary cards]

### Reading the Numbers

- **Occupancy Rate** is calculated as: (Total Stock / Total Capacity) x 100. If this is above 90%, the card turns red to alert you that space is running low.
- **Active Records** represents current customers with goods in storage. This is not the same as total customers -- it only counts open records.
- **Pending Revenue** is the sum of all unpaid rent and hamali charges. A rising number here means you need to follow up on collections.

> **Tip:** The dashboard metrics refresh automatically. You do not need to reload the page to see updated numbers after recording an inflow or outflow.

---

## 8.2 Business Analytics Page

Navigate to **Analytics** in the sidebar for the full analytics suite.

> **Important:** The Business Analytics page is available on the Professional plan and above. Free and Starter plan users will not see this option.

### Revenue vs. Expenses Chart

A line chart showing monthly revenue (green) and expenses (red) for the current year. This helps you see whether your warehouse is profitable month by month.

[Screenshot: Revenue vs Expenses line chart]

### Year-over-Year Growth

A bar chart comparing annual revenue across the last five years. Use this to spot long-term growth trends or seasonal dips.

### Net Profit Chart

A bar chart of monthly net earnings (revenue minus expenses). Months where you spent more than you earned will show as shorter or negative bars.

### Inflow vs. Outflow Chart

A bar chart comparing monthly bag inflow (blue) against bag outflow (amber) for the current year. This reveals:

- **Seasonal patterns** -- Which months see the most stock coming in?
- **Storage velocity** -- Is stock moving out as fast as it comes in?
- **Accumulation risk** -- If inflow consistently exceeds outflow, your warehouse may fill up.

[Screenshot: Inflow vs Outflow bar chart showing monthly bag movement]

---

## 8.3 Understanding the Numbers

### What "Healthy" Looks Like

| Metric | Healthy Range | Action If Outside Range |
|---|---|---|
| Occupancy Rate | 60-85% | Below 60%: consider marketing. Above 85%: plan for overflow or new lots. |
| Turnover Rate | Above 50% | Low turnover means stock is sitting too long. Follow up with customers. |
| Avg. Storage Duration | Depends on crop | If much higher than typical for the commodity, investigate. |
| Collection Rate | Above 80% | Below 80%: tighten payment terms, send reminders, check Receivables report. |

### Common Questions

**Q: Why does my Pending Revenue keep going up even though customers are paying?**
A: New records generate new rent charges daily. If inflow exceeds payment speed, pending revenue will rise. Check the Aging report (Chapter 7) to ensure old dues are being cleared.

**Q: The occupancy rate seems wrong. How is capacity calculated?**
A: Total capacity is the sum of all lot capacities configured in Settings > Lots. If you added storage space but did not update lot capacity, the rate will appear inflated. See Chapter 10 for how to update lot capacity.

**Q: What time period do the dashboard metrics cover?**
A: Dashboard cards show current, real-time state -- not a date range. Active Records means records open right now. Pending Revenue is the total outstanding balance right now.

---

## Tips

- **Check the dashboard first thing each morning.** The four cards give you a 10-second health check of your warehouse.
- **Use Inflow vs. Outflow to plan staffing.** If a particular month always sees high inflow, schedule extra labour for unloading.
- **Compare YoY Growth before renewing leases or expanding.** The trend line shows whether your business justifies the investment.
