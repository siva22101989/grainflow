# 🧪 Testing Guide

## Overview

GrainFlow uses a comprehensive testing strategy with **Vitest** for unit/integration tests and **Playwright** for end-to-end testing.

**Current Status:** 100% test pass rate (291/291 tests passing)

---

## Running Tests

### Unit & Integration Tests (Vitest)

```bash
# Run all tests
npm test

# Run tests in watch mode
npx vitest

# Run with coverage report
npm run test -- --coverage

# Run specific test file
npx vitest run src/lib/validation.test.ts
```

### End-to-End Tests (Playwright)

```bash
# Run E2E tests
npm run test:e2e

# Run with UI mode
npx playwright test --ui

# Run specific browser
npx playwright test --project=chromium
```

---

## Test Coverage

### Validation Suite (54 tests) ✅

**File:** `src/lib/validation.test.ts`

- **String Validation**
  - `sanitizeString()` - XSS prevention (4 tests)
  - `isValidEmail()` - Email format validation (4 tests)
  - `isValidUUID()` - UUID v4 validation (4 tests)
  - `isValidPhone()` - International phone (10-15 digits) (6 tests)
  - `formatPhoneNumber()` - Phone number formatting (4 tests)

- **Number Validation**
  - `isPositiveNumber()` - Positive number checks (5 tests)

- **Date Validation**
  - `isNotFutureDate()` - Past/present date validation (3 tests)

- **Schema Validation (Zod)**
  - CommonSchemas.uuid - UUID schema validation (2 tests)
  - CommonSchemas.email - Email schema (2 tests)
  - CommonSchemas.phone - Phone with transformation (3 tests)
  - CommonSchemas.positiveInt - Positive integers (4 tests)
  - CommonSchemas.currency - Currency amounts (3 tests)
  - CommonSchemas.pastDate - Date constraints (2 tests)
  - CommonSchemas.date - Date transformation (2 tests)

- **Form Data Validation**
  - `validateFormData()` - FormData to schema mapping (3 tests)

### Billing Logic Tests

**Files:** `src/lib/billing.test.ts`, `src/lib/billing-regression.test.ts`

- Rent calculation algorithms
- Multi-year storage pricing
- Leap year handling
- Edge case month boundaries
- Payment allocation logic

### Payment Services

**File:** `src/test/unit/payment-service.test.ts`

- Payment recording
- Payment history
- Amount validation
- Payment method verification

### Integration Tests

**Files:** `src/test/integration/*.test.ts`

- Complete payment flow (record to allocation)
- Outflow process (withdrawal to billing)
- Storage record lifecycle

### E2E Tests (Playwright)

**Files:** `tests/e2e/*.spec.ts`

- User authentication flows
- Customer management
- Stock in/out workflows
- Payment recording
- Report generation

### Action Tests (116 tests)

**Files:** `src/test/actions/*.test.ts`

- Server action validation and authorization
- CRUD operations for all major entities (customers, storage records, payments, lots, warehouses)
- Subscription and payment flow actions
- Webhook handling and signature verification
- Role-based access control enforcement
- Uses test factories from `src/test/factories/index.ts` for consistent test data generation

### Webhook Signature Verification Tests

- Razorpay webhook signature validation
- Rejection of requests with missing or placeholder secrets
- Tampered payload detection

---

## Test Factories

**File:** `src/test/factories/index.ts`

Reusable factory functions for generating test data. Used across action tests and integration tests to create consistent, valid test objects (customers, warehouses, storage records, payments, subscriptions, etc.).

---

## Writing Tests

### 1. Unit Tests

Test individual functions in isolation:

```typescript
import { describe, it, expect } from "vitest";
import { calculateFinalRent } from "@/lib/billing";

describe("calculateFinalRent", () => {
  it("calculates 3-month storage correctly", () => {
    const record = {
      id: "123",
      storageStartDate: new Date("2024-01-01"),
      bagsStored: 100,
    };

    const result = calculateFinalRent(record, new Date("2024-04-01"), 50);

    expect(result.monthsStored).toBe(3);
    expect(result.rentPerBag).toBe(50); // RATE_6_MONTHS
  });
});
```

### 2. Integration Tests

Test complete workflows:

```typescript
import { describe, it, expect, beforeEach } from "vitest";

describe("Payment Flow", () => {
  beforeEach(() => {
    // Setup test database state
  });

  it("records payment and allocates to storage record", async () => {
    // Test multi-step process
  });
});
```

### 3. E2E Tests (Playwright)

Test user journeys:

```typescript
import { test, expect } from "@playwright/test";

test("customer can record inflow", async ({ page }) => {
  await page.goto("/customers/123");
  await page.click("text=New Inflow");
  await page.fill('[name="bags"]', "100");
  await page.click("text=Submit");

  await expect(page.locator("text=Success")).toBeVisible();
});
```

---

## Best Practices

### General

1. **Test behavior, not implementation** - Focus on what functions do, not how
2. **One assertion per test** - Keep tests focused and readable
3. **Use descriptive names** - Test names should explain what's being tested
4. **Test edge cases** - Null, undefined, boundary values, error states
5. **Keep tests independent** - Each test should run in isolation

### Vitest Specific

1. **Use type guards** - Leverage `isDefined()`, `isApiSuccess()` for type safety
2. **Mock external dependencies** - Use `vi.mock()` for DB/API calls
3. **Avoid test coupling** - Don't rely on test execution order
4. **Use `beforeEach` wisely** - Reset state between tests

### E2E Specific

1. **Use data-testid** - Add `data-testid` attributes for reliable selectors
2. **Wait for elements** - Use `waitFor` helpers to avoid flaky tests
3. **Test critical paths** - Focus on happy paths and error scenarios
4. **Keep tests fast** - Limit unnecessary navigation/waits

---

## Test Structure

```
project-root/
├── src/
│   ├── lib/
│   │   ├── validation.ts
│   │   ├── validation.test.ts      # Unit tests
│   │   ├── billing.ts
│   │   └── billing.test.ts
│   ├── test/
│   │   ├── setup.ts                # Vitest configuration
│   │   ├── utils.tsx               # Test utilities
│   │   ├── factories/
│   │   │   └── index.ts            # Test data factories
│   │   ├── mocks/                  # Mock implementations
│   │   ├── unit/                   # Unit tests
│   │   ├── actions/                # Server action tests (116 tests)
│   │   └── integration/            # Integration tests
│   └── components/
│       └── *.test.tsx              # Component tests
├── tests/
│   └── e2e/
│       └── *.spec.ts               # Playwright E2E tests
├── vitest.config.ts                # Vitest configuration
└── playwright.config.ts            # Playwright configuration
```

---

## Coverage Goals

- **Critical Business Logic**: 95%+ (billing, payments, validation)
- **Utilities**: 90%+ (helpers, transformations)
- **Components**: 70%+ (UI components)
- **Integration Flows**: 80%+ (critical user paths)

---

## Continuous Integration

Tests run automatically on:

- Every git push (via GitHub Actions)
- Pull request creation
- Before deployment

**CI Commands:**

```bash
# Type check
npm run typecheck

# Lint
npm run lint

# Unit tests
npm test

# E2E tests
npm run test:e2e
```

---

## Troubleshooting

### Common Issues

**Tests fail with "Cannot find module"**

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**E2E tests timeout**

```bash
# Increase timeout in playwright.config.ts
timeout: 60000 // 60 seconds
```

**Coverage not generating**

```bash
# Install coverage package
npm install -D @vitest/coverage-v8
```

---

_Last Updated: Apr 7, 2026_
_Next Review: May 7, 2026_
