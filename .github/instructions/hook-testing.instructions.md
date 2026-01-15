---
applyTo: 'src/renderer/src/**/*.test.tsx'
---

# Hook Testing Guide

## Scope

These instructions cover writing Jest tests for React hooks in the renderer application under `src/renderer/src`. This guide addresses the specific challenges and patterns encountered in this project's testing environment.

## Key Testing Challenges in This Project

### 1. Complex Dependency Chains

- Many hooks import contexts that have deep dependency trees leading to problematic modules like `react-localization`
- Direct context provider usage in tests can cause "Cannot use import statement outside a module" errors
- Solution: Mock dependencies comprehensively rather than trying to provide real context

### 2. Context Dependencies

- Hooks often depend on contexts like `PlanContext`, `GlobalContext`, etc.
- These contexts import Redux stores, localization, and other complex dependencies
- Solution: Mock `useContext` directly instead of trying to provide context values

## Testing Pattern for Hooks

### Basic Test Structure

```typescript
import { renderHook } from '@testing-library/react';
import React from 'react';

// Mock dependencies BEFORE importing the hook
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useContext: jest.fn(),
  useMemo: jest.fn(),
  // Add other React hooks as needed
}));

jest.mock('../../context/useGlobal', () => ({
  useGlobal: jest.fn(),
}));

jest.mock('../../crud', () => ({
  // Mock all crud functions the hook uses
  findRecord: jest.fn(),
  sectionDescription: jest.fn(),
}));

// Import the hook AFTER mocking
import { useYourHook } from './useYourHook';

// Get references to mocked functions
const { useContext, useMemo } = React;
const { useGlobal } = require('../../context/useGlobal');
const { findRecord } = require('../../crud');
```

### Mock Setup Pattern

```typescript
describe('useYourHook', () => {
  const mockContextValue = {
    // Mock context state structure
    state: {
      sectionArr: [[1, 'Section One']],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    (useGlobal as jest.Mock).mockReturnValue([mockMemory, jest.fn()]);
    (useContext as jest.Mock).mockReturnValue(mockContextValue);
    (findRecord as jest.Mock).mockReturnValue(undefined);

    // Mock useMemo to return the factory result directly
    (useMemo as jest.Mock).mockImplementation((factory) => factory());
  });
});
```

## Comprehensive Mocking Strategy

### Required Mocks

1. **React hooks**: `useContext`, `useMemo`, `useCallback`, etc.
2. **Custom contexts**: `useGlobal`, context imports
3. **CRUD functions**: Any imported utility functions
4. **Model imports**: Usually work fine, but mock if causing issues

### Mock Context Providers

Instead of creating context providers, mock `useContext` directly:

```typescript
// DON'T do this (causes dependency issues):
const Wrapper = ({ children }) => (
  <PlanContext.Provider value={mockValue}>
    {children}
  </PlanContext.Provider>
);

// DO this instead:
(useContext as jest.Mock).mockReturnValue(mockValue);
```

## Common Test Cases for Hooks

### 1. Basic Functionality

```typescript
it('should return expected value/function', () => {
  const { result } = renderHook(() => useYourHook());
  expect(typeof result.current).toBe('function');
});
```

### 2. Dependency Calls

```typescript
it('should call dependencies with correct parameters', () => {
  const { result } = renderHook(() => useYourHook());
  const hookFunction = result.current;

  hookFunction(mockInput);

  expect(mockedDependency).toHaveBeenCalledWith(expectedParams);
});
```

### 3. Edge Cases

```typescript
it('should handle undefined/null inputs gracefully', () => {
  (mockedDependency as jest.Mock).mockReturnValue(undefined);

  const { result } = renderHook(() => useYourHook());
  const hookFunction = result.current;

  expect(() => hookFunction(null)).not.toThrow();
});
```

### 4. Context Changes (useMemo behavior)

