import { useState } from 'react';
import { Link } from '@mui/material';

interface AeroTaskErrorMessageProps {
  summary: string;
  details?: string;
  detailsLabel: string;
}

export default function AeroTaskErrorMessage({
  summary,
  details,
  detailsLabel,
}: AeroTaskErrorMessageProps) {
  const [showDetails, setShowDetails] = useState(false);
  return (
    <span>
      {summary}
      {details && (
        <>
          {' '}
          <Link
            component="button"
            type="button"
            onClick={() => setShowDetails((open) => !open)}
          >
            {detailsLabel}
          </Link>
          {showDetails && (
            <span
              style={{
                display: 'block',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {details}
            </span>
          )}
        </>
      )}
    </span>
  );
}
