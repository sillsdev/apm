import { Dialog, Stack, Button, Checkbox, FormControlLabel } from '@mui/material';



interface IProps {
  handleShowResources: () => void;
  handleConfigureGeneral: () => void;
  onClose: () => void;
  open: boolean;
  showResources: boolean;
  showConfigureGeneral: boolean;
  resourcesChecked: boolean;
}

export const SettingsDialog = (props: IProps) => {
  return (
    <Dialog open={props.open} onClose={props.onClose}>
      <Stack sx={{ p: 2 }}>
        {props.showResources && (
          <FormControlLabel
            control={
              <Checkbox
                checked={props.resourcesChecked}
                onChange={(_, checked) => {
                  if (checked !== props.resourcesChecked) {
                    props.handleShowResources();
                  }
                }}
              />
            }
            label="Show resources for all passages"
          />
        )}
        {props.showConfigureGeneral && (
          <Button
            variant="outlined"
            onClick={props.handleConfigureGeneral}
            sx = {{color: 'black', borderBlockColor: 'black'}}>
            Configure General
          </Button>
        )}
      </Stack>
    </Dialog>
  );
};
