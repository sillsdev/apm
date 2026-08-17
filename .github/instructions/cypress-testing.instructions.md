# Cypress Component Testing Instructions

## Overview

This guide documents best practices and patterns for creating Cypress component tests in the APM Vite application, based on experience testing React components with complex dependencies like Orbit Memory, Redux, Material-UI, and custom global context providers.

---

## Essential Test Setup Patterns

### 1. Provider Stack Setup

All React components in this app require a complex provider stack. Use this standard pattern:

```tsx
// Mock dependencies first
const createMockLiveQuery = () => ({
  subscribe: () => () => {}, // Returns an unsubscribe function
  query: () => [],
});

const mockMemory = {
  cache: {
    query: () => [],
    liveQuery: createMockLiveQuery,
  },
  update: () => {},
} as unknown as Memory;

const mockCoordinator = {
  getSource: () => mockMemory,
} as unknown as Coordinator;

// Create Redux store with proper reducers
const mockStringsReducer = () => {
  const initialState = localizationReducer(undefined, { type: '@@INIT' });
  return initialState;
};

const mockStore = createStore(
  combineReducers({
    strings: mockStringsReducer,
    // Add other reducers as needed
  })
);

// Helper function to mount with providers
const mountComponent = (props, mockData = []) => {
  const initialState = createInitialState({
    memory: mockMemoryWithData,
    coordinator: mockCoordinatorWithData,
  });

  cy.mount(
    <Provider store={mockStore}>
      <GlobalProvider initialState={initialState}>
        <DataProvider dataStore={mockMemoryWithData}>
          <YourComponent {...props} />
        </DataProvider>
      </GlobalProvider>
    </Provider>
  );
};
```

### 2. Orbit Memory Mock Patterns

**Critical**: The `findRecord` function from `../../crud` uses `memory.cache.query` with a query builder pattern. Mock it properly:

```tsx
const mockMemoryWithData = {
  ...mockMemory,
  cache: {
    ...mockMemory.cache,
    query: (queryBuilder: any) => {
      // Handle function-style queries (like findRecord uses)
      if (typeof queryBuilder === 'function') {
        const mockQueryBuilderInstance = {
          findRecord: (identity: { type: string; id: string }) => {
            // Return matching record for the specific id
            return mockData.find(
              (record) =>
                identity.type === record.type && record.id === identity.id
            );
          },
          findRecords: (type: string) => {
            return mockData.filter((record) => record.type === type);
          },
        };
        return queryBuilder(mockQueryBuilderInstance);
      }
      // Fallback to data array for other query patterns
      return mockData;
    },
  },
} as unknown as Memory;
```

### 3. Model Mock Factory Functions

Create factory functions for consistent mock data:

```tsx
const createMockSection = (
  id: string,
  name: string,
  overrides: Partial<SectionD> = {}
): SectionD => ({
  id,
  type: 'section',
  attributes: {
    sequencenum: 1,
    name,
    graphics: '',
    published: false,
    publishTo: '',
    level: 1,
    state: '',
    dateCreated: '2024-01-01T00:00:00Z',
    dateUpdated: '2024-01-01T00:00:00Z',
    lastModifiedBy: 1,
    ...overrides.attributes,
  },
  relationships: {
    plan: { data: { type: 'plan', id: 'plan-1' } },
    ...overrides.relationships,
  },
  ...overrides,
});

const createMockSheet = (overrides: Partial<ISheet> = {}): ISheet => ({
  kind: IwsKind.SectionPassage,
  level: SheetLevel.Section,
  sectionSeq: 1,
  passageSeq: 1,
  sectionId: { type: 'section', id: 'section-1' } as RecordIdentity,
  book: 'GEN',
  reference: 'Genesis 1:1',
  comment: '',
  deleted: false,
  filtered: false,
  passageType: PassageTypeEnum.PASSAGE,
  ...overrides,
});
```

### 4. Localization Setup Patterns

**Critical**: Components using Redux selectors for localization require proper mock setup with LocalizedStrings objects and correct reducer structure.

