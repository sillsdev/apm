# Audio Project Manager

An application for managing oral Bible translation workflows. APM is multi-modal: it coordinates creation of **oral content** (recordings, publishing to Akuo) and **text content** (transcriptions, sync to Paratext). Teams (or individuals working alone) organize work into projects and walk passages through configurable workflow steps on desktop and web.

## Collaboration & ownership

**Team**:
A group of people who share projects and workflow configuration.
_Avoid_: Organization (implementation name in the data model)

**Personal Team**:
The cloud-backed team every user has for solo projects. Data syncs to and is backed up in the cloud. Some admin functions require an Internet connection because related configuration is not fully available offline — it cannot be edited without cloud authority.
_Avoid_: Work Alone (different sync model); Organization

**Work Alone Project**:
A project that lives entirely on the local device and is never synced to the cloud. Used when a translator works solo without cloud backup. Because there is no cloud authority, the user can perform admin functions while offline.
_Avoid_: Personal Team project; Offline Available project

**Offline Available**:
A cloud team project marked for download so transcribers and editors can work on it without a connection. Still syncs to the cloud when online — unlike a Work Alone project.
_Avoid_: Work Alone; calling it simply "offline"

**Offline** (connectivity):
The app has lost network access. A cloud-connected user working on an Offline Available project is offline but not Work Alone.
_Avoid_: Work Alone; Offline Available

**Project**:
A translation effort owned by a team. Holds language, permissions, integrations, and other settings that apply to the whole effort. In practice each project has exactly one plan; users think of these as a single thing called "project."
_Avoid_: Plan (when speaking to users or describing the whole effort)

**Plan**:
The structural detail of a project: flat vs hierarchical layout, how content is organized (sections, passages, movements), section count, and tags. Paired 1:1 with its project — the plan is the detailed blueprint; the project is the overall effort.
_Avoid_: Treating plan as a separate user-facing entity; Edition, Version (unless distinguishing historical layouts)

## Project structure

**Unpublished Project**:
A project before publishing has been enabled. Structure is limited to sequentially numbered sections and passages with Scripture references. No movements, book rows, chapter rows, notes, or publishing metadata.
_Avoid_: Published project; Publishing-enabled project

**Publishing-Enabled Project**:
A project where a user with Paratext publishing permission has clicked **Publish** for the project. Publishing rows and metadata (book names, movements, section titles, notes, graphics) can now be added and edited. The cloud API can receive content marked ready to publish.
_Avoid_: Published project (until a section is actually published); Unpublished project

**Published Project**:
A project with at least one section published to Akuo (or the beta channel). Not the same as publishing-enabled — the project is not considered published until content reaches Akuo.
_Avoid_: Publishing-enabled project; conflating with enabling publishing on the project

**Section**:
A sequentially numbered unit of work in the project (starting at 1). In hierarchical layout, sections contain passages. In flat layout, sections are the leaf units where workflow runs.
_Avoid_: Movement (a section is not a movement); Passage

**Passage**:
A unit of work within a section in hierarchical layout, numbered starting at 1 within its section. Identified in shorthand as section.passage (e.g. 7.2 for section 7, passage 2). Carries the Scripture reference (e.g. Mat 5:1-10) and is where recording, transcription, and workflow progress attach.
_Avoid_: Section; using "passage" in flat projects

**Scripture Reference**:
The book, chapter, and verse range on a passage row (e.g. Mat 5:1-10). Distinct from section/passage sequence numbers or publishing identifiers.
_Avoid_: Calling sequence 7.2 a "reference" when you mean position; Verse (when the full range is meant)

**Movement**:
A semantic grouping of related sections within a publishing-enabled Oral Bible Translation project. Movements do not normally align to Bible chapters — they divide the whole project by meaning, not canon structure. Added after publishing is enabled.
_Avoid_: Section; Chapter; Book

**Flat Layout**:
Project structure with sections only — no passages beneath sections.
_Avoid_: Hierarchical; calling flat rows "passages"

**Hierarchical Layout**:
Project structure with sections containing numbered passages.
_Avoid_: Flat

## Publishing & Akuo

Publishing in APM normally means releasing **oral content** to listeners — not transferring transcriptions. Text content follows the Paratext sync path instead.

**Akuo**:
The primary phone app where published oral translation content is consumed. The cloud API exposes sections and passages marked ready to publish. The Akuo web app can show published or beta data; the phone app shows published data only.
_Avoid_: APM; Aquifer (different destination)

**Enable Publishing** (Publish the project):
An admin action (requires Paratext publishing permission) that turns on publishing for a project. After this, book name records, movements, titles, notes, and graphics can be added — content required for Akuo release.
_Avoid_: Publish a section; Published project

**Publish a Section**:
Mark a section (and its passages) so its **oral translation** appears in Akuo when the required metadata is present — book and movement context included when available.
_Avoid_: Enable publishing on the project; Paratext sync; Export

**Beta Channel**:
A pre-release publishing destination visible in the Akuo web app (via URL parameter) but not on the Akuo phone app.
_Avoid_: Published (production) channel; calling beta "unpublished"

**Publishing Identifier**:
The "Netflix-style" label used once publishing structure exists (e.g. M1 S7 — movement 1, section 7). Section 7 in an unpublished project may become M1 S7 after movements are added.
_Avoid_: Section number alone when publishing labels are active; Sequence (7.2)

## Workflow

**Process**:
The workflow template a team follows (e.g. OBT — Oral Bible Translation, BOLD). Defines the default sequence of steps for that translation approach.
_Avoid_: Workflow step; Tool

**BOLD**:
A workflow process for Basic Oral Language Documentation. Includes Prompt, Record, Careful Speech, back-translation, and transcription steps tuned for careful oral language work. Oral back-translation is split into two recording steps: **vernacular** → **Careful Speech** (slower vernacular) → **LWC Translation** (LWC).
_Avoid_: OBT (different step sequence and goals); conflating with the single-step **Phrase Back Translation** path on other processes

