import { debounce } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useWavesurfer } from '@wavesurfer/react';
import Timeline from 'wavesurfer.js/dist/plugins/timeline';
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';

import { logError, Severity } from '../utils/logErrorService';

import {
  IRegion,
  IRegions,
  parseRegions,
  useWaveSurferRegions,
} from './useWavesurferRegions';
import { convertToWav } from '../utils/wav';
import { useGlobal } from '../context/useGlobal';
import { maxZoom } from '../components/WSAudioPlayerZoom';
import WaveSurfer from 'wavesurfer.js';
import { NamedRegions } from '../utils';

const noop = () => {};

export interface IMarker {
  time: number;
  label?: string;
  color?: string;
}

export function useWaveSurfer(
  allowSegment: NamedRegions | undefined, //just used for debug logging
  container: any,
  onReady: (duration: number, loadingAnother: boolean) => void,
  onProgress: (progress: number) => void = noop,
  onRegion: (count: number, newRegion: boolean) => void = noop,
  onCanUndo: (canUndo: boolean) => void = noop,
  onPlayStatus: (playing: boolean) => void = noop,
  onInteraction: () => void = noop,
  onZoom: undefined | ((px: number) => void),
  onMarkerClick: (time: number) => void = noop,
  height: number,
  singleRegionOnly: boolean = false,
  currentSegmentIndex?: number | undefined,
  onCurrentRegion?: (currentRegion: IRegion | undefined) => void,
  onStartRegion?: (start: number) => void,
  onRegionPlayEnd?: (region: IRegion) => void,
  verses?: string,
  hasSegmentUndo?: boolean
) {
  const [errorReporter] = useGlobal('errorReporter');
  const progressRef = useRef(0);
  const [Regions, setRegions] = useState<RegionsPlugin>();
  const blobToLoad = useRef<Blob | undefined>(undefined);
  const positionToLoad = useRef<number | undefined>(undefined);
  const loadRequests = useRef(0);
  const playingRef = useRef(false);
  const loopingRef = useRef(false);
  const durationRef = useRef(0);
  const isReadyRef = useRef(false);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const isPlayingRef = useRef(false);
  const [undoBuffer, setUndoBuffer] = useState<AudioBuffer | undefined>();
  const inputRegionsRef = useRef<IRegions | undefined>(undefined);
  const regionsLoadedRef = useRef(false);

  const audioContextRef = useRef<AudioContext | undefined>(undefined);
  const fillpxRef = useRef(0);
  const [playerUrl, setPlayerUrl] = useState<string | undefined>();
  const [actualPxPerSec, setActualPxPerSec] = useState(0);
  const blobRef = useRef<Blob | undefined>(undefined);
  const blobAudioRef = useRef<AudioBuffer | undefined>(undefined);
  const positionRef = useRef<number | undefined>(undefined);
  const loadingRef = useRef(false);
  const recordingRef = useRef(false);
  const currentBlobUrlRef = useRef<string | undefined>(undefined);

  // Create plugins outside of useMemo to ensure they're stable
  const regionsPlugin = useMemo(() => {
    const plugin = RegionsPlugin.create();
    setRegions(plugin);
    return plugin;
  }, []);

  const timelinePlugin = useMemo(() => Timeline.create({}), []);
  const zoomPlugin = useMemo(() => {
    if (!onZoom) return undefined;
    return ZoomPlugin.create({
      scale: 0.5,
      maxZoom: maxZoom,
    });
  }, [onZoom]);

  const plugins = useMemo(() => {
    if (zoomPlugin) return [timelinePlugin, regionsPlugin, zoomPlugin];
    else return [timelinePlugin, regionsPlugin];
  }, [timelinePlugin, regionsPlugin, zoomPlugin]);

  // Create a stable configuration object
  const wavesurferConfig = useMemo(
    () => ({
      container: container,
      progressColor: '#96c1c1', //bluegray
      waveColor: '#9fc5e8', //kinda blue purple
      cursorColor: '#1b0707', //mostly black
      url: playerUrl,
      height: height,
      normalize: true,
      plugins: plugins,
      fillParent: true,
    }),
    [container, height, plugins, playerUrl]
  );

  //put these all in refs to be used in functions
  const { wavesurfer, isPlaying, currentTime } =
    useWavesurfer(wavesurferConfig);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Debounce the progress callback to prevent excessive re-renders
  const debouncedProgressCallback = debounce((value: number) => {
    onProgress(value);
  }, 200);

  const setProgress = (value: number) => {
    progressRef.current = value;
    debouncedProgressCallback(value);
  };

  useEffect(() => {
    const roundToFiveDecimals = (n: number) => Math.round(n * 100000) / 100000;

    if (
      !loadingRef.current ||
      (currentTime > 0 && progressRef.current !== currentTime)
    ) {
      setProgress(roundToFiveDecimals(currentTime));
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime]);

  const wsDuration = () => durationRef.current || 0;
  const wsFillPx = () => fillpxRef.current;
  const isNear = (position: number) => {
    return Math.abs(position - progressRef.current) < 0.3;
  };

  const wsGoto = async (position: number, keepPlayRegion: boolean = false) => {
    if (!keepPlayRegion) resetPlayingRegion();
    const duration = wsDuration();
    if (position > duration) position = duration;
    onRegionGoTo(position);
    if (position === duration && isPlayingRef.current) {
      //if playing, position messages come in after this one that set it back to previously playing position.  Turn this off first in hopes that all messages are done before we set the position...
      wavesurferRef.current?.pause();
    }
    if (progress() !== position) {
      wavesurferRef.current?.setTime(position);
    }
  };

  const progress = () => progressRef.current;
  const setPlaying = (value: boolean) => setPlayingx(value, singleRegionOnly);
  const wsIsPlaying = () => playingRef.current;
  const wsLoopRegion = (loop: boolean) => {
    loopingRef.current = loop;
    return regLoopRegion(loop);
  };
  const {
    setupRegions,
    wsAutoSegment,
    wsAddRegion,
    wsRemoveSplitRegion,
    wsPrevRegion,
    wsNextRegion,
    loadRegions,
    clearRegions,
    wsGetRegions,
    wsAddMarkers,
    wsPlayRegion,
    regLoopRegion,
    justPlayRegion,
    resetPlayingRegion,
    onRegionGoTo,
    currentRegion,
    wsSetRegionColor,
    wsRemoveCurrentRegion,
    prepareForDestroy,
  } = useWaveSurferRegions(
    singleRegionOnly,
    currentSegmentIndex ?? -1,
    wavesurferRef.current,
    container,
    onRegion,
    wsDuration,
    isNear,
    wsGoto,
    progress,
    wsIsPlaying,
    setPlaying,
    onCurrentRegion,
    onStartRegion,
    onRegionPlayEnd,
    onMarkerClick,
    verses,
    hasSegmentUndo
  );

  const setPlayingx = (value: boolean, regionOnly: boolean) => {
    playingRef.current = value;
    try {
      if (value) {
        if (isReadyRef.current) {
          //play region once if single region
          const playingRegion = regionOnly ? justPlayRegion(progress()) : false;
          if (!playingRegion) {
            //default play (which will loop region if looping is on)
            resetPlayingRegion();
            if (!wavesurferRef.current?.isPlaying())
              wavesurferRef.current?.play();
          }
        }
      } else {
        try {
          wavesurferRef.current?.pause();
        } catch {
          //ignore
        }
      }
      if (onPlayStatus) onPlayStatus(playingRef.current);
    } catch (error: any) {
      logError(Severity.error, errorReporter, error);
    }
  };

  const audioContext = () => {
    audioContextRef.current =
      audioContextRef.current ?? new window.AudioContext();
    return audioContextRef.current;
  };

  const setupZoom = () => {
    if (durationRef.current > 0 && !recordingRef.current) {
      const containerWidth = container.current?.clientWidth || 0; // Get the width of the waveform container in pixels.
      // Calculate the actual pixels per second
      const pxPerSec = containerWidth / durationRef.current;
      setActualPxPerSec(pxPerSec);
      fillpxRef.current = Math.round(pxPerSec * 10) / 10;
      onZoom && onZoom(fillpxRef.current);
    } else {
      onZoom && onZoom(maxZoom);
    }
  };
  useEffect(() => {
    const handleReady = () => {
      isReadyRef.current = true;
      setupRegions(wavesurferRef.current as WaveSurfer);
      //recording also sends ready
      if (loadRequests.current > 0) loadRequests.current--;
      //do these even if we're going to load another to show progress
      setDuration(wavesurferRef.current?.getDuration() ?? durationRef.current);
      if (positionRef.current !== undefined && positionRef.current >= 0) {
        wsGoto(positionRef.current);
      } else {
        wsGoto(durationRef.current);
      }

      loadingRef.current = false;
      if (!loadRequests.current) {
        if (!regionsLoadedRef.current) {
          //we need to call this even if undefined to setup regions variables
          regionsLoadedRef.current = loadRegions(
            inputRegionsRef.current,
            false
          );
        }
        setupZoom();
        if (playingRef.current) setPlaying(true);
      } else {
        //requesting load of blob that came in while this one was loading
        wsLoad();
      }
      //do this too even if we're going to go load another
      onReady(durationRef.current, loadRequests.current > 0);
    };

    wavesurferRef.current = wavesurfer;
    regionsLoadedRef.current = false;
    if (wavesurfer) {
      wavesurfer.on('ready', handleReady);
      //this is received way more times than expected
      wavesurfer.on('destroy', function () {
        prepareForDestroy();
        //prevent region-removed messages from the destroy
        Regions?.unAll();
        wavesurferRef.current = null;
      });

      wavesurfer.on('finish', function () {
        if (playingRef.current && !loopingRef.current) setPlaying(false);
      });
      wavesurfer.on('interaction', function (/*newTime: number*/) {
        onInteraction();
      });
      wavesurfer.on('click', (/*relativeX: number, relativeY: number*/) => {
        if (singleRegionOnly) {
          wsRemoveCurrentRegion();
        }
      });
      wavesurfer.on('dblclick', (/*relativeX: number, relativeY: number*/) => {
        if (!singleRegionOnly) {
          wsAddRegion();
        }
      });

      if (onZoom) {
        wavesurfer.on('zoom', function (px: number) {
          onZoom(px);
          if (px > actualPxPerSec) {
            wavesurfer.setOptions({
              height: height - 40,
            });
          }
        });
      }
      if (blobToLoad.current) {
        wsLoad();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wavesurfer]);

  useEffect(() => {
    // Removes events, elements and disconnects Web Audio nodes on component unmount
    return () => {
      prepareForDestroy();
      blobToLoad.current = undefined;

      if (wavesurferRef.current) {
        const ws = wavesurferRef.current;
        if (isPlayingRef.current) ws.stop();
        isPlayingRef.current = false;
        ws.unAll();
        ws.destroy();
        wavesurferRef.current = null;
      }

      // Clean up AudioContext
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = undefined;
      }

      // Clear audio buffer references
      blobAudioRef.current = undefined;
      setUndoBuffer(undefined);

      // Clear blob references and revoke blob URLs
      revokeCurrentBlobUrl();
      blobRef.current = undefined;
      setPlayerUrl(undefined);

      // Cleanup debounced function on unmount
      debouncedProgressCallback.cancel();
    }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDuration = (value: number) => {
    durationRef.current = value;
    // Set data attribute for cursor styling
    container.current?.setAttribute('data-duration', value.toString());
  };

  const wsClear = (preventUndo: boolean = false) => {
    if (loadRequests.current) {
      //queue this
      blobToLoad.current = undefined;
      loadRequests.current = 2; //if there was another, we'll bypass it
      return;
    }
    if (isPlayingRef.current) wavesurferRef.current?.stop();
    if (!preventUndo) {
      setUndoBuffer(copyOriginal());
    } else setUndoBuffer(undefined);
    onCanUndo(!preventUndo);
    clearRegions(false, preventUndo);
    wsGoto(0);
    loadBlob();
  };

  const wsTogglePlay = () => {
    setPlaying(!playingRef.current);
    return playingRef.current;
  };

  const wsPlay = () => setPlaying(true);

  const wsPause = () => setPlaying(false);

  const wsPosition = () => progressRef.current;

  const wsSetPlaybackRate = (rate: number) => {
    if (rate !== wavesurferRef.current?.getPlaybackRate()) {
      wavesurferRef.current?.setPlaybackRate(rate);
    }
  };

  const wsZoom = debounce((zoom: number) => {
    if (isReadyRef.current && !recordingRef.current)
      wavesurferRef.current?.zoom(zoom);
  }, 10);

  // Helper function to revoke current blob URL
  const revokeCurrentBlobUrl = () => {
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = undefined;
    }
  };

  const loadBlob = async (blob?: Blob, position?: number) => {
    positionRef.current = position;

    // Revoke previous blob URL if it exists
    revokeCurrentBlobUrl();

    if (!blob) {
      //this is the only way I found to clear the wavesurfer. Toggle the url to "the other empty" to trigger a reload
      setPlayerUrl(playerUrl === '' ? undefined : '');
      blobAudioRef.current = undefined;
      blobRef.current = undefined;
      setDuration(0);
      return;
    }
    try {
      loadingRef.current = true;
      blobAudioRef.current = await audioContext().decodeAudioData(
        await blob.arrayBuffer()
      );

      blobRef.current = blob;

      setDuration(
        blobAudioRef.current?.duration ||
          blobAudioRef.current?.length / blobAudioRef.current?.sampleRate ||
          0
      );
      //await wavesurferRef.current?.loadBlob(blob); // -- this says it is no longer supported but it works

      // Create blob URL for wavesurfer
      const blobUrl = URL.createObjectURL(blob);
      currentBlobUrlRef.current = blobUrl;
      //setPlayerUrl(blobUrl); //this is slow
      await wavesurferRef.current?.load(blobUrl); //this works and is the approved way
    } catch (error) {
      console.error('Error loading blob:', error);
      loadingRef.current = false;
      // Revoke the blob URL if loading failed
      revokeCurrentBlobUrl();
      throw error;
    }
  };
  const queueLoad = (blob?: Blob, position?: number) => {
    blobToLoad.current = blob;
    positionToLoad.current = position;
  };
  const wsLoad = (blob?: Blob, position?: number) => {
    regionsLoadedRef.current = false;
    if (!wavesurferRef.current) {
      queueLoad(blob, position);
      loadRequests.current = 1;
    } else if (blob) {
      if (loadRequests.current) {
        //queue this
        queueLoad(blob, position);
        loadRequests.current = 2; //if there was another, we'll bypass it
      } else {
        loadBlob(blob, position);
        loadRequests.current = 1;
      }
    } else if (blobToLoad.current) {
      loadBlob(blobToLoad.current, positionToLoad.current);
      blobToLoad.current = undefined;
    } else {
      loadRequests.current--;
      //no blob so clear
      wsClear();
    }
  };

  const wsLoadRegions = (regions: string, loop: boolean) => {
    if (isReadyRef.current) {
      loadRegions(parseRegions(regions), loop);
      regionsLoadedRef.current = true;
    } else {
      inputRegionsRef.current = parseRegions(regions);
      regionsLoadedRef.current = false;
    }
  };
  const wsClearRegions = () => {
    if (isReadyRef.current) {
      clearRegions();
    } else {
      inputRegionsRef.current = undefined;
    }
  };
  const wsBlob = async () => {
    return blobRef.current;
  };

  const wsRegionBlob = async () => {
    if (!wavesurfer) return;
    if (!currentRegion()) return wsBlob();
    const start = trimTo(currentRegion()?.start ?? 0, 3);
    const end = trimTo(currentRegion()?.end ?? 0, 3);
    const len = end - start;
    if (!len) return wsBlob();

    const originalBuffer = blobAudioRef.current;
    if (!originalBuffer) return wsBlob();
    const { numberOfChannels, sampleRate } = originalBuffer;
    // Calculate the number of frames for the region
    const startFrame = Math.floor(start * sampleRate);
    const endFrame = Math.floor(end * sampleRate);
    const frameCount = endFrame - startFrame;

    // Create a new buffer for the region
    const regionBuffer = audioContext().createBuffer(
      numberOfChannels,
      frameCount,
      sampleRate
    );

    // Copy the audio data for the region
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const originalData = originalBuffer.getChannelData(channel);
      const regionData = regionBuffer.getChannelData(channel);
      regionData.set(originalData.subarray(startFrame, endFrame));
    }
    return await audioBufferToWavBlob(regionBuffer);
  };

  const wsSkip = (amt: number) => {
    wavesurferRef.current?.skip(amt);
  };

  const wsSetHeight = (height: number) =>
    wavesurferRef.current?.setOptions({
      height: height, // Sets the waveform height
    });

  const trimTo = (val: number, places: number) => {
    const dec = places > 0 ? 10 ** places : 1;
    return ((val * dec) >> 0) / dec;
  };

  /**
   * Encodes an AudioBuffer to a WAV Blob.
   */

  async function audioBufferToWavBlob(buffer: AudioBuffer): Promise<Blob> {
    // Use Web Audio API to decode any supported audio format
    const decodedAudioBuffer = buffer;

    // Extract PCM data from the decoded audio buffer
    const channels: Float32Array[] = [];
    for (let i = 0; i < decodedAudioBuffer.numberOfChannels; i++) {
      channels.push(decodedAudioBuffer.getChannelData(i));
    }

    // Convert to WAV using the existing wav.ts utility
    const leftChannel = channels[0];
    const rightChannel = channels.length > 1 ? channels[1] : null;

    return convertToWav(leftChannel, rightChannel, {
      isFloat: true,
      numChannels: channels.length,
      sampleRate: decodedAudioBuffer.sampleRate,
    });
  }

  async function loadDecoded(audioBuffer: AudioBuffer, position?: number) {
    wsLoad(await audioBufferToWavBlob(audioBuffer), position);
  }
  const copyOriginal = () => {
    if (!wavesurferRef.current) return undefined;
    const originalBuffer = blobAudioRef.current;
    if (originalBuffer && originalBuffer.length > 1) {
      const len = originalBuffer.length;
      let uberSegment: AudioBuffer | undefined = undefined;

      uberSegment = audioContext().createBuffer(
        originalBuffer.numberOfChannels,
        len,
        originalBuffer.sampleRate
      );
      for (let ix = 0; ix < originalBuffer.numberOfChannels; ++ix) {
        const chan_data = originalBuffer.getChannelData(ix);
        const uber_chan_data = uberSegment.getChannelData(ix);

        uber_chan_data.set(chan_data);
      }
      return uberSegment;
    } else return undefined;
  };

  const insertAudioData = async (
    newBuffer: AudioBuffer,
    startposition: number,
    endposition: number | undefined
  ) => {
    if (!wavesurferRef.current) return 0;

    const originalBuffer = blobAudioRef.current;
    if (endposition === undefined || !originalBuffer) {
      await loadDecoded(newBuffer);
      return newBuffer.length / newBuffer.sampleRate;
    }

    const start_offset = (startposition * originalBuffer.sampleRate) >> 0;
    const after_offset = (endposition * originalBuffer.sampleRate) >> 0;
    let after_len = originalBuffer.length - after_offset;
    if (after_len < 0) after_len = 0;
    const new_len = start_offset + newBuffer.length + after_len;
    let uberSegment = null;
    uberSegment = audioContext().createBuffer(
      originalBuffer.numberOfChannels,
      new_len,
      originalBuffer.sampleRate
    );
    for (let ix = 0; ix < originalBuffer.numberOfChannels; ++ix) {
      const chan_data = originalBuffer.getChannelData(ix);
      const new_data = newBuffer.getChannelData(
        ix < newBuffer.numberOfChannels ? ix : newBuffer.numberOfChannels - 1
      );
      const uber_chan_data = uberSegment.getChannelData(ix);

      uber_chan_data.set(chan_data.slice(0, start_offset));
      uber_chan_data.set(new_data, start_offset);
      if (after_len)
        uber_chan_data.set(
          chan_data.slice(after_offset),
          start_offset + newBuffer.length
        );
    }
    const position = (start_offset + newBuffer.length) / newBuffer.sampleRate;
    await loadDecoded(uberSegment, position);

    return position;
  };

  const wsInsertAudio = async (
    blob: Blob | undefined,
    buffer: AudioBuffer | undefined,
    position: number,
    overwriteToPosition: number | undefined
  ) => {
    if (!wavesurferRef.current) throw new Error('wavesurfer closed'); //closed while we were working on the blob

    // If we have a blob (from recording), decode it to AudioBuffer
    if (blob && !buffer) {
      buffer = await decodeAudioData(audioContext(), await blob.arrayBuffer());
    }

    if (buffer?.length === 0) return position;
    try {
      return await insertAudioData(buffer!, position, overwriteToPosition);
    } catch (error: any) {
      logError(Severity.error, errorReporter, error);
      throw error;
    }
  };

  const setRecording = (value: boolean) => {
    recordingRef.current = value;
  };
  const wsStartRecord = () => {
    setUndoBuffer(copyOriginal());
    setRecording(true);
  };
  const wsStopRecord = () => {
    onCanUndo(true);
    setRecording(false);
    isReadyRef.current = false;
  };

  const wsUndo = async () => {
    if (undoBuffer) await loadDecoded(undoBuffer, 0);
    else {
      wsClear();
    }
    //reset any region
    clearRegions();
    setUndoBuffer(undefined);
    onCanUndo(false);
  };

  //delete the audio in the current region
  const wsRegionDelete = async () => {
    if (!currentRegion() || !wavesurferRef.current) return;
    const start = trimTo(currentRegion()?.start ?? 0, 3);
    const end = trimTo(currentRegion()?.end ?? 0, 3);
    currentRegion()?.remove();
    const len = end - start;

    if (!len) return wsClear();
    const originalBuffer = blobAudioRef.current;
    if (!originalBuffer) return null;
    setUndoBuffer(copyOriginal());
    onCanUndo(true);
    const { numberOfChannels, sampleRate, duration } = originalBuffer;
    const startSample = Math.floor(start * sampleRate);
    const endSample = Math.floor(end * sampleRate);
    const totalSamples = Math.floor(duration * sampleRate);
    const newLength = totalSamples - (endSample - startSample);

    const newAudioBuffer = audioContext().createBuffer(
      numberOfChannels,
      newLength,
      sampleRate
    );
    for (let ix = 0; ix < numberOfChannels; ++ix) {
      const oldData = originalBuffer.getChannelData(ix);
      const newData = newAudioBuffer.getChannelData(ix);
      // Copy samples before startTime
      newData.set(oldData.subarray(0, startSample));
      // Copy samples after endTime
      newData.set(oldData.subarray(endSample), startSample);
    }

    let tmp = start - 0.03;
    if (tmp < 0) tmp = 0;
    await loadDecoded(newAudioBuffer, tmp);
    onRegion(0, true);
  };

  // Helper function to decode audio data
  function decodeAudioData(
    audioContext: AudioContext,
    arrayBuffer: ArrayBuffer
  ): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      audioContext.decodeAudioData(arrayBuffer, resolve, reject);
    });
  }
  const wsRegionReplace = async (blob: Blob) => {
    if (!wavesurferRef.current) return;
    setUndoBuffer(copyOriginal());
    onCanUndo(true);

    if (!currentRegion()) {
      wsLoad(blob);
      return blob;
    }
    const start = trimTo(currentRegion()?.start ?? 0, 3);
    const end = trimTo(currentRegion()?.end ?? 0, 3);
    const len = end - start;
    if (!len || !blobRef.current) {
      wsLoad(blob);
      return blob;
    }

    const originalBuffer = blobAudioRef.current;
    if (!originalBuffer) return await wsBlob();
    const { numberOfChannels, sampleRate, length } = originalBuffer;
    // Load the new Blob and replace the region
    const newBuffer = await decodeAudioData(
      audioContext(),
      await blob.arrayBuffer()
    );

    // Create a new buffer with the combined audio data
    const newLength = length - (end - start) * sampleRate + newBuffer.length;
    const combinedBuffer = audioContext().createBuffer(
      numberOfChannels,
      newLength,
      sampleRate
    );
    // Copy the original audio data up to the start of the region
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const originalData = originalBuffer.getChannelData(channel);
      const combinedData = combinedBuffer.getChannelData(channel);

      combinedData.set(originalData.subarray(0, start * sampleRate));

      // Copy the new audio data
      if (channel < newBuffer.numberOfChannels)
        combinedData.set(
          newBuffer.getChannelData(channel),
          start * originalBuffer.sampleRate
        );
      else
        combinedData.set(
          newBuffer.getChannelData(0),
          start * originalBuffer.sampleRate
        );

      // Copy the original audio data after the end of the region
      combinedData.set(
        originalData.subarray(end * sampleRate),
        start * sampleRate + newBuffer.length
      );
    }
    const position = (start + newBuffer.length) / sampleRate;
    // Load the new buffer into Wavesurfer
    await loadDecoded(combinedBuffer, position);
    return await wsBlob();
  };

  return {
    wsLoad,
    wsBlob,
    wsRegionBlob,
    wsClear,
    wsIsPlaying,
    wsTogglePlay,
    wsPlay,
    wsPlayRegion,
    wsPause,
    wsGoto,
    wsSetPlaybackRate,
    wsDuration,
    wsPosition,
    wsSkip,
    wsSetHeight,
    wsLoadRegions,
    wsClearRegions,
    wsLoopRegion,
    wsRegionDelete,
    wsRegionReplace,
    wsUndo,
    wsInsertAudio,
    wsZoom,
    wsFillPx,
    wsGetRegions,
    wsAutoSegment,
    wsPrevRegion,
    wsNextRegion,
    wsAddRegion,
    wsRemoveSplitRegion,
    wsStartRecord,
    wsStopRecord,
    wsAddMarkers,
    wsSetRegionColor,
    wsRemoveCurrentRegion,
  };
}
