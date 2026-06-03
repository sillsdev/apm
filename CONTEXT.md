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
The workflow template a team follows (e.g. OBT — Oral Bible Translation). Defines the default sequence of steps for that translation approach.
_Avoid_: Workflow step; Tool

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
A back-translation artifact at phrase level — audio (and related workflow) produced in the Phrase Back Translation step.
_Avoid_: WBT; Transcription; the step name when the artifact is what's broken

**WBT** (Whole Back Translation):
A back-translation artifact at whole-passage level.
_Avoid_: PBT; Vernacular

**Audio File**:
One stored audio recording and its metadata for a passage (including transcription text, artifact type, and storage location). There is exactly one audio file entity per physical recording.
_Avoid_: Artifact (type/category vs the file itself); Media (too vague)

**Transcription**:
Text representing the spoken content of an audio file. Metadata on that audio file, not a separate audio product. The Transcribe step determines which artifact type's audio is shown for editing.
_Avoid_: Artifact; treating transcription as its own recording

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
A workflow step where an authorized consultant gives **approval** on translation quality. Consultants may not speak the vernacular and often review via back translations, asking about wording choices or alternatives. Problems identified here typically lead to a new vernacular version. Review intensity varies — careful early oversight, then spot checks as trust in the team grows.
_Avoid_: Peer Review; Community Testing; Ready to Sync; Discussion

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
Back-translation and other derived artifacts (PBT, WBT, etc.) are associated with the specific vernacular version they were created from — not independently versioned like vernacular.
_Avoid_: Saying "PBT version 3" when you mean vernacular version 3's PBT

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
