import { createRef } from 'react';
import { Box, Card, Drawer, Grid, Paper } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const cardCount = 7;
const cardRefs = Array.from({ length: cardCount }, () =>
  createRef<HTMLDivElement>()
);

/**
 * Lays the list out as DiscussionDrawer and DiscussionList do: a
 * right-anchored drawer (overflow hidden) whose header and mini player sit
 * above a scrolling Paper of cards. Each button makes the same call
 * DiscussionCard makes when its region is located.
 */
function DrawerHarness() {
  return (
    <>
      {cardRefs.map((ref, i) => (
        <button
          key={i}
          data-cy={`select-${i}`}
          onClick={() => ref.current?.scrollIntoView({ block: 'start' })}
        >
          {i}
        </button>
      ))}
      <Drawer
        anchor="right"
        open
        slotProps={{
          paper: {
            id: 'drawer-paper',
            sx: {
              width: 450,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box data-cy="drawer-header" sx={{ height: 70, flex: '0 0 auto' }}>
          Discussions
        </Box>
        <Box sx={{ height: 150, flex: '0 0 auto' }}>Player</Box>
        <Paper
          id="DiscussionList"
          elevation={0}
          square
          sx={{
            flex: '1 1 auto',
            minHeight: 0,
            width: '100%',
            overflow: 'auto',
          }}
        >
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
        </Paper>
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

// scrollIntoView also scrolls overflow:hidden ancestors; the drawer's
// title bar and player must stay put.
const expectDrawerChromeInPlace = () => {
  cy.get('#drawer-paper').should(($paper) => {
    expect($paper[0].scrollTop, 'drawer scrollTop').to.equal(0);
    const paperTop = $paper[0].getBoundingClientRect().top;
    const headerTop = $paper
      .find('[data-cy="drawer-header"]')[0]
      .getBoundingClientRect().top;
    expect(headerTop, 'drawer header top').to.equal(paperTop);
  });
};

describe('DiscussionList locate scroll (TT-7887)', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    cy.mount(
      <ThemeProvider theme={createTheme()}>
        <DrawerHarness />
      </ThemeProvider>
    );
  });

  it('shows the full header of a middle card on the first selection', () => {
    cy.get('[data-cy="select-3"]').click({ force: true });
    expectHeaderVisible(3);
    expectDrawerChromeInPlace();
  });

  it('shows the full header on each later selection', () => {
    cy.get('[data-cy="select-2"]').click({ force: true });
    expectHeaderVisible(2);
    cy.get('[data-cy="select-6"]').click({ force: true });
    expectHeaderVisible(6);
    cy.get('[data-cy="select-1"]').click({ force: true });
    expectHeaderVisible(1);
    expectDrawerChromeInPlace();
  });
});