```tsx
import LocalizedStrings from 'react-localization';
import localizationReducer from '../../store/localization/reducers';

// Create mock localization strings for each layout
const mockPlanSheetStrings = new LocalizedStrings({
  en: {
    unknownBook: 'Unknown Book',
    chapter: 'Chapter',
    verse: 'Verse',
    // Add other strings used by component
  },
});

const mockMainStrings = new LocalizedStrings({
  en: {
    updateAvailable: 'Update {0} available ({1})',
    goOnline: 'Go Online',
    // Add other main strings
  },
});

// Mock strings reducer with proper structure
const mockStringsReducer = () => {
  const initialState = localizationReducer(undefined, { type: '@@INIT' });
  return {
    ...initialState,
    loaded: true,
    lang: 'en',
    // Match the selector layout names exactly
    planSheet: mockPlanSheetStrings, // for planSheetSelector
    main: mockMainStrings, // for mainSelector
    shared: mockSharedStrings, // for sharedSelector
    cards: mockCardStrings, // for cardsSelector
    // Add other layout-specific strings as needed
  };
};

// Additional reducer mocks (books, etc.)
const mockBooksReducer = () => ({
  map: {
    GEN: 'Genesis',
    EXO: 'Exodus',
    MAT: 'Matthew',
    JOH: 'John',
    // Add other book mappings
  },
});

// Complete store setup
const mockStore = createStore(
  combineReducers({
    strings: mockStringsReducer,
    books: mockBooksReducer,
    // Add other reducers as needed
  })
);
```

**Key Points for Localization**:

- Each selector function (planSheetSelector, mainSelector, etc.) expects a specific layout name
- Mock LocalizedStrings objects must contain the actual keys used by components
- The localization reducer state must include `loaded: true` and correct `lang` property
- Book maps and other auxiliary data may also be needed depending on component dependencies

---

## Material-UI Testing Patterns

### 1. Use data-cy Attributes for Reliable Selection

Add test-specific attributes to components:

```tsx
// In component
<Box data-cy="component-container">
  <Typography data-cy="component-text">{content}</Typography>
</Box>;

// In test
cy.get('[data-cy="component-container"]').should('exist');
cy.get('[data-cy="component-text"]').should('contain.text', 'expected');
```

### 2. CSS Testing Patterns

**Computed vs Declared Values**: Material-UI computes CSS values at runtime. Handle this properly:

```tsx
// ❌ Wrong - expects declared CSS value
cy.get('[data-cy="element"]').should('have.css', 'width', '100%');

// ✅ Right - handles computed values
cy.get('[data-cy="element"]')
  .should('be.visible')
  .and(($el) => {
    const width = $el.css('width');
    const parentWidth = $el.parent().css('width');
    expect(width === '100%' || width === parentWidth).to.be.true;
  });

// ✅ Also Right - check actual computed color
cy.get('[data-cy="element"]').should('have.css', 'color', 'rgb(128, 128, 128)');
```

### 3. Empty Fragment Testing

When components return `<></>`, test for absence of specific elements, not all DOM elements:

```tsx
// ❌ Wrong - providers create DOM elements
cy.get('body').children().should('not.exist');

// ✅ Right - check for absence of component-specific elements
cy.get('[data-cy="component-container"]').should('not.exist');
```

### 4. Material-UI Avatar Testing

**Avatar Image Elements**: Material-UI Avatar with `src` prop doesn't always have `role="img"` attribute:

```tsx
// ❌ Wrong - role attribute may not exist
cy.get('[role="img"]').should('exist');

// ✅ Right - use img child selector
cy.get('.MuiAvatar-root img')
  .should('exist')
  .and('have.attr', 'src', 'expected-url');

// ✅ Check absence of image
cy.get('.MuiAvatar-root img').should('not.exist');
```

**String Avatar Text**: String avatars generate initials with specific casing rules:

```tsx
// ❌ Wrong - assuming all uppercase
cy.get('.MuiAvatar-root').should('contain.text', 'TI');

// ✅ Right - match actual implementation (mixed case for multi-word)
cy.get('.MuiAvatar-root').should('contain.text', 'Ti'); // "This is..." -> "Ti"
cy.get('.MuiAvatar-root').should('contain.text', 'T'); // "Test" -> "T"
```

### 5. GlobalProvider Context Setup

**Critical**: GlobalProvider requires `init` prop, not `initialState`, and needs complete GlobalState object:

```tsx
// ❌ Wrong - incorrect prop name and incomplete state
const createInitialState = () => ({
  memory: mockMemory,
  coordinator: mockCoordinator,
});

<GlobalProvider initialState={createInitialState()}>

// ✅ Right - use 'init' prop with complete GlobalState
import { GlobalState } from '../../context/GlobalContext';

const createInitialState = (overrides: Partial<GlobalState> = {}): GlobalState => ({
  coordinator: mockCoordinator,
  errorReporter: bugsnagClient,
  fingerprint: 'test-fingerprint',
  memory: mockMemory,
  lang: 'en',
  latestVersion: '',
  loadComplete: false,
  offlineOnly: false,
  organization: 'test-org',
  releaseDate: '',
  user: 'test-user',
  alertOpen: false,
  autoOpenAddMedia: false,
  changed: false,
  connected: true,
  dataChangeCount: 0,
  developer: false,
  enableOffsite: false,
  home: false,
  importexportBusy: false,
  orbitRetries: 0,
  orgRole: undefined,
  plan: '',
  playingMediaId: '',
  progress: 0,
  project: '',
  projectsLoaded: [],
  projType: '',
  remoteBusy: false,
  saveResult: undefined,
  snackAlert: undefined,
  snackMessage: (<></>) as React.JSX.Element,
  offline: false,
  mobileView: false,
  ...overrides,
});

<GlobalProvider init={createInitialState()}>
```