**Careful Speech** (step):
A **BOLD-only** workflow step — the name **Careful Speech** appears only in BOLD workflows, never as the user-facing label on other processes (those use **Phrase Back Translation** for the equivalent guided UX). The user listens to each **clause** of the **source recording** (from the Record step) and records a slow, careful re-speaking of that clause **in the vernacular** — same language as the source, clearer and slower (e.g. careful Kom from full-speed Kom). Uses the `carefulSpeech` tool and two-phase **listen pass** / **recording pass** UX. The step is **complete** when every clause has a **Careful Speech artifact** — **workflow navigation** marks the step complete so the user can advance to the next step. The user may return later to review or revise recordings (replay, delete, re-record); revisiting does not block navigation to other steps. Deleting any clause recording after completion marks the step **incomplete** again until that clause is re-recorded.
_Avoid_: Record step; vernacular versioning; LWC Translation; using the name Careful Speech outside BOLD; treating the output as **PBT** or a new vernacular version; requiring a separate manual "done" action once all clauses are recorded; keeping the step marked complete while a clause lacks a recording

**Clause**:
In BOLD phrase-level steps (Careful Speech, LWC Translation, LWC Transcription), a numbered unit aligned across the workflow — one time range on the **source recording**, one **Careful Speech artifact**, one **LWC translation recording**, and (after LWC Transcription) one **transcription** on that LWC translation recording. **Clause boundaries** (the time ranges) are defined once on the source recording and shared across these steps. User-facing label in clause navigation (e.g. "Clause 3/7").
_Avoid_: Segment (in BOLD UI when "Clause" is shown); Passage; PBT phrase; separate boundary copies per step or per artifact

**Clause boundaries**:
The time ranges that divide the **source recording** into **clauses**. Stored on the source recording (vernacular from Record) — the single canonical copy for BOLD phrase-level steps. Set and adjusted during Careful Speech **listen pass**; locked in **recording pass**; read but not changed in **LWC Translation**. **Careful Speech artifacts** and **LWC translation recordings** link to a clause by matching its time range, not by storing their own boundaries.
_Avoid_: Boundaries stored only on careful speech artifacts; per-step boundary copies; Mark Verses regions (different purpose)

**Source Recording**:
In Careful Speech, the passage audio from the prior Record step — one waveform divided into **clause boundaries** for listening. Holds the canonical clause segmentation for downstream BOLD phrase steps. Not the careful-speech output.
_Avoid_: Careful Speech recording; Vernacular version

**Careful Speech artifact**:
The audio output of one clause in the **Careful Speech** step — a slow, careful re-speaking **in the vernacular**, linked to the **source recording**'s vernacular version and clause time range. Distinct artifact type from **PBT**; not a new vernacular version. One artifact per clause.
_Avoid_: **PBT**; **LWC translation recording**; Vernacular version; Source recording

**Careful Speech Recording**:
User-facing name for one **Careful Speech artifact** — the recording the user makes per clause in the Careful Speech step.
_Avoid_: Vernacular; Source recording; **PBT**

**Speaker** (Careful Speech):
The person making the **careful speech recordings** for a passage. One speaker covers all clauses in the passage — the same person re-speaks every clause of the source recording. The speaker name is entered in the recording pass and stored on each careful speech artifact. **Optional** — an empty name does not block recording or save. The field is shown as missing (error styling) when empty to encourage entry. The app remembers the **last speaker name used globally** (across passages) and pre-fills the field on return.
_Avoid_: Treating speaker as per-clause metadata; requiring a different speaker per clause; requiring a name before Record or save; assuming per-passage memory from artifacts

**Listen Pass**:
The first phase of guided two-phase phrase steps: the user plays through every clause/segment of the reference waveform (without recording). Used in BOLD **Careful Speech** on the **source recording** and in **Phrase Back Translation** on full-speed **vernacular**. Purpose includes reviewing and adjusting boundaries before recording. **Start Recording** becomes available only after every unit has been heard at least once. Required only on **first entry** when no output recordings exist yet for the passage — once any unit has been recorded, re-entry skips the listen pass and opens in the **recording pass**. After a unit has been heard, the user may tap within it to reposition the cursor and replay from that point to the end of the unit (or pause mid-playback). On Phrase BT, the listen pass also shows player **+ / − / Undo** (no Reset). An info control explains **More Clauses** and **Combine with Next Clause** (Careful Speech strings). **LWC Translation** has no listen pass — clause boundaries are already fixed.
_Avoid_: Recording pass; LWC Translation; skipping ahead to record; treating a partial replay as hearing a new unit for the first time; applying listen pass on re-entry after recording has started; applying listen pass to single-phase steps

**Recording Pass**:
The second phase of guided two-phase phrase steps: after **Start Recording**, the user listens to each unrecorded unit again and records a response per unit. In **Careful Speech**, the output is a **Careful Speech artifact** (vernacular); in **Phrase Back Translation**, the output is a **PBT** (LWC). Global re-segmentation (More/Fewer) is not available. Targeted boundary edits: Careful Speech uses **Split Clause** / **Combine with Next Clause**; Phrase BT keeps those and also allows player **+ / −** under recording locks (no add inside a recorded segment; no remove of an end boundary when either side has a recording). Phrase BT shows **Reset** in this pass only and navigates with sequential prev/next arrows flanking **Record**. **Re-entry:** if some units are already recorded, the user resumes here at the first unrecorded unit; if every unit is recorded, the user enters here in **review mode** on unit 1.
_Avoid_: Listen pass; LWC Translation; More Clauses / Fewer Clauses during this pass; treating all Phrase BT boundaries as immovable during recording pass

**More Clauses** / **Fewer Clauses**:
Controls during the **listen pass** of guided two-phase phrase steps (BOLD **Careful Speech**; **Phrase Back Translation** as More/Fewer **Segments**) that re-segment the reference waveform into more or fewer units by adjusting auto-segment parameters. On Phrase BT, auto-segment continues to merge **Mark Verses** boundaries; those edits push the multi-level segment **Undo** stack. **Fewer** reverses the last **More** change first. Using either control resets listen progress. Hidden during the **recording pass**.
_Avoid_: Longer / Shorter (removed from BOLD); Combine with Next (recording pass only)

