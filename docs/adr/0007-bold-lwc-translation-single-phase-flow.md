# BOLD LWC Translation single-phase flow

BOLD LWC Translation is a single-phase listen-and-record step — not the two-phase listen pass / recording pass used by Careful Speech (ADR 0005). Careful Speech's listen pass exists partly so the user can review and adjust clause boundaries before recording; LWC Translation has no boundaries to adjust, so a listen pass would add friction without purpose.

The user-facing step name is **LWC Translation**, not Phrase Back Translate (the latter is the shared tool slug). The user hears each clause's **Careful Speech recording** in the top player, then records an **LWC translation recording** in the bottom recorder. Clause boundaries are inherited from Careful Speech and cannot be adjusted (no More Clauses, Fewer Clauses, or Combine with Next Clause). Recorder states — record, stop, trash, Next Clause — match Careful Speech's recording pass. On entry, the step opens on the first clause missing its LWC translation.

The `phraseBackTranslate` tool is shared with Careful Speech and non-BOLD PBT steps; BOLD LWC Translation is distinguished by artifact type (PBT), named region (BT), user-facing name, and this UX shape. Mobile-first layout with desktop parity — not the legacy `PassageDetailItem` grid on desktop.

## Step settings

**LWC language** is configured in StepEditor (team level) via the Language Picker on the LWC Translation step — not during recording. Downstream LWC Transcription uses this setting for ASR auto-transcription.

## Open product question

**Careful Speech prerequisite:** LWC Translation is blocked until every clause has a Careful Speech recording. Follow up with product owners — some clauses may be noise-only or wordless after segmentation; it is unclear whether users should still produce an LWC translation for those, or whether Careful Speech completion should be enforced differently.
