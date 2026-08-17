# WaveSurfer region-out listener uses a ref-forwarded stable wrapper

WaveSurfer's `region-out` listener is registered **once** when the audio fires `ready` (inside `setupRegions`). It captures a snapshot of whatever callback existed at registration time. In Careful Speech, `handleRegionPlayEnd` has two branches — listen-pass and recording-pass — controlled by `recordingPassStarted`, which flips to `true` when the user clicks **Start Recording** without reloading the audio. Passing `handleRegionPlayEnd` directly gave the listener a stale closure that always ran the listen-pass branch, causing the clause to advance to the next one instead of staying put and enabling Record.

We route the callback through a stable wrapper (`useCallback` with `[]` deps) that reads the latest handler from a ref on every invocation. The alternative — forcing an audio reload on every Start Recording transition — would reset the waveform and interrupt the user. Any callback passed to `setupRegions` (or any other WaveSurfer one-shot registration) that depends on React state changed after audio load must use this same pattern.

## Considered Options

- **Audio reload on Start Recording** — would re-register the listener with the current handler, but at the cost of re-loading the waveform, resetting position, and visible flicker. Rejected.
- **Single registration via a module-level or context ref** — possible, but would require restructuring how `setupRegions` is called and how the callback is threaded through `useWaveSurfer` → `useWavesurferRegions`. Disproportionate refactor for one callback.
