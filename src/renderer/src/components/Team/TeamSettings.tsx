import React, { useEffect, useState } from 'react';
import {
  DialogMode,
  ICardsStrings,
  ISharedStrings,
  Organization,
} from '../../model';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  styled,
  AccordionDetailsProps,
  FormLabel,
  Stack,
  FormControl,
  FormControlLabel,
  Checkbox,
  IconButton,
  Typography,
  Badge,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Options } from '../../control';
import { TeamContext } from '../../context/TeamContext';
import SettingsIcon from '@mui/icons-material/Settings';
import BigDialog from '../../hoc/BigDialog';
import { BigDialogBp } from '../../hoc/BigDialogBp';
import SelectSponsor from '../../business/voice/SelectSponsor';
import { shallowEqual, useSelector } from 'react-redux';
import { cardsSelector, sharedSelector } from '../../selector';
import { useGlobal } from '../../context/useGlobal';
import {
  orgDefaultPermissions,
  orgDefaultWorkflowProgression,
  WorkflowProgression,
} from '../../crud';
import { isElectron } from '../../../api-variable';

import { FeatureSlug } from './FeatureSlug';

const Details = styled(AccordionDetails)<AccordionDetailsProps>(
  ({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    '& .MuiBox-root': {
      paddingTop: theme.spacing(0),
    },
  })
);

export interface IFeatures {
  noNoise?: boolean;
  deltaVoice?: boolean;
  aiTranscribe?: boolean;
  [key: string]: any;
}

interface IValues {
  features: IFeatures;
  workflowProgression: string;
  permissions: boolean;
}

interface IProps {
  mode: DialogMode;
  team?: Organization;
  values: IValues;
  setValue: (what: string, value: string, init?: boolean) => void;
}

export function TeamSettings(props: IProps) {
  const { mode, team, values, setValue } = props;
  const ctx = React.useContext(TeamContext);
  const [permissions, setPermissions] = useState(true);
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [offline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const { personalTeam } = ctx.state;
  const t: ICardsStrings = useSelector(cardsSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const workflowOptions = [
    t.workflowProgressionPassage,
    t.workflowProgressionStep,
  ];
  const [workflowProgression, setWorkflowProgression] = useState(
    values?.workflowProgression ?? WorkflowProgression.Passage
  );

  useEffect(() => {
    setWorkflowProgression(
      values?.workflowProgression ?? WorkflowProgression.Passage
    );
  }, [values?.workflowProgression]);

  useEffect(() => {
    setPermissions(values?.permissions);
  }, [values?.permissions]);

  const setProgression = (label: string) => {
    // map localized label back to the stable key
    const val =
      label === t.workflowProgressionStep
        ? WorkflowProgression.Step
        : WorkflowProgression.Passage;
    setWorkflowProgression(val);
    setValue(orgDefaultWorkflowProgression, val);
  };

  const handleFeatures = (feat: string) => (_e: any, checked: boolean) => {
    setValue(feat, checked?.toString());
  };

  const handleRefresh = () => {
    setValue('refresh', '');
  };
  const handlePermissionSwitch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(orgDefaultPermissions, e.target.checked.toString());
    setPermissions(e.target.checked);
  };
  return (
    <Box sx={{ width: '100%', my: 1 }}>
      <Accordion>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel0a-content"
          id="panel0a-header"
        >
          {t.settings}
        </AccordionSummary>
        <Details>
          <Stack spacing={1}>
            {team?.id !== personalTeam && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={permissions}
                    onChange={handlePermissionSwitch}
                  />
                }
                labelPlacement="end"
                label={t.projectPermissions}
              />
            )}
            <Options
              label={t.workflowProgression}
              defaultValue={
                workflowProgression === WorkflowProgression.Step
                  ? t.workflowProgressionStep
                  : t.workflowProgressionPassage
              }
              options={workflowOptions}
              onChange={setProgression}
            />

            <FormControl
              component="fieldset"
              sx={{ border: '1px solid grey', mr: 1, px: 2 }}
            >
              <FormLabel sx={{ color: 'secondary.main' }}>
                {t.experimentalFeatures}
              </FormLabel>
              {!offline && (
                <Stack direction="row" spacing={1}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={
                          values?.features?.[FeatureSlug.NoNoise] ?? false
                        }
                        onChange={handleFeatures(FeatureSlug.NoNoise)}
                      />
                    }
                    label={<Badge badgeContent={ts.ai}>{t.reduceNoise}</Badge>}
                  />
                </Stack>
              )}
              {!offline && (
                <Stack direction="row" spacing={1}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={
                          values?.features?.[FeatureSlug.DeltaVoice] ?? false
                        }
                        onChange={handleFeatures(FeatureSlug.DeltaVoice)}
                      />
                    }
                    label={<Badge badgeContent={ts.ai}>{t.convertVoice}</Badge>}
                  />
                  {mode !== DialogMode.add && (
                    <IconButton
                      onClick={() => setVoiceVisible(true)}
                      disabled={!values?.features?.[FeatureSlug.DeltaVoice]}
                    >
                      <SettingsIcon />
                    </IconButton>
                  )}
                </Stack>
              )}
              {!offline && (
                <Stack direction="row" spacing={1}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={
                          values?.features?.[FeatureSlug.AiTranscribe] ?? false
                        }
                        onChange={handleFeatures(FeatureSlug.AiTranscribe)}
                      />
                    }
                    label={
                      <Badge badgeContent={ts.ai}>{t.recognizeSpeech}</Badge>
                    }
                  />
                </Stack>
              )}
              {isElectron && (
                <Stack direction="row" spacing={1}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={
                          values?.features?.[FeatureSlug.Normalize] ?? false
                        }
                        onChange={handleFeatures(FeatureSlug.Normalize)}
                      />
                    }
                    label={t.normalize}
                  />
                </Stack>
              )}
            </FormControl>
          </Stack>
        </Details>
      </Accordion>

      <BigDialog
        title={t.convertVoiceSettings}
        isOpen={voiceVisible}
        onOpen={() => setVoiceVisible(false)}
        description={<Typography>{t.convertPrompt}</Typography>}
        bp={BigDialogBp.sm}
      >
        <SelectSponsor
          team={team}
          refresh={handleRefresh}
          onOpen={() => setVoiceVisible(false)}
        />
      </BigDialog>
    </Box>
  );
}

export default TeamSettings;
