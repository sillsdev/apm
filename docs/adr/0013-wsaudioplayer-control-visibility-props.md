# 0013 — WSAudioPlayer control-visibility props

**Status:** accepted (interim split done); `controls` object proposed for after
release
**Date:** 2026-09-18
**Context:** written while adding loop + prev/next segment navigation to the
Add Audio Resource configure step (`ProjectResourceConfigure.tsx`), which needed
those controls without the auto-segment tool.

## The situation

`WSAudioPlayer` decides which toolbar/controls buttons to show from props that
follow three different conventions at once:

- **Positive capability flags** — `allowRecord`, `allowSegment`,
  `allowAutoSegment`, `allowZoom`, `allowSpeed`, `allowDownload`,
  `allowDeltaVoice`, `allowNoNoise`. This is the dominant pattern.
- **Negative override flags** — `hideToolbar`, `hideControls`, `hideZoom`,
  `hideSegmentControls`, `hideSegmentReset`, `hideWaveformEditTools`. Read as
  double negatives, and several only make sense in combination with an `allow*`
  flag.
- **Callback-presence gating** — `onVersions`, `onSaveProgress`, `handleSave`,
  `handleUpload`, `onSegmentUndo`. The button renders iff a handler was passed.

The immediate defect that prompted this ADR: **`allowAutoSegment` was
overloaded.** A single prop drove three unrelated things —

1. the loop toggle (`loopNode`),
2. the prev/next segment-navigation arrows (`prevRegionNode` / `nextRegionNode`),
3. the auto-segment barcode button and its parameters dialog (the `wsAutoSegment`
   plumbing into `WSAudioPlayerSegment`).

The resource-configure step wants (1) and (2) but not (3). There was no way to
express that with the existing props. A first attempt added a `hideAutoSegment`
override flag, which worked but introduced a _fourth_ convention (a hide-flag
meaningful only together with an allow-flag) — exactly the kind of thing that
makes this component hard to reason about.

## Decision (done now)

Split the overloaded prop into two intention-revealing capability flags,
matching the dominant `allow*` convention:

- **`allowSegmentNav`** — show the loop toggle and prev/next arrows.
- **`allowAutoSegment`** — show _only_ the auto-segment barcode button and its
  parameters dialog.

`hideAutoSegment` was removed. `PassageDetailPlayer` threads both flags through
to `WSAudioPlayer`.

### Call-site migration (all 5 consumers)

| Consumer                              | Before                                            | After                                                |
| ------------------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| `Transcriber.tsx`                     | `allowAutoSegment={true}`                         | `allowSegmentNav={true}` + `allowAutoSegment={true}` |
| `PassageDetailTranscribeMobile.tsx`   | `allowAutoSegment={!isReadOnly && hasPermission}` | both, same condition                                 |
| `PassageDetailItem.tsx`               | `allowAutoSegment={segments !== undefined}`       | both, same condition                                 |
| `PassageDetailGuidedPhraseRecord.tsx` | `allowAutoSegment={false}`                        | unchanged (neither)                                  |
| `ProjectResourceConfigure.tsx`        | (new)                                             | `allowSegmentNav` only                               |

The three transcriber-style sites keep today's behaviour by opting into both
flags; only the new resource-configure site takes navigation without the tool.

### Left as-is on purpose

The callback-presence gating (`onVersions`, `onSaveProgress`, …) is an
established idiom here and those controls genuinely cannot function without a
handler, so they were not churned. The `hide*` overrides that legitimately mean
"this host supplies its own version of this control" (e.g. `hideSegmentControls`
for Careful Speech) also stay.

## Considered and rejected (for now)

- **One boolean per control** (`allowLoop`, `allowSegmentNav`, `allowSplit`, …).
  Maximum control but prop explosion; every call site sets a dozen booleans.
- **Slots / composition** (consumer passes toolbar children). Too large a
  refactor for the benefit; overkill for a fixed control set.

## Proposed for after release — a `controls` config object

Once this release is out, consider replacing the scattered `allow*` / `hide*`
visibility flags with a single structured prop:

```ts
controls={{
  loop,          // loop toggle
  segmentNav,    // prev/next arrows
  autoSegment,   // barcode + params
  split,         // add/remove segment
  zoom,
  speed,
  record,
  // …
}}
```

optionally with a `mode` preset (`"transcribe" | "segmentReview" | "record" |
"playback"`) that expands to a default set, with the per-flag object as
overrides.

**Why after release, not now:** it touches every consumer of `WSAudioPlayer` and
`PassageDetailPlayer` and changes a widely-used public surface, so it deserves
its own change and its own regression pass — not a rider on a feature ticket
close to a release.

**The trade-off to weigh then** ("lose per-flag ergonomics unless you keep
escape hatches"): a bare `mode` preset reads cleanly at the call site but forces
every real screen that is _almost_ a preset into a new preset or a special case —
and this component's history is entirely such near-misses (resource-configure is
"transcribe minus the auto tool"; guided-record is "segments but no nav"). So a
preset alone would recreate the overload problem at a coarser grain. Keep the
per-flag object as the escape hatch (`mode` sets defaults, explicit flags win),
so a near-miss is one overridden flag rather than a new preset. Only a mode-plus-
override shape captures the ergonomic win without losing the fine control the
`allow*` flags give today.

Migration is cheap on the same axis this ADR already exercised: the visibility
flags have few consumers (5 for the segment flags), so a codemod or manual pass
per prop is tractable.