### 6. Context Provider Setup Patterns

**Critical**: Components using multiple context providers (PlanContext, TeamContext, etc.) require proper mock setup with all required state properties.

```tsx
import { PlanContext, ICtxState } from '../../context/PlanContext';

// Create mock context state factory
const createPlanContextState = (
  overrides: Partial<ICtxState> = {}
): ICtxState => ({
  t: {} as any,
  connected: true,
  projButtonStr: {} as any,
  mediafiles: [],
  discussions: [],
  groupmemberships: [],
  scripture: true, // Critical for scripture-dependent logic
  flat: false,
  shared: false,
  publishingOn: true,
  hidePublishing: true,
  canEditSheet: false,
  canPublish: false,
  sectionArr: [],
  setSectionArr: () => {},
  togglePublishing: () => {},
  setCanAddPublishing: () => {},
  tab: 0,
  setTab: () => {},
  ...overrides,
});

// In mount function
const mountComponent = (props, contextOverrides = {}) => {
  const planContextState = createPlanContextState(contextOverrides);
  const mockPlanContextValue = {
    state: planContextState,
    setState: cy.stub(),
  };

  cy.mount(
    <Provider store={mockStore}>
      <GlobalProvider init={createInitialState()}>
        <DataProvider dataStore={mockMemory}>
          <PlanContext.Provider value={mockPlanContextValue as any}>
            <YourComponent {...props} />
          </PlanContext.Provider>
        </DataProvider>
      </GlobalProvider>
    </Provider>
  );
};

// Usage in tests
mountComponent(
  {
    /* props */
  },
  { scripture: false }
); // Override context state
```

**Key Context Patterns**:

- Always provide complete context state objects, not partial ones
- Use factory functions with overrides for flexibility
- Mock all context method functions with cy.stub()
- Pay attention to boolean flags like `scripture` that affect component logic

---

## Common Test Categories

### 1. Core Functionality Tests

```tsx
it('should render main content when conditions are met', () => {
  // Test primary use case
});

it('should handle empty/undefined data gracefully', () => {
  // Test null/undefined scenarios
});

it('should return empty fragment when conditions not met', () => {
  // Test conditional rendering
});
```

### 2. Edge Case Tests

```tsx
it('should handle special characters in data', () => {
  // Test with special chars: quotes, symbols, unicode
});

it('should handle very long content', () => {
  // Test with long strings/data
});

it('should handle numeric vs string data types', () => {
  // Test data type variations
});
```

### 3. UI/Styling Validation Tests

```tsx
it('should apply correct MUI variant and styling', () => {
  // Test CSS classes, computed styles, MUI theme values
});

it('should maintain responsive behavior', () => {
  // Test width, height, flex behavior
});
```

### 4. Reactive Behavior Tests

```tsx
it('should update when props change', () => {
  // Test component re-rendering with new props
});

it('should integrate with context providers', () => {
  // Test context consumption and updates
});
```

---

## Common Issues and Solutions

### 1. TypeError: Cannot read properties of undefined

**Cause**: Mock memory not returning data for `findRecord` calls.
**Solution**: Implement proper query builder mock (see Orbit Memory Mock Patterns above).

### 2. CSS Assertion Failures

**Cause**: Material-UI computes CSS values at runtime.
**Solution**: Use computed value checking patterns or check for actual rendered values.

### 3. DOM Structure Expectations

**Cause**: Provider wrappers create additional DOM elements.
**Solution**: Use specific `data-cy` selectors instead of generic element selectors.

### 4. TypeScript Import Errors

**Cause**: Missing enum/type imports in test files.
**Solution**: Import all required types from model files:

```tsx
import {
  ISheet,
  SectionD,
  IwsKind,
  SheetLevel,
  PassageTypeEnum,
} from '../../model';
```

### 5. Material-UI Avatar Image Selection Failures

