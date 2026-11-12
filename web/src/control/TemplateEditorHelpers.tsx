import {
  Dialog,
  DialogTitle,
  List,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Typography,
} from '@mui/material';
import { ITemplateStrings } from '../model';
import { templateSelector } from '../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { validTemplateCodes } from './TemplateEditorUtils';

interface ITemplateTextProps {
  template: string;
  validCodes?: string[];
}

export const TemplateText = ({
  template,
  validCodes = validTemplateCodes,
}: ITemplateTextProps) => {
  const parts: Array<{ text: string; isValid: boolean }> = [];
  let lastIndex = 0;

  // Match complete template codes: {CODE} or {}
  const completeRegex = /\{([A-Za-z]*)\}/g;

  let match;
  const matches: Array<{
    index: number;
    endIndex: number;
    code: string;
    isComplete: boolean;
  }> = [];

  // Find all complete template codes (including empty {})
  while ((match = completeRegex.exec(template)) !== null) {
    const code = match[1].toUpperCase();
    matches.push({
      index: match.index,
      endIndex: completeRegex.lastIndex,
      code: code,
      isComplete: true,
    });
  }

  // Find incomplete template codes (starting with { but not closed)
  // Check if there's an unclosed { at the end
  const lastOpenBrace = template.lastIndexOf('{');
  const lastCloseBrace = template.lastIndexOf('}');
  if (lastOpenBrace > lastCloseBrace) {
    // There's an unclosed brace
    matches.push({
      index: lastOpenBrace,
      endIndex: template.length,
      code: template.substring(lastOpenBrace + 1).toUpperCase(),
      isComplete: false,
    });
  }

  // Sort matches by index
  matches.sort((a, b) => a.index - b.index);

  // Build parts array
  for (const match of matches) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({
        text: template.substring(lastIndex, match.index),
        isValid: true,
      });
    }
    // Add the matched template code
    if (match.isComplete) {
      // Empty braces {} or invalid codes are invalid
      const isValid = match.code.length > 0 && validCodes.includes(match.code);
      parts.push({
        text: template.substring(match.index, match.endIndex),
        isValid: isValid,
      });
    } else {
      // Incomplete code - always invalid
      parts.push({
        text: template.substring(match.index, match.endIndex),
        isValid: false,
      });
    }
    lastIndex = match.endIndex;
  }

  // Add remaining text
  if (lastIndex < template.length) {
    parts.push({
      text: template.substring(lastIndex),
      isValid: true,
    });
  }

  if (parts.length === 0) {
    parts.push({ text: template, isValid: true });
  }

  return (
    <>
      {parts.map((part, index) => (
        <Typography
          key={index}
          component="span"
          variant="caption"
          sx={{
            color: part.isValid ? 'text.secondary' : 'error.main',
            fontWeight: part.isValid ? 'normal' : 'bold',
          }}
        >
          {part.text}
        </Typography>
      ))}
    </>
  );
};

interface IInfoDialogProps {
  open: boolean;
  onClose: () => void;
  onClick: (template: string) => void;
  validCodes: string[];
  codeLabels: Record<string, string>;
}

export const InfoDialog = (props: IInfoDialogProps) => {
  const { onClose, onClick, open, validCodes, codeLabels } = props;
  const t: ITemplateStrings = useSelector(templateSelector, shallowEqual);

  // Build pattern from validCodes and codeLabels
  const pattern: Record<string, string> = {};
  validCodes.forEach((code) => {
    if (codeLabels[code]) {
      pattern[code] = codeLabels[code];
    }
  });

  const handleClose = () => {
    onClose();
  };

  const handleListItemClick = (index: number) => {
    onClick(Object.keys(pattern)[index]);
  };

  return (
    <Dialog
      onClose={handleClose}
      open={open}
      aria-labelledby="templDlg"
      disableEnforceFocus
    >
      <DialogTitle id="templDlg">{t.templateCodes}</DialogTitle>
      <List>
        {Object.keys(pattern).map((pat, index) => (
          <ListItemButton key={pat} onClick={() => handleListItemClick(index)}>
            <ListItemIcon>{`{${pat}}`}</ListItemIcon>
            <ListItemText primary={pattern[pat]} />
          </ListItemButton>
        ))}
      </List>
    </Dialog>
  );
};
