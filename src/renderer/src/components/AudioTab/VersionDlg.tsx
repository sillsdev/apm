import { useState, useMemo, useCallback } from 'react';
import { useGlobal } from '../../context/useGlobal';
import { MediaFileD, ISharedStrings } from '../../model';
import AudioTable from './AudioTable';
import { ActionRow, GrowingDiv } from '../StepEditor';
import SelectLatest from './SelectLatest';
import { UpdateRecord } from '../../model/baseModel';
import { useOrbitData } from '../../hoc/useOrbitData';
import { shallowEqual, useSelector } from 'react-redux';
import { useMobile } from '../../utils/index';
import { Typography, Box } from '@mui/material';
import { sharedSelector } from '../../selector/selectors';
import { PriButton } from '../../control';
import { usePassageVersionAudioRows } from './usePassageVersionAudioRows';

interface IProps {
  passId: string;
  canSetDestination: boolean;
  hasPublishing: boolean;
  /** Close parent dialog (e.g. BigDialog X or after action). */
  close?: () => void;
  /** After the chosen file is promoted to latest version (orbit updated). */
  onVersionApplied?: () => void;
}
export const VersionDlg = (props: IProps) => {
  const { passId, canSetDestination, hasPublishing, close, onVersionApplied } =
    props;
  const mediaFiles = useOrbitData<MediaFileD[]>('mediafile');

  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const [playItem, setPlayItem] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const { data, sectionArr, shared, readonly, handleRefresh } =
    usePassageVersionAudioRows(passId, playItem);
  const versions = useMemo(
    () => data.map((d) => parseInt(d.version, 10)),
    [data]
  );

  const promoteVersionToLatest = useCallback(
    (version: number) => {
      const id = data.find((d) => parseInt(d.version, 10) === version)?.id;
      const nextVersion = Math.max(...versions, 0) + 1;
      if (!id) return Promise.resolve();
      const pi = mediaFiles.find((m) => m.id === id) as MediaFileD | undefined;
      if (!pi) return Promise.resolve();
      pi.attributes.versionNumber = nextVersion;
      return memory
        .update((t) => UpdateRecord(t, pi, user))
        .then(() => {
          handleRefresh();
          onVersionApplied?.();
        });
    },
    [data, versions, mediaFiles, memory, user, handleRefresh, onVersionApplied]
  );

  const { isMobile: isMobileView } = useMobile();

  return (
    <>
      <AudioTable
        data={data}
        setRefresh={handleRefresh}
        playItem={playItem}
        setPlayItem={setPlayItem}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        readonly={readonly}
        sectionArr={sectionArr}
        shared={shared}
        canSetDestination={canSetDestination}
        hasPublishing={hasPublishing}
        showVersionRadio={isMobileView}
      />
      <ActionRow>
        {isMobileView ? (
          <Box
            sx={{
              pt: 2,
              width: '100%',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <PriButton
              onClick={() => {
                if (!selectedId) return;
                const version = parseInt(
                  data.find((d) => d.id === selectedId)?.version || '0',
                  10
                );
                void promoteVersionToLatest(version).then(() => close?.());
              }}
              disabled={!selectedId}
            >
              <Typography sx={{ color: 'white', p: 0.5 }}>
                {ts.useThisVersion}
              </Typography>
            </PriButton>
          </Box>
        ) : (
          <>
            <GrowingDiv />
            <SelectLatest
              versions={versions}
              onChange={(v) => {
                void promoteVersionToLatest(v);
              }}
            />
          </>
        )}
      </ActionRow>
    </>
  );
};

export default VersionDlg;
