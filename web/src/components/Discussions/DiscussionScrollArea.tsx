import { Paper, PaperProps, styled } from '@mui/material';
import { type ReactNode, type RefObject, useEffect, useRef } from 'react';

export const StyledPaper = styled(Paper)<PaperProps>(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  '& .MuiPaper-rounded': {
    borderRadius: '8px',
  },
  overflow: 'auto',
}));

interface DiscussionScrollAreaProps {
  /** The card to scroll to, e.g. the one whose region was just selected. */
  highlightedRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/** The scrolling list of discussion cards below the drawer's header and player. */
export function DiscussionScrollArea({
  highlightedRef,
  children,
}: DiscussionScrollAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    const card = highlightedRef?.current;
    if (container && card) {
      // TT-7887: measure from this scroll area, not card.offsetTop. The
      // offsetParent is the drawer, so offsetTop also counted the header
      // and player above the list and scrolled the card's header out of view.
      const cardTop =
        card.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop;
      const margin = parseFloat(getComputedStyle(card).marginTop) || 0;
      container.scrollTo(0, Math.max(0, cardTop - margin));
    }
  }, [highlightedRef]);

  return (
    <StyledPaper
      ref={scrollRef}
      id="DiscussionList"
      elevation={0}
      square
      sx={{ flex: '1 1 auto', minHeight: 0, width: '100%' }}
    >
      {children}
    </StyledPaper>
  );
}

export default DiscussionScrollArea;
