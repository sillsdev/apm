import { TextField } from '@mui/material';
import { IScriptureTableStrings } from '@model/index';
import { useSelector, shallowEqual } from 'react-redux';
import { scriptureTableSelector } from '../../selector';

export function NoteTitleField({
  value,
  onChange,
  readonly = false,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  readonly?: boolean;
}>) {
  const t: IScriptureTableStrings = useSelector(
    scriptureTableSelector,
    shallowEqual
  );
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
          // Same text as the visible Title column header.
          'aria-label': t.title,
          spellCheck: true,
          readOnly: readonly,
        },
      }}
    />
  );
}
