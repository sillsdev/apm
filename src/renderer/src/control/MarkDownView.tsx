import React from 'react';
import MarkDown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Box } from '@mui/material';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

interface MarkDownProps {
  value: string;
  wrapOverflow?: boolean;
}

export function MarkDownView({ value }: MarkDownProps) {
  // adapted from https://stackoverflow.com/questions/31749625/make-a-link-from-electron-open-in-browser (zrbecker's)
  const handleClick = (event: any) => {
    if (event.target.tagName.toLowerCase() === 'a') {
      event.preventDefault();
      ipc?.openExternal(event.target.href);
    }
  };

  React.useEffect(() => {
    if (ipc) document.addEventListener('click', handleClick);

    return () => {
      if (ipc) document.removeEventListener('click', handleClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <MarkDown remarkPlugins={[remarkGfm]}>{value}</MarkDown>;
}

export function CompactMarkDownView({ value, wrapOverflow = false }: MarkDownProps) {
  // adapted from https://stackoverflow.com/questions/31749625/make-a-link-from-electron-open-in-browser (zrbecker's)
  const handleClick = (event: any) => {
    if (event.target.tagName.toLowerCase() === 'a') {
      event.preventDefault();
      ipc?.openExternal(event.target.href);
    }
  };

  React.useEffect(() => {
    if (ipc) document.addEventListener('click', handleClick);

    return () => {
      if (ipc) document.removeEventListener('click', handleClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        fontSize: '0.95rem',
        lineHeight: 1.45,
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
        '& img': { maxWidth: '100%', height: 'auto' },
        '& pre': wrapOverflow
          ? {
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              overflowX: 'hidden',
            }
          : { overflowX: 'auto' },
        '& code': wrapOverflow
          ? {
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
            }
          : {},
        '& table': wrapOverflow
          ? {
              width: '100%',
              tableLayout: 'fixed',
            }
          : { display: 'block', width: '100%', overflowX: 'auto' },
        '& th, & td': wrapOverflow
          ? {
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
            }
          : {},
      }}
    >
      <MarkDown remarkPlugins={[remarkGfm]}>{value}</MarkDown>
    </Box>
  );
}