**Combine with Next Clause**:
A control during the **recording pass** that merges the current clause with the next by removing the boundary between them, then replays the merged clause. **Undo** (shared with **Split Clause**) restores the most recent boundary edit — one level only; a new split or combine replaces the undo snapshot. Only allowed when **neither** clause has a **Careful Speech recording** yet. Disabled while recording is in progress or after a recording is saved for the current clause. Shown alongside **Split Clause** during the recording pass only — not during the listen pass.
_Avoid_: More Clauses / Fewer Clauses; Longer / Shorter; combining clauses that already have recordings; listen pass; separate undo stacks for split vs combine

**Split Clause**:
A control during the **recording pass** (alongside **Combine with Next Clause**) that divides the **current clause** into two at the midpoint of the longest internal silence — silence at the clause's start or end edges is excluded. Uses the same silence-detection and minimum-segment settings as auto-segmentation for the step (including any adjustments from **More Clauses** / **Fewer Clauses** during the listen pass). Shown on the recording-pass control row in order: **Split Clause**, **Combine with Next Clause**, then **Undo** (icon) for Careful Speech. Not shown during the listen pass (use **More Clauses** / **Fewer Clauses** for global re-segmentation there). **Disabled** while recording is in progress, when the current clause already has a **Careful Speech recording**, when no qualifying internal silence exists in the clause, or when either resulting sub-clause would be shorter than the minimum segment length used for auto-segmentation. After a successful split, both new sub-clauses are unrecorded; focus moves to the **first** sub-clause and it replays. **Record** stays disabled until that replay completes — same listen-before-record gate as navigating to any unrecorded clause; the second sub-clause requires its own play-through before recording. **Undo** (shared with **Combine with Next Clause**) restores the most recent boundary edit — one level only; a new split or combine replaces the undo snapshot. Phrase BT uses the same Split/Combine controls labeled for **Segment**, with multi-level player **Undo** instead of the one-level icon beside them.
_Avoid_: Listen pass; More Clauses / Fewer Clauses; splitting the whole file; Longer / Shorter; splitting a recorded clause; multi-level undo history on Careful Speech; separate undo stacks for split vs combine; fixed thresholds unrelated to step segmentation settings; allowing sub-clauses shorter than the auto-segment minimum; calling it "Split Segment" in BOLD UI (use **Clause**)

**Clause highlight** (Careful Speech):
During the **recording pass**, the active unrecorded clause is **yellow**; clauses with a **Careful Speech recording** are **green**. When every clause is green, the step is complete and **workflow navigation** may mark it complete for advancing to the next step.
_Avoid_: Yellow for recorded clauses; treating partial listen progress as green; treating green clauses alone as blocking return visits

**Next-action highlight** (Careful Speech):
A unified affordance meaning "this is the next thing we expect — or require — you to do." Appears as a **highlighted (filled) play button** when the system has positioned the cursor at a clause but wants the user to play it, and as a **yellow clause** on the waveform identifying which clause is active. Both signals point to the same action: play this clause. The highlight is not modal — it does not change meaning between the listen pass and the recording pass. It always means "play here next."
_Avoid_: Treating the highlighted play button and the yellow clause as separate concepts; using the highlight to mean anything other than "play this next"

**Next Clause**:
During the **recording pass**, advances to the first unrecorded clause — highlights it yellow, snaps the cursor to its start, and plays it.
_Avoid_: Next workflow step; chevron navigation without play

**Recording Pass** (tap behavior):
During the **recording pass**, tapping an **already-recorded** clause replays the source clause and loads that clause's existing **Careful Speech recording** in the recorder (where it can be played). The user may delete it with the trash control and record again. Tapping an unrecorded clause highlights it yellow, snaps to the start, and plays it. After the clause plays through, the clause stays yellow, the play position snaps back to the clause start, and the **Record button becomes enabled** (the primary next action). The play button is not re-highlighted — the user can replay, but recording is the expected next step. If the clause is too short to make a clear careful-speech recording, the alternative is **Combine with Next Clause**; if too long, **Split Clause**. If the user navigates to a different clause (by tapping it on the waveform) and then returns, the system plays the clause again automatically — the user must hear it before Record re-enables. Navigating away forfeits the heard state for that clause.
_Avoid_: Silently overwriting a recording; ignoring recorded clauses; re-highlighting the play button after play-through; advancing to the next clause automatically after play-through (listen-pass behavior); enabling Record without the user having heard the current clause in the current navigation

**Segment** (Phrase Back Translation):
A numbered unit on the vernacular **source recording** under that step’s **language-and-artifact-scoped** segment-boundary bucket — one time range, one **PBT**. User-facing label in segment navigation (e.g. "Segment 3/7"). Legacy single-language projects may still resolve from **`BT`** until **Legacy Phrase Back Translation claim**. Retell Back Translation uses a single ephemeral full-span segment, not this bucket.
_Avoid_: Clause (in Phrase Back Translation UI when **Segment** is shown); Passage; separate boundary copies per PBT file; sharing Retell’s ephemeral span with Phrase BT maps

**Consultant Check**:
A workflow step where an authorized consultant gives **approval** on translation quality. Consultants may not speak the vernacular and often review via back translations, asking about wording choices or alternatives. Problems identified here typically lead to a new vernacular version. Review intensity varies — careful early oversight, then spot checks as trust in the team grows. When multiple **Phrase Back Translation** languages exist, Phrase BT review uses a **language picker**: segments and media follow the selected language’s boundary bucket and `languagebcp47` PBTs — not a merged view of divergent maps.
_Avoid_: Peer Review; Community Testing; Ready to Sync; Discussion; showing all Phrase BT languages on one mixed segment map

