# Testing Guide

## Overview

This guide covers testing for the QueryAI backend API.

## Test Framework

- **Jest** - JavaScript testing framework
- **ts-jest** - TypeScript support for Jest
- **@types/jest** - TypeScript types for Jest

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

## Test Structure

Tests are located in `src/__tests__/` directory:

```
src/__tests__/
├── setup.ts              # Test setup and environment variables
├── utils.test.ts         # Utility function tests
├── error-handler.test.ts # Error class tests
├── auth-service.test.ts  # Authentication service tests
└── ai-service.test.ts    # AI service tests
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect } from '@jest/globals';

describe('Feature Name', () => {
  it('should do something', () => {
    expect(actual).toBe(expected);
  });
});
```

### Mocking

```typescript
jest.mock('../config/database', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
    },
  },
}));
```

## Test Coverage

Current test coverage includes:
- ✅ Error classes (ValidationError, AuthenticationError, etc.)
- ✅ Input validation
- ✅ Utility functions
- ✅ Authentication service validation
- ✅ AI service validation

## Adding New Tests

1. Create test file: `src/__tests__/feature-name.test.ts`
2. Import necessary modules
3. Write test cases
4. Run tests: `npm test`

## Continuous Integration

Tests should be run:
- Before committing code
- In CI/CD pipeline
- Before deployment

## Best Practices

1. **Test one thing at a time** - Each test should verify one behavior
2. **Use descriptive names** - Test names should describe what they test
3. **Mock external dependencies** - Don't make real API calls in tests
4. **Clean up after tests** - Use `beforeEach`/`afterEach` to reset state
5. **Test edge cases** - Include boundary conditions and error cases
