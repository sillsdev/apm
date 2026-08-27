# 0010 — `currentSegmentIndex` has two numbering conventions

**Status:** accepted problem statement, fix deferred (Noel: after the next release)
**Date:** 2026-08-22
**Context:** found while fixing PBT segment-selection faults on TT-7621

## The situation

`PassageDetailContext.currentSegmentIndex` is written by three different places
using two different numberings, and read by consumers that assume one or the
other. Nothing forces agreement: the setter is

```ts
setCurrentSegment(segment: IRegion | undefined, index: number)
```

so any number is accepted, and each author picked what was natural locally.

|        | Convention                                                                          | Where                                                                                                                                                                             |
| ------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Writes | **1-based** (`sortedIndex + 1`; `0` means whole/none, `-1` cleared)                 | `business/player/usePlayerLogic.ts:113` — the waveform, via `onCurrentRegion`                                                                                                     |
| Writes | **1-based-by-accident** (table row; row 0 is the header, so row _i_ ↔ region _i−1_) | `components/PassageDetail/mobile/MarkVerses/PassageDetailMarkVerses.tsx` (925, 934, 1079, 1389, 1477)                                                                             |
| Writes | **0-based** clause index                                                            | `components/PassageDetail/PassageDetailGuidedPhraseRecord.tsx` — 17 call sites (615, 733, 898, 915, 1018, 1088, 1112, 1122, 1160, 1249, 1338, 1424, 1445, 1474, 1506, 1515, 1542) |
| Reads  | **1-based**                                                                         | `PassageDetailItem.tsx:246` (`> 0` → filename postfix `sN`), `Discussions/DiscussionList.tsx:107` (`>= 0`), `PassageDetailMarkVerses.tsx:617-621` (row lookup)                    |
| Reads  | **0-based**                                                                         | `crud/useWavesurferRegions.tsx:955` — `regarray[defaultRegionIndex]?.start`                                                                                                       |

## What it broke (TT-7621)

Recording segment 1, then segment 3, then clicking back to segment 2 filed the
next take **on segment 3**, over the take already there.

The guided-record step learns that the selection moved by watching
`currentSegmentIndex` change. Clicking segment 2 makes the waveform write
`1 + 1 = 2`; the step had just written `2` itself for segment 3. Same number, so
the dependency never changed, the navigation effect never re-ran, and the step
stayed on segment 3 while the waveform selection and playhead moved to segment 2.
Anything recorded then went to the segment the step still believed it was on.

Note the step never uses the _number_ — it derives its own index from the region
via `findClauseIndex`. The field was only ever a change signal to it, which is
exactly why the collision went unnoticed for so long.

## What was done instead of unifying

`currentSegmentSeq`: a token in `PassageDetailContext` incremented whenever the
current segment actually changes. The step's two navigation effects watch it
rather than inferring a change from the index. Committed on
`TT-7621_pbt-segment-selection-and-recorder-state` (PR #527).

Unification was deliberately not attempted in that change: it touches every
caller across Mark Verses, the players and the guided-record step, and it landed
in the middle of a run of behaviour fixes.

## The latent off-by-one

`crud/useWavesurferRegions.tsx:955`, at the end of `loadRegions`:

```ts
onRegionGoTo(regarray[defaultRegionIndex]?.start ?? 0);
```

`defaultRegionIndex` is the context's `currentSegmentIndex`
(`useWaveSurfer.tsx:293`), and `onRegionGoTo` → `applyRegionAtPosition`, which
**selects** the region at that position. So a region load that reads a 1-based
value selects the segment _after_ the current one; when the index is past the
end the lookup is `undefined` and it falls back to `0`, which is why it usually
passes unnoticed.

Every region load is affected — `WSAudioPlayer` 889, 1042, 1370, and 1517
(`loadRegionsJson`, which Split, Combine, segment undo and Reset all call).

**It is not currently reproducible from PBT.** An effect there
(`PassageDetailGuidedPhraseRecord.tsx:615`) continuously re-asserts the step's
own 0-based index into the context, so by the time a load reads the value it is
usually 0-based — correct for `regarray[i]` by accident. I tried both boundary
edits, sampling the painted selection at 5ms, and could not make it stray. Mark
Verses and the generic segment player have no such effect and are the places to
look.

## When unifying

1. **Pick 1-based** (`0` = whole, `-1` = cleared). It is what the documented
   comments and the majority of readers already assume, and it is what the
   waveform emits.
2. Change the 17 guided-record writes to send `idx + 1`, and
   `useWavesurferRegions.tsx:955` to index `regarray[defaultRegionIndex - 1]`.
3. Confirm Mark Verses' row arithmetic really is region + 1 on every path
   (925, 934, 1079, 1389, 1477 write it; 617-621 reads it back).
4. Consider making the convention unmissable rather than conventional — either
   an explicit parameter name (`sortedIndexOneBased`) or a signature that takes a
   0-based `sortedIndex` and derives the legacy value in the context. Adding
   `+ 1` at 17 call sites preserves the original hazard: the next person writes
   `setCurrentSegment(regions[i], i)` and nothing complains.

### What becomes removable

- **`currentSegmentSeq`** and both navigation dependency lists in
  `PassageDetailGuidedPhraseRecord` can go back to watching
  `currentSegmentIndex` alone. One case to check first: the same sorted position
  with different bounds (after Combine, position 1 spans 0–6 where it spanned
  0–3) still repeats the number. There is no reproduction for that today — the
  handlers re-assert their own index — but the token covers it for free, so
  removing it is a small regression risk to weigh rather than a certainty.
- The context field, its ref and the initState comment go with it.

### What does _not_ become removable

The other TT-7621 fixes are unrelated to the numbering and stay:

- `onSegmentClick` (a click is not playback overshoot) — PR #528
- deriving `recordReady` from the reference audio stopping — PR #529
- clearing MediaRecord's `loading` when a load is abandoned — PR #530
- More/Fewer Segments honouring their direction — PR #532

## The related problem: the field carries no intent either

Numbering is one of two things wrong with this field. The other — that a change
to it does not say whether the user moved the selection or the playhead did — is
written up separately in ADR
[0011](0011-segment-selection-intent.md), together with the two refactors that
would fix it. The two overlap: they touch the same 17 call sites, and 0011's
source tag makes `currentSegmentSeq` removable whether or not the numbering is
unified. Worth scheduling as one change.
