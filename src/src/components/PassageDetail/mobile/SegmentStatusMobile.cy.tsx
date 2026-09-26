import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import LocalizedStrings from 'react-localization';
import SegmentStatusMobile from './SegmentStatusMobile';

const mockStringsReducer = () => ({
  loaded: true,
  lang: 'en',
  mobile: new LocalizedStrings({
    en: { segment: 'Segment {0}' },
  }),
});

const mockStore = createStore(
  combineReducers({
    strings: mockStringsReducer,
  })
);

const mountStatus = (segmentText: string) => {
  cy.mount(
    <Provider store={mockStore}>
      <SegmentStatusMobile segmentText={segmentText} />
    </Provider>
  );
};

describe('SegmentStatusMobile', () => {
  it('renders the segment text in the localized template', () => {
    mountStatus('0:01-0:10');

    cy.contains('Segment 0:01-0:10').should('be.visible');
  });

  it('falls back to an em dash when segment text is empty', () => {
    mountStatus('');

    cy.contains('Segment —').should('be.visible');
  });
});
