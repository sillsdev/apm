import { useEffect, useRef } from 'react';
import {
  styled,
  TextareaAutosize,
  TextareaAutosizeProps,
  TextField,
  FilledTextFieldProps,
} from '@mui/material';

/**
 * Hook to dynamically inject @font-face rule when url is provided
 */
const useFontFace = (family: string, url?: string) => {
  const injectedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!url || !family || injectedRef.current === family) {
      return;
    }

    // Check if font-face already exists
    const existingStyle = document.getElementById(`font-face-${family}`);
    if (existingStyle) {
      injectedRef.current = family;
      return;
    }

    // Inject @font-face rule
    const style = document.createElement('style');
    style.id = `font-face-${family}`;
    style.textContent = `
      @font-face {
        font-family: '${family}';
        src: url('${url}') format('woff2'),
             url('${url}') format('woff'),
             url('${url}') format('truetype');
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
    injectedRef.current = family;

    return () => {
      // Cleanup: remove style when component unmounts (optional)
      // You might want to keep it for other components using the same font
      // const styleEl = document.getElementById(`font-face-${family}`);
      // if (styleEl) styleEl.remove();
    };
  }, [family, url]);
};

export interface StyledTextAreaAutosizeProps extends TextareaAutosizeProps {
  family: string;
  url?: string;
  overrides?: React.CSSProperties;
}

const StyledTextAreaAutosizeBase = styled(TextareaAutosize, {
  shouldForwardProp: (prop) =>
    prop !== 'family' && prop !== 'url' && prop !== 'overrides',
})<StyledTextAreaAutosizeProps>(({ family, overrides }) => ({
  fontFamily: family,
  ...overrides,
}));

export const StyledTextAreaAutosize = (props: StyledTextAreaAutosizeProps) => {
  useFontFace(props.family, props.url);
  return <StyledTextAreaAutosizeBase {...props} />;
};

export interface StyledTextFieldProps extends FilledTextFieldProps {
  family: string;
  url?: string;
}

const StyledTextFieldBase = styled(TextField, {
  shouldForwardProp: (prop) => prop !== 'family' && prop !== 'url',
})<StyledTextFieldProps>(({ family }) => ({
  fontFamily: family,
}));

export const StyledTextField = (props: StyledTextFieldProps) => {
  useFontFace(props.family, props.url);
  return <StyledTextFieldBase {...props} />;
};
