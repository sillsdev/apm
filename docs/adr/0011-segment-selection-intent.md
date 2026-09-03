# 0011 — the current segment carries no intent

**Status:** proposed, not started
**Date:** 2026-08-25
**Context:** written while explaining `pendingOvershootSwallowRef`; companion to
ADR [0010](0010-current-segment-index-numbering.md), which covers the numbering
of the same field

## The situation

`PassageDetailContext.currentSegment` / `currentSegmentIndex` is one channel
carrying two unrelated kinds of message:

- **"I have moved the selection"** — the guided-record step writing its own
  clause index (17 call sites in `PassageDetailGuidedPhraseRecord.tsx`), Mark
  Verses writing a table row, a region load re-asserting a default.
- **"the playhead is somewhere new"** — the waveform reporting `region-in` as
  audio plays, via `usePlayerLogic.ts:138`.

The guided-record step both writes that channel and watches it to learn that the
user navigated. Nothing on the wire says which kind a given change is, so the
step has to guess — and a wrong guess moves the clause the user was about to
record, which is how takes end up filed under the wrong segment.

## What guessing costs today

Four separate mechanisms in `PassageDetailGuidedPhraseRecord.tsx`, all answering
"did the user mean this?" from a signal that does not carry the answer:

| Mechanism                                                     | Where                             | What it encodes                                              |
| ------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------ |
| `pendingOvershootSwallowRef`                                  | 233                               | "the next +1 change is not real" (TT-7360)                   |
| `suppressClauseAutoPlayRef` + `bumpSuppressClauseAutoPlay(4)` | 193, 553-561, and four call sites | a **count of phantom events to expect**, four at a time      |
| `currentSegmentSeq`                                           | context 1023                      | "something changed" when the numbers collide (ADR 0010)      |
| `onSegmentClick`                                              | PR #528                           | one event exempted by hand, because a click is not overshoot |

`bumpSuppressClauseAutoPlay(4)` is where the approach admits defeat: nothing in
the code knows the real number is four. The literal was tuned against observed
behaviour, and any change in render or event timing invalidates it silently.

The guard order also becomes load-bearing. TT-7621 was fixed by checking the
swallow _ahead of_ the completed-clause branch — correct, but the kind of
correctness that has to be rediscovered by whoever edits the effect next.

## Why the audio layer is the wrong place to fix it

The obvious reading is that playback overshoots the clause boundary and should
be stopped more precisely. It does overshoot, and precision does not help.

WaveSurfer plays through an `HTMLMediaElement` (no `backend` option is set in
`useWaveSurfer.tsx`), so `play(start, end)` cannot schedule a stop; it stores
`stopAtPosition` and polls it from a `requestAnimationFrame` tick that emits
`timeupdate` at the overshot position **before** pausing. One frame is ~16 ms of
audio at 1x, ~4 ms at 0.25x, and unbounded when a frame is dropped — which is
exactly when the step mounts `MediaRecord` and re-renders.

But the regions plugin decides membership with an inclusive test on both ends:

```js
this.regions.filter((r) => r.start <= t && r.end >= t);
```

Clause regions are contiguous (`next.start === r.end`), so a stop landing
_exactly_ on the boundary puts the playhead in two regions at once and still
emits `region-in(next)`. A sample-accurate stop — which would mean moving
playback to the WebAudio backend, taking duration, seeking, playback rate and
the recording teardown at `useWaveSurfer.tsx:998-1006` with it — buys precision
the problem is not short of. Intent is what is missing, not milliseconds.

## Piece 1 — tag every current-segment write with its source

Give the setter at `PassageDetailContext.tsx:1002` (declared at 210) a source:

```ts
setCurrentSegment(
  segment: IRegion | undefined,
  index: number,
  source: 'click' | 'playhead' | 'programmatic' | 'load'
)
```

The guided-record navigation effects act only on `'click'`. Every other source
still flows — Mark Verses' row highlight, the discussion markers, the filename
postfix in `PassageDetailItem.tsx` all want playhead updates — they just stop
being read as user intent.

The precedent is already in the tree. `useWavesurferRegions` documents
`onRegionClicked` as _"a region was clicked; distinct from `onCurrentRegion`,
which also fires for playhead-driven changes"_ (PR #528). That is this idea,
applied to one event as a point fix. Generalising it is the change.

Writers to update: `usePlayerLogic.ts:138` (`'playhead'`, or `'programmatic'`
when it is re-asserting after a load), the 17 guided-record sites listed in ADR
0010, Mark Verses' five, and the region-load default at
`useWavesurferRegions.tsx:949`.

