import { TextField } from '@mui/material';

export function NoteTitleField({
  value,
  onChange,
  readonly = false,
}: Readonly<{
  value: string;
  onChange: (value: string) => void;
  readonly?: boolean;
}>) {
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
          // Accessibility-only label: intentionally not localized.
          'aria-label': 'Note title',
          spellCheck: true,
          readOnly: readonly,
        },
      }}
    />
  );
}
