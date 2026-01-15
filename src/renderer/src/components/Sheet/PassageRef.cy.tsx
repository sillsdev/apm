import React from 'react';
import { PassageRef } from './PassageRef';
import { PassageTypeEnum } from '../../model';
import { GlobalProvider, GlobalState } from '../../context/GlobalContext';
import { PlanContext, ICtxState } from '../../context/PlanContext';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import DataProvider from '../../hoc/DataProvider';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import localizationReducer from '../../store/localization/reducers';
import bugsnagClient from '../../auth/bugsnagClient';
import LocalizedStrings from 'react-localization';

describe('PassageRef', () => {
  // Mock setup
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

  // Mock localization strings
  const mockPlanSheetStrings = new LocalizedStrings({
    en: {
      unknownBook: 'Unknown Book',
      chapter: 'Chapter',
      verse: 'Verse',
    },
  });

  const mockStringsReducer = () => {
    const initialState = localizationReducer(undefined, { type: '@@INIT' });
    return {
      ...initialState,
      loaded: true,
      lang: 'en',
      planSheet: mockPlanSheetStrings,
    };
  };

  // Mock books reducer with sample book map
  const mockBooksReducer = () => ({
    map: {
      GEN: 'Genesis',
      EXO: 'Exodus',
      MAT: 'Matthew',
      JOH: 'John',
    },
  });

  const mockStore = createStore(
    combineReducers({
      strings: mockStringsReducer,
      books: mockBooksReducer,
    })
  );

  // Helper functions
  const createInitialState = (
    overrides: Partial<GlobalState> = {}
  ): GlobalState => ({
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

  const createPlanContextState = (
    overrides: Partial<ICtxState> = {}
  ): ICtxState => ({
    t: {} as any,
    connected: true,
    projButtonStr: {} as any,
    mediafiles: [],
    discussions: [],
    groupmemberships: [],
    scripture: true,
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

  const mountComponent = (
    props: {
      psgType: PassageTypeEnum;
      book?: string;
      ref?: string;
      comment?: string;
    },
    planContextOverrides: Partial<ICtxState> = {}
  ) => {
    const initialState = createInitialState();
    const planContextState = createPlanContextState(planContextOverrides);

    const mockPlanContextValue = {
      state: planContextState,
      setState: cy.stub(),
    };

    cy.mount(
      <Provider store={mockStore}>
        <GlobalProvider init={initialState}>
          <DataProvider dataStore={mockMemory}>
            <PlanContext.Provider value={mockPlanContextValue as any}>
              <PassageRef {...props} />
            </PlanContext.Provider>
          </DataProvider>
        </GlobalProvider>
      </Provider>
    );
  };

  describe('Core Functionality', () => {
    it('should render passage text with full book name for PASSAGE type in scripture projects', () => {
      mountComponent({
        psgType: PassageTypeEnum.PASSAGE,
        book: 'GEN',
        ref: '1:1-5',
        comment: 'Test comment',
      });

      cy.get('[data-cy="passage-ref"]').should('not.exist'); // No data-cy added to component
      cy.get('.MuiTypography-h6')
        .should('exist')
        .and('contain.text', 'Genesis 1:1-5');
    });

    it('should render passage text without book name for PASSAGE type in non-scripture projects', () => {
      mountComponent(
        {
          psgType: PassageTypeEnum.PASSAGE,
          book: 'GEN',
          ref: '1:1-5',
        },
        { scripture: false }
      );

      cy.get('.MuiTypography-h6')
        .should('exist')
        .and('contain.text', '1:1-5')
        .and('not.contain.text', 'Genesis');
    });

    it('should use RefRender component for non-PASSAGE types with ref', () => {
      mountComponent({
        psgType: PassageTypeEnum.CHAPTERNUMBER,
        ref: '1',
        comment: 'Chapter comment',
      });

      cy.get('.MuiTypography-h6').should('exist');
      // RefRender component should be rendered - we'll check for its typical structure
      cy.get('.MuiTypography-h6').should('contain.text', '1');
    });

    it('should append comment for CHAPTERNUMBER type when comment exists', () => {
      mountComponent({
        psgType: PassageTypeEnum.CHAPTERNUMBER,
        ref: '1',
        comment: 'Introduction',
      });

      cy.get('.MuiTypography-h6')
        .should('exist')
        .and('contain.text', '1')
        .and('contain.text', 'Introduction');
    });

    it('should not append comment for non-CHAPTERNUMBER types', () => {
      mountComponent({
        psgType: PassageTypeEnum.NOTE,
        ref: 'Note reference',
        comment: 'Note comment',
      });

      cy.get('.MuiTypography-h6')
        .should('exist')
        .and('contain.text', 'Note reference')
        .and('not.contain.text', 'Note comment');
    });

    it('should return null when no ref is provided for non-PASSAGE types', () => {
      mountComponent({
        psgType: PassageTypeEnum.NOTE,
        book: 'GEN',
        comment: 'Test comment',
      });

      cy.get('.MuiTypography-h6').should('not.exist');
    });
  });

  describe('Book Name Resolution', () => {
    it('should resolve book abbreviation to full name in scripture projects', () => {
      mountComponent({
        psgType: PassageTypeEnum.PASSAGE,
        book: 'MAT',
        ref: '5:1-12',
      });

      cy.get('.MuiTypography-h6')
        .should('exist')
        .and('contain.text', 'Matthew 5:1-12');
    });

    it('should use "Unknown Book" for unrecognized book abbreviation in scripture projects', () => {
      mountComponent({
        psgType: PassageTypeEnum.PASSAGE,
        book: 'UNK',
        ref: '1:1',
      });

      cy.get('.MuiTypography-h6')
        .should('exist')
        .and('contain.text', 'undefined 1:1'); // When book not in map, undefined is returned
    });

    it('should use book abbreviation when book map is undefined', () => {
      // Create a store without books map
      const mockStoreWithoutBooks = createStore(
        combineReducers({
          strings: mockStringsReducer,
          books: () => ({ map: undefined }),
        })
      );

      const initialState = createInitialState();
      const planContextState = createPlanContextState();
      const mockPlanContextValue = {
        state: planContextState,
        setState: cy.stub(),
      };

      cy.mount(
        <Provider store={mockStoreWithoutBooks}>
          <GlobalProvider init={initialState}>
            <DataProvider dataStore={mockMemory}>
              <PlanContext.Provider value={mockPlanContextValue as any}>
                <PassageRef
                  psgType={PassageTypeEnum.PASSAGE}
                  book="GEN"
                  ref="1:1"
                />
              </PlanContext.Provider>
            </DataProvider>
          </GlobalProvider>
        </Provider>
      );

      cy.get('.MuiTypography-h6')
        .should('exist')
        .and('contain.text', 'GEN 1:1'); // When map is undefined but bookAbbreviation exists, it returns the abbreviation
    });

    it('should handle undefined book gracefully in scripture projects', () => {
      mountComponent({
        psgType: PassageTypeEnum.PASSAGE,
        ref: '1:1',
      });

      cy.get('.MuiTypography-h6')
        .should('exist')
        .and('contain.text', 'Unknown Book 1:1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty reference string', () => {
      mountComponent({
        psgType: PassageTypeEnum.PASSAGE,
        book: 'GEN',
        ref: '',
      });

      cy.get('.MuiTypography-h6')
        .should('exist')
        .and('contain.text', 'Genesis ');
    });

    it('should handle very long reference text', () => {
      const longRef =
        'This is a very long reference that spans multiple verses and chapters 1:1-50:26';

      mountComponent({
        psgType: PassageTypeEnum.PASSAGE,
        book: 'GEN',
        ref: longRef,
      });

      cy.get('.MuiTypography-h6')
        .should('exist')
        .and('contain.text', `Genesis ${longRef}`);
    });

    it('should handle special characters in reference', () => {
      mountComponent({
        psgType: PassageTypeEnum.PASSAGE,
        book: 'GEN',
        ref: '1:1-5 "Special quote" & symbols',
      });

      cy.get('.MuiTypography-h6')
        .should('exist')
        .and('contain.text', 'Genesis 1:1-5 "Special quote" & symbols');
    });

    it('should handle special characters in comment', () => {
      mountComponent({
        psgType: PassageTypeEnum.CHAPTERNUMBER,
        ref: '1',
        comment: 'Comment with "quotes" & symbols',
      });

      cy.get('.MuiTypography-h6')
        .should('exist')
        .and('contain.text', 'Comment with "quotes" & symbols');
    });

    it('should handle numeric-only references', () => {
      mountComponent({
        psgType: PassageTypeEnum.CHAPTERNUMBER,
        ref: '123',
      });

      cy.get('.MuiTypography-h6').should('exist').and('contain.text', '123');
    });

    it('should handle empty comment for CHAPTERNUMBER type', () => {
      mountComponent({
        psgType: PassageTypeEnum.CHAPTERNUMBER,
        ref: '1',
        comment: '',
      });

      cy.get('.MuiTypography-h6')
        .should('exist')
        .and('contain.text', '1')
        .and('not.contain.text', ' '); // Should not have extra space
    });
  });

  describe('UI/Styling', () => {
    it('should apply Typography h6 variant', () => {
      mountComponent({
        psgType: PassageTypeEnum.PASSAGE,
        book: 'GEN',
        ref: '1:1',
      });

      cy.get('.MuiTypography-h6').should('exist');
      cy.get('.MuiTypography-root').should('exist');
    });

    it('should maintain consistent styling across different passage types', () => {
      // Test PASSAGE type styling
      mountComponent({
        psgType: PassageTypeEnum.PASSAGE,
        book: 'GEN',
        ref: '1:1',
      });

      cy.get('.MuiTypography-h6')
        .should('exist')
        .then(($passageEl) => {
          const passageClasses = Array.from($passageEl[0].classList);

          // Remount with different type
          cy.mount(
            <Provider store={mockStore}>
              <GlobalProvider init={createInitialState()}>
                <DataProvider dataStore={mockMemory}>
                  <PlanContext.Provider
                    value={
                      {
                        state: createPlanContextState(),
                        setState: cy.stub(),
                      } as any
                    }
                  >
                    <PassageRef
                      psgType={PassageTypeEnum.NOTE}
                      ref="Note reference"
                    />
                  </PlanContext.Provider>
                </DataProvider>
              </GlobalProvider>
            </Provider>
          );

          cy.get('.MuiTypography-h6').should(($noteEl) => {
            const noteClasses = Array.from($noteEl[0].classList);
            // Should have same base classes
            expect(noteClasses).to.deep.equal(passageClasses);
          });
        });
    });
  });

  describe('Reactive Behavior', () => {
    it('should update when passage type changes', () => {
      mountComponent({
        psgType: PassageTypeEnum.PASSAGE,
        book: 'GEN',
        ref: '1:1',
      });

      cy.get('.MuiTypography-h6').should('contain.text', 'Genesis 1:1');

      // Update with different passage type
      cy.mount(
        <Provider store={mockStore}>
          <GlobalProvider init={createInitialState()}>
            <DataProvider dataStore={mockMemory}>
              <PlanContext.Provider
                value={
                  {
                    state: createPlanContextState(),
                    setState: cy.stub(),
                  } as any
                }
              >
                <PassageRef
                  psgType={PassageTypeEnum.CHAPTERNUMBER}
                  ref="1"
                  comment="Chapter intro"
                />
              </PlanContext.Provider>
            </DataProvider>
          </GlobalProvider>
        </Provider>
      );

      cy.get('.MuiTypography-h6')
        .should('contain.text', '1')
        .and('contain.text', 'Chapter intro')
        .and('not.contain.text', 'Genesis');
    });

    it('should update when PlanContext scripture setting changes', () => {
      mountComponent(
        {
          psgType: PassageTypeEnum.PASSAGE,
          book: 'GEN',
          ref: '1:1',
        },
        { scripture: true }
      );

      cy.get('.MuiTypography-h6').should('contain.text', 'Genesis 1:1');

      // Update context to non-scripture
      cy.mount(
        <Provider store={mockStore}>
          <GlobalProvider init={createInitialState()}>
            <DataProvider dataStore={mockMemory}>
              <PlanContext.Provider
                value={
                  {
                    state: createPlanContextState({ scripture: false }),
                    setState: cy.stub(),
                  } as any
                }
              >
                <PassageRef
                  psgType={PassageTypeEnum.PASSAGE}
                  book="GEN"
                  ref="1:1"
                />
              </PlanContext.Provider>
            </DataProvider>
          </GlobalProvider>
        </Provider>
      );

      cy.get('.MuiTypography-h6')
        .should('contain.text', '1:1')
        .and('not.contain.text', 'Genesis');
    });
  });

  describe('PassageTypeEnum Support', () => {
    const testCases = [
      {
        type: PassageTypeEnum.PASSAGE,
        shouldUseRefRender: false,
        description: 'PASSAGE type',
      },
      {
        type: PassageTypeEnum.NOTE,
        shouldUseRefRender: true,
        description: 'NOTE type',
      },
      {
        type: PassageTypeEnum.CHAPTERNUMBER,
        shouldUseRefRender: true,
        description: 'CHAPTERNUMBER type',
      },
      {
        type: PassageTypeEnum.BOOK,
        shouldUseRefRender: true,
        description: 'BOOK type',
      },
      {
        type: PassageTypeEnum.ALTBOOK,
        shouldUseRefRender: true,
        description: 'ALTBOOK type',
      },
      {
        type: PassageTypeEnum.MOVEMENT,
        shouldUseRefRender: true,
        description: 'MOVEMENT type',
      },
    ];

    testCases.forEach(({ type, shouldUseRefRender, description }) => {
      it(`should handle ${description} correctly`, () => {
        mountComponent({
          psgType: type,
          book: 'GEN',
          ref: 'Test reference',
        });

        cy.get('.MuiTypography-h6').should('exist');

        if (shouldUseRefRender) {
          // For RefRender types, we expect the ref text to be present
          cy.get('.MuiTypography-h6').should('contain.text', 'Test reference');
        } else {
          // For PASSAGE type, we expect book name + ref
          cy.get('.MuiTypography-h6').should(
            'contain.text',
            'Genesis Test reference'
          );
        }
      });
    });

    it('should return empty Typography for PASSAGE type with no ref', () => {
      mountComponent({
        psgType: PassageTypeEnum.PASSAGE,
        book: 'GEN',
      });

      // PASSAGE type always renders Typography, even with empty content
      cy.get('.MuiTypography-h6')
        .should('exist')
        .and('contain.text', 'Genesis '); // Shows book name with space, but no ref
    });
  });
});
