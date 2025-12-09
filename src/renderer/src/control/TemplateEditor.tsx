import React, { useState, useRef, useEffect } from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Stack,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { ITemplateStrings } from '../model';
import { templateSelector } from '../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { InfoDialog } from './TemplateEditorHelpers';
import {
  getTemplateCodeLabels,
  hasInvalidTemplate,
} from './TemplateEditorUtils';
import { useOrganizedBy } from '../crud';

interface ITemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  validCodes: string[];
  id?: string;
  showLabel?: boolean;
  onValid?: (isValid: boolean) => void;
}

export const TemplateEditor = (props: ITemplateEditorProps) => {
  const { value, onChange, validCodes, id, showLabel, onValid } = props;
  const [localValue, setLocalValue] = useState(value);
  const [templateInfo, setTemplateInfo] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);
  const isEditingRef = useRef(false);
  const t: ITemplateStrings = useSelector(templateSelector, shallowEqual);
  const { getOrganizedBy } = useOrganizedBy();
  const [organizedBy] = useState(getOrganizedBy(true));

  // Sync with prop changes, but not while actively editing
  useEffect(() => {
    if (!isEditingRef.current && value !== localValue) {
      setLocalValue(value);
    }
  }, [value, localValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    isEditingRef.current = true;
    onChange(newValue);
    // Reset editing flag after a short delay
    setTimeout(() => {
      isEditingRef.current = false;
    }, 100);
  };

  const handleTemplateInfo = () => {
    setTemplateInfo(true);
  };

  const handleClose = () => {
    setTemplateInfo(false);
  };

  const handleChipClick = (code: string) => {
    const input = templateRef.current?.querySelector(
      'input'
    ) as HTMLInputElement;
    if (input) {
      // Get cursor position before state update
      const start = input.selectionStart ?? localValue.length;
      const end = input.selectionEnd ?? localValue.length;
      const newTemplate =
        localValue.substring(0, start) +
        `{${code}}` +
        localValue.substring(end);

      // Update state
      setLocalValue(newTemplate);
      onChange(newTemplate);

      // Set cursor position after inserted code
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        if (input) {
          input.focus();
          const newPos = start + code.length + 2; // +2 for { and }
          input.setSelectionRange(newPos, newPos);
        }
      });
    } else {
      // Fallback: append to end if input not found
      const newTemplate = localValue + `{${code}}`;
      setLocalValue(newTemplate);
      onChange(newTemplate);
    }
  };

  const hasInvalid = hasInvalidTemplate(localValue, validCodes);

  // Notify parent when validation state changes
  useEffect(() => {
    if (onValid) {
      onValid(!hasInvalid);
    }
  }, [hasInvalid, onValid]);

  return (
    <>
      <TextField
        ref={templateRef}
        label={showLabel ? t.autoMatchTemplate : ''}
        variant="filled"
        fullWidth
        sx={{ mt: 2 }}
        value={localValue}
        onChange={handleChange}
        error={hasInvalid}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  id={id ? `${id}-templCodes` : 'templCodes'}
                  color="primary"
                  sx={{ p: 1 }}
                  onClick={handleTemplateInfo}
                  title={t.templateCodes}
                >
                  <InfoIcon />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      <Stack
        direction="row"
        spacing={1}
        sx={{ mt: 1, mb: 1, flexWrap: 'wrap', gap: 0.5 }}
      >
        {validCodes.map((code) => (
          <Chip
            key={code}
            label={`{${code}}`}
            size="small"
            onClick={() => handleChipClick(code)}
            sx={{ cursor: 'pointer' }}
          />
        ))}
      </Stack>
      <InfoDialog
        open={templateInfo}
        onClose={handleClose}
        onClick={handleChipClick}
        validCodes={validCodes}
        codeLabels={getTemplateCodeLabels(validCodes, t, organizedBy)}
      />
    </>
  );
};