**Cause**: Looking for `[role="img"]` on Avatar components with `src` prop.
**Solution**: Use `.MuiAvatar-root img` selector pattern instead:

```tsx
// ❌ Fails - role attribute inconsistent
cy.get('[role="img"]').should('exist');

// ✅ Works - direct img child selector
cy.get('.MuiAvatar-root img').should('exist');
```

### 6. GlobalProvider Context Initialization Errors

**Cause**: Using wrong prop name (`initialState` instead of `init`) or incomplete state object.
**Solution**: Use `init` prop with complete `GlobalState` object including all required properties.

### 7. Localization Selector Failures

**Cause**: Redux selector functions expecting specific localization structure but finding undefined.
**Solution**: Ensure mock localization reducer matches expected structure:

```tsx
// ❌ Fails - missing layout-specific strings
const mockStore = createStore(
  combineReducers({
    strings: () => ({ loaded: true, lang: 'en' }),
  })
);

// ✅ Works - includes layout-specific mock strings
const mockStore = createStore(
  combineReducers({
    strings: () => ({
      loaded: true,
      lang: 'en',
      planSheet: mockPlanSheetStrings, // for planSheetSelector
      main: mockMainStrings, // for mainSelector
    }),
  })
);
```

### 8. Context State Incomplete Errors

**Cause**: Context providers expecting complete state objects but receiving partial mocks.
**Solution**: Always provide complete context state with factory functions:

```tsx
// ❌ Fails - incomplete context state
const mockContext = { scripture: true };

// ✅ Works - complete context state with overrides
const createPlanContextState = (overrides = {}) => ({
  // All required properties
  t: {} as any,
  connected: true,
  scripture: true,
  // ... all other required properties
  ...overrides,
});
```

### 9. Book Map Resolution Errors

**Cause**: Components expecting book name resolution but mock doesn't provide proper book map.
**Solution**: Include book map in Redux store mock:

```tsx
const mockBooksReducer = () => ({
  map: {
    GEN: 'Genesis',
    EXO: 'Exodus',
    // Add mappings for books used in tests
  },
});
```

---

## Test File Structure Template

```tsx
import React from 'react';
import { ComponentName } from './ComponentName';
import {} from // Import all required types
'../../model';
import { RecordIdentity, RecordRelationship } from '@orbit/records';
import { GlobalProvider } from '../../context/GlobalContext';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import DataProvider from '../../hoc/DataProvider';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import bugsnagClient from '../../auth/bugsnagClient';
import localizationReducer from '../../store/localization/reducers';

describe('ComponentName', () => {
  // Mock setup
  const createMockLiveQuery = () => ({
    /* ... */
  });
  const mockMemory = {
    /* ... */
  };
  const mockCoordinator = {
    /* ... */
  };
  const mockStore = createStore(/* ... */);

  // Factory functions
  const createMockData = (/* ... */) => ({
    /* ... */
  });

  // Helper functions
  const mountComponent = (props, mockData = []) => {
    /* ... */
  };
  const createInitialState = (overrides = {}) => ({
    /* ... */
  });

  // Test categories
  describe('Core Functionality', () => {
    it('should render when conditions are met', () => {
      /* ... */
    });
    it('should handle empty data', () => {
      /* ... */
    });
    it('should return empty fragment when not applicable', () => {
      /* ... */
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters', () => {
      /* ... */
    });
    it('should handle long content', () => {
      /* ... */
    });
  });

  describe('UI/Styling', () => {
    it('should apply correct styling', () => {
      /* ... */
    });
  });

  describe('Reactive Behavior', () => {
    it('should update on prop changes', () => {
      /* ... */
    });
  });
});
```

---

## Debugging Tips

1. **Use Screenshots**: Cypress automatically takes screenshots of failed tests. Review them to understand DOM structure.

2. **Console Logging**: Add `cy.log()` statements to debug test flow.

3. **Inspect Elements**: Use browser dev tools to inspect actual CSS values and DOM structure.

4. **Mock Validation**: Add console.log to mock functions to verify they're being called correctly.

5. **Provider State**: Log the initial state passed to providers to ensure data is structured correctly.

---

## Performance Considerations

1. **Parallel Test Execution**: Independent tests can run in parallel. Avoid sequential dependencies.

2. **Mock Efficiency**: Keep mocks lightweight. Only mock what's needed for each test.

3. **Test Isolation**: Each test should be completely independent with its own mock setup.

4. **Selective Imports**: Only import the types and utilities actually used in tests.

---

This configuration should be referenced whenever creating new Cypress component tests to ensure consistent patterns and avoid common pitfalls discovered during the FlatTitle.tsx testing process.
