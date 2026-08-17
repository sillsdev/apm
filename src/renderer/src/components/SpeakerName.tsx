import * as React from 'react';
import { useGlobal } from '../context/useGlobal';
import { ICommunityStrings, ISharedStrings, MediaFileD } from '../model';
import TextField from '@mui/material/TextField';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IntellectualProperty from '../model/intellectualProperty';
import ProvideRights from './ProvideRights';
import { communitySelector, sharedSelector } from '../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { ArtifactTypeSlug, findRecord, related } from '../crud';
import { Typography, Stack } from '@mui/material';
import { useOrbitData } from '../hoc/useOrbitData';
import { useSnackBar } from '../hoc/SnackBar';
import { useMobile } from '../utils/index';

interface NameOptionType {
  inputValue?: string;
  name: string;
}

const filter = createFilterOptions<NameOptionType>();

/** Non-empty trimmed name, or null if the value is missing / whitespace-only. */
function normalizedSpeakerName(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  return t.length === 0 ? null : t;
}

interface IProps {
  name: string;
  planId?: string;
  noNewVoice?: boolean | undefined;
  onChange?: ((name: string) => void) | undefined;
  onRights?: ((hasRights: boolean) => void) | undefined;
  team?: string | undefined;
  recordingRequired?: boolean | undefined;
  disabled?: boolean | undefined;
}

