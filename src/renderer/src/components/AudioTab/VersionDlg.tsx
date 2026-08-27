import {
  useState,
  useMemo,
  useCallback,
  useLayoutEffect,
  useEffect,
  useRef,
} from 'react';
import { useGlobal } from '../../context/useGlobal';
import { MediaFileD, ISharedStrings } from '../../model';
import AudioTable from './AudioTable';
import { ActionRow } from '../StepEditor';
import { UpdateRecord } from '../../model/baseModel';
import { useOrbitData } from '../../hoc/useOrbitData';
import { shallowEqual, useSelector } from 'react-redux';
import { doSort } from '../../utils/index';
import type { GridSortModel } from '@mui/x-data-grid';
import { Box } from '@mui/material';
import { sharedSelector } from '../../selector/selectors';
import { Button } from '../../control';
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
    () => data.map((d) => parseInt(d.version || '0', 10)),
    [data]
  );

  const versionSortModel: GridSortModel = [{ field: 'version', sort: 'desc' }];
  const rowsByVersionDesc = useMemo(
    () => [...data].sort(doSort(versionSortModel)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  );
  const latestRowId = rowsByVersionDesc[0]?.id ?? '';

  const prevDataLenRef = useRef<number | null>(null);
  useEffect(() => {
    prevDataLenRef.current = null;
  }, [passId]);

  useEffect(() => {
    const prev = prevDataLenRef.current;
    prevDataLenRef.current = data.length;
    if (prev !== null && prev > 0 && data.length === 0) {
      close?.();
    }
  }, [data.length, close, passId]);

  useLayoutEffect(() => {
    if (!latestRowId) {
      setSelectedId('');
      return;
    }
    setSelectedId((prev) => {
      const prevStillInList = prev && data.some((d) => d.id === prev);
      if (!prevStillInList) return latestRowId;
      return prev;
    });
  }, [latestRowId, data]);

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
        showVersionRadio={true}
      />
      {data.length > 0 && (
        <ActionRow>
          <Box
            sx={{
              pt: 2,
              width: '100%',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <Button
              onClick={() => {
                if (!selectedId || selectedId === latestRowId) return;
                const version = parseInt(
                  data.find((d) => d.id === selectedId)?.version || '0',
                  10
                );
                void promoteVersionToLatest(version).then(() => close?.());
              }}
              color="primary"
              disabled={!selectedId || selectedId === latestRowId}
            >
              {ts.useThisVersion}
            </Button>
          </Box>
        </ActionRow>
      )}
    </>
  );
};

export default VersionDlg;
