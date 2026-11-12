import { Checkbox, FormControlLabel, FormGroup, Box } from '@mui/material';
import { useArtifactType } from '../../crud';
import React from 'react';
import { Button, ActionRow, rowSx } from '../../control';
import { ISharedStrings } from '../../model';
import { shallowEqual, useSelector } from 'react-redux';
import { sharedSelector } from '../../selector';

interface IProps {
  compare: string[];
  onChange: (compare: string[]) => void;
  allItems: string[];
}

export default function ConsultantCheckCompare({
  compare,
  onChange,
  allItems,
}: IProps) {
  const { localizedArtifactType } = useArtifactType();
  const [state, setState] = React.useState(compare);
  const t: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = event.target;
    const newState = state.includes(name)
      ? state.filter((item) => item !== name)
      : [...state, name];
    setState(newState);
  };

  return (
    <>
      <FormGroup>
        {allItems.map((item, index) => (
          <FormControlLabel
            key={item}
            control={
              <Checkbox
                data-testid={`checkbox-${index}`}
                checked={state.includes(item)}
                onChange={handleChange}
                name={item}
              />
            }
            label={localizedArtifactType(item)}
          />
        ))}
      </FormGroup>
      <ActionRow>
        <Box sx={rowSx}>
          <Button onClick={() => onChange(compare)}>{t.cancel}</Button>
          <Button
            color="primary"
            disabled={
              state.length === 1 ||
              JSON.stringify(state) === JSON.stringify(compare)
            }
            onClick={() => onChange(state)}
          >
            {t.save}
          </Button>
        </Box>
      </ActionRow>
    </>
  );
}
