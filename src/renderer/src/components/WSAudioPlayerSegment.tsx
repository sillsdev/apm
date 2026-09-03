import { IconButton, Grid } from '@mui/material';
import { useContext, useEffect, useRef, useState } from 'react';
import { GrowingDiv } from '../control/GrowingDiv';
import { LightTooltip } from '../control/LightTooltip';
import { ToolbarGrid } from '../control/ToolbarGrid';
import { IWsAudioPlayerSegmentStrings } from '../model';
import { IoMdBarcode } from 'react-icons/io';
import type { IconBaseProps } from 'react-icons';
import RemoveIcon from '@mui/icons-material/Remove';
import SettingsIcon from '@mui/icons-material/Settings';
import { HotKeyContext } from '../context/HotKeyContext';
import AddIcon from '@mui/icons-material/Add';
import { IRegionChange, IRegionParams } from '../crud/useWavesurferRegions';
import { useSelector } from 'react-redux';
import WSSegmentParameters from './WSSegmentParameters';
import { useSnackBar } from '../hoc/SnackBar';
import { audioPlayerSegmentSelector } from '../selector';
import { useGlobal } from '../context/useGlobal';
import { useMobile } from '../utils/useMobile';

export const ADDREMSEG_KEY = 'CTRL+ALT+Y';
export const DELREG_KEY = 'CTRL+ARROWDOWN';

const Barcode = IoMdBarcode as unknown as React.FC<IconBaseProps>;

interface IProps {
  ready: boolean;
  loop: boolean;
  currentNumRegions: number;
  params?: IRegionParams;
  playing: boolean;
  canSetDefault?: boolean;
  onAutoSegment?: () => void;
  /** Playhead is on an existing boundary — disable Add so no split lands on it. */
  disableSplit?: boolean;
  /** Playhead is on a removable internal join — enable Remove. */
  removeEnabled?: boolean;
  onSplit: (split: IRegionChange) => void;
  onParamChange?: (params: IRegionParams, teamDefault: boolean) => void;
  wsAutoSegment?: (loop: boolean | undefined, params: IRegionParams) => number;
  wsRemoveSplitRegion: () => IRegionChange | undefined;
  wsAddRegion: () => IRegionChange | undefined;
  setBusy?: (value: boolean) => void;
}

