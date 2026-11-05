import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom';
import MinimapPlugin from 'wavesurfer.js/dist/plugins/minimap';
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import VoiceOverOffOutlinedIcon from '@mui/icons-material/VoiceOverOffOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import MicIcon from '@mui/icons-material/Mic';
import DownloadIcon from '@mui/icons-material/GetAppOutlined';
import { formatTime } from '../utils/formatTime';
import { extensionFromAudioContentType } from '../utils/mimeTypes';
import { localUserKey, LocalKey } from '../utils/localUserKey';
import {
  spliceAudio,
  clampSelectionToHighlights,
  insertSilenceAudio,
} from '../utils/audioUtils';
import { useRecorder } from '../utils/useRecorder';
import { useUserMedia } from '../crud/useUserMedia';
import { buildCaptureConstraints } from '../crud/captureConstraints';
import {
  createWaveformRenderer,
  disableProgressSplit,
} from '../crud/waveformRenderer';
import { audioManager, type AudioHandle } from '../utils/audioManager';
import usePassageDetailContext from '../context/usePassageDetailContext';
import { MicrophoneDialog } from './MicrophoneDialog';
import { ConvertVoiceDialog } from './ConvertVoiceDialog';
import { AiProcessing } from './AiProcessing';
import NoChickenIcon from '../control/NoChickenIcon';
import VoiceConversionLogo from '../control/VoiceConversionLogo';
import { useAudioConversion } from '../utils/useAudioConversion';
import { shallowEqual, useSelector } from 'react-redux';
import { IAudioDownloadStrings, IWsAudioPlayerStrings } from '../model';
import { audioDownloadSelector, wsAudioPlayerSelector } from '../selector';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AudioPlayerHandle {
  /** Start playback */
  play: () => void;
  /** Pause playback */
  pause: () => void;
  /** Seek to a specific time */
  setTime: (time: number) => void;
  /** Start recording from the microphone */
  startRecording: () => Promise<void>;
  /** Stop recording */
  stopRecording: () => void;
  /** Push current audio + selection onto the undo stack, with an optional payload returned to onAudioChange when this entry is restored */
  pushUndo: (payload?: unknown) => void;
  /** Programmatically set the waveform selection */
  updateSelection: (sel: { start: number; end: number } | null) => void;
  /** Reset zoom to the default */
  resetZoom: () => void;
}

export interface AudioPlayerProps {
  /** Audio source — either a Blob or a URL string */
  audioSource?: Blob;

  /** Allow user to drag-create a selection on the waveform */
  enableDragSelection?: boolean;

  /** Double-tap the waveform to select the entire clip (default: false) */
  selectAllOnDoubleClick?: boolean;

  /** WaveSurfer waveColor */
  waveColor?: string;
  /** WaveSurfer progressColor */
  progressColor?: string;
  /** Waveform height in px (default: 80) */
  height?: number;

  /** Custom time display. If omitted, shows "currentTime / duration" (or selection range when active) */
  formatTimeDisplay?: (currentTime: number, duration: number) => string;
  /** Called on every timeupdate */
  onTimeUpdate?: (time: number) => void;
  /** Called when WaveSurfer decodes audio (provides duration) */
  onReady?: (duration: number) => void;
  /** Called when a recording completes (provides the recorded Blob) */
  onRecordingComplete?: (blob: Blob) => void;
  /** Called once when playback reaches the end of the clip. */
  onFinish?: () => void;

  /** Menu items to show in the overflow menu (e.g. <MenuItem> elements) */
  menuItems?: React.ReactNode;

  /** Called when the drag-selection changes (null when cleared) */
  onSelectionChange?: (
    selection: { start: number; end: number } | null,
    source: 'user' | 'undo'
  ) => void;

  /** Show a Record button instead of Play when no audio is loaded (default: false) */
  showRecordButton?: boolean;
  /** Is recording intended for this player (default: showRecordButton) */
  allowRecord?: boolean;
  /** Mic echo cancellation while recording (default: false) */
  captureEchoCancellation?: boolean;
  /** Mic noise suppression while recording (default: false) */
  captureNoiseSuppression?: boolean;
  /** Show a cut icon in the controls row (default: false) */
  showCut?: boolean;
  /** Show a trash option to clear the audio (default: false) */
  showTrash?: boolean;
  /** Show a silence icon in the controls row (default: false) */
  showSilence?: boolean;
  /** Show an undo icon in the controls row (default: true) */
  showUndo?: boolean;
  /** Show a download option in the menu (default: true) */
  showDownload?: boolean;

