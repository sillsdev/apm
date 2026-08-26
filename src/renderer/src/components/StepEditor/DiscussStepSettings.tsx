import { useEffect, useState } from 'react';
import { MarkDownEdit } from '../../control/MarkDownEdit';
import { Box } from '@mui/material';
import { Button, ActionRow, rowSx } from '../../control';
import { shallowEqual, useSelector } from 'react-redux';
import { sharedSelector } from '../../selector';
import { ISharedStrings } from '../../model';

interface IProps {
  toolSettings: string;
  onChange: (toolSettings: string) => void;
  onClose: () => void;
}

export const DiscussStepSettings = ({
  toolSettings,
  onChange,
  onClose,
}: IProps) => {
  const [inValue, setInValue] = useState<string>('');
  const [value, setValue] = useState<string>('');
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  useEffect(() => {
    if (toolSettings) {
      const json = JSON.parse(toolSettings);
      setValue(json.markDown);
      setInValue(json.markDown);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolSettings]);

  const handleChange = (value: string | null) => {
    setValue(value || '');
  };

  const handleSave = () => {
    onChange(JSON.stringify({ markDown: value }));
    onClose();
  };

  return (
    <Box>
      <MarkDownEdit inValue={value} onValue={handleChange} />
      <ActionRow>
        <Box sx={rowSx}>
          <Button onClick={onClose}>
            {value === inValue ? ts.close : ts.cancel}
          </Button>
          <Button
            color="primary"
            disabled={value === inValue}
            onClick={handleSave}
          >
            {ts.save}
          </Button>
        </Box>
      </ActionRow>
    </Box>
  );
};
