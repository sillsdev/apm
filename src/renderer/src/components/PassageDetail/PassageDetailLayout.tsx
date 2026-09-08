import { createContext, useContext, useState } from 'react';
import { Box, SxProps } from '@mui/material';

const LayoutFabContext = createContext<HTMLElement | null>(null);

export const useLayoutFabAnchor = () => useContext(LayoutFabContext);

interface PassageDetailLayoutProps {
  header: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  footerAbove?: React.ReactNode;
  headerSx?: SxProps;
  contentSx?: SxProps;
  footerSx?: SxProps;
  footerAboveSx?: SxProps;
}

export default function PassageDetailLayout({
  header,
  children,
  footer,
  footerAbove,
  headerSx,
  contentSx,
  footerSx,
  footerAboveSx,
}: PassageDetailLayoutProps) {
  const [fabAnchor, setFabAnchor] = useState<HTMLDivElement | null>(null);

  return (
    <LayoutFabContext.Provider value={fabAnchor}>
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flexShrink: 0, ...headerSx }}>{header}</Box>
        <Box
          sx={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            data-cy="layout-content"
            sx={{
              flex: 1,
              minHeight: 0,
              overflowX: 'hidden',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              ...contentSx,
              pb: 10,
            }}
          >
            {children}
          </Box>
          <Box
            ref={setFabAnchor}
            data-cy="layout-fab-anchor"
            sx={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              p: 1.5,
              pointerEvents: 'none',
              '& > *': { pointerEvents: 'auto' },
            }}
          />
        </Box>
        {footerAbove && (
          <Box sx={{ flexShrink: 0, ...footerAboveSx }}>{footerAbove}</Box>
        )}
        {footer && <Box sx={{ flexShrink: 0, ...footerSx }}>{footer}</Box>}
      </Box>
    </LayoutFabContext.Provider>
  );
}