**Segment boundaries**:
The time ranges that divide the vernacular **source recording** into **segments** for **Phrase Back Translation**. Stored on the vernacular media in a named-region bucket keyed by **Phrase Back Translation language + artifact** (not one shared map for every LWC, and not shared with **Retell**). Legacy single-bucket **`BT`** (`NamedRegions.BackTranslation`) is the historical default claimed into the first configured Phrase BT language. On first entry with no PBTs for that language, when that language’s Phrase BT bucket is empty or identical to **Mark Verses** marks, boundaries are created by auto-segment **constrained by Mark Verses** (verse edges kept; long verses split). **More Segments** / **Less Segments** keep that verse constraint. Manual **+ / −** (playhead) and recording-pass **Split Segment** / **Combine with Next Segment** also edit boundaries. **PBT** recordings link to a segment by matching its time range via `sourceSegments`, not by storing their own boundaries. **Retell Back Translation** does not share this map — it uses a single full-recording segment and must not read or write Phrase BT boundary buckets.
_Avoid_: One shared boundary map across French and English Phrase BT steps; Phrase BT and Retell sharing or Reset-affecting each other’s boundaries; Clause boundaries (BOLD **`clause`** bucket); treating Mark Verses as an unremovable lock on manual −; boundaries stored only on back-translation artifacts

**Reset** (Phrase Back Translation):
Recording-pass control that restores **this step’s language-and-artifact-scoped segment boundaries** to the map captured when the step opened (after Verse-constrained seed or load of that Phrase BT language’s bucket), deletes the **PBTs** for the **current vernacular recording** on the **current workflow step** after confirm when any exist, clears the undo stack (not undoable), and returns the user to the **listen pass**. Scope is `sourceMedia` of the current vernacular, this step’s artifact type, and this step’s **Phrase Back Translation language** (matched to `languagebcp47` on each PBT) — not Retell recordings, not other languages’ Phrase BT buckets, not every PBT on the passage, and **not** other vernacular mediafiles that merely share a version number (`sourceVersion` alone never qualifies). Confirm also appears when boundaries drifted with no recordings yet. Not shown on the listen pass. Distinct from Transcribe Reset (restore Verse marks as the transcription region).
_Avoid_: Deleting all PBTs for the passage across languages or steps; rewriting Retell or another language’s segment map; matching by vernacular version number without `sourceMedia`; Careful Speech; Mark Verses–only restore without the step baseline; undoable Reset that resurrects deleted audio

**Phrase Back Translation language** (step setting):
The BCP-47 **LWC** for a non-BOLD **`phraseBackTranslate`** step (**Phrase Back Translation** or **Retell Back Translation**), configured per step (same shape as **LWC language** on BOLD). **Required** — the step cannot be saved in **StepEditor** without it, and recording is blocked if it is missing. **Unique per process per artifact type** — two Phrase BT steps may not share a language; two Retell steps may not share a language; Phrase BT `en` and Retell `en` may coexist because artifact type separates media and boundaries. Copied onto each output recording as `languagebcp47` when recorded. Distinguishes multiple same-artifact steps (e.g. French vs English Phrase BT) for display, completion, **Reset**, **Consultant Check** review, and **Transcribe** steps that target PBTs. Phrase BT and Retell never affect each other’s recordings or boundary state. Does not drive BOLD **LWC Translation** boundary storage (shared **`clause`** map); BOLD may still stamp **LWC language** onto **LWC translation recordings**.
_Avoid_: Vernacular language; optional language on non-BOLD phraseBackTranslate steps; duplicate same-artifact languages on one process; cross-impact between Phrase BT and Retell; treating all recordings of the same artifact type as one set across languages; choosing language only in the recorder UI without a step setting; creating new outputs with empty `languagebcp47`; using workflow-step id as the discriminator when language+artifact already uniquely identifies the step; per-language **clause** buckets in BOLD

**Segment recording** (Phrase Back Translation):
The **PBT** shown for a **segment** on the current step — the live take for that segment under the current vernacular (`sourceMedia` must equal the current vernacular mediafile), this step’s artifact type, and this step’s **Phrase Back Translation language**, matching the segment time range via `sourceSegments`. Product rule: one live take per segment per language (re-record after trash). When legacy data still has multiple matching takes, the UI shows the most recently created (`dateCreated`) — not highest mediafile `versionNumber` (PBT uploads are not vernacular-versioned). Same `sourceMedia` + artifact + language filter gates listen-pass skip and completion.
_Avoid_: Picking by vernacular `sourceVersion` alone or `sourceVersion` OR `sourceMedia`; treating mediafile `versionNumber` as PBT history; showing another language’s take; inventing independent PBT version sequences

**Legacy Phrase Back Translation claim**:
When a **Phrase Back Translation** step is first given a **Phrase Back Translation language** in **StepEditor**, untagged PBTs for that passage (empty `languagebcp47`, matching artifact type and current vernacular) and the legacy shared **`BT`** segment map are **claimed** into that language: write `languagebcp47` on those PBTs and copy `BT` into that language’s Phrase BT boundary bucket if the bucket is empty. A later second language step starts empty and does not inherit untagged legacy. Retell takes and Retell state are never part of this claim.
_Avoid_: Leaving untagged PBTs orphaned once every Phrase BT step has a language; letting a newly added language inherit another step’s untagged takes; claiming Retell into Phrase BT; destructive deletion of legacy duplicate takes during claim

**Retell Back Translation** (step):
A non-BOLD `phraseBackTranslate` step configured with the **Retell** artifact where the user retells the entire passage for the consultant in one guided **listen pass** / **recording pass** — exactly **one segment** covering full vernacular audio, with no More/Fewer/Split/Combine or player boundary tools. The full-span segment is **ephemeral** (synthesized from audio duration at runtime) — Retell never reads or writes vernacular named-region segment maps, including legacy **`BT`** or Phrase BT language buckets. Same **Phrase Back Translation language** rules for recordings (required, unique among Retell steps, stamped on takes, language-scoped matching). Fully isolated from Phrase Back Translation: Retell actions never change Phrase BT PBTs or boundaries, and Phrase BT **Reset** never changes Retell takes. Legacy Retell recordings with empty `sourceSegments` still count as complete for that single segment.
_Avoid_: Community Testing Retell; multi-segment Retell BT; Careful Speech; persisting Retell boundaries on vernacular media; sharing Phrase BT `BT`/language boundary buckets; any Reset or resegment on Retell that mutates Phrase BT state

