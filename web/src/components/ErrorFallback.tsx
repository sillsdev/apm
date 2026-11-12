import { Stack, Typography } from '@mui/material';
import { Button } from '../control';
import { IMainStrings } from '../model';
import { shallowEqual, useSelector } from 'react-redux';
import { mainSelector } from '../selector';

interface IErrorFallback {
  error: Error;
  info: React.ErrorInfo;
  clearError: () => void;
}

export const ErrorFallback = ({
  error,
  info,
  clearError,
}: IErrorFallback): React.ReactElement => {
  const t: IMainStrings = useSelector(mainSelector, shallowEqual);
  return (
    <Stack>
      <Typography>
        {error?.message ?? JSON.stringify(error, null, 2)}
      </Typography>
      <Typography>{info.componentStack}</Typography>
      <Button color="primary" onClick={clearError}>
        {t.clear}
      </Button>
    </Stack>
  );
};
