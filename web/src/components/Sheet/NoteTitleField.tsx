import { TextField } from '@mui/material';

export function NoteTitleField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      value={value}
      onChange={(event) => onChange(event.target.value)}
      size="small"
      spellCheck
      inputProps={{ 'aria-label': 'Note title', spellCheck: true }}
    />
  );
}