function WSAudioPlayerSegment(props: IProps) {
  const {
    ready,
    loop,
    currentNumRegions,
    params,
    playing,
    disableSplit,
    removeEnabled,
    canSetDefault,
    onAutoSegment,
    onSplit,
    onParamChange,
    wsAutoSegment,
    wsRemoveSplitRegion,
    wsAddRegion,
    setBusy,
  } = props;
  const t: IWsAudioPlayerSegmentStrings = useSelector(
    audioPlayerSegmentSelector
  );
  const [segParams, setSegParams] = useState<IRegionParams>({
    silenceThreshold: 0.004,
    timeThreshold: 0.02,
    segLenThreshold: 0.5,
  });
  const busyRef = useRef(false);
  const [showSettings, setShowSettings] = useState(false);
  const { isMobileView } = useMobile();
  const [isDeveloper] = useGlobal('developer');
  const { subscribe, unsubscribe, localizeHotKey } =
    useContext(HotKeyContext).state;
  const { showMessage } = useSnackBar();
  const readyRef = useRef(ready);

  useEffect(() => {
    const keys = [
      { key: ADDREMSEG_KEY, cb: handleSplit },
      { key: DELREG_KEY, cb: handleRemoveNextSplit },
    ];
    keys.forEach((k) => subscribe(k.key, k.cb));

    return () => {
      keys.forEach((k) => unsubscribe(k.key));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    setSegParams({
      silenceThreshold: params?.silenceThreshold
        ? params.silenceThreshold
        : 0.004,
      timeThreshold: params?.timeThreshold ? params.timeThreshold : 0.02,
      segLenThreshold: params?.segLenThreshold || 0.5,
    });
  }, [params]);

  const setSegmenting = (value: boolean) => {
    if (setBusy) setBusy(value);
    busyRef.current = value;
  };
  const handleAutoSegment = () => {
    setSegmenting(true);
    const numRegions = (wsAutoSegment && wsAutoSegment(loop, segParams)) ?? 0;
    showMessage(t.segmentsCreated.replace('{0}', numRegions.toString()));
    setSegmenting(false);
    onAutoSegment?.();
    return true;
  };
  const handleShowSettings = () => {
    setShowSettings(!showSettings);
  };
  // Keep Add disabled state and styling in sync.
  // disableSplit covers boundary and recorded-segment cases.
  const splitDisabled = !ready || busyRef.current || !!disableSplit;

  const handleSplit = () => {
    if (!readyRef.current) return false;
    if (setBusy) setBusy(true);
    const result = wsAddRegion();
    if (result && onSplit) onSplit(result);
    if (setBusy) setBusy(false);
    return true;
  };
  const handleRemoveNextSplit = () => {
    if (!readyRef.current) return false;
    if (setBusy) setBusy(true);
    // Remove the boundary nearest the playhead (relative to the current region).
    const result = wsRemoveSplitRegion();
    if (result && onSplit) onSplit(result);
    if (setBusy) setBusy(false);
    return true;
  };
  const handleSegParamChange = (
    params: IRegionParams,
    teamDefault: boolean
  ) => {
    setSegParams(params);
    onParamChange && onParamChange(params, teamDefault);
  };

  return (
    <GrowingDiv>
      <ToolbarGrid container>
        <Grid>
          {wsAutoSegment && (
            <>
              <LightTooltip
                id="wsSegmentTip"
                title={t.autoSegment.replace('[{0}]', '')}
              >
                <span>
                  <IconButton
                    id="wsSegment"
                    onClick={handleAutoSegment}
                    disabled={!ready || playing || busyRef.current}
                  >
                    <Barcode />
                  </IconButton>
                </span>
              </LightTooltip>
              {(!isMobileView || isDeveloper) && (
                <LightTooltip id="wsSettingsTip" title={t.segmentSettings}>
                  <span>
                    <IconButton
                      id="wsSegmentSettings"
                      onClick={handleShowSettings}
                      disabled={playing}
                    >
                      <SettingsIcon fontSize="small" />
                    </IconButton>
                  </span>
                </LightTooltip>
              )}
              <WSSegmentParameters
                loop={loop}
                params={segParams}
                canSetDefault={canSetDefault ?? false}
                currentNumRegions={currentNumRegions}
                wsAutoSegment={wsAutoSegment}
                isOpen={showSettings && !playing}
                onOpen={setShowSettings}
                onSave={handleSegParamChange}
                setBusy={setBusy}
              />
            </>
          )}
          <LightTooltip
            id="wsSplitTip"
            title={t.splitSegment.replace('{0}', localizeHotKey(ADDREMSEG_KEY))}
          >
            <span>
              <IconButton
                id="wsSplit"
                onClick={handleSplit}
                disabled={splitDisabled}
                // Use primary style only when Add is actionable.
                variant={splitDisabled ? undefined : 'primary'}
              >
                <AddIcon />
              </IconButton>
            </span>
          </LightTooltip>
          <LightTooltip
            id="wsJoinTip"
            title={t.removeSegment.replace('{0}', localizeHotKey(DELREG_KEY))}
          >
            <span>
              <IconButton
                id="wsJoin"
                onClick={handleRemoveNextSplit}
                disabled={
                  !ready ||
                  busyRef.current ||
                  currentNumRegions === 0 ||
                  !removeEnabled
                }
                // A little breathing room so the solid-background Add button
                // isn't crowding Remove when it's enabled.
                sx={{ ml: '6px' }}
              >
                <RemoveIcon />
              </IconButton>
            </span>
          </LightTooltip>
        </Grid>
      </ToolbarGrid>
    </GrowingDiv>
  );
}

export default WSAudioPlayerSegment;
