import { createRef, type RefObject, useState } from 'react';
import { Box, Card, Drawer, Grid } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { DiscussionScrollArea } from './DiscussionScrollArea';

const cardCount = 7;
const cardRefs = Array.from({ length: cardCount }, () =>
  createRef<HTMLDivElement>()
);

/**
 * Lays the scroll area out as DiscussionDrawer and DiscussionList do: a
 * right-anchored drawer whose header and mini player sit above the cards.
 * The buttons stand in for selecting a waveform region, which makes
 * DiscussionCard hand its ref to the list.
 */
function DrawerHarness() {
  const [highlightedRef, setHighlightedRef] =
    useState<RefObject<HTMLElement | null>>();
  return (
    <>
      {cardRefs.map((ref, i) => (
        <button
          key={i}
          data-cy={`select-${i}`}
          onClick={() => setHighlightedRef(ref)}
        >
          {i}
        </button>
      ))}
      <Drawer
        anchor="right"
        open
        slotProps={{
          paper: {
            sx: {
              width: 450,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box sx={{ height: 70, flex: '0 0 auto' }}>Discussions</Box>
        <Box sx={{ height: 150, flex: '0 0 auto' }}>Player</Box>
        <DiscussionScrollArea highlightedRef={highlightedRef}>
          <Grid container>
            {cardRefs.map((ref, i) => (
              <Card
                key={i}
                ref={ref}
                sx={{ m: 1, flexGrow: 1, width: '100%' }}
                data-cy={`card-${i}`}
              >
                <Box data-cy={`card-header-${i}`} sx={{ height: 40 }}>
                  Discussion {i}
                </Box>
                <Box sx={{ height: 220 }}>Comments</Box>
              </Card>
            ))}
          </Grid>
        </DiscussionScrollArea>
      </Drawer>
    </>
  );
}

const expectHeaderVisible = (index: number) => {
  cy.get('#DiscussionList').then(($list) => {
    const list = $list[0].getBoundingClientRect();
    cy.get(`[data-cy="card-header-${index}"]`).should(($header) => {
      const header = $header[0].getBoundingClientRect();
      expect(header.top, 'header top').to.be.at.least(list.top);
      expect(header.bottom, 'header bottom').to.be.at.most(list.bottom);
    });
  });
};

describe('DiscussionScrollArea', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    cy.mount(
      <ThemeProvider theme={createTheme()}>
        <DrawerHarness />
      </ThemeProvider>
    );
  });

  // TT-7887: selecting a middle waveform segment hid the card's header.
  it('shows the full header of a middle card on the first selection', () => {
    cy.get('[data-cy="select-3"]').click({ force: true });
    expectHeaderVisible(3);
  });

  it('shows the full header on each later selection', () => {
    cy.get('[data-cy="select-2"]').click({ force: true });
    expectHeaderVisible(2);
    cy.get('[data-cy="select-4"]').click({ force: true });
    expectHeaderVisible(4);
    cy.get('[data-cy="select-1"]').click({ force: true });
    expectHeaderVisible(1);
  });
});
