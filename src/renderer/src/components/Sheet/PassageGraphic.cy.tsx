import React from 'react';
import { PassageGraphic } from './PassageGraphic';
import {
  ISheet,
  IwsKind,
  SheetLevel,
  PassageTypeEnum,
  IMediaShare,
} from '../../model';
import { RecordIdentity } from '@orbit/records';
import { GlobalProvider, GlobalState } from '../../context/GlobalContext';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import DataProvider from '../../hoc/DataProvider';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import localizationReducer from '../../store/localization/reducers';
import bugsnagClient from '../../auth/bugsnagClient';

describe('PassageGraphic', () => {
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

  const mockStringsReducer = () => {
    const initialState = localizationReducer(undefined, { type: '@@INIT' });
    return initialState;
  };

  const mockStore = createStore(
    combineReducers({
      strings: mockStringsReducer,
    })
  );

  // Factory functions
  const createMockSheet = (overrides: Partial<ISheet> = {}): ISheet => ({
    kind: IwsKind.SectionPassage,
    level: SheetLevel.Section,
    sectionSeq: 1,
    passageSeq: 1,
    sectionId: { type: 'section', id: 'section-1' } as RecordIdentity,
    book: 'GEN',
    reference: 'Genesis 1:1',
    comment: 'Test passage comment',
    deleted: false,
    filtered: false,
    passageType: PassageTypeEnum.PASSAGE,
    published: [],
    mediaShared: IMediaShare.None,
    ...overrides,
  });

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

  const mountComponent = (
    props: {
      cardInfo: ISheet;
      reference?: string;
      psgType: PassageTypeEnum;
    },
    mockData: any[] = []
  ) => {
    const initialState = createInitialState();

    cy.mount(
      <Provider store={mockStore}>
        <GlobalProvider init={initialState}>
          <DataProvider dataStore={mockMemory}>
            <PassageGraphic {...props} />
          </DataProvider>
        </GlobalProvider>
      </Provider>
    );
  };

  describe('Core Functionality', () => {
    it('should render Avatar with graphic URI when graphicUri is provided and psgType is NOTE', () => {
      const mockSheet = createMockSheet({
        graphicUri: 'https://example.com/test-image.jpg',
        passageType: PassageTypeEnum.NOTE,
      });

      mountComponent({
        cardInfo: mockSheet,
        reference: 'Test Reference',
        psgType: PassageTypeEnum.NOTE,
      });

      cy.get('.MuiAvatar-root img')
        .should('exist')
        .and('have.attr', 'src', 'https://example.com/test-image.jpg');

      cy.get('.MuiAvatar-rounded').should('exist');
      cy.get('.MuiAvatar-root').should('have.css', 'margin-right', '8px');
    });

    it('should render Avatar with graphic URI when graphicUri is provided and psgType is CHAPTERNUMBER', () => {
      const mockSheet = createMockSheet({
        graphicUri: 'https://example.com/chapter-image.jpg',
        passageType: PassageTypeEnum.CHAPTERNUMBER,
      });

      mountComponent({
        cardInfo: mockSheet,
        reference: 'Chapter 1',
        psgType: PassageTypeEnum.CHAPTERNUMBER,
      });

      cy.get('.MuiAvatar-root img')
        .should('exist')
        .and('have.attr', 'src', 'https://example.com/chapter-image.jpg');

      cy.get('.MuiAvatar-rounded').should('exist');
    });

    it('should render stringAvatar when no graphicUri and reference is provided', () => {
      const mockSheet = createMockSheet({
        graphicUri: undefined,
        passageType: PassageTypeEnum.NOTE,
      });

      mountComponent({
        cardInfo: mockSheet,
        reference: 'Test Note',
        psgType: PassageTypeEnum.NOTE,
      });

      cy.get('.MuiAvatar-root').should('exist').and('contain.text', 'TN');
      cy.get('.MuiAvatar-rounded').should('exist');
    });

    it('should render stringAvatar using cardInfo.reference when no reference prop provided', () => {
      const mockSheet = createMockSheet({
        graphicUri: undefined,
        reference: 'Genesis 1:1-5',
        passageType: PassageTypeEnum.NOTE,
      });

      mountComponent({
        cardInfo: mockSheet,
        psgType: PassageTypeEnum.NOTE,
      });

      cy.get('.MuiAvatar-root').should('exist').and('contain.text', 'G1');
      cy.get('.MuiAvatar-rounded').should('exist');
    });

    it('should render stringAvatar with fallback "Note" when no reference available', () => {
      const mockSheet = createMockSheet({
        graphicUri: undefined,
        reference: undefined,
        passageType: PassageTypeEnum.NOTE,
      });

      mountComponent({
        cardInfo: mockSheet,
        psgType: PassageTypeEnum.NOTE,
      });

      cy.get('.MuiAvatar-root').should('exist').and('contain.text', 'N');
      cy.get('.MuiAvatar-rounded').should('exist');
    });

    it('should return null when psgType is not NOTE or CHAPTERNUMBER', () => {
      const mockSheet = createMockSheet({
        passageType: PassageTypeEnum.PASSAGE,
      });

      mountComponent({
        cardInfo: mockSheet,
        reference: 'Test Reference',
        psgType: PassageTypeEnum.PASSAGE,
      });

      cy.get('.MuiAvatar-root').should('not.exist');
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in reference text', () => {
      const mockSheet = createMockSheet({
        graphicUri: undefined,
        passageType: PassageTypeEnum.NOTE,
      });

      mountComponent({
        cardInfo: mockSheet,
        reference: 'Special "Quote" & Symbol',
        psgType: PassageTypeEnum.NOTE,
      });

      cy.get('.MuiAvatar-root').should('exist').and('contain.text', 'S"');
    });

    it('should handle very long reference text', () => {
      const mockSheet = createMockSheet({
        graphicUri: undefined,
        passageType: PassageTypeEnum.NOTE,
      });

      const longReference =
        'This is a very long reference text that should be handled gracefully by the stringAvatar function';

      mountComponent({
        cardInfo: mockSheet,
        reference: longReference,
        psgType: PassageTypeEnum.NOTE,
      });

      cy.get('.MuiAvatar-root').should('exist').and('contain.text', 'Ti');
    });

    it('should handle empty string reference', () => {
      const mockSheet = createMockSheet({
        graphicUri: undefined,
        reference: '',
        passageType: PassageTypeEnum.NOTE,
      });

      mountComponent({
        cardInfo: mockSheet,
        reference: '',
        psgType: PassageTypeEnum.NOTE,
      });

      cy.get('.MuiAvatar-root').should('exist').and('contain.text', 'N');
    });

    it('should handle numeric-only reference', () => {
      const mockSheet = createMockSheet({
        graphicUri: undefined,
        passageType: PassageTypeEnum.CHAPTERNUMBER,
      });

      mountComponent({
        cardInfo: mockSheet,
        reference: '123',
        psgType: PassageTypeEnum.CHAPTERNUMBER,
      });

      cy.get('.MuiAvatar-root').should('exist').and('contain.text', '1');
    });

    it('should handle single character reference', () => {
      const mockSheet = createMockSheet({
        graphicUri: undefined,
        passageType: PassageTypeEnum.NOTE,
      });

      mountComponent({
        cardInfo: mockSheet,
        reference: 'A',
        psgType: PassageTypeEnum.NOTE,
      });

      cy.get('.MuiAvatar-root').should('exist').and('contain.text', 'A');
    });

    it('should handle invalid graphicUri gracefully', () => {
      const mockSheet = createMockSheet({
        graphicUri: 'invalid-url',
        passageType: PassageTypeEnum.NOTE,
      });

      mountComponent({
        cardInfo: mockSheet,
        reference: 'Test Reference',
        psgType: PassageTypeEnum.NOTE,
      });

      // The Avatar should fall back to initials if the image fails to load
      cy.get('.MuiAvatar-root').should('exist').and('contain.text', 'TR');
    });
  });

  describe('UI/Styling', () => {
    it('should apply correct MUI styling classes', () => {
      const mockSheet = createMockSheet({
        graphicUri: 'https://example.com/test.jpg',
        passageType: PassageTypeEnum.NOTE,
      });

      mountComponent({
        cardInfo: mockSheet,
        reference: 'Test Reference',
        psgType: PassageTypeEnum.NOTE,
      });

      cy.get('.MuiAvatar-root').should('exist');
      cy.get('.MuiAvatar-rounded').should('exist');
    });

    it('should apply border styling when color is provided', () => {
      const mockSheet = createMockSheet({
        graphicUri: 'https://example.com/test.jpg',
        color: '#ff0000',
        passageType: PassageTypeEnum.NOTE,
      });

      mountComponent({
        cardInfo: mockSheet,
        reference: 'Test Reference',
        psgType: PassageTypeEnum.NOTE,
      });

      cy.get('.MuiAvatar-root').should(($el) => {
        const borderColor = $el.css('border-color');
        // MUI might convert hex to rgb format
        expect(borderColor === 'rgb(255, 0, 0)' || borderColor === '#ff0000').to
          .be.true;
      });

      cy.get('.MuiAvatar-root').should(($el) => {
        const borderWidth = $el.css('border-width');
        expect(borderWidth === '2px' || borderWidth === '1.6px').to.be.true;
      });
    });

    it('should apply right margin styling', () => {
      const mockSheet = createMockSheet({
        graphicUri: 'https://example.com/test.jpg',
        passageType: PassageTypeEnum.NOTE,
      });

      mountComponent({
        cardInfo: mockSheet,
        reference: 'Test Reference',
        psgType: PassageTypeEnum.NOTE,
      });

      cy.get('.MuiAvatar-root').should('have.css', 'margin-right', '8px');
    });

    it('should apply different background colors for different references', () => {
      const mockSheet1 = createMockSheet({
        graphicUri: undefined,
        passageType: PassageTypeEnum.NOTE,
      });

      const mockSheet2 = createMockSheet({
        graphicUri: undefined,
        passageType: PassageTypeEnum.NOTE,
      });

      // Mount first component
      mountComponent({
        cardInfo: mockSheet1,
        reference: 'First Reference',
        psgType: PassageTypeEnum.NOTE,
      });

      let firstColor: string;

      cy.get('.MuiAvatar-root')
        .should('exist')
        .then(($el) => {
          firstColor = $el.css('background-color');

          // Remount with different reference
          cy.mount(
            <Provider store={mockStore}>
              <GlobalProvider init={createInitialState()}>
                <DataProvider dataStore={mockMemory}>
                  <PassageGraphic
                    cardInfo={mockSheet2}
                    reference="Second Reference"
                    psgType={PassageTypeEnum.NOTE}
                  />
                </DataProvider>
              </GlobalProvider>
            </Provider>
          );

          cy.get('.MuiAvatar-root').should(($secondEl) => {
            const secondColor = $secondEl.css('background-color');
            expect(secondColor).to.not.equal(firstColor);
          });
        });
    });
  });

  describe('Reactive Behavior', () => {
    it('should update when cardInfo changes', () => {
      const initialSheet = createMockSheet({
        graphicUri: undefined,
        passageType: PassageTypeEnum.NOTE,
      });

      mountComponent({
        cardInfo: initialSheet,
        reference: 'Initial Reference',
        psgType: PassageTypeEnum.NOTE,
      });

      cy.get('.MuiAvatar-root').should('contain.text', 'IR');

      // Update with new props
      const updatedSheet = createMockSheet({
        graphicUri: 'https://example.com/updated.jpg',
        passageType: PassageTypeEnum.NOTE,
      });

      cy.mount(
        <Provider store={mockStore}>
          <GlobalProvider init={createInitialState()}>
            <DataProvider dataStore={mockMemory}>
              <PassageGraphic
                cardInfo={updatedSheet}
                reference="Updated Reference"
                psgType={PassageTypeEnum.NOTE}
              />
            </DataProvider>
          </GlobalProvider>
        </Provider>
      );

      cy.get('.MuiAvatar-root img')
        .should('exist')
        .and('have.attr', 'src', 'https://example.com/updated.jpg');
    });

    it('should update when psgType changes to unsupported type', () => {
      const mockSheet = createMockSheet({
        graphicUri: 'https://example.com/test.jpg',
        passageType: PassageTypeEnum.NOTE,
      });

      mountComponent({
        cardInfo: mockSheet,
        reference: 'Test Reference',
        psgType: PassageTypeEnum.NOTE,
      });

      cy.get('.MuiAvatar-root').should('exist');

      // Update with unsupported psgType
      cy.mount(
        <Provider store={mockStore}>
          <GlobalProvider init={createInitialState()}>
            <DataProvider dataStore={mockMemory}>
              <PassageGraphic
                cardInfo={mockSheet}
                reference="Test Reference"
                psgType={PassageTypeEnum.PASSAGE}
              />
            </DataProvider>
          </GlobalProvider>
        </Provider>
      );

      cy.get('.MuiAvatar-root').should('not.exist');
    });

    it('should switch between image and text avatar when graphicUri changes', () => {
      const mockSheet = createMockSheet({
        graphicUri: 'https://example.com/test.jpg',
        passageType: PassageTypeEnum.NOTE,
      });

      mountComponent({
        cardInfo: mockSheet,
        reference: 'Test Reference',
        psgType: PassageTypeEnum.NOTE,
      });

      cy.get('.MuiAvatar-root img').should('exist');
      cy.get('.MuiAvatar-root').should('not.contain.text');

      // Update to remove graphicUri
      const updatedSheet = createMockSheet({
        graphicUri: undefined,
        passageType: PassageTypeEnum.NOTE,
      });

      cy.mount(
        <Provider store={mockStore}>
          <GlobalProvider init={createInitialState()}>
            <DataProvider dataStore={mockMemory}>
              <PassageGraphic
                cardInfo={updatedSheet}
                reference="Test Reference"
                psgType={PassageTypeEnum.NOTE}
              />
            </DataProvider>
          </GlobalProvider>
        </Provider>
      );

      cy.get('.MuiAvatar-root').should('contain.text', 'TR');
      cy.get('.MuiAvatar-root img').should('not.exist');
    });
  });

  describe('PassageTypeEnum Support', () => {
    const testCases = [
      {
        type: PassageTypeEnum.NOTE,
        shouldRender: true,
        description: 'NOTE type',
      },
      {
        type: PassageTypeEnum.CHAPTERNUMBER,
        shouldRender: true,
        description: 'CHAPTERNUMBER type',
      },
      {
        type: PassageTypeEnum.BOOK,
        shouldRender: false,
        description: 'BOOK type',
      },
      {
        type: PassageTypeEnum.ALTBOOK,
        shouldRender: false,
        description: 'ALTBOOK type',
      },
      {
        type: PassageTypeEnum.MOVEMENT,
        shouldRender: false,
        description: 'MOVEMENT type',
      },
      {
        type: PassageTypeEnum.PASSAGE,
        shouldRender: false,
        description: 'PASSAGE type',
      },
    ];

    testCases.forEach(({ type, shouldRender, description }) => {
      it(`should ${
        shouldRender ? 'render' : 'return null'
      } for ${description}`, () => {
        const mockSheet = createMockSheet({
          graphicUri: 'https://example.com/test.jpg',
          passageType: type,
        });

        mountComponent({
          cardInfo: mockSheet,
          reference: 'Test Reference',
          psgType: type,
        });

        if (shouldRender) {
          cy.get('.MuiAvatar-root').should('exist');
        } else {
          cy.get('.MuiAvatar-root').should('not.exist');
        }
      });
    });
  });
});
