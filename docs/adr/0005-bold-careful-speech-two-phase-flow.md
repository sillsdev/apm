# BOLD Careful Speech two-phase flow

BOLD Careful Speech is a two-phase step on the source recording from Record — not a vernacular version fork.

**Listen pass:** Auto-segment into clauses (default silence threshold 2, minimum silence length 2, minimum segment length 1.5). User must hear every clause once before Start Recording is enabled. More Clauses / Fewer Clauses adjust segmentation parameters and reset listen progress. Longer / Shorter boundary nudging is not used in BOLD. The listen-pass panel includes an info message explaining More Clauses and Combine with Next Clause.

**Recording pass:** Start Recording locks clause boundaries. User records one Careful Speech artifact per clause (green = recorded, yellow = current unrecorded). Combine with Next Clause merges boundaries only when neither clause has a recording; undo restores. Next Clause advances to the first unrecorded clause and plays it.

This flow is **BOLD-only** — gated on the team's BOLD process, not merely on the `carefulSpeech` tool slug. Other processes that might use the Careful Speech tool in future get a different UX, not this two-phase flow.
