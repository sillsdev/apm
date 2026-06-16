# BOLD Careful Speech two-phase flow

BOLD Careful Speech is a two-phase step on the source recording from Record — not a vernacular version fork. Output is stored as the **`carefulspeech`** artifact type (vernacular re-speaking per clause), not PBT. The step uses the dedicated **`carefulSpeech`** tool; LWC Translation remains on **`phraseBackTranslate`** with PBT artifacts.

Non-BOLD **Phrase Back Translation** is one workflow step (vernacular → PBT in LWC, no Careful Speech artifact) but will use the same **listen pass** / **recording pass** UX when the legacy UI is replaced; only labels and artifact type differ.

**Listen pass:** Auto-segment into clauses (default silence threshold 2, minimum silence length 2, minimum segment length 1.5). User must hear every clause once before Start Recording is enabled. More Clauses / Fewer Clauses adjust segmentation parameters and reset listen progress. Longer / Shorter boundary nudging is not used in BOLD. The listen-pass panel includes an info message explaining More Clauses and Combine with Next Clause.

**Recording pass:** Start Recording locks clause boundaries. User records one Careful Speech artifact per clause (green = recorded, yellow = current unrecorded). Combine with Next Clause merges boundaries only when neither clause has a recording; undo restores. Next Clause advances to the first unrecorded clause and plays it.

BOLD Careful Speech is gated on the team's BOLD process, not merely on the `carefulSpeech` tool slug. The **Careful Speech** step name and `carefulSpeech` tool appear only in BOLD workflows. On other processes, the same two-phase guided interaction will ship under the user-facing name **Phrase Back Translation** via the `phraseBackTranslate` tool — not labeled Careful Speech.
