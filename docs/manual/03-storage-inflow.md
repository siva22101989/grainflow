# Chapter 3: Storage Inflow

This chapter covers how to record new stock arriving at your warehouse, including assigning it to a storage lot and calculating hamali charges.

---

## 3.1 What Is an Inflow?

An inflow is the process of recording new bags of grain or other commodity entering your warehouse for storage. Each inflow creates a **storage record** -- a unique entry that tracks:

- Which customer the stock belongs to.
- What commodity it is (e.g., paddy, groundnut, maize).
- How many bags were brought in.
- Which lot (storage zone) in the warehouse it was placed in.
- The date storage started.
- Hamali (labor) charges for loading/unloading.

> **Important:** Rent is not charged at inflow time. Rent is calculated only when the customer withdraws their stock (outflow). The inflow simply starts the storage clock.

---

## 3.2 Creating a New Storage Record

1. Go to **Dashboard > Inflow**.
2. The inflow form will appear on the page. Fill in the details:

### Step-by-Step

**Select Customer**

3. Choose the customer from the **Customer** dropdown. If the customer does not exist yet, click **Add Customer** in the top right to create one first.
4. Once selected, the customer's **Father's Name** and **Village** will auto-fill (read-only) for easy verification.

**Choose Inflow Type**

5. Select the inflow type:
   - **Direct (Purchase)** -- stock arriving fresh from the field or market. This is the most common type.
   - **Plot (Transfer In)** -- stock being transferred from an outdoor plot into the warehouse.

**Select Product and Lot**

6. Choose the **Product / Crop** from the dropdown (e.g., Paddy, Groundnut).
7. Choose the **Lot No.** where the bags will be stored. The dropdown shows available capacity for each lot (e.g., "Lot A (Available: 450)"). Lots that are full are disabled.

**Enter Quantities**

8. For a Direct inflow, enter the **No. of Bags** being stored.
9. For a Plot transfer, enter:
   - **Plot Bags** -- the number of bags coming from the plot.
   - **Load Bags (Final)** -- the final count after re-weighing (optional).

**Vehicle and Date**

10. Enter the **Lorry / Tractor No.** (e.g., "AP 21 1234") -- optional but useful for tracking.
11. Set the **Date**. It defaults to today but can be changed to a past date if you are recording a delayed entry.

**Hamali Charges**

12. Enter the **Hamali Rate (per bag)** -- the rate charged per bag for loading/unloading labor.
13. Enter **Hamali Paid Now** -- if the customer is paying hamali charges upfront, enter the amount here. Leave blank or 0 if payment is deferred.

**Khata Amount**

14. If applicable, enter the **Khata Amount (Weighbridge)** -- the weighbridge charge.

[Screenshot: Inflow form with all fields filled in]

### Billing Summary

At the bottom of the form, a summary shows:
- **Total Hamali Payable** -- bags multiplied by hamali rate. If linked to an unloading record, includes unloading charges.
- **Hamali Pending** -- hamali payable minus hamali paid now.
- **Estimated Rent (6 Months)** -- a reference showing what the per-bag rent would be if withdrawn within 6 months. This is informational only; actual rent is calculated at outflow.

15. Click **Create Storage Record**.

The record is created and assigned an auto-generated serial number.

---

## 3.3 Using Unloading Records

If your warehouse uses the gate entry / unloading workflow, you can link an inflow to a previous unloading record:

1. At the top of the inflow form, you will see a section labeled **Select from Unloading Record (Optional)** if any unloaded trucks are waiting.
2. Select a truck arrival from the dropdown. It shows the customer name, commodity, and bags remaining.
3. The form will auto-fill the customer, crop, and bag count from the unloading record.
4. Complete the remaining fields and submit.

> **Tip:** Using unloading records speeds up data entry and reduces errors because the customer and commodity are already known.

---

## 3.4 Understanding the Receipt

After creating a storage record, a receipt is generated that you can print or download. The receipt includes:

- Record serial number.
- Customer name, father's name, and village.
- Commodity and lot number.
- Number of bags stored.
- Storage start date.
- Hamali charges (total and pending).
- Lorry/tractor number.

Hand the printed receipt to the customer as proof of storage.

[Screenshot: Inflow receipt]

---

## 3.5 Viewing Recent Inflows

The Inflow page shows a list of the most recent inflows below the form. You can see:

- Record number.
- Customer name.
- Commodity.
- Bags.
- Date.
- Status (Active or Withdrawn).

Use this list to verify recent entries or find a record to review.

---

## 3.6 Tips and Common Issues

> **Tip:** Always double-check the lot selection. Placing bags in the wrong lot makes physical retrieval difficult later.

> **Tip:** If a customer brings stock in multiple lorry loads on the same day, create one inflow record per lorry for accurate tracking.

> **Important:** You cannot change the customer on a storage record after it is created. If you select the wrong customer, you will need to delete the record and create a new one.

> **Important:** The storage start date determines when rent starts accumulating. If you backdate an inflow, the rent calculation at outflow will cover the full period from that date.

---

**Next:** [Chapter 4 -- Storage Outflow](./04-storage-outflow.md)
