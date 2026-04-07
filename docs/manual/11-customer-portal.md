# Chapter 11: Customer Portal

Give your customers self-service access to view their storage records, payment history, and outstanding balance.

---

## Overview

The Customer Portal is a separate, read-only interface designed for your customers. It lets them check on their stored goods and account balance without calling or visiting your office.

Customers access the portal through a dedicated login page using their registered mobile number. They cannot make changes -- the portal is view-only.

---

## 11.1 What Is the Customer Portal?

The portal is a simple, mobile-friendly page that shows a customer:

- Which warehouses hold their goods
- What commodities are stored and in what quantity
- How long each item has been in storage
- How much has been billed and paid
- Any outstanding balance (amount due)
- History of completed (withdrawn) records

Think of it as a live statement that customers can check anytime from their phone.

[Screenshot: Customer portal showing the global portfolio header with total bags and warehouse cards below]

---

## 11.2 How Customers Access the Portal

### Login Process

1. The customer opens the portal URL (for example, yoursite.com/portal/login).
2. They enter their 10-digit mobile number (the one registered in your system).
3. They tap **Get Login OTP**.
4. An OTP is sent to their phone.
5. They enter the OTP to sign in.

No password is needed. The portal uses secure, one-time codes for authentication.

[Screenshot: Portal login page with mobile number field and OTP button]

> **Important:** The mobile number must match exactly what you entered when creating the customer record in GrainFlow. If a customer cannot log in, verify their phone number in your customer list.

> **Tip:** Share the portal link with customers via SMS or WhatsApp after their first inflow. This saves you from fielding daily "how many bags do I have?" phone calls.

---

## 11.3 What Customers Can See

### Global Portfolio Header

At the top, a summary card shows:

- **Total bags currently stored** across all your warehouses
- **Number of warehouse locations** where they have goods

### Active Records

Under the "Active" tab, each warehouse location shows:

- **Warehouse name and location**
- **Total bags in stock** at that location
- **Amount paid** so far (Rs.)
- **Amount due** (Rs.) -- highlighted in red if there is an outstanding balance
- **Per-record details:**
  - Commodity name (for example, Groundnut, Paddy)
  - Record number
  - Storage start date
  - Days in storage
  - Number of bags
  - Due amount for that specific record

Customers can tap **View Details** on any record to see a timeline of all activity:
- Initial inflow (date and bag count)
- Payments received (date and amount)
- Stock withdrawals (date and bags withdrawn)

[Screenshot: Active records view showing warehouse card with individual storage entries]

### History (Completed Records)

The "History" tab shows records where all goods have been withdrawn. Each entry is marked as "Withdrawn" and displays the commodity, dates, and final billing summary.

### Download Statement

Customers can tap the **Statement** button on the portfolio header to download a consolidated PDF of all their records across all warehouses.

### Print Receipt

Each record has a **Print** button that generates a receipt document for that specific storage entry.

---

## 11.4 What Customers Cannot Do

The portal is strictly read-only. Customers cannot:

- Add or modify storage records
- Record payments
- Request outflows or withdrawals
- Change their account details
- Access other customers' data
- View warehouse settings or team information

All data changes must be made by your warehouse staff through the main GrainFlow dashboard.

---

## 11.5 Admin Access to the Portal

If you (as an admin, manager, or owner) visit the portal page, you will see a **Back to Dashboard** link that takes you back to the main GrainFlow interface. This is useful when you want to preview what a customer sees.

Regular customers will not see this link.

---

## 11.6 Setting Up the Portal for Your Customers

There is no separate setup needed. The portal is always available. To start using it:

1. Make sure your customers have a valid mobile number in their customer record.
2. Share the portal URL with them.
3. They log in with their mobile number and OTP.

That is all. The portal automatically shows data from all warehouses where the customer has records.

---

## Tips

- **Print the portal URL on your physical receipts.** This helps customers discover the self-service option.
- **Tell customers about the Statement download.** It gives them a PDF record of everything, which they may need for their own accounting or loan applications.
- **If a customer sees "No Records Found" after logging in**, check that their phone number in GrainFlow matches the number they used to log in. Even a single digit difference will prevent the match.
- **Use the portal as a trust-builder.** Customers who can verify their own records are more likely to continue storing with you.
