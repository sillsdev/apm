import { TextField } from '@mui/material';
import { IPlanSheetStrings } from '@model/index';
import { useSelector, shallowEqual } from 'react-redux';
import { planSheetSelector } from '../../selector';

export function NoteTitleField({
  value,
  onChange,
  readonly = false,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  readonly?: boolean;
}>) {
  const t: IPlanSheetStrings = useSelector(planSheetSelector, shallowEqual);
  return (
    <TextField
      value={value}
      onChange={(event) => {
        if (readonly) return;
        onChange(event.target.value);
      }}
      size="small"
      spellCheck
      slotProps={{
        htmlInput: {
          'aria-label': t.noteTitle,
          spellCheck: true,
          readOnly: readonly,
        },
      }}
    />
  );
}
