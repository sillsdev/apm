import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline';
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom';
import { maxZoom } from './WSAudioPlayerZoom';
//import * as WaveSurferMarkers from 'wavesurfer.js/dist/plugin/markers';

//eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createWaveSurfer(container, height, timelineContainer) {
  const regionsPlugin = RegionsPlugin.create({
    regions: [],
    dragSelection: {
      slop: 5,
    },
  });

  const wavesurfer = WaveSurfer.create({
    container: container,
    fillParent: true, // This ensures the waveform fills the container
    waveColor: '#A8DBA8',
    progressColor: '#3B8686',
    height: height,
    normalize: true,
    plugins: [
      timelineContainer &&
        TimelinePlugin.create({
          container: timelineContainer,
          height: 10,
        }),
      regionsPlugin,
      ZoomPlugin.create({
        scale: 0.5,
        maxZoom: maxZoom,
      }),
      //WaveSurferMarkers.create({}),
    ],
  });
  return { wavesurfer, regions: regionsPlugin };
}
