-- payment_links was originally designed for grain customer rent payments,
-- where customer_id FK -> customers.id was always required. With the SaaS
-- subscription billing flow, the "customer" is the warehouse owner (a
-- profiles row), not a row in the customers table — so the NOT NULL
-- constraint blocks subscription payment link creation.
--
-- The FK stays (so non-null values still reference real customers); only
-- the NOT NULL is dropped.
ALTER TABLE public.payment_links ALTER COLUMN customer_id DROP NOT NULL;