**Phrase Back Translation** (step):
A non-BOLD workflow step where the user listens to full-speed **vernacular** by phrase and records the meaning as a **PBT** in **LWC** — one workflow step with no separate **Careful Speech** artifact step (e.g. Kom directly to English). Uses the **listen pass** / **recording pass** guided interaction via `PassageDetailPhraseBackTranslate` and the `phraseBackTranslate` tool. Shares the guided shell with Careful Speech but diverges on boundary chrome (player +/−/Undo, recording-pass Reset to step baseline, sequential arrows around Record, verse-constrained auto-segment). **User-facing name is Phrase Back Translation, not Careful Speech**.
_Avoid_: Careful Speech (name or step outside BOLD); LWC Translation (BOLD step); Whole Back Translation; calling the output careful speech; legacy single-phase-only UX

**Phrase Back Translate** (tool):
Developer-facing tool slug for phrase-level listen-and-record steps on non-BOLD processes (**Phrase Back Translation**) and for **LWC Translation** in BOLD (PBT artifact, LWC audio). BOLD **Careful Speech** uses the separate `carefulSpeech` tool and **Careful Speech artifact** type — that tool and step name appear only in BOLD workflows. Configured per step with artifact type and named region in **StepEditor**.
_Avoid_: Careful Speech (user-facing name outside BOLD); LWC Translation (user-facing BOLD step name); Phrase Back Translate (in BOLD Careful Speech UI copy)

**LWC** (Language of Wider Communication):
The language used for back translation in BOLD — a regional or international language consultants and reviewers understand. Configured per workflow step in **StepEditor** (see **LWC language**).
_Avoid_: Back-translation language (in BOLD user-facing copy when LWC is established); Vernacular; language chosen during recording

**StepEditor**:
Team-level admin UI for configuring a team's workflow — step sequence, tools, and per-step settings (e.g. artifact type, language).
_Avoid_: Workflow Navigation; Assignments tab

**LWC language** (step setting):
The BCP-47 language for the **LWC Translation** step, set in **StepEditor** via the Language Picker when the team configures the BOLD workflow. Not entered during recording in the LWC Translation step itself. Required so downstream **LWC Transcription** can run ASR auto-transcription against the correct language.
_Avoid_: Vernacular language; per-recording language entry; choosing language in the recorder UI

**ASR lock** (LWC Transcription):
While **Auto Translation** is running on the current clause, navigation is blocked — left/right clause arrows, **Next Clause**, other workflow steps, and leaving the project or passage. Mirrors **recording lock** (LWC Translation).
_Avoid_: Allowing clause or workflow navigation mid-ASR

**Navigation save flush** (LWC Transcription):
When the user changes clause (arrows or **Next Clause**) while **transcription** text has unsaved edits, flush the pending debounced **transcription save** before switching clauses. No navigation lock for typing alone — only during ASR.
_Avoid_: Fire-and-forget save on navigate; blocking navigation while text is dirty but not yet debounce-saved

**Step complete control** (LWC Transcription):
On BOLD **desktop**, show `PassageDetailStepComplete` in the header (same as Careful Speech and LWC Translation) — gated by `isBoldWorkflow` + `Transcribe` tool + PBT artifact, not all Transcribe steps globally. Checkbox syncs with auto-complete when every clause is transcribed; manual toggle remains available. Hidden on mobile — completion is automatic there.
_Avoid_: Adding bare `Transcribe` to all workflows' step-complete UI; legacy Transcriber Complete button in the clause editor; manual-only completion without auto-sync

**Clear transcription** (LWC Transcription):
To re-run **Auto Translation** or mark a clause incomplete, the user clears **transcription** text in the editor (e.g. select all and delete). Debounced **transcription save** persists the empty string, re-enables Auto Translation, and marks the clause and step incomplete again. No dedicated clear/trash control in v1.
_Avoid_: Clear button with confirm; dedicated trash control; blocking manual delete in the textarea

**Auto Translation** (LWC Transcription):
A one-tap control that runs ASR on the current clause's **LWC translation recording** and drafts **transcription** text into the editor. ASR language is resolved automatically from **LWC language** on the upstream **LWC Translation** step — no language picker in this step. If the script requires a sister language for ASR, the existing sister-language prompt appears only when needed. The button is disabled with a clear message when LWC language is not configured. **Disabled** when the current clause already has non-empty **transcription** text — the user must clear the text before running Auto Translation again. Saved ASR output counts as a completed clause transcription (user may edit afterward).
_Avoid_: Auto Transcription (user-facing copy when Auto Translation is established); language picker in the transcription step; manual-only v1; requiring separate confirmation after ASR before the clause counts as transcribed; overwriting existing transcription without clearing first

**Transcription editor** (LWC Transcription):
A minimal per-clause editor — audio player, clause navigation, progress ring, plain **transcription** textarea (project font and RTL when configured), **Auto Translation**, debounced **transcription save**, and **Next Clause**. No TaskList, transcriber/editor roles, Reject/Approve, explicit Complete button, passage history panel, or legacy Transcriber chrome. Workflow step completion uses the BOLD auto-complete pattern.
_Avoid_: Full `Transcriber.tsx` UI per clause; TaskList; editor checking step in this view; transcriptionstate reject/approve in v1

**Transcription save** (LWC Transcription):
**Transcription** text auto-saves to the clause's LWC translation recording (`mediafile.attributes.transcription`) as the user types — debounced, and on blur or clause navigation. No explicit Save button. An empty saved string marks the clause untranscribed and the step incomplete again.
_Avoid_: Explicit Save button; save-only-on-Next-Clause; 30-second-only autosave without debounced typing saves