Do this together with ADR 0010's numbering fix — same files, same call sites,
one review.

### What becomes removable

- `pendingOvershootSwallowRef` and its five arm/disarm sites.
- `suppressClauseAutoPlayRef`, `bumpSuppressClauseAutoPlay`,
  `consumeSuppressClauseAutoPlay` and the four `(4)` literals.
- `currentSegmentSeq`, its ref and both navigation dependency lists — ADR 0010
  already lists this as removable once the numbering is unified; with a source
  tag it is removable regardless of numbering, because the effect no longer
  infers "the user moved" from the value changing at all.
- The ordering constraint between the swallow branch and the completed-clause
  branch.

### Risk

The tag is only as good as its call sites: a new writer that passes `'click'`
because it is first in the union re-creates the bug. Prefer a signature that
makes the wrong value hard to write — separate entry points
(`selectSegmentByUser` / `reportPlayheadSegment`) rather than a string parameter
— for the same reason ADR 0010 warns against fixing the numbering by adding
`+ 1` at 17 call sites.

## Piece 2 — make targeted region playback an explicit operation

`wsPlayRegion` starts a play and then relies on the event stream to notice it
finished: `region-out` is the sole producer of `onRegionPlayEnd`
(`useWavesurferRegions.tsx:592-633`), which is how the step learns a clause
finished playing, parks, arms the swallow and enables Record. Two consequences:

- Anything that stops playback _before_ the boundary never leaves the region, so
  the completion signal never arrives. The overshoot is load-bearing.
- The window in which playhead-driven selection is ignored is a race, not a
  state: `playRegionRef` is cleared inside the `region-out` handler
  (`:587` guards on it), and the snapback is covered only by
  `programmaticSeekRef`, released two `requestAnimationFrame`s later
  (`:1279-1291`). A dropped frame, or an event arriving in the other order,
  slips through.

Instead, model it as one operation with a lifecycle:

- `playRegion(region)` enters a **targeted-play** state.
- While in that state, no playhead-driven selection change is published at all —
  not just foreign `region-in`s filtered by id.
- The state ends when the snapback seek completes (the media element's `seeked`
  event), not on a frame count.
- Completion fires once, as a named callback, whether it came from `region-out`,
  the paused position, or a stop request.

That removes the frame-count guess and makes the inclusive-boundary
double-membership stop mattering: during a targeted play, nothing the plugin
says about neighbouring regions is treated as selection.

### Ordering

Piece 1 is worth doing first and alone: it is local, it deletes more than it
adds, and it removes the failure mode that has produced the most defects. Piece
2 touches the shared engine and affects every consumer of the waveform (Mark
Verses, Transcribe, Discuss), so it deserves its own change and its own
regression pass over prev/next segment playback.

## Update — TT-7437 added a fifth workaround (2026-09-03)

TT-7437 ("recording saved to the currently selected segment instead of the one
played") was fixed without the source-tag refactor above. Two additions, on PR
for TT-7437 / TT-7666:

- **`recordingTarget` latch** in `PassageDetailGuidedPhraseRecord.tsx` — the
  clause `{index, region}` is captured when recording starts and everything that
  files the take (`sourceSegments`, filename postfix, the optimistic green mark)
  reads the latch instead of the live `currentSegment`. Cleared on
  save-complete, discard, and mediafile change.
- **the selection lock extended to `region-in`** in `useWaveSurferRegions` — a
  waveform click also seeks, so the playhead entered the clicked region and
  `region-in` moved the selection behind the click-lock's back; the lock now
  covers that path (and drag/resize, double-click).

This is aligned with the ADR's thesis — the latch captures **intent explicitly**
(the user pressed Record on _this_ segment) rather than inferring it from the
channel, which is exactly "intent is what is missing." But it is a **fifth**
entry in the "What guessing costs today" table rather than a consolidation: it
does not remove `pendingOvershootSwallowRef`, `suppressClauseAutoPlayRef`,
`currentSegmentSeq`, or `onSegmentClick`, and it adds one more piece of state a
future reader has to hold.

**When Piece 1 (source-tagged writes) lands, revisit the latch.** With a
`'click'`-only navigation effect the take can no longer be re-filed by a
playhead-driven change mid-record, so the latch may become redundant — or it may
be kept as a deliberate save-time invariant ("a take belongs to the segment it
started on") that is cheaper to prove than to re-derive. Decide it consciously
then rather than leaving a fifth workaround in place by inertia.