export function SpeakerName({
  name,
  planId,
  noNewVoice,
  onChange,
  onRights,
  team,
  recordingRequired,
  disabled,
}: IProps) {
  const ipRecs = useOrbitData<IntellectualProperty[]>('intellectualproperty');
  const [value, setValue] = React.useState<NameOptionType | null>({ name });
  const valueRef = React.useRef<string>('');
  const [showSelectDialog, setShowSelectDialog] = React.useState(false);
  const [organization] = useGlobal('organization');
  const { showMessage } = useSnackBar();
  const [memory] = useGlobal('memory');
  const t: ICommunityStrings = useSelector(communitySelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const [hasNoRights, setHasNoRights] = React.useState(false);

  const speakers = React.useMemo((): NameOptionType[] => {
    const orgId = team || organization;
    const orgIp = ipRecs.filter((r) => related(r, 'organization') === orgId);

    const newSpeakers: NameOptionType[] = [];
    if (recordingRequired) {
      orgIp.forEach((r) => {
        const mediaRec = findRecord(
          memory,
          'mediafile',
          related(r, 'releaseMediafile')
        ) as MediaFileD;
        if (mediaRec?.attributes?.transcription) {
          newSpeakers.push({ name: r.attributes.rightsHolder });
        }
      });
    } else {
      newSpeakers.push(
        ...orgIp.map((r) => ({ name: r.attributes.rightsHolder }))
      );
    }

    newSpeakers.sort((a, b) => a.name.localeCompare(b.name));
    return newSpeakers;
  }, [ipRecs, team, organization, recordingRequired, memory]);

  const handleRights = () => {
    onRights && onRights(false);
    if (noNewVoice) {
      showMessage(t.noVoiceCreation);
      onChange?.(name);
      return;
    }
    setHasNoRights(true);
  };

  const nameReset = () => {
    valueRef.current = '';
    onChange && onChange('');
    onRights && onRights(false);
    setHasNoRights(false);
  };

  const getOptionLabel = (option: string | NameOptionType) => {
    // Value selected with enter, right from the input
    if (typeof option === 'string') {
      return option;
    }
    // Add "xxx" option created dynamically
    if (option.inputValue) {
      return option.inputValue;
    }
    // Regular option
    return option.name;
  };

  const handleRightsChange = (hasRights: boolean) => {
    onRights && onRights(hasRights);
    setHasNoRights(false);
    setShowSelectDialog(false);
  };

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    valueRef.current = event.target.value;
    onRights && onRights(false);
  };

  const inList = (name: string) => {
    const normalized = normalizedSpeakerName(name);
    if (!normalized) return undefined;
    const n = normalized.toLocaleLowerCase();
    return speakers.find((s) => {
      const sn = normalizedSpeakerName(s.name);
      return sn != null && sn.toLocaleLowerCase() === n;
    });
  };

  const handleChoice = (newValue: string | NameOptionType | null) => {
    if (newValue === null) {
      nameReset();
    } else if (typeof newValue === 'string') {
      const n = normalizedSpeakerName(newValue);
      if (!n) {
        nameReset();
        return;
      }
      valueRef.current = n;
      setValue({ name: n });
      onChange && onChange(n);
      if (inList(n)) {
        onRights && onRights(true);
        setHasNoRights(false);
      } else handleRights();
    } else if (newValue && newValue.inputValue) {
      const n = normalizedSpeakerName(newValue.inputValue);
      if (!n) {
        nameReset();
        return;
      }
      valueRef.current = n;
      setValue({ name: n });
      onChange && onChange(n);
      if (inList(n)) {
        onRights && onRights(true);
        setHasNoRights(false);
      } else handleRights();
    } else {
      setValue(newValue);
      if (newValue) {
        const n = normalizedSpeakerName(newValue.name);
        if (!n) {
          nameReset();
          return;
        }
        valueRef.current = n;
        onChange && onChange(n);
        onRights && onRights(true);
        setHasNoRights(false);
      }
    }
  };

  const handleChoiceMobile = (newValue: string | NameOptionType | null) => {
    if (newValue === null) {
      nameReset();
      setHasNoRights(false);
    } else if (typeof newValue === 'string') {
      const n = normalizedSpeakerName(newValue);
      if (!n) {
        nameReset();
        setHasNoRights(false);
        return;
      }
      valueRef.current = n;
      setValue({ name: n });
      onChange && onChange(n);
      if (inList(n)) {
        setHasNoRights(false);
        setShowSelectDialog(false);
      } else {
        setHasNoRights(true);
      }
    } else if (newValue && newValue.inputValue) {
      const n = normalizedSpeakerName(newValue.inputValue);
      if (!n) {
        nameReset();
        setHasNoRights(false);
        return;
      }
      valueRef.current = n;
      setValue({ name: n });
      onChange && onChange(n);
      setHasNoRights(true);
    } else {
      setValue(newValue);
      if (newValue) {
        const n = normalizedSpeakerName(newValue.name);
        if (!n) {
          nameReset();
          setHasNoRights(false);
          return;
        }
        valueRef.current = n;
        onChange && onChange(n);
        setHasNoRights(false);
        setShowSelectDialog(false);
      }
    }
  };

  const handleLeave = (event: any, reason: string) => {
    if (
      reason === 'blur' &&
      valueRef.current &&
      event?.relatedTarget?.id !== 'uploadCancel'
    )
      handleChoice(valueRef.current);
  };

  React.useEffect(() => {
    if (inList(name)) {
      onRights && onRights(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakers, name]);

  React.useEffect(() => {
    const newName = valueRef.current ? valueRef.current : name;
    if (value?.name !== newName) setValue({ name: newName });
  }, [name, value?.name]);

  const handleOpenSelectDialog = () => {
    setShowSelectDialog(true);
  };

  const handleCloseSelectDialog = () => {
    setShowSelectDialog(false);
  };

  const handleSelectAndClose = (newValue: string | NameOptionType | null) => {
    // Desktop: keep the dialog open when the user is adding a new speaker
    // so we can show ProvideRights inline.
    if (newValue === null) {
      nameReset();
      return;
    }
    const rawName =
      typeof newValue === 'string'
        ? newValue
        : newValue.inputValue
          ? newValue.inputValue
          : newValue.name;

    const nextName = normalizedSpeakerName(rawName);
    // If empty, keep dialog open (don't launch rights).
    if (!nextName) {
      nameReset();
      setValue({ name: '' });
      return;
    }

    valueRef.current = nextName;
    setValue({ name: nextName });
    onChange && onChange(nextName);

    if (inList(nextName)) {
      onRights && onRights(true);
      setHasNoRights(false);
      setShowSelectDialog(false);
    } else {
      onRights && onRights(false);
      setHasNoRights(true);
      // keep dialog open
    }
  };

  const buttonText = name?.trim() !== '' ? name : t.selectSpeaker + '...';

  const { isMobile: isMobileView } = useMobile();

  return (
    <>
      <Button
        variant={name?.trim() !== '' ? 'outlined' : 'contained'}
        onClick={handleOpenSelectDialog}
        disabled={disabled}
        sx={{
          minWidth: isMobileView ? 100 : 200,
          justifyContent: 'flex-start',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <SupportAgentIcon />
          <span>{buttonText}</span>
        </Stack>
      </Button>
      <Dialog
        open={showSelectDialog}
        onClose={handleCloseSelectDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <SupportAgentIcon />
            <span>{t.selectSpeaker}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Autocomplete
            value={value}
            onChange={(event, newValue) =>
              isMobileView
                ? handleChoiceMobile(newValue)
                : handleSelectAndClose(newValue)
            }
            onClose={handleLeave}
            filterOptions={(options, params) => {
              const filtered = filter(options, params);

              const { inputValue } = params;
              const trimmed = normalizedSpeakerName(inputValue);
              const isExisting =
                trimmed != null &&
                options.some(
                  (option) => normalizedSpeakerName(option.name) === trimmed
                );
              if (trimmed && !isExisting) {
                filtered.push({
                  inputValue: trimmed,
                  name: t.addSpeaker.replace('{0}', trimmed),
                });
              }

              return filtered;
            }}
            selectOnFocus
            clearOnBlur
            handleHomeEndKeys
            id="speaker-name"
            options={speakers}
            getOptionLabel={getOptionLabel}
            renderOption={(props, option, state) => (
              <li {...props} key={`spkr-opt-${state.index}`}>
                {option.name}
              </li>
            )}
            sx={{ width: '100%', marginTop: '5px' }}
            freeSolo
            renderInput={(params) => {
              const { size, InputLabelProps, ...restParams } = params;
              const { className, ...restInputLabelProps } =
                InputLabelProps || {};
              return (
                <TextField
                  required
                  {...restParams}
                  {...(size && { size })}
                  slotProps={{
                    inputLabel: {
                      ...restInputLabelProps,
                      ...(className && { className }),
                    },
                  }}
                  label={t.speaker}
                  onChange={handleNameChange}
                />
              );
            }}
          />
          {hasNoRights && (
            <>
              <Typography sx={{ my: 2 }}>
                {recordingRequired ? t.voiceRights : t.releaseRights}
              </Typography>
              <ProvideRights
                planId={planId}
                speaker={value?.name || ''}
                recordType={ArtifactTypeSlug.IntellectualProperty}
                onRights={handleRightsChange}
                team={team}
                recordingRequired={recordingRequired}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSelectDialog}>{ts.cancel}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default SpeakerName;