**Playback on entry** (LWC Transcription):
When the user lands on an **untranscribed** clause (including first entry at the first incomplete clause), the **LWC translation recording** auto-plays. Visiting a clause that already has a **transcription** does not auto-play — review/edit mode loads the saved text without forced replay. Typing and **Auto Translation** are not blocked if the user has not listened. When every clause is transcribed, re-entry opens in **review mode** on clause 1.
_Avoid_: Auto-play on every visit including review; never auto-playing; requiring listen-before-type gate; opening on last clause when all complete

**LWC Transcription** (step):
A BOLD workflow step after **LWC Translation** where the user transcribes each **LWC translation recording**. Includes **Auto Translation** for ASR drafting. Requires every clause to have an **LWC translation recording** before the step is available — partial LWC Translation completion is not supported. Shows a prerequisite message (e.g. "Complete LWC Translation first") when upstream work is incomplete. On entry, the step advances to the first clause missing its transcription. The step is **complete** when every clause has a saved, non-empty **transcription** on its LWC translation recording — workflow navigation marks the step complete automatically; no separate manual "done" action. ASR output from Auto Translation counts once saved. Clearing a clause's transcription marks the step **incomplete** again until that clause is re-transcribed. Mobile-first layout with desktop parity — same simplified clause-by-clause UX on both form factors, not the legacy desktop Transcriber grid (`PassageDetailTranscribe`).
_Avoid_: Careful Transcription; LWC Translation; manual-only transcription without ASR option; legacy Transcriber grid on desktop for BOLD; starting LWC Transcription while LWC Translation is incomplete; requiring explicit ASR confirmation before a clause counts as transcribed; manual step-complete button

**LWC Translation** (step):
The BOLD user-facing step where the user listens to each **Careful Speech recording** (one per **clause**) and records an **LWC translation recording**. Single-phase flow — no listen pass, because clause boundaries were already set in **Careful Speech** and cannot be changed here. On entry, the step advances to the first clause missing its LWC translation. Requires every clause to have a **Careful Speech recording** before the step is available — partial Careful Speech completion is not supported for now (open product question: noise-only or wordless clauses). The step is **complete** when every clause has an **LWC translation recording**. Mobile-first layout with desktop parity — same simplified clause-by-clause UX on both form factors, not the legacy desktop phrase-back-translate grid.
_Avoid_: Phrase Back Translate (in BOLD UI copy); Careful Speech step; non-BOLD Phrase Back Translation (different source audio); starting LWC Translation while Careful Speech is incomplete; treating partial LWC translation as step complete; desktop-only or mobile-only exclusivity

**Reference audio** (LWC Translation):
The **Careful Speech recording** for the current clause, played in the top player before the user records the LWC translation. The top player shows one recording at a time — not a segmented waveform. Clauses are presented in the same order they were recorded in **Careful Speech** (clause 1, then 2, …).
_Avoid_: Source recording; Vernacular; multi-clause waveform with regions

**Reference audio** (LWC Transcription):
The **LWC translation recording** for the current clause, played in the top player while the user transcribes it. The top player shows one recording at a time — not a segmented waveform. Clauses are presented in the same order as upstream BOLD phrase steps (clause 1, then 2, …).
_Avoid_: Careful Speech recording; Source recording; Vernacular; multi-clause waveform with regions

**LWC Translation Recording**:
The audio the user records in the **LWC Translation** step for one clause — spoken in LWC, linked to the corresponding **Careful Speech recording** and clause index. Stored as a PBT artifact; not a new vernacular version. Saves immediately when the user stops recording — no separate Save action.
_Avoid_: Phrase Back Translation (in BOLD user-facing copy); Careful Speech recording; Vernacular; WBT; explicit save-after-record

**Speaker** (LWC Translation):
The person making the **LWC translation recordings** for a passage — typically whoever on the team speaks the target LWC language. One speaker name covers all clauses in the passage and may differ from the **Speaker** (Careful Speech). **Optional** — an empty name does not block recording or save. Shown as missing (error styling) when empty to encourage entry. Pre-filled from existing LWC translation recordings when returning to the step.
_Avoid_: Speaker (Careful Speech) as the same person; recording-rights flow; per-clause speaker; requiring a name before Record enables

**Speaker** (Phrase Back Translation):
The person making **PBT** recordings for a passage in the **Phrase Back Translation** step. One speaker name covers all phrases in the passage. **Optional** — an empty name does not block recording or save. Shown as missing (error styling) when empty to encourage entry. Same global last-used pattern as **Speaker** (Careful Speech) when that guided UX is adopted for Phrase Back Translation.
_Avoid_: Speaker (Careful Speech); per-phrase speaker; requiring a name before Record or save

**Clause navigation** (LWC Translation):
Left and right arrows below the top player flanking the current clause index (e.g. "Clause 1/7"). The **right arrow** advances to the next clause in sequence and may show an existing **LWC translation recording** if that clause is already recorded. The **right arrow** is disabled on the last clause; it highlights once the **current** clause has a recording. The **left arrow** goes to the prior clause and is disabled on the first clause. Distinct from **Next Clause** (LWC Translation).
_Avoid_: Next Clause (LWC Translation); skipping sequence order; requiring the current clause to be recorded before the right arrow enables

**Clause navigation** (LWC Transcription):
Left and right arrows below the top player flanking the current clause index (e.g. "Clause 1/7"). The **right arrow** advances to the next clause in sequence and loads that clause's existing **transcription** if present. The **right arrow** is disabled on the last clause; it highlights once the **current** clause has a saved transcription. The **left arrow** goes to the prior clause and is disabled on the first clause. Users may browse clauses freely — no lock. Distinct from **Next Clause** (LWC Transcription).
_Avoid_: Next Clause (LWC Transcription); requiring the current clause to be transcribed before the right arrow enables; recording lock

