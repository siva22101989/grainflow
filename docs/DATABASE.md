# Database Documentation

## Overview

GrainFlow uses PostgreSQL 17 via Supabase with Row Level Security (RLS) for multi-tenant data isolation. The schema is designed for agricultural warehouse management with strict referential integrity and soft delete capabilities.

---

## Core Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    WAREHOUSES ||--o{ USER_WAREHOUSES : "has users"
    WAREHOUSES ||--o{ CUSTOMERS : "manages customers
    WAREHOUSES ||--o{ STORAGE_RECORDS : "tracks inventory"
    WAREHOUSES ||--o{ EXPENSES : "records expenses"
    WAREHOUSES ||--o{ WAREHOUSE_LOTS : "has zones"
    WAREHOUSES ||--o{ SUBSCRIPTIONS : "has plan"

    CUSTOMERS ||--o{ STORAGE_RECORDS : "owns stock"
    STORAGE_RECORDS ||--o{ PAYMENTS : "receives payments"
    STORAGE_RECORDS ||--o{ WITHDRAWAL_TRANSACTIONS : "tracks withdrawals"

    PROFILES ||--o{ USER_WAREHOUSES : "assigned to"
    PLANS ||--o{ SUBSCRIPTIONS : "defines features"
```

---

## Tables

### `warehouses`

**Purpose:** Multi-tenant warehouse entities

| Column       | Type        | Constraints                            | Description        |
| ------------ | ----------- | -------------------------------------- | ------------------ |
| `id`         | UUID        | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier  |
| `name`       | TEXT        | NOT NULL                               | Warehouse name     |
| `location`   | TEXT        | NULL                                   | Physical address   |
| `phone`      | TEXT        | NULL                                   | Contact number     |
| `email`      | TEXT        | NULL                                   | Contact email      |
| `created_at` | TIMESTAMPTZ | DEFAULT now()                          | Creation timestamp |

**Indexes:**

```sql
CREATE INDEX idx_warehouses_created_at ON warehouses(created_at DESC);
```

---

### `profiles`

**Purpose:** User profiles with role-based access control

| Column         | Type        | Constraints                | Description                                         |
| -------------- | ----------- | -------------------------- | --------------------------------------------------- |
| `id`           | UUID        | PRIMARY KEY, FK→auth.users | Supabase Auth user ID                               |
| `warehouse_id` | UUID        | FK→warehouses              | Primary warehouse (deprecated, use user_warehouses) |
| `role`         | user_roles  | NOT NULL, DEFAULT 'staff'  | Global role                                         |
| `full_name`    | TEXT        | NULL                       | Display name                                        |
| `avatar_url`   | TEXT        | NULL                       | Profile picture URL                                 |
| `created_at`   | TIMESTAMPTZ | DEFAULT now()              | Account creation                                    |
| `updated_at`   | TIMESTAMPTZ | DEFAULT now()              | Last modified                                       |

**Enum `user_roles`:**

```sql
CREATE TYPE user_roles AS ENUM (
  'super_admin',  -- System owner
  'owner',        -- Warehouse owner
  'admin',        -- Full warehouse access
  'manager',      -- Reports + stock management
  'staff',        -- Basic operations
  'customer'      -- View-only own records
);
```

**RLS Policies:**

- ✅ Users can view all profiles (for team management)
- ✅ Users can update only their own profile

---

### `user_warehouses`

**Purpose:** Many-to-many relationship for warehouse access

| Column         | Type        | Constraints               | Description             |
| -------------- | ----------- | ------------------------- | ----------------------- |
| `id`           | UUID        | PRIMARY KEY               | Unique identifier       |
| `user_id`      | UUID        | FK→profiles, NOT NULL     | User                    |
| `warehouse_id` | UUID        | FK→warehouses, NOT NULL   | Warehouse               |
| `role`         | user_roles  | NOT NULL, DEFAULT 'staff' | Warehouse-specific role |
| `created_at`   | TIMESTAMPTZ | DEFAULT now()             | Assignment date         |

**Unique Constraint:**

```sql
UNIQUE(user_id, warehouse_id)
```

**Indexes:**

```sql
CREATE INDEX idx_user_warehouses_user_id ON user_warehouses(user_id);
CREATE INDEX idx_user_warehouses_warehouse_id ON user_warehouses(warehouse_id);
```

**RLS Policies:**

- ✅ Users see their own warehouse assignments

---

### `customers`

**Purpose:** Customer/client records for each warehouse

| Column           | Type        | Constraints             | Description        |
| ---------------- | ----------- | ----------------------- | ------------------ |
| `id`             | UUID        | PRIMARY KEY             | Unique identifier  |
| `warehouse_id`   | UUID        | FK→warehouses, NOT NULL | Owning warehouse   |
| name`            | TEXT        | NOT NULL                | Customer name      |
| `phone`          | TEXT        | NOT NULL                | Contact number     |
| `address`        | TEXT        | NULL                    | Physical address   |
| `linked_user_id` | UUID        | FK→profiles, NULL       | Portal access user |
| `created_at`     | TIMESTAMPTZ | DEFAULT now()           | Record creation    |
| `updated_at`     | TIMESTAMPTZ | DEFAULT now()           | Last modified      |

**Indexes:**

```sql
CREATE INDEX idx_customers_warehouse_id ON customers(warehouse_id);
CREATE INDEX idx_customers_phone ON customers(phone);
-- Full-text search (from performance migration)
CREATE INDEX idx_customers_name_trgm ON customers USING gin(name gin_trgm_ops);
```

**RLS Policies:**

- ✅ Users see customers from their assigned warehouses
- ✅ Customers see only their own record (if `linked_user_id` = auth.uid())

---

### `storage_records`

**Purpose:** Core inventory tracking (inflow/outflow transactions)

| Column                  | Type          | Constraints             | Description                  |
| ----------------------- | ------------- | ----------------------- | ---------------------------- |
| `id`                    | UUID          | PRIMARY KEY             | Unique identifier            |
| `warehouse_id`          | UUID          | FK→warehouses, NOT NULL | Owning warehouse             |
| `customer_id`           | UUID          | FK→customers, NOT NULL  | Stock owner                  |
| `lot_id`                | UUID          | FK→warehouse_lots, NULL | Storage zone                 |
| `crop_id`               | UUID          | FK→crops, NULL          | Commodity type               |
| `record_id`             | TEXT          | UNIQUE, NOT NULL        | Human-readable ID (REC-1001) |
| `commodity_description` | TEXT          | NOT NULL                | Commodity name               |
| `bags_stored`           | INTEGER       | NOT NULL, CHECK > 0     | Quantity deposited           |
| `storage_start_date`    | DATE          | NOT NULL                | Inflow date                  |
| `storage_end_date`      | DATE          | NULL                    | Outflow date (NULL = active) |
| `hamali_rate`           | NUMERIC(10,2) | DEFAULT 0               | Labor charge per bag         |
| `hamali_payable`        | NUMERIC(10,2) | DEFAULT 0               | Total labor due              |
| `total_rent_billed`     | NUMERIC(10,2) | DEFAULT 0               | Total storage rent           |
| `outflow_invoice_no`    | TEXT          | NULL                    | Invoice reference            |
| `created_at`            | TIMESTAMPTZ   | DEFAULT now()           | Record creation              |
| `updated_at`            | TIMESTAMPTZ   | DEFAULT now()           | Last modified                |

**Indexes:**

```sql
CREATE INDEX idx_storage_records_customer_id ON storage_records(customer_id);
CREATE INDEX idx_storage_records_warehouse_id ON storage_records(warehouse_id);
CREATE INDEX idx_storage_records_lot_id ON storage_records(lot_id);
CREATE INDEX idx_storage_records_crop_id ON storage_records(crop_id);
CREATE INDEX idx_storage_records_created_at ON storage_records(created_at DESC);

-- Active records optimization
CREATE INDEX idx_storage_active ON storage_records(warehouse_id, storage_end_date DESC)
  WHERE storage_end_date IS NULL;

-- Date range queries
CREATE INDEX idx_storage_dates ON storage_records(warehouse_id, storage_start_date DESC, storage_end_date DESC);
```

**RLS Policies:**

- ✅ Users see records from their warehouses (uses `belongs_to_warehouse()` function instead of direct `user_warehouses` join)
- ✅ Customers see only their own records

---

### `payments`

**Purpose:** Payment transactions against storage records

| Column              | Type          | Constraints                  | Description                 |
| ------------------- | ------------- | ---------------------------- | --------------------------- |
| `id`                | UUID          | PRIMARY KEY                  | Unique identifier           |
| `storage_record_id` | UUID          | FK→storage_records, NOT NULL | Related record              |
| `payment_id`        | TEXT          | UNIQUE, NOT NULL             | Human-readable ID (PAY-505) |
| `amount`            | NUMERIC(10,2) | NOT NULL, CHECK > 0          | Payment amount              |
| `payment_date`      | DATE          | NOT NULL                     | Transaction date            |
| `payment_type`      | TEXT          | DEFAULT 'rent'               | rent, hamali, advance       |
| `notes`             | TEXT          | NULL                         | Optional memo               |
| `created_at`        | TIMESTAMPTZ   | DEFAULT now()                | Record creation             |

**Indexes:**

```sql
CREATE INDEX idx_payments_storage_record_id ON payments(storage_record_id);
CREATE INDEX idx_payments_date ON payments(payment_date DESC);
```

**RLS Policies:**

- ✅ Users see payments for their warehouse records

---

### `withdrawal_transactions`

**Purpose:** Detailed audit trail of partial/full withdrawals

| Column              | Type          | Constraints                  | Description                    |
| ------------------- | ------------- | ---------------------------- | ------------------------------ |
| `id`                | UUID          | PRIMARY KEY                  | Unique identifier              |
| `storage_record_id` | UUID          | FK→storage_records, NOT NULL | Parent record                  |
| `bags_withdrawn`    | INTEGER       | NOT NULL, CHECK > 0          | Quantity removed               |
| `withdrawal_date`   | DATE          | NOT NULL                     | Transaction date               |
| `rent_per_bag`      | NUMERIC(10,2) | NOT NULL                     | Calculated rate                |
| `total_rent`        | NUMERIC(10,2) | NOT NULL                     | Total rent for this withdrawal |
| `created_at`        | TIMESTAMPTZ   | DEFAULT now()                | Record creation                |

**Indexes:**

```sql
CREATE INDEX idx_transactions_record_id ON withdrawal_transactions(storage_record_id);
CREATE INDEX idx_transactions_date ON withdrawal_transactions(withdrawal_date DESC);
```

---

### `expenses`

**Purpose:** Warehouse operational expenses

| Column         | Type             | Constraints             | Description       |
| -------------- | ---------------- | ----------------------- | ----------------- |
| `id`           | UUID             | PRIMARY KEY             | Unique identifier |
| `warehouse_id` | UUID             | FK→warehouses, NOT NULL | Warehouse         |
| `category`     | expense_category | NOT NULL                | Expense type      |
| `amount`       | NUMERIC(10,2)    | NOT NULL, CHECK > 0     | Expense amount    |
| `expense_date` | DATE             | NOT NULL                | Date incurred     |
| `description`  | TEXT             | NULL                    | Notes             |
| `created_at`   | TIMESTAMPTZ      | DEFAULT now()           | Record creation   |

**Enum `expense_category`:**

```sql
CREATE TYPE expense_category AS ENUM ('staff', 'utilities', 'maintenance', 'other');
```

**RLS Policies:**

- ✅ Users see expenses from their warehouses

---

### `warehouse_lots`

**Purpose:** Physical storage zones/sections within a warehouse

| Column          | Type        | Constraints             | Description                        |
| --------------- | ----------- | ----------------------- | ---------------------------------- |
| `id`            | UUID        | PRIMARY KEY             | Unique identifier                  |
| `warehouse_id`  | UUID        | FK→warehouses, NOT NULL | Parent warehouse                   |
| `lot_name`      | TEXT        | NOT NULL                | Zone identifier (Row A, Section 1) |
| `capacity`      | INTEGER     | NULL                    | Max bags                           |
| `current_stock` | INTEGER     | DEFAULT 0               | Current occupancy (auto-updated)   |
| `created_at`    | TIMESTAMPTZ | DEFAULT now()           | Creation timestamp                 |
| `updated_at`    | TIMESTAMPTZ | DEFAULT now()           | Last modified                      |

**Trigger:**

```sql
-- Auto-update current_stock when storage_records change (sync_lot_stock)
-- Fires on every INSERT, UPDATE, or DELETE on storage_records
-- Recalculates current_stock as SUM(bags_stored) for active records in the lot
CREATE TRIGGER trg_sync_warehouse_stock
  AFTER INSERT OR UPDATE OR DELETE ON storage_records
  FOR EACH ROW EXECUTE FUNCTION sync_warehouse_stock();
```

> **Note:** The `sync_lot_stock` trigger ensures `current_stock` is always consistent with the actual `SUM(bags_stored)` from `storage_records` where `storage_end_date IS NULL`. This fires on INSERT, UPDATE, and DELETE to maintain data integrity even when records are removed or modified.

---

### `sequences`

**Purpose:** Auto-increment counters for human-readable IDs

| Column          | Type    | Constraints             | Description                        |
| --------------- | ------- | ----------------------- | ---------------------------------- |
| `id`            | UUID    | PRIMARY KEY             | Unique identifier                  |
| `warehouse_id`  | UUID    | FK→warehouses, NOT NULL | Tenant isolation                   |
| `sequence_type` | TEXT    | NOT NULL                | Type (records, payments, invoices) |
| `current_value` | INTEGER | DEFAULT 0               | Current counter                    |

**Unique Constraint:**

```sql
UNIQUE(warehouse_id, sequence_type)
```

**RLS Policies:**

- ✅ Users can read sequences for their warehouses
- ✅ System can increment via SECURITY DEFINER functions

---

### `subscriptions`

**Purpose:** Connects warehouses to subscription plans

| Column               | Type        | Constraints                     | Description                          |
| -------------------- | ----------- | ------------------------------- | ------------------------------------ |
| `id`                 | UUID        | PRIMARY KEY                     | Unique identifier                    |
| `warehouse_id`       | UUID        | FK→warehouses, UNIQUE, NOT NULL | One subscription per warehouse       |
| `plan_id`            | UUID        | FK→plans, NOT NULL              | Active plan                          |
| `status`             | TEXT        | NOT NULL                        | active, inactive, past_due, canceled |
| `current_period_end` | TIMESTAMPTZ | NULL                            | Subscription expiry                  |
| `created_at`         | TIMESTAMPTZ | DEFAULT now()                   | Subscription start                   |
| `updated_at`         | TIMESTAMPTZ | DEFAULT now()                   | Last modified                        |

**RLS Policies:**

- ✅ Users can view subscriptions for their warehouses
- ✅ Only `super_admin` can manage subscriptions

> **Note:** The `process_subscription_renewals` RPC was fixed to join via `user_warehouses` instead of the non-existent `warehouses.owner_id` column.

---

### `plans`

**Purpose:** Subscription tier definitions

| Column             | Type        | Constraints      | Description         |
| ------------------ | ----------- | ---------------- | ------------------- |
| `id`               | UUID        | PRIMARY KEY      | Unique identifier   |
| `tier`             | plan_tier   | UNIQUE, NOT NULL | Plan tier           |
| `name`             | TEXT        | NOT NULL         | Display name        |
| `display_name`     | TEXT        | NOT NULL         | Marketing name      |
| `price`            | TEXT        | NOT NULL         | Price string for UI |
| `features`         | TEXT[]      | NOT NULL         | Feature list        |
| `razorpay_plan_id` | TEXT        | NULL             | Payment gateway ID  |
| `created_at`       | TIMESTAMPTZ | DEFAULT now()    | Creation timestamp  |

**Enum `plan_tier`:**

```sql
CREATE TYPE plan_tier AS ENUM ('free', 'starter', 'professional', 'enterprise');
```

> **Note:** Yearly plan limits were corrected -- `starter_yearly` and `professional_yearly` previously had free tier limits and have been updated to match their respective paid tier limits.

---

## Database Functions

### `sync_warehouse_stock()`

**Purpose:** Auto-update warehouse_lots.current_stock when storage_records change

```sql
CREATE OR REPLACE FUNCTION sync_warehouse_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lot_id IS NOT NULL THEN
    UPDATE warehouse_lots
    SET current_stock = (
      SELECT COALESCE(SUM(bags_stored), 0)
      FROM storage_records
      WHERE lot_id = NEW.lot_id AND storage_end_date IS NULL
    )
    WHERE id = NEW.lot_id;
  END IF;
  RETURN NEW;
END;
$$;
```

### `process_bulk_payment_atomic()`

**Purpose:** Atomically process bulk payments for multiple storage records in a single transaction

> **Note:** The RPC parameter signature now includes `warehouse_id`, `type`, and `notes` fields to ensure correct warehouse scoping and payment metadata.

### `set_updated_at()`

**Purpose:** Auto-update `updated_at` timestamp on row modification

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
```

**Applied to:**

- storage_records
- payments
- crops
- warehouse_lots
- customers

---

## Row Level Security (RLS) Policies

### Principles

1. **All tables have RLS enabled**
2. **Policies enforce multi-tenant isolation**
3. **Services bypass RLS using service_role key (server-only)**
4. **Client always uses anon key (RLS enforced)**

### Example Policy Pattern

```sql
-- SELECT: Users see data from their assigned warehouses
CREATE POLICY "Users see own warehouse data" ON table_name
  FOR SELECT USING (
    warehouse_id IN (
      SELECT warehouse_id FROM user_warehouses
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: Users can only create data in their warehouses
CREATE POLICY "Users insert own warehouse data" ON table_name
  FOR INSERT WITH CHECK (
    warehouse_id IN (
      SELECT warehouse_id FROM user_warehouses
      WHERE user_id = auth.uid()
    )
  );
```

---

## Migrations

### Migration Files Location

```
supabase/migrations/
├── 00000000_consolidated_schema.sql  # Base schema
├── 20250101_performance_indexes.sql  # Performance optimizations
├── 20250101_fix_subscription_rls.sql # Subscription access control
└── ... (new migrations added chronologically)
```

### Migration Best Practices

1. **Never delete migration files**
2. **Always append new migrations**
3. **Test locally first**
4. **Apply to staging before production**
5. **Include rollback SQL in comments**

### Applying Migrations

**Via Supabase CLI:**

```bash
supabase db push --db-url <connection_string>
```

**Via MCP Server:**

```typescript
await supabase_mcp.apply_migration({
  project_id: "ayndosipsjjcagfrdglg",
  name: "migration_name",
  query: "SQL_CONTENT",
});
```

---

## Queries

### Common Query Patterns

**Get active storage records for a warehouse:**

```sql
SELECT sr.*, c.name as customer_name, c.phone
FROM storage_records sr
INNER JOIN customers c ON c.id = sr.customer_id
WHERE sr.warehouse_id = $1
  AND sr.storage_end_date IS NULL
ORDER BY sr.created_at DESC;
```

**Calculate customer balance:**

```sql
SELECT
  c.id,
  c.name,
  COALESCE(SUM(sr.total_rent_billed), 0) - COALESCE(SUM(p.amount), 0) AS balance
FROM customers c
LEFT JOIN storage_records sr ON sr.customer_id = c.id
LEFT JOIN payments p ON p.storage_record_id = sr.id
WHERE c.warehouse_id = $1
GROUP BY c.id, c.name;
```

**Get monthly revenue:**

```sql
SELECT
  DATE_TRUNC('month', payment_date) AS month,
  SUM(amount) AS revenue
FROM payments p
INNER JOIN storage_records sr ON sr.id = p.storage_record_id
WHERE sr.warehouse_id = $1
  AND p.payment_date >= NOW() - INTERVAL '6 months'
GROUP BY month
ORDER BY month DESC;
```

---

## Performance Considerations

### Indexing Strategy

1. **Foreign Keys** - Always indexed
2. **Date Columns** - DESC index for recent-first queries
3. **Composite Indexes** - For multi-column filters
4. **Partial Indexes** - For filtered queries (e.g., active records)
5. **GIN Indexes** - For full-text search (pg_trgm)

### Query Optimization

**Use `EXPLAIN ANALYZE` to identify slow queries:**

```sql
EXPLAIN ANALYZE
SELECT * FROM storage_records
WHERE warehouse_id = 'xxx'
  AND storage_end_date IS NULL;
```

**Look for:**

- Sequential Scans (should use Index Scan)
- High cost estimates
- Missing indexes

---

## Backup & Recovery

### Automatic Backups

**Supabase Configuration:**

- Frequency: Daily at 2 AM UTC
- Retention: 7 days (free tier), 30 days (pro)
- Storage: Supabase managed

### Manual Backup

```bash
# Export full database
pg_dump <connection_string> > backup_$(date +%Y%m%d).sql

# Restore from backup
psql <connection_string> < backup_20260105.sql
```

### Point-in-Time Recovery

**Available on Pro tier:**

- Recovery window: Up to 7 days
- Granularity: To the second
- Access: Via Supabase Dashboard

---

## Data Integrity Rules

### Constraints

1. **Foreign Keys** - Prevent orphaned records
2. **Check Constraints** - Validate data ranges
3. **Unique Constraints** - Enforce uniqueness
4. **Not Null** - Required fields

### Cascade Behavior

**Most FKs use `ON DELETE RESTRICT`:**

- Cannot delete a warehouse if it has customers
- Cannot delete a customer if they have storage records

**Exception:**

- `profiles.warehouse_id` allows NULL (soft delete)

---

## Monitoring

### Database Health Checks

**Check connection pool:**

```sql
SELECT count(*) FROM pg_stat_activity;
```

**Check table sizes:**

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Check slow queries:**

```sql
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## Troubleshooting

### Common Issues

**RLS Policy Blocking Legitimate Access:**

```sql
-- Check user's warehouse assignments
SELECT * FROM user_warehouses WHERE user_id = auth.uid();

-- Verify RLS policies
SELECT * FROM pg_policies WHERE tablename = 'table_name';
```

**Sequence ID Conflicts:**

```sql
-- Reset sequence if needed
UPDATE sequences
SET current_value = (SELECT MAX(CAST(SUBSTRING(record_id FROM 5) AS INTEGER)) FROM storage_records)
WHERE sequence_type = 'records';
```

---

**Last Updated:** January 5, 2026  
**Version:** 1.0  
**Maintainer:** Database Team