```typescript
it('should update when dependencies change', () => {
  const initialValue = { data: 'initial' };
  const updatedValue = { data: 'updated' };

  (useContext as jest.Mock).mockReturnValue(initialValue);

  const { result, rerender } = renderHook(() => useYourHook());

  // Update context
  (useContext as jest.Mock).mockReturnValue(updatedValue);
  rerender();

  // Test that hook uses updated value
  expect(result.current).toBeDefined();
});
```

## Model Type Utilities

### Creating Mock Objects

Create helper functions for complex model objects:

```typescript
const createMockRow = (overrides: Partial<ISheet> = {}): ISheet => ({
  level: SheetLevel.Section,
  kind: IwsKind.Section,
  sectionSeq: 1,
  passageSeq: 0,
  passageType: PassageTypeEnum.PASSAGE,
  deleted: false,
  filtered: false,
  published: [],
  ...overrides,
});
```

## Import Pattern Gotchas

### 1. Import Order Matters

- Always mock dependencies before importing the hook
- Use `require()` for getting mock references after mocking

### 2. Enum Usage

- Import enums from their correct locations
- Common enums: `PassageTypeEnum`, `SheetLevel`, `IwsKind`
- `PublishDestinationEnum` comes from `../../crud`, not model

### 3. Interface Requirements

- `ISheet` requires `deleted`, `filtered`, and `published` properties
- Use mock helper functions to ensure all required properties are present

## Testing Environment

### Jest Configuration

- Tests run in `jsdom` environment
- TypeScript configuration uses `tsconfig.jest.json`
- Setup file: `jest.setup.ts` provides global test utilities

### Running Tests

```bash
cd src/renderer
npm test -- yourHookName.test.tsx
```

## Common Errors and Solutions

### "Cannot use import statement outside a module"

- **Cause**: Complex dependency chain importing problematic modules
- **Solution**: Mock all dependencies comprehensively, avoid real context providers

### "Property does not exist on type"

- **Cause**: Missing required properties on mock objects
- **Solution**: Use helper functions that include all required properties

### "Cannot access before initialization"

- **Cause**: React reference in mock setup before import
- **Solution**: Use `require()` syntax for mock references

### Mock function not working

- **Cause**: Mock setup after import, or incorrect mock pattern
- **Solution**: Ensure mocks are set up before imports, use proper jest.Mock casting

## Best Practices

1. **Comprehensive Mocking**: Mock all external dependencies, don't try to use real ones
2. **Helper Functions**: Create mock object builders for complex types
3. **Clear Test Names**: Describe exactly what scenario is being tested
4. **Edge Case Coverage**: Test null/undefined inputs and error conditions
5. **Isolation**: Each test should be independent with proper cleanup
6. **Documentation**: Add comments explaining complex mock setups

## Example Template

```typescript
/**
 * Test suite for useExampleHook
 *
 * Brief description of what the hook does
 */

import { renderHook } from '@testing-library/react';
import React from 'react';

// Mock all dependencies first
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useContext: jest.fn(),
  useMemo: jest.fn(),
}));

jest.mock('../../context/useGlobal');
jest.mock('../../crud', () => ({
  someFunction: jest.fn(),
}));

// Import hook after mocking
import { useExampleHook } from './useExampleHook';
import { ISheet } from '../../model';

// Get mock references
const { useContext, useMemo } = React;
const { useGlobal } = require('../../context/useGlobal');
const { someFunction } = require('../../crud');

describe('useExampleHook', () => {
  const mockData = {
    /* mock setup */
  };

  const createMockInput = (overrides = {}): InputType => ({
    // default properties
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    (useGlobal as jest.Mock).mockReturnValue([mockMemory, jest.fn()]);
    (useContext as jest.Mock).mockReturnValue(mockData);
    (useMemo as jest.Mock).mockImplementation((factory) => factory());
  });

  it('should handle basic functionality', () => {
    // Test implementation
  });

  it('should handle edge cases', () => {
    // Test edge cases
  });
});
```

This pattern ensures reliable, isolated testing of hooks in this project's complex environment.
