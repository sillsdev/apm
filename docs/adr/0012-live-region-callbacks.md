# Make WaveSurfer region callbacks live at the source (deferred to after release)

## Status

Accepted, **not yet implemented** — deferred until after the current release
(TT-7437). This ADR records what the fix is, why it is deferred, and what
becomes redundant once it lands, so the follow-up can be done cleanly.

## Context

WaveSurfer's region-event listeners are registered **once**, inside
`setupRegions`, when the audio fires `ready` (`useWaveSurferRegions` →
`useWaveSurfer`). Each listener captures the render closure that existed at
audio-load time. As a result, the callback parameters of `useWaveSurferRegions`
run **stale**: any React state a consumer reads inside them is frozen as of the
last audio load and can be several edits out of date. On top of that, a single
user gesture fires the callbacks more than once — adding one boundary emits both
a `wsSplitRegion` call and a `region-created` event, so `onSegment` fires ≥2×.

The affected callbacks (all called directly from once-registered handlers,
none ref-wrapped):

- `onRegion` — `region-created`/`-removed`/`-updated`
- `onCurrentRegion`
- `onRegionPlayEnd`
- `onMarkerClick`
- `onRegionClicked` (surfaces to consumers as `onSegmentClick`)
- `onStartRegion`

The `onSegment` a step consumes is `onRegion` after two forwarding hops
(`WSAudioPlayer.onWSRegion` → `PassageDetailPlayer.onSegmentChange` →
consumer). Every hop is captured in the first-render closure.

ADR 0006 already fixed **one** callback (`onRegionPlayEnd`) with a ref-forwarded
wrapper (`handleRegionPlayEndRef`) and explicitly deferred the general fix as
"disproportionate for one callback." TT-7437 showed the same defect corrupting
undo history in two steps, so the general fix is now warranted — but it touches
every step that uses the player, so it is scheduled on its own after release.

### Symptoms this caused (TT-7437)

- **Phrase Back Translate:** the multi-level segment undo stack recorded the
  same stale "before" snapshot on every fire of a gesture, so one Undo reverted
  every edit at once. Confirmed in the field via console instrumentation.
- **Mark Verses:** milder — a region-count guard stops the collapse, but undo
  snapshots still closed over stale selection / pasted-segments state, so an
  Undo could restore a stale selection.

### Interim mitigations already shipped (Layers 1 + 3)

These are per-consumer workarounds, not the root fix:

- `PassageDetailGuidedPhraseRecord.tsx`: `clauseSegStringRef` + `setClauseSeg`
  (read the live segmentation, not the closure); `onSegmentPlaybackEnd` routed
  through `handleRegionPlayEndRef`.
- `PassageDetailMarkVerses.tsx`: `pastedSegmentsRef`, `waveSegmentsJsonRef`,
  `currentSegmentRef`, `currentSegmentIndexRef`, read by `pushUndoSnapshot`.
- Phrase BT multi-fire: `handleSegment` compares incoming boundaries against the
  live `clauseSegStringRef` and returns before pushing when unchanged, so a
  repeated `onSegment` fire never records a duplicate undo entry. The stack
  itself is a plain LIFO.

## Decision (what Layer 2 must do)

Make the region callbacks **live at the source**, so no consumer can ever read
stale state through them again. Mirror each callback parameter of
`useWaveSurferRegions` into a ref that is reassigned every render, and have the
once-registered event handlers invoke `xxxRef.current(...)` instead of the raw
parameter. This is exactly the pattern already used in the same file for
non-callback inputs (`isSegmentRecordedRef`, `applyRegionColorRef`,
`disableDragSelectionRef`) and for `onProgressRef` in `useWaveSurfer`.

Concretely:

1. In `useWaveSurferRegions.tsx`, add `onRegionRef`, `onCurrentRegionRef`,
   `onRegionPlayEndRef`, `onMarkerClickRef`, `onRegionClickedRef`,
   `onStartRegionRef`, assign `.current` on every render, and replace the direct
   calls (region-created/removed/updated, setCurrentRegion, region-out,
   region-clicked, and the imperative split/remove paths) with the ref calls.
2. In `useWaveSurfer.tsx`, give `onPlayStatus` the same treatment as
   `onProgressRef`; the region callbacks it forwards become live automatically.
3. Do this behind cross-step regression testing (Careful Speech, Phrase BT,
   Retell, LWC, Mark Verses, Transcriber, mobile transcribe) — flipping these
   callbacks live changes timing that the recording flow's tuned logic
   (overshoot swallow, segment-seq tokens: ADRs 0010, 0011) was written against.

The multi-fire is **not** addressed by this change. Each consumer keeps its own
multi-fire guard — Phrase BT the `handleSegment` boundary comparison, Mark Verses
the region-count guard — which is where it belongs.

## What becomes redundant once Layer 2 lands

Rip out, in this order, re-testing each step:

- **ADR 0006 wrapper** — `handleRegionPlayEndRef` and the `onSegmentPlaybackEnd`
  indirection in `PassageDetailGuidedPhraseRecord.tsx` collapse back to passing
  `handleRegionPlayEnd` directly. Supersede ADR 0006 with this one.
- **Phrase BT staleness refs** — `clauseSegStringRef` and the `setClauseSeg`
  wrapper in `PassageDetailGuidedPhraseRecord.tsx`; edit handlers can read
  `clauseSegString` directly and call `setClauseSegString`. (Keep the
  `handleSegment` boundary guard — that handles multi-fire, which Layer 2 does
  not fix.)
- **Mark Verses staleness refs** — `pastedSegmentsRef`, `waveSegmentsJsonRef`,
  `currentSegmentRef`, `currentSegmentIndexRef`; `pushUndoSnapshot` can read the
  state directly again. (Keep the region-count guard.)
- **The hazard comments** — the ⚠️ block atop `useWaveSurferRegions.tsx` and the
  `onSegment` prop note in `PassageDetailPlayer.tsx` can be deleted or trimmed to
  a short "callbacks are live (ADR 0012)" note.

## Considered Options

- **Do it now, in the TT-7437 PR.** Rejected: widens the blast radius from two
  steps to every player step and rides a risky timing change along with an
  urgent undo fix.
- **Per-consumer refs forever (status quo).** Rejected as the end state: every
  new step silently re-inherits the bug; TT-7437 is the second time this class
  of defect shipped. Acceptable only as the interim until this ADR is done.
- **Force an audio reload to re-register listeners with fresh closures.**
  Rejected (as in ADR 0006): resets the waveform, position, and coloring, and
  flickers — unacceptable for a state change mid-edit.
