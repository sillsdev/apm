# Reference Texts live in project defaults, not resource rows

A **Scripture Project** may choose a **Primary** and **Secondary** **Reference Text** — Bibles listed in the bundled HelloAO catalog (`web/src/assets/reference_text_bibles.json`, harvested from `https://bible.helloao.org/api/available_translations.json` and each translation's `books.json`) — in the project dialog, offered only when they have the exact **Project Book**. Each choice is stored as a snapshot (`id` = the HelloAO translation id, name, englishName, language as ISO 639-3, languageName, languageEnglishName, textDirection, license label, licenseUrl, books) in `defaultParams.referenceTexts`, ordered Primary then Secondary. No `sharedresource`, `sectionresource` or mediafile records are created. The Internalize step will later surface the two as built-in items at the top of its list, synthesizing speech from the passage's verse range in HelloAO's chapter JSON.

## Considered Options

- **Snapshots in `defaultParams`** (chosen) — one place per project; survives catalog regeneration that drops or renames an entry; no per-passage records to keep in sync
- **Catalog id only** — rejected; a regenerated catalog could orphan the choice
- **Project resource mediafile + derived per-passage section resources** (the `projectresource` pattern) — rejected; that pattern is keyed by audio time ranges, would need a fake text mediafile, and one row per passage
- **Separate USFM project book field** — rejected; would drift from `defaultParams.book`, which already drives publishing rows and export
- **open.bible as the source** (slice 1's first cut) — replaced; ~490 usable Bibles, filtered only by testament, and passages had to come from a zipped USX download. HelloAO offers ~1,500 translations, per-book lists, and chapter JSON over HTTPS

## Consequences

- The book picker maps localized canonical books to and from Akuo slots; deuterocanonical books cannot be chosen
- The snapshot keeps `books`, so changing the Project Book clears Reference Texts that lack the new book without needing the catalog; switching to General drops them on save
- The harvest keeps every translation with a canonical book, including NC and ND, and labels licenses `Public Domain` or `CC BY[-NC][-ND|-SA]`; translations HelloAO gives no `license` object (e.g. BSB, NET) get an empty label, shown as "License not stated" rather than guessed — some are public domain, others copyrighted
- Language names are localized at runtime from the CLDR names used by the profile (`langName`, after canonicalizing the ISO 639-3 code), falling back to HelloAO's English name and autonym; the catalog itself stays locale-neutral
- The picker does not filter by text-to-speech voice: voices differ per device and TTS backend, so availability is reported at playback (and perhaps hinted in the picker later)
- Internalize's `rowData` assumes every row has a mediafile and is shared by every step, so the built-in Reference Text rows render above the sortable list instead, outside `rowData` (`ReferenceTextRows`, desktop and mobile): they cannot be dragged, edited or deleted, and have no Done checkbox, because there is nowhere yet to keep a per-user "listened" state
- Play goes through one `speakReferenceText` seam; when it finds no voice, or speaking fails, the passage text is shown with a notice saying why, and the license (or "License not stated") linked to `licenseUrl`
- Speech uses the browser's `speechSynthesis` on web and desktop alike: Electron's Chromium already lists the OS voices (Windows OneCore), so there is no main-process IPC. Voice lookup stays behind `deviceVoices`, where an IPC or cloud backend could be added. A voice matches on the canonical primary language subtag, preferring the default voice, then a local one over a network one. Originally nothing was chosen or saved; ADR 0015 adds a team **Voice Ranking** that is tried first
- The passage is spoken in sentence-sized chunks (Chrome stops some voices after about 15 seconds of one utterance). Pause and resume are unreliable, so the round progress button offers Stop, and Play starts over; progress counts characters spoken, from word boundaries or chunk ends
- Speaking stops the passage's other playback (the toolbar keeps its loaded file), that playback starting stops speaking, and only one passage speaks at a time
- Passage text comes from `{id}/{BOOK}/{chapter}.simple.json`, cached in memory and, on desktop, under `offlineData/referencetext/` with no eviction, so a chapter reads offline once fetched. HelloAO keys a bridged verse by its first number, and omitted verses are simply absent, so a range keeps whatever verses fall inside it
- The catalog is regenerated with `npm run helloao` (`env-config/genHelloAoCatalog.cjs`); snapshots keep older choices valid when entries change
- Snapshots saved during the open.bible cut lack `books` and are dropped as malformed; that cut never shipped
