/**
 * Test Data Factories
 * Consistent test data generators for the RENT/GrainFlow project
 */

let counter = 0;
function nextId() { return `test-${++counter}`; }

export function resetFactoryCounter() { counter = 0; }

// --- Customer Factory ---
export function buildCustomer(overrides: Record<string, any> = {}) {
  const id = nextId();
  return {
    id,
    name: `Customer ${id}`,
    phone: '9876543210',
    address: '123 Village Road, District',
    email: '',
    father_name: '',
    village: '',
    warehouse_id: 'wh-default',
    deleted_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// --- Storage Record Factory ---
export function buildStorageRecord(overrides: Record<string, any> = {}) {
  const id = nextId();
  return {
    id,
    recordNumber: `R-${id}`,
    customerId: 'cust-default',
    commodityDescription: 'Wheat',
    bagsStored: 100,
    location: 'Bay 1',
    storageStartDate: new Date('2024-01-01'),
    storageEndDate: null,
    hamaliPayable: 500,
    rentDue: 0,
    totalPaid: 0,
    outflowInvoiceNo: null,
    payments: [],
    warehouse_id: 'wh-default',
    deleted_at: null,
    ...overrides,
  };
}

// --- Payment Factory ---
export function buildPayment(overrides: Record<string, any> = {}) {
  const id = nextId();
  return {
    id,
    record_id: 'rec-default',
    amount: 1000,
    date: new Date().toISOString(),
    type: 'rent' as const,
    notes: 'Test payment',
    ...overrides,
  };
}

// --- Warehouse Factory ---
export function buildWarehouse(overrides: Record<string, any> = {}) {
  const id = nextId();
  return {
    id,
    name: `Warehouse ${id}`,
    location: 'Test Location',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// --- Subscription Factory ---
export function buildSubscription(overrides: Record<string, any> = {}) {
  const id = nextId();
  return {
    id,
    warehouse_id: 'wh-default',
    plan_id: 'plan-default',
    status: 'active' as const,
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    grace_period_end: null,
    grace_period_notified: false,
    ...overrides,
  };
}

// --- Plan Factory ---
export function buildPlan(overrides: Record<string, any> = {}) {
  const id = nextId();
  return {
    id,
    name: 'basic',
    display_name: 'Basic',
    tier: 'basic',
    price: 999,
    duration_days: 30,
    max_warehouses: 1,
    max_storage_records: 100,
    features: {},
    ...overrides,
  };
}

// --- Withdrawal Transaction Factory ---
export function buildWithdrawalTransaction(overrides: Record<string, any> = {}) {
  const id = nextId();
  return {
    id,
    record_id: 'rec-default',
    bags_withdrawn: 10,
    withdrawal_date: new Date().toISOString(),
    rent_charged: 500,
    discount: 0,
    batch_id: null,
    hamali_charged: 0,
    ...overrides,
  };
}

// --- FormData Builder ---
export function buildFormData(data: Record<string, string | boolean>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, String(value));
  }
  return formData;
}
