# Phrase BT language scoping (multi-LWC)

Non-BOLD **Phrase Back Translation** (and **Retell Back Translation**) must support multiple same-artifact steps on one process (e.g. French and English Phrase BT). Discriminator is **step language** (required, unique per artifact type), stamped on each take as `languagebcp47` — not workflow-step id. Phrase BT language is an **LWC** (typically one speaker); Retell language is normally the **vernacular** (multiple speakers expected). Matching, listen-pass gating, completion, and **Reset** require current vernacular `sourceMedia` + artifact type + language; `sourceVersion` alone never qualifies. Phrase BT segment boundaries live in per-language(+artifact) buckets; legacy untagged PBTs and shared **`BT`** are claimed when the first Phrase BT language is configured. Retell is a separate step preset (Retell artifact on `phraseBackTranslate`) — not an artifact option in Phrase BT settings — uses an ephemeral full-span segment with no segmenting, and never reads/writes vernacular named regions, so Phrase BT and Retell cannot affect each other. Consultant Check uses a language picker; Transcribe binds PBT media by primary language (sister language is ASR-only). Segment UI shows one live take per segment per language, with `dateCreated` only as a legacy duplicate tie-break.

## Considered Options

- **Language (+ artifact) discriminator** (chosen) — fits French/English product intent; uniqueness per artifact type; Phrase BT `en` + Retell `en` allowed
- **Workflow-step id on every mediafile** — rejected for now; heavier data model when language already uniquely identifies same-artifact steps
- **Shared `BT` + version-number OR matching** (status quo) — rejected; over-broad Reset/display and cannot separate LWCs

## Consequences

- ADR 0008’s Reset “delete-all PBTs” means all PBTs **for this vernacular + this Phrase BT language**, not every PBT on the passage
- BOLD **LWC Translation** keeps shared **`clause`** boundaries; may still stamp **LWC language** on recordings without per-language clause maps
- Language scoping is an **allowlist** keyed on `artifactStampsStepLanguage` — **Phrase BT only**, the one artifact whose takes carry `languagebcp47`. **Whole Back Translation** is recorded by `PassageDetailItem`, which never stamps a language, and vernacular / Q&A / Retell use the org vernacular — a Transcribe step's `language` is their ASR / font / spell-check language only, so scoping their task lists by it would match nothing
- The allowlist is deliberately **narrower than `isPhraseSegmentArtifact`**, which also covers **Careful Speech**. Those two predicates answer different questions: `isPhraseSegmentArtifact` means "uses segmented regions on the waveform" (still true of Careful Speech, and still what `phraseRegions` / `phraseArtifactSlug` key on), while `artifactStampsStepLanguage` means "takes carry a language". Careful Speech is BOLD-only — `CAREFUL_SPEECH_CONFIG` sets `requireBoldWorkflow`, which makes `stepLanguageField` resolve to `undefined`, so its takes are recorded untagged and BOLD keeps shared **`clause`** boundaries rather than per-language ones