  /** Create an unclearable selection region on the waveform */
  stickySelection?: { start: number; end: number };

  /** Stop playback at stickySelection end and seek back to start (default: true) */
  shouldStopAfterStickySelection?: boolean;

  /** Called when the internal audio changes. When the change is an undo restore, undoPayload carries whatever was passed to pushUndo for that entry. */
  onAudioChange?: (audio: Blob | null, undoPayload?: unknown) => void;

  /** Enable mouse-wheel and touch-pinch zoom on the waveform (default: true) */
  enableZoom?: boolean;

  /** Colored regions to highlight on the waveform */
  highlights?: { start: number; end: number; color: string }[];

  /** Children rendered below the waveform (e.g. helper text) */
  children?: React.ReactNode;

  /** Optional label rendered on the top row (after time display) */
  topRowLabel?: React.ReactNode;

  /** Static markers — timestamps in seconds, optionally with a color (default grey). */
  markers?: (number | AudioMarker)[];

  /** Fires on every waveform click. `marker` is the nearest marker timestamp within ~10px, if any. */
  onWaveformClick?: (timestamp: number, marker?: number) => void;

  /**
   * Prefixes every aria-label inside the player (e.g. "passage play").
   * Override when a screen shows more than one player, so the labels stay unique.
   */
  label?: string;
}

export interface AudioMarker {
  /** Timestamp in seconds */
  time: number;
  /** Marker color */
  color?: string;
}

/* ------------------------------------------------------------------ */
/*  Marker helpers                                               */
/* ------------------------------------------------------------------ */

const GRACE_PX = 10;
const DEFAULT_MARKER_COLOR = '#868686c5';

/**
 * Nearest marker drawn within GRACE_PX on-screen pixels of the click, or undefined.
 */