**Next Clause** (LWC Translation):
A button below the recorder that advances to the **first unrecorded** clause. Hidden until the user stops recording; disabled when every clause has an **LWC translation recording**. Unlike the right arrow, it does not visit already-recorded clauses in sequence — it jumps ahead to the next work remaining.
_Avoid_: Next Clause (Careful Speech recording pass); the right arrow; Next workflow step; showing the button while recording is active

**Next Clause** (LWC Transcription):
A button below the transcription field that advances to the **first untranscribed** clause. Shown when the **current** clause has a saved transcription; hidden when every clause is transcribed. Unlike the right arrow, it does not visit already-transcribed clauses in sequence — it jumps ahead to the next work remaining.
_Avoid_: Next Clause (LWC Translation); Next Clause (Careful Speech); the right arrow; Next workflow step

**Step progress indicator** (LWC Transcription):
A circular indicator in the **clause navigation** row (after the chevrons, with a `completed/total` count inside the ring) showing how many clauses have a saved **transcription** out of the total clause count. Same placement as **LWC Translation** (v1); player-row placement is a possible future polish for both steps.
_Avoid_: Workflow step completion badge; LWC Translation recording progress; a different layout than LWC Translation without intentional reason

**Recording lock** (LWC Translation):
While the bottom recorder is actively capturing audio, all navigation is blocked — left/right clause arrows, **Next Clause**, other workflow steps, and leaving the project or passage. The **Next Clause** button is not shown until recording stops.
_Avoid_: Allowing clause or workflow navigation mid-recording; showing Next Clause during capture

**Step progress indicator** (LWC Translation):
A circular indicator in the **clause navigation** row (after the chevrons, with a `completed/total` count inside the ring) showing how many clauses have an **LWC translation recording** out of the total clause count.
_Avoid_: Workflow step completion badge; Careful Speech listen-pass progress; duplicating the indicator on the player row in v1

**Recording gate** (LWC Translation):
The listen-before-record requirement applies only when the user must **make** a new **LWC translation recording** — an unrecorded clause, or a clause whose recording was cleared. The bottom recorder appears after the user has played the current clause's **Careful Speech recording** through to the end. On arrival at an unrecorded clause, **reference audio** auto-plays. Navigating to a clause that already has a recording skips the gate: the saved recording is shown immediately (playable, deletable) and reference audio does not auto-play. Clearing with the trash control returns to the gated state — reference audio auto-plays and the user must listen through before recording.
_Avoid_: Requiring reference playback on every visit to a recorded clause; showing the recorder before playback completes on unrecorded clauses; skipping the listen requirement after delete; auto-playing reference audio in review mode

**Workflow Step** (Step):
A named stage in the translation process that a user performs on a passage (e.g. Internalize, Record, PBT Transcribe). Step names are configurable per team and can be in the user's language. What users move through via workflow navigation.
_Avoid_: Tool; calling a step a "mode"; Racetrack (dev name for the navigation UI)

**Workflow Navigation**:
The UI control for moving between sections, passages, and workflow steps while working on a passage.
_Avoid_: Racetrack (internal dev name); Sections & Passages sheet

**Tool**:
The program logic APM provides to help the user accomplish a workflow step. Each step is mapped to exactly one tool from the fixed set the application offers.
_Avoid_: Workflow step; using "tool" in user-facing copy when you mean the step name