function nearestMarkerWithin(
  markers: AudioMarker[],
  clickXPercent: number,
  durationInSec: number,
  waveformWidthPx: number
): number | undefined {
  const clickPx = clickXPercent * waveformWidthPx;
  let best: number | undefined;
  let bestD = Infinity;
  for (const m of markers) {
    const markerPx = (m.time / durationInSec) * waveformWidthPx;
    const d = Math.abs(markerPx - clickPx);
    if (d <= GRACE_PX && d < bestD) {
      best = m.time;
      bestD = d;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  (
    {
      audioSource,
      enableDragSelection = false,
      selectAllOnDoubleClick = false,
      waveColor: waveColorProp,
      progressColor: progressColorProp,
      height = 80,
      formatTimeDisplay,
      onTimeUpdate,
      onReady,
      menuItems: menuItemsProp,
      onSelectionChange,
      showRecordButton = false,
      allowRecord = showRecordButton,
      captureEchoCancellation = false,
      captureNoiseSuppression = false,
      showCut = false,
      showTrash = false,
      showSilence = false,
      showUndo = true,
      showDownload = true,
      stickySelection,
      shouldStopAfterStickySelection = true,
      onRecordingComplete,
      onFinish,
      onAudioChange,
      highlights = [],
      enableZoom = true,
      children,
      topRowLabel,
      markers,
      onWaveformClick,
      label = 'passage',
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const minimapContainerRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WaveSurfer | null>(null);
    const regionsRef = useRef<RegionsPlugin | null>(null);

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [internalAudio, setInternalAudio] = useState<Blob | null>(
      audioSource ?? null
    );
    const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
    const [isZoomed, setIsZoomed] = useState(false);
    const theme = useTheme();
    const waveColor = waveColorProp ?? theme.palette.primary.extraLight;
    const progressColor = progressColorProp ?? theme.palette.primary.extraLight;
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
    const isSelectionSticky = !!stickySelection;

    // Undo stack
    interface UndoEntry {
      audio: Blob | null;
      selection: { start: number; end: number } | null;
      payload?: unknown;
    }
    const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
    const pushUndo = (payload?: unknown) => {
      setUndoStack((prev) => [
        ...prev,
        { audio: internalAudio, selection, payload },
      ]);
    };

    const selfHandleRef = useRef<Required<AudioHandle>>({
      play: () => wsRef.current?.play(),
      pause: () => wsRef.current?.pause(),
      stop: () => wsRef.current?.stop(),
    });

    const [selection, setSelection] = useState<{
      start: number;
      end: number;
    } | null>(stickySelection ?? null);
    const selectionRef = useRef(selection);
    useEffect(() => {
      selectionRef.current = selection;
    }, [selection]);
    const stickySelectionRef = useRef(stickySelection);
    useEffect(() => {
      stickySelectionRef.current = stickySelection;
    }, [stickySelection]);
    const shouldStopAfterStickySelectionRef = useRef(
      shouldStopAfterStickySelection
    );
    useEffect(() => {
      shouldStopAfterStickySelectionRef.current =
        shouldStopAfterStickySelection;
    }, [shouldStopAfterStickySelection]);
    const highlightsRef = useRef(highlights);
    useEffect(() => {
      highlightsRef.current = highlights;
    }, [highlights]);
    const markerObjs = (markers ?? []).map((m) =>
      typeof m === 'number' ? { time: m } : m
    );
    const markersRef = useRef(markerObjs);
    markersRef.current = markerObjs;

    useEffect(() => {
      if (audioSource && audioSource !== internalAudio) {
        setUndoStack([]);
        applySelection(stickySelection ?? null);
        setInternalAudio(audioSource);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioSource]);

    // Helper: only fire onSelectionChange when the value actually changed
    const fireSelectionChange = (
      sel: { start: number; end: number } | null,
      source: 'user' | 'undo'
    ) => {
      const prev = selectionRef.current;
      if (
        prev === sel ||
        (prev && sel && prev.start === sel.start && prev.end === sel.end)
      )
        return;
      onSelectionChange?.(sel, source);
    };
    const onAudioChangeRef = useRef(onAudioChange);
    useEffect(() => {
      onAudioChangeRef.current = onAudioChange;
    }, [onAudioChange]);

    // Ref to track whether a region add is programmatic
    const programmaticRef = useRef(false);

    const { recording, setRecording, isBoldWorkflow } =
      usePassageDetailContext();
    const {
      progress: conversionProcessing,
      suppressNoise,
      convertVoice,
      cancel,
    } = useAudioConversion();
    const t: IWsAudioPlayerStrings = useSelector(
      wsAudioPlayerSelector,
      shallowEqual
    );
    const ta: IAudioDownloadStrings = useSelector(
      audioDownloadSelector,
      shallowEqual
    );
    const [microphoneId, setMicrophoneId] = useState(
      () => localStorage.getItem(localUserKey(LocalKey.microphoneId)) ?? ''
    );
    const [micDialogOpen, setMicDialogOpen] = useState(false);
    const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
    const getMic = useUserMedia(
      buildCaptureConstraints(
        microphoneId,
        captureEchoCancellation,
        captureNoiseSuppression
      )
    );
    const [micStream, setMicStream] = useState<MediaStream>();
    useEffect(() => {
      if (allowRecord)
        getMic(true).then(
          ({ stream }) => setMicStream(stream),
          () => {}
        );
    }, [allowRecord, getMic, microphoneId]);

    const recorder = useRecorder(micStream);
    const startRecording = async () => {
      if (conversionProcessing) return;
      await recorder.startRecording(
        internalAudio,
        currentTime,
        wsRef.current,
        (audio) => {
          if (internalAudio) {
            pushUndo();
            wsRef.current?.once('decode', () =>
              wsRef.current?.setTime(currentTime)
            );
          }
          setInternalAudio(audio);
          setRecording(false);
          onAudioChangeRef.current?.(audio);
          onRecordingComplete?.(audio);
        }
      );
      setRecording(true);
    };
    const stopRecording = () => recorder.stopRecording();

    // Apply or clear the single selection region.
    const applySelection = (sel: { start: number; end: number } | null) => {
      const rp = regionsRef.current;
      if (rp) {
        rp.getRegions().forEach((r) => {
          if (r.start !== r.end) r.remove();
        });
        if (sel) {
          programmaticRef.current = true;
          rp.addRegion({ start: sel.start, end: sel.end });
          programmaticRef.current = false;
          wsRef.current?.setTime(sel.start);
        }
      }
      setSelection(sel);
      fireSelectionChange(sel, 'user');
    };

    // Imperative handle
    useImperativeHandle(ref, () => ({
      play: selfHandleRef.current.play,
      pause: selfHandleRef.current.pause,
      setTime: (t: number) => wsRef.current?.setTime(t),
      get container() {
        return containerRef.current;
      },
      startRecording,
      stopRecording,
      pushUndo,
      updateSelection: applySelection,
      resetZoom: () => {
        const ws = wsRef.current;
        if (ws) ws.zoom(1);
      },
    }));

    /* ----- Init WaveSurfer ----- */
    useEffect(() => {
      if (!containerRef.current) return;
      const handle = selfHandleRef.current;

      const wsRegions = RegionsPlugin.create();
      regionsRef.current = wsRegions;

      const plugins: Array<RegionsPlugin | ZoomPlugin> = [wsRegions];
      if (enableZoom) {
        plugins.push(
          ZoomPlugin.create({
            scale: 0.5,
            maxZoom: 500,
            deltaThreshold: 5,
            exponentialZooming: true,
            iterations: 20,
          })
        );
      }

      const wsOptions = {
        container: containerRef.current,
        waveColor,
        progressColor,
        cursorColor: '#333',
        cursorWidth: 4,
        barWidth: 2,
        height,
        normalize: false,
        plugins,
        hideScrollbar: isSmallScreen,
      };

      const renderFunction = createWaveformRenderer(
        {
          ws: wsRef,
          highlights: highlightsRef,
        },
        wsOptions
      );

      const ws = WaveSurfer.create({ ...wsOptions, renderFunction });
      wsRef.current = ws;

      disableProgressSplit(ws);

      if (enableZoom && minimapContainerRef.current) {
        ws.registerPlugin(
          MinimapPlugin.create({
            container: minimapContainerRef.current,
            height: 12,
            waveColor: '#dddddd',
            progressColor: '#dddddd',
            cursorWidth: 0,
            overlayColor: '#c4c4c448',
          })
        );
      }

      ws.on('zoom', () => {
        requestAnimationFrame(() => {
          const parent = wsRef.current?.getWrapper().parentElement;
          setIsZoomed(!!parent && parent.scrollWidth > parent.clientWidth + 1);
        });
      });

      const container = containerRef.current!;
      let dragCleanup: (() => void) | undefined;
      if (enableDragSelection) {
        dragCleanup = wsRegions.enableDragSelection({});

        // Work around a bug in wavesurfer's createDragStream: multi-touch leaves
        // stale entries in its activePointers map, permanently breaking drag selection.
        // Re-initialize drag selection after each pinch gesture to reset the state.
        let wasPinching = false;
        const onTouchStart = (e: TouchEvent) => {
          if (e.touches.length >= 2) wasPinching = true;
        };
        const onTouchEnd = (e: TouchEvent) => {
          if (wasPinching && e.touches.length === 0) {
            wasPinching = false;
            dragCleanup?.();
            dragCleanup = wsRegions.enableDragSelection({});
          }
        };
        container.addEventListener('touchstart', onTouchStart, {
          passive: true,
        });
        container.addEventListener('touchend', onTouchEnd, { passive: true });
      }

      // --- Real-time highlight clamping ---
      wsRegions.on('region-initialized', (region) => {
        region.on('update', (side) => {
          if (region.start === region.end) return; // marker
          const hl = highlightsRef.current;
          if (!hl.length) return;

          const mode =
            side === 'start' ? 'start' : side === 'end' ? 'end' : 'pan';
          const userSelection = selectionRef.current;
          //filter out when the selection is highlighted (e.g. replacement dialog)
          const filtered = userSelection
            ? hl.filter(
                (h) =>
                  h.start >= userSelection.end || h.end <= userSelection.start
              )
            : hl;
          const clamped = clampSelectionToHighlights(
            { start: region.start, end: region.end },
            filtered,
            mode,
            userSelection
          );

          if (!clamped) {
            const prev = selectionRef.current;
            if (prev) region.setOptions({ start: prev.start, end: prev.end });
            else region.remove();
            return;
          }
          if (clamped.start !== region.start || clamped.end !== region.end) {
            region.setOptions({
              start: clamped.start,
              end: clamped.end,
            });
          }
        });
      });

      // --- Region events (drag-selection) ---
      wsRegions.on('region-created', (region) => {
        if (region.start === region.end) return; // marker, ignore
        if (programmaticRef.current) return;

        // Remove other non-marker regions (single-selection mode)
        wsRegions.getRegions().forEach((r) => {
          if (r.id !== region.id && r.start !== r.end) r.remove();
        });
        const sel = { start: region.start, end: region.end };
        setSelection(sel);
        fireSelectionChange(sel, 'user');
        ws.setTime(region.start);
      });

      wsRegions.on('region-updated', (region) => {
        const sel = { start: region.start, end: region.end };
        setSelection(sel);
        fireSelectionChange(sel, 'user');
        ws.setTime(region.start);
      });

      wsRegions.on('region-clicked', (region, e) => {
        if (region.start !== region.end) {
          e.stopPropagation();
        }
      });

      // --- Waveform click ---
      ws.on('click', () => {
        if (!isSelectionSticky) {
          // Clear selection regions (but not when initialSelection is set)
          wsRegions.getRegions().forEach((r) => {
            if (r.start !== r.end) r.remove();
          });
          setSelection(null);
          fireSelectionChange(null, 'user');
        }
      });

      // --- Waveform double-click: select the entire clip ---
      if (selectAllOnDoubleClick) {
        ws.on('dblclick', () => {
          const dur = ws.getDuration();
          if (!dur) return;
          applySelection({ start: 0, end: dur });
        });
      }

      // --- Playback events ---
      let playStartTime = 0;
      ws.on('play', () => {
        playStartTime = ws.getCurrentTime();
        setPlaying(true);
      });
      ws.on('pause', () => {
        setPlaying(false);
        audioManager.release(handle);
      });
      ws.on('timeupdate', (time) => {
        setCurrentTime(time);
        onTimeUpdate?.(time);
        // Stop playback at sticky/regular selection end and seek back to start.
        const sel =
          shouldStopAfterStickySelectionRef.current &&
          stickySelectionRef.current
            ? stickySelectionRef.current
            : enableDragSelection
              ? selectionRef.current
              : null;
        if (
          ws.isPlaying() &&
          sel &&
          time >= sel.end &&
          playStartTime < sel.end
        ) {
          ws.pause();
          ws.setTime(sel.start);
          setCurrentTime(sel.start);
        }
      });
      ws.on('decode', (d) => {
        if (d < 0.01) {
          return;
        }
        setDuration(d);
        if (recording) return;
        onReady?.(d);
        if (stickySelectionRef.current && ws.options.minPxPerSec < 20)
          ws.zoom(20);

        if (!regionsRef.current) return;

        // Clear any pre-existing regions
        regionsRef.current.getRegions().forEach((r) => {
          r.remove();
        });

        // Preserve previous selection
        const prevSelection = selectionRef.current;
        if (prevSelection) {
          programmaticRef.current = true;
          regionsRef.current.addRegion({
            start: prevSelection.start,
            end: prevSelection.end,
            color:
              prevSelection.start === prevSelection.end
                ? '#303030aa'
                : undefined,
          });
          programmaticRef.current = false;
          ws.setTime(prevSelection.start);
        }

        // Re-add static markers
        for (const m of markersRef.current) {
          regionsRef.current.addRegion({
            start: m.time,
            drag: false,
            resize: false,
            color: m.color ?? DEFAULT_MARKER_COLOR,
          });
        }
      });
      ws.on('finish', () => {
        onFinish?.();
      });

      return () => {
        dragCleanup?.();
        audioManager.release(handle);
        ws.destroy();
        wsRef.current = null;
        regionsRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ----- Sync audio source ----- */
    useEffect(() => {
      const ws = wsRef.current;
      if (!ws || !internalAudio) return;
      // Restore cursor visibility (may have been hidden by trash)
      ws.setOptions({ cursorWidth: 4 });
      const url = URL.createObjectURL(internalAudio);
      ws.load(url);
      return () => URL.revokeObjectURL(url);
    }, [internalAudio]);

    /* ----- Sync sticky selection → selection ----- */
    useEffect(() => {
      if (!stickySelection) return;
      setSelection({
        start: stickySelection.start,
        end: stickySelection.end,
      });
      wsRef.current?.setTime(stickySelection.start);
    }, [stickySelection]);

    /* ----- Re-render waveform when highlights change ----- */
    useEffect(() => {
      const ws = wsRef.current;
      if (!ws || !duration) return;
      ws.setOptions({});
    }, [selection, duration, waveColor, highlights]);

    /* ----- Sync static markers when the prop changes during runtime ----- */
    const markerKey = markerObjs
      .map((m) => `${m.time}|${m.color ?? ''}`)
      .join(',');
    useEffect(() => {
      const rp = regionsRef.current;
      const ws = wsRef.current;
      if (!rp || !ws || !ws.getDuration()) return;
      rp.getRegions().forEach((r) => {
        if (r.end === r.start) r.remove();
      });
      for (const m of markersRef.current) {
        rp.addRegion({
          start: m.time,
          drag: false,
          resize: false,
          color: m.color ?? DEFAULT_MARKER_COLOR,
        });
      }
    }, [markerKey]);

    /* ----- Fire onWaveformClick (alongside the click handler) ----- */
    useEffect(() => {
      if (!onWaveformClick) return;
      const ws = wsRef.current;
      if (!ws) return;
      return ws.on('click', (relX: number) => {
        const duration = ws.getDuration();
        const waveformWidth = ws.getWrapper().getBoundingClientRect().width;

        const marker = nearestMarkerWithin(
          markersRef.current ?? [],
          relX,
          duration,
          waveformWidth
        );
        onWaveformClick(relX * duration, marker);
      });
    }, [onWaveformClick]);

    const hasLoadedAudio = duration > 0;

    const handlePlayToggle = () => {
      if (playing) audioManager.pause();
      else audioManager.play(selfHandleRef.current);
    };

    const handleUndo = () => {
      const stack = [...undoStack];
      const entry = stack.pop();
      if (!entry) return;
      setUndoStack(stack);
      setInternalAudio(entry.audio);
      onAudioChangeRef.current?.(entry.audio, entry.payload);
      wsRef.current?.once('decode', () => wsRef.current?.setTime(currentTime));
      setSelection(entry.selection);
      fireSelectionChange(entry.selection, 'undo');
    };
    const handleCutClick = async () => {
      if (!internalAudio || !selection) return;
      pushUndo();
      try {
        const spliced = await spliceAudio(
          internalAudio,
          selection.start,
          selection.end
        );
        // Clear selection and regions before loading new audio
        setSelection(null);
        fireSelectionChange(null, 'user');
        regionsRef.current?.getRegions().forEach((r) => {
          if (r.start !== r.end) r.remove();
        });
        setInternalAudio(spliced);
        onAudioChangeRef.current?.(spliced);
        wsRef.current?.once('decode', () =>
          wsRef.current?.setTime(currentTime)
        );
      } catch {
        // Splice failed — leave audio unchanged
      }
    };
    const handleTrashClick = () => {
      pushUndo();
      setInternalAudio(null);
      onAudioChangeRef.current?.(null);
      const ws = wsRef.current;
      if (ws) {
        ws.setTime(0);
        ws.empty();
        ws.getMediaElement().load();
        ws.setOptions({ cursorWidth: 0 });
      }
      setDuration(0);
      setSelection(null);
    };
    const handleDownloadClick = () => {
      if (!internalAudio) return;
      const ext = extensionFromAudioContentType(internalAudio.type);
      const url = URL.createObjectURL(internalAudio);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = ext ? `audio.${ext}` : 'audio';
      anchor.click();
      URL.revokeObjectURL(url);
    };
    const handleInsertSilenceClick = async () => {
      if (!internalAudio) return;
      pushUndo();
      const withSilence = await insertSilenceAudio(
        internalAudio,
        currentTime,
        0.5
      );
      setInternalAudio(withSilence);
      onAudioChangeRef.current?.(withSilence);
      wsRef.current?.once('decode', () => wsRef.current?.setTime(currentTime));
    };
    const applyAi = async (
      func: (
        audio: Blob,
        range: { start: number; end: number }
      ) => Promise<Blob | undefined>
    ) => {
      wsRef.current?.pause();
      onAudioChangeRef.current?.(null);
      const result = await func(
        internalAudio!,
        selection ?? { start: 0, end: duration }
      );
      if (!result) {
        onAudioChangeRef.current?.(internalAudio);
        return;
      }
      pushUndo();
      setInternalAudio(result);
      onAudioChangeRef.current?.(result);
      wsRef.current?.once('decode', () => wsRef.current?.setTime(currentTime));
    };

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
      setMenuAnchorEl(event.currentTarget);
    };
    const handleMenuClose = () => {
      setMenuAnchorEl(null);
    };
    const isMenuOpen = Boolean(menuAnchorEl);
    const hasMenu =
      React.Children.count(menuItemsProp) > 0 ||
      showTrash ||
      allowRecord ||
      showDownload;

    const timeDisplay = formatTimeDisplay
      ? formatTimeDisplay(currentTime, duration)
      : selection
        ? `${formatTime(selection.start)} - ${formatTime(selection.end)}`
        : `${formatTime(currentTime)} / ${formatTime(duration || 0)}`;

    return (
      <Box>
        <Box sx={{ display: conversionProcessing ? 'none' : undefined }}>
          <Stack direction="row" alignItems="center" spacing={0}>
            {/* Left button: Record/Stop when showRecordButton and no audio (or actively recording), otherwise Play/Pause */}
            {showRecordButton && (!hasLoadedAudio || recording) ? (
              recording ? (
                <IconButton
                  onClick={stopRecording}
                  sx={{ p: 0 }}
                  aria-label={`${label} stop recording`}
                >
                  <StopIcon fontSize="large" sx={{ color: 'error.main' }} />
                </IconButton>
              ) : (
                <IconButton
                  onClick={startRecording}
                  sx={{ p: 0 }}
                  aria-label={`${label} start recording`}
                >
                  <FiberManualRecordIcon
                    fontSize="large"
                    sx={{ color: 'error.main' }}
                  />
                </IconButton>
              )
            ) : (
              <IconButton
                onClick={handlePlayToggle}
                disabled={!hasLoadedAudio}
                sx={{ p: 0 }}
                aria-label={playing ? `${label} pause` : `${label} play`}
              >
                {playing ? (
                  <PauseIcon fontSize="large" />
                ) : (
                  <PlayArrowIcon fontSize="large" />
                )}
              </IconButton>
            )}
            <Typography variant="body2" sx={{ ml: '12px !important' }}>
              {timeDisplay}
            </Typography>
            {topRowLabel ?? <Box sx={{ flexGrow: 1 }} />}
            {showUndo && undoStack.length > 0 && (
              <IconButton
                disabled={undoStack.length === 0}
                size="small"
                aria-label={`${label} undo`}
                sx={{ ml: '12px !important' }}
                onClick={handleUndo}
              >
                <UndoIcon fontSize="small" />
              </IconButton>
            )}
            {showCut && (
              <IconButton
                disabled={!selection}
                size="small"
                aria-label={`${label} cut`}
                sx={{ ml: '12px !important' }}
                onClick={handleCutClick}
              >
                <ContentCutIcon fontSize="small" />
              </IconButton>
            )}
            {showSilence && (
              <IconButton
                disabled={!hasLoadedAudio || recording}
                size="small"
                aria-label={`${label} insert silence`}
                sx={{ ml: '12px !important' }}
                onClick={handleInsertSilenceClick}
              >
                <VoiceOverOffOutlinedIcon fontSize="small" />
              </IconButton>
            )}
            {hasMenu && (
              <IconButton
                aria-label={`${label} audio menu`}
                disabled={recording}
                size="small"
                sx={{ ml: '8px !important' }}
                onClick={handleMenuOpen}
              >
                <MoreVertIcon />
              </IconButton>
            )}
          </Stack>

          {hasMenu && (
            <Menu
              anchorEl={menuAnchorEl}
              open={isMenuOpen}
              onClose={handleMenuClose}
            >
              {allowRecord && (
                <MenuItem
                  aria-label={`${label} select microphone`}
                  onClick={() => {
                    handleMenuClose();
                    setMicDialogOpen(true);
                  }}
                >
                  <ListItemIcon>
                    <MicIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Select Microphone...</ListItemText>
                </MenuItem>
              )}
              {allowRecord && !isBoldWorkflow && (
                <MenuItem
                  aria-label={`${label} reduce noise`}
                  disabled={!hasLoadedAudio}
                  onClick={() => {
                    handleMenuClose();
                    applyAi(suppressNoise);
                  }}
                >
                  <ListItemIcon>
                    <NoChickenIcon sx={{ width: '14pt', height: '14pt' }} />
                  </ListItemIcon>
                  <ListItemText>{t.reduceNoiseAi}</ListItemText>
                </MenuItem>
              )}
              {allowRecord && !isBoldWorkflow && (
                <MenuItem
                  aria-label={`${label} convert voice`}
                  disabled={!hasLoadedAudio}
                  onClick={() => {
                    handleMenuClose();
                    setVoiceDialogOpen(true);
                  }}
                >
                  <ListItemIcon>
                    <VoiceConversionLogo
                      disabled={!hasLoadedAudio}
                      sx={{ width: '14pt', height: '14pt' }}
                    />
                  </ListItemIcon>
                  <ListItemText>{t.convertVoiceAi}...</ListItemText>
                </MenuItem>
              )}
              {showDownload && (
                <MenuItem
                  aria-label={`${label} download audio`}
                  disabled={!internalAudio}
                  onClick={() => {
                    handleMenuClose();
                    handleDownloadClick();
                  }}
                >
                  <ListItemIcon>
                    <DownloadIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{ta.downloadMedia}</ListItemText>
                </MenuItem>
              )}
              {showTrash && (
                <MenuItem
                  aria-label={`${label} reset audio`}
                  disabled={!hasLoadedAudio}
                  onClick={() => {
                    handleMenuClose();
                    handleTrashClick();
                  }}
                >
                  <ListItemIcon>
                    <DeleteOutlineIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Reset Audio</ListItemText>
                </MenuItem>
              )}
              {menuItemsProp}
            </Menu>
          )}
          {micDialogOpen && (
            <MicrophoneDialog
              microphoneId={microphoneId}
              onCancel={() => setMicDialogOpen(false)}
              onConfirm={(id) => {
                localStorage.setItem(localUserKey(LocalKey.microphoneId), id);
                setMicrophoneId(id);
                setMicDialogOpen(false);
              }}
            />
          )}
          {voiceDialogOpen && (
            <ConvertVoiceDialog
              onCancel={() => setVoiceDialogOpen(false)}
              begin={(voice) => {
                setVoiceDialogOpen(false);
                applyAi((audio, range) => convertVoice(audio, range, voice));
              }}
            />
          )}

          <Box
            ref={containerRef}
            aria-label={`${label} waveform`}
            sx={{
              minHeight: height,
              bgcolor: 'action.hover',
              mt: 1,
              borderRadius: 1,
              overflow: 'hidden',
              width: '100%',
            }}
          />
          {enableZoom && (
            <Box
              ref={minimapContainerRef}
              sx={{
                height: { xs: 12, sm: 0 },
                overflow: 'hidden',
                opacity: isZoomed ? 1 : 0,
              }}
            />
          )}
        </Box>
        {conversionProcessing && (
          <AiProcessing {...conversionProcessing} onCancel={cancel} />
        )}
        {children}
      </Box>
    );
  }
);

AudioPlayer.displayName = 'AudioPlayer';