**Internalize**:
The user-facing name for the workflow step where translators internalize source material before recording. Implemented by the Resource tool.
_Avoid_: Resource (in conversation with users); General Resource (that's a kind of upload, not the step)

**Assignment**:
Granting a workflow step on a section or passage to a team member or group — who may perform that step. Configured on the Assignments tab. Replaced the original SIL Transcriber model of transcriber/editor assignment; transcription steps still use transcriber/editor activity states in the queue.
_Avoid_: Workflow step (what work, not who); Sheet editing permission

**Sheet Editing Permission**:
Who may edit the Sections & Passages sheet for a project — assigned to a user or group separately from workflow step assignments.
_Avoid_: Assignment; Publish permission

## Sync & Paratext

**Cloud Sync**:
Keeping APM project data consistent with the cloud API (and local storage on desktop). Background coordination of teams, projects, passages, media metadata, and related records. Distinct from Paratext Sync and from Akuo publishing.
_Avoid_: Sync (unqualified); Paratext Sync; Data Sync (prefer Cloud Sync)

**Paratext Sync**:
Transferring approved **transcriptions** (text content) to Paratext when the Paratext Sync workflow step is run. Supports cloud Paratext sync (web and desktop) and offline Paratext sync (desktop only — copies into the local Paratext folder on the same machine). Distinct from Cloud Sync and from Akuo publishing of oral content.
_Avoid_: Cloud Sync; Enable publishing; Publish a section to Akuo; Sync (unqualified)

**Ready to Sync**:
Transcription workflow state meaning a passage's text is approved and eligible for **Paratext Sync**. Completely separate from Akuo publishing of oral content and from Cloud Sync.
_Avoid_: Published to Akuo; Publish a section; Cloud Sync; Step complete (broader)

**Cloud Paratext Sync**:
Paratext integration via the cloud. Available on web and desktop.
_Avoid_: Offline Paratext sync

**Offline Paratext Sync**:
Paratext integration by copying content into the Paratext app's local folder structure on the same computer as the APM desktop app. Desktop only.
_Avoid_: Cloud Paratext sync; Work Alone project

## Artifacts & media

**Artifact**:
A typed product associated with a passage — vernacular audio, back-translation audio, graphics, and similar outputs. When someone names a step like "PBT," they usually mean both the workflow step and the artifact that step works with.
_Avoid_: Resource (inputs, not passage products); Media File (the container for one audio file)

**Vernacular**:
The primary oral translation recording for a passage — the main audio product of the Record step.
_Avoid_: Recording (when you mean a specific back-translation or test recording); Artifact (too broad when vernacular is intended)

**PBT** (Phrase Back Translation):
A back-translation artifact at phrase level — audio spoken in **LWC** expressing the meaning of a vernacular phrase. Produced in the **Phrase Back Translation** step (vernacular → PBT in one step) or as an **LWC translation recording** in BOLD (careful speech vernacular → PBT in LWC). Not the same as a **Careful Speech artifact** (vernacular re-speaking, not LWC).
_Avoid_: WBT; **Careful Speech artifact**; Transcription; the step name when the artifact is what's broken

**WBT** (Whole Back Translation):
A back-translation artifact at whole-passage level.
_Avoid_: PBT; Vernacular

**Audio File**:
One stored audio recording and its metadata for a passage (including transcription text, artifact type, and storage location). There is exactly one audio file entity per physical recording.
_Avoid_: Artifact (type/category vs the file itself); Media (too vague)

**Transcription**:
Text representing the spoken content of an audio file. Metadata on that audio file, not a separate audio product. The Transcribe step determines which artifact type's audio is shown for editing. When that artifact is **PBT** and multiple **Phrase Back Translation** languages exist, the Transcribe step’s **primary** language selects which language’s PBTs are in scope — it must match a Phrase BT step language on the process. **Sister language** (when present) is for ASR only and never selects the media set.
_Avoid_: Artifact; treating transcription as its own recording; mixing French and English PBTs in one Transcribe step without a language binder; using sister language to choose which PBTs open

**Resource**:
Source material an admin prepares for the team before oral translation work — reference audio, text, links, and similar inputs. Not an output of the transcription process.
_Avoid_: Artifact (when meaning outputs); General Resource / Shared Resource (qualifiers for scope, not separate concepts in conversation)

**Community Testing**:
A workflow step that collects structured **feedback** (questions and responses) on the current oral translation. Results may inform a new vernacular version.
_Avoid_: Peer Review; Discussion (unstructured comments)

**Peer Review**:
A workflow step that collects feedback on the current oral translation from peers (e.g. via Paratext sync). Evaluates the current vernacular version. Produces **feedback**, not a Discussion.
_Avoid_: Community Testing; Consultant Check; calling peer review output a Discussion

**Consultant Check**:
A workflow step where an authorized consultant gives **approval** on translation quality. Consultants may not speak the vernacular and often review via back translations, asking about wording choices or alternatives. Problems identified here typically lead to a new vernacular version. Review intensity varies — careful early oversight, then spot checks as trust in the team grows. When multiple **Phrase Back Translation** languages exist, Phrase BT review uses a **language picker**: segments and media follow the selected language’s boundary bucket and `languagebcp47` PBTs — not a merged view of divergent maps.
_Avoid_: Peer Review; Community Testing; Ready to Sync; Discussion; showing all Phrase BT languages on one mixed segment map

**Consultant**:
An authorized reviewer who approves translation quality in the Consultant Check step. Time is often limited; review may be thorough in early project stages and lighter later.
_Avoid_: CIT; Mentor; transcriber; editor

**CIT** (Consultant in Training):
A trainee consultant preparing for future consultant work. May draft feedback the translation team does not see until a consultant reviews it. The consultant may revise how feedback is worded before the team sees it.
_Avoid_: Consultant; Mentor

**Mentor**:
Supports a CIT during Consultant Check. Mentor comments are visible to CITs; mentors can approve CIT comments to make them visible to the wider team.
_Avoid_: Consultant; CIT

**Discussion**:
In APM, a tracked thread of questions and decisions the team considered during oral translation — tied to an audio file and workflow step. The Discuss tool and similar review UI. Not the generic English sense of "any conversation."
_Avoid_: Community test responses; peer review feedback; using "discussion" in UI copy for structured feedback steps

**Feedback**:
Structured input from Community Testing or Peer Review (questions, responses, review notes) evaluating the current vernacular version. Conventionally people might call these "discussions," but in APM we reserve **Discussion** for the Discuss feature to avoid confusing users.
_Avoid_: Discussion (when meaning Community Testing or Peer Review output)

**Version**:
A numbered vernacular recording for a passage. Saving a new vernacular recording creates a new version; the latest version is the one the workflow treats as current.
_Avoid_: Version for PBT/WBT numbering; workflow step state; publishing identifiers (M1 S7)

**Current Version**:
The latest vernacular version for a passage — what Community Testing, Peer Review, and downstream steps evaluate.
_Avoid_: An older entry in version history; a back-translation artifact

**Version History**:
Prior vernacular recordings kept for a passage after a newer version is saved. Selectable for reference but not the current workflow target.
_Avoid_: History of PBT/WBT artifacts (those are tied to a vernacular version, not independently versioned)

**Artifact Version Link**:
Back-translation and other derived artifacts (**Careful Speech artifacts**, PBT, WBT, **LWC translation recordings**, etc.) are associated with the specific vernacular recording they were created from via `sourceMedia` (and may also store that recording’s version number). They do not carry their own version sequences — re-recording vernacular creates a new current recording; prior derived work stays linked to the older vernacular mediafile and is not treated as current for that artifact type + language. For non-BOLD Phrase BT / Retell matching, **`sourceMedia` is required** — sharing a version number with the current vernacular is not enough. A new vernacular version does not carry forward prior BOLD downstream work; the team redoes Careful Speech and LWC Translation against the new version.
_Avoid_: Saying "PBT version 3" when you mean vernacular version 3's PBT; treating derived artifacts as current after a new vernacular is saved; calling **Careful Speech artifacts** PBT; matching Phrase BT / Retell by version number alone

## Project types

**Scripture Project**:
A project whose content is organized around Bible books and verse references.
_Avoid_: General project; calling it "Bible project" unless that is established user language

**General Project**:
A project for non-Scripture oral content (stories, training materials, etc.) without canon book structure.
_Avoid_: Generic (code name); Scripture project

**Personal Project**:
A project on the user's Personal Team — about solo ownership and involvement, not a content type. A Personal project can be Scripture or General. Unusual for Scripture, but possible when a group shares one device while one person operates the app.
_Avoid_: Work Alone project (different sync model); treating Personal as a third type alongside Scripture and General
