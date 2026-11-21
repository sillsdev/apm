# Compare ITF and IndexedDb Sync

I compared the two paths by reading the client code. The server's ITF import code isn't on this machine, so what I say about how the server merges is inferred from what the client does with its responses.

**Short answer:** this branch builds a second sync system on the client: the replayed edit queue plus `localOnlyMedia`. It also leaves out two things ITF already gets from the server: conflict detection and id mapping for records created offline. I recommend keeping this branch's storage and durability work, but using ITF as the only way to send work done while disconnected, on both web and desktop. Then fix ITF's real weaknesses: when it runs, and how it copes with a flaky connection.

## How each works

**ITF sync (desktop):**

- You switch to offline mode explicitly, and edits go only to IndexedDB. A `needItfSync` flag is set ([HeadStatus.tsx:75](web/src/components/App/HeadStatus.tsx#L75), [Access.tsx:143](web/src/routes/Access.tsx#L143)).
- On the next Electron start while online, the app discards the Orbit queue and builds one zip. It holds every record changed since `snapshotDate` and every mediafile created since then, for all Offline Available projects ([electronExport.tsx:282](web/src/store/importexport/electronExport.tsx#L282)).
- The zip goes up as one PUT if it's under 100 MB. Otherwise it goes in 64 MB parts, 4 at a time, with per-part retries ([actions.tsx:742](web/src/store/importexport/actions.tsx#L742)).
- The server imports it in batches it can resume (`206` + `startindex`). It maps the ids of records created offline and returns a report of changes made online, which ImportTab shows. The app then calls `forceDataChanges`.

**This branch (web):**

- Each edit made offline stays in Orbit's remote queue. That queue is now saved in IndexedDB on web too, which is new in 25a770a2; before, only Electron saved it ([Sources.tsx:254](web/src/Sources.tsx#L254)). The queue replays one operation at a time when you're back online.
- Recordings are Upload Pending blobs. They upload one at a time, oldest first, and the drain stops at the first failure ([drainUploadPending.ts](web/src/store/upload/drainUploadPending.ts)). Each take costs a POST, an S3 PUT and a pull.
- A take recorded offline gets a local-only record whose id is the blob key ([localOnlyMedia.ts](web/src/crud/localOnlyMedia.ts)). After upload, the drain links the server id to that record.

## Comparison

|                         | ITF                                                                                                                                     | This branch                                                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| When it runs            | Next app start after an explicit offline session                                                                                        | Right away: when the browser goes back online, when a project opens, on each data sync, or from a background sync                                                                                                 |
| Unit of work            | One bundle for all Offline Available projects                                                                                           | One edit or one take; current project only                                                                                                                                                                        |
| Round trips             | A few, plus batched import calls                                                                                                        | About 3 per take plus 1 per queued edit, all one after another                                                                                                                                                    |
| Parallel transfer       | 4 parts at a time (≥100 MB)                                                                                                             | None                                                                                                                                                                                                              |
| Flaky network           | Under 100 MB it's a single PUT, so any drop restarts the whole file. A failed multipart upload is aborted and waits for the next start. | Progress is kept take by take                                                                                                                                                                                     |
| Records created offline | Server maps their ids, for every record type                                                                                            | Client maps them, for mediafiles only                                                                                                                                                                             |
| Conflicts               | Server compares and reports changes made online                                                                                         | Last writer wins; requests the server rejects are skipped                                                                                                                                                         |
| Known gaps              | Only runs after a restart                                                                                                               | 3 limits listed in [BOLD-offline.md](docs/BOLD-offline.md): edits to a take that's still local aren't sent, links to it stay on the device, and a recording made online before the drain finishes can be rejected |

## Speed

The audio bytes are the same either way, so the difference comes from round trips and parallel transfer.

- **Large backlog:** at a 500 ms round trip (a typical slow link), 300 takes plus 1,500 edits through the branch's path is about 2.5 min for the takes plus about 12.5 min for the edits. That's roughly 15 minutes of waiting on round trips before counting any bytes. ITF needs a handful of round trips. ITF clearly wins here.
- **A few items:** ITF's fixed cost is also only a few round trips, so it isn't much slower. The branch's real advantage here is _when_ it runs (immediately, not at the next start), not how it sends.
- **Flaky connection:** you're right that the branch's path does better, because ITF has no resumable upload under 100 MB.

These numbers are estimates. They should be measured before anything is decided (step 4 below).

## The bigger issue is correctness, not speed

1. **Conflicts.** When the queue replays, an offline edit can silently overwrite a teammate's newer change. Or the server rejects it and the edit is dropped. ITF reports both cases. For Team + Offline Available projects this matters more than speed.
2. **Id mapping.** `localOnlyMedia` repeats on the client what ITF's server import already does, and only for mediafiles. Every other record type created offline (comments, discussions, section resources and so on) would need the same work. This is how the second system would keep growing, which is the "fix it in two places" problem you're worried about.

## How to move forward

1. **Keep from this branch:** the Local Media Blob store, Upload Pending status, strict durability, the Web Lock, the service worker background sync, the gate before leaving a project, and eviction. That's storage and durability, not sync, and it matches desktop (ADR 0016).
2. **Change how web sends offline work:**
   - While disconnected, write only to memory and IndexedDB, and set `needItfSync`, the way desktop's offline mode does.
   - On reconnect, build the ITF in the browser. That needs a JS zip library over the Orbit backup and the blobs, because `electronExport` uses Electron's zip.
   - Send it with the existing `processImportFile`, which already runs in the browser.
   - Then remove the saved web queue replay and the `localOnlyMedia` linking.
3. **Improve ITF on both platforms:**
   - Run it when the connection comes back, not only at the next start.
   - Make the upload resumable: use small multipart parts (S3 allows 5 MB) and save the upload id and the parts already done instead of aborting. That keeps progress on a flaky link, which is the main thing the branch's path does better today.
4. **Measure first.** Time both paths with 5, 50 and 500 takes plus edits, using DevTools throttling with a high round-trip time and dropped connections.

## Things to confirm before committing

- **How desktop matches its local records to server ids after an ITF import.** This is the same problem `linkLocalOnlyMediafile` solves, so step 2 depends on the answer. It's in the server code I couldn't see.
- **A possible desktop gap.** Suppose an online Electron session loses the network mid-session and the app restarts. The startup code discards the remote queue ([Sources.tsx:466](web/src/Sources.tsx#L466)), but `needItfSync` is only set by an explicit mode switch. If so, those queued edits may never reach the server. Worth a quick check, since it affects desktop today.

The other way round (moving desktop onto the queue and the per-take uploads) would need a lot more: conflict checks on the server, a batch endpoint, parallel uploads, id mapping for every record type, and desktop offline sessions that fill the queue. I don't recommend it.

I can turn this into a page to share with the team if that would help.

## Deeper analysis after looking server side

I read the server's ITF import ([OfflineDataService.cs](../../web-transcriber-lambda/src/Services/OfflineDataService.cs)). It corrects three things I said last time, and it shows a better way for the two paths to share code.

## Corrections

**1. ITF doesn't prevent conflicts; it reports them.** The offline version always overwrites what's on the server. If the server copy changed after the snapshot, the import adds that record to the change report, then overwrites it anyway (`UpdateMediafile` at line 2041, and the same for discussions and comments). So both paths let the offline edit win. The real difference is that ITF tells the user and this branch doesn't. That's a smaller gap than I described.

**2. Id mapping isn't hidden server magic. It's a shared mechanism the web client already has.**

- Every server model has a public `offline-id` attribute ([BaseModel.cs:25](../../web-transcriber-lambda/src/Models/BaseModel.cs#L25)). ITF stores the client's local id in it.
- When the data-changes pull later brings that row down, [processDataChanges.ts:176](web/src/hoc/processDataChanges.ts#L176) (`DeleteLocalCopy`) removes the local record that has that id.
- After the import, `UpdateOfflineIds` (line 1854) fixes up comments, discussions and `sourceMedia` links that pointed at local ids.
- `linkLocalOnlyMediafile`, and its "remove the second copy" step, is a second version of this same mechanism. That's the clearest case of the duplication you're worried about.

**3. ITF covers only some tables.** The import handles 10 tables: users, sections, passages, discussions, comments, mediafiles, group memberships, passage state changes, intellectual property, and org key term targets (lines 2888–2946). It ignores everything else. The web queue sends every record type, so here the web path covers more, not less.

## Other things the server code shows

- **Version numbers:** ITF gives new vernacular takes the next version number on the server (line 2597). If two people record the same passage offline, ITF avoids a version clash. The per-take POST path has no matching step that I could find.
- **Duplicate checks:** ITF skips a mediafile whose `OfflineId` already exists (line 2577, with the comment "uploaded another way (ie. itf and now we're itfs or vice versa)"). The normal mediafile POST doesn't check this. So on the web path, a retry after a lost response can create a duplicate.
- **Server-side speed:** the import works in 20-second slices. Each slice reads the zip back from S3 (into memory when it's under 512 MB) and works through records and media one at a time. Media is copied out of the zip into S3 inside AWS, so it's fast. Audio crosses the user's connection once on either path. So the speed comparison stands: ITF wins on large backlogs because it needs few round trips, not because of anything the server does.

## Revised recommendation

**First, worth doing whichever direction you pick: use the `offline-id` model on the web path.**

- The drain's POST sends `offlineId` set to the blob key.
- On the server, mediafile create ignores a POST whose `OfflineId` already exists, the same check ITF does. That's a small change in the lambda.
- Then delete `linkLocalOnlyMediafile` and the second-copy cleanup, and let `DeleteLocalCopy` do the work.

This makes retries safe. It also means a take sent by the drain and then again inside an ITF (or the other way round) can't be duplicated. That's what makes it safe to mix the two paths during the move.

**Then make ITF the catch-up path for both platforms:**

- On web, if the remote queue has backed up while offline, skip it on reconnect and send an ITF instead. That's what desktop already does at startup.
- Keep the per-item path for normal online work and for the Upload Pending drain of a few takes.
- Building an ITF in the browser means giving `electronExport`'s `ipc.zip*` calls a JS zip library underneath.
- Before relying on ITF for everything, decide what to do about the tables ITF ignores. Either add them to the import, or keep sending those through the queue.

**Improve ITF on both platforms (unchanged from before):** run it when the connection comes back, and make the upload resumable with small multipart parts.

**If per-item stays as a second path for large backlogs:** move the merge rules (change report, version renumbering, the `UpdateOfflineIds` fix-up) into one server service. Both the ITF import and the JSON:API create/update hooks would call it, so they live in one place.

## Still open

The possible desktop gap from last time remains:

- On startup the app discards the remote queue ([Sources.tsx:466](web/src/Sources.tsx#L466)).
- `needItfSync` is only set when the user explicitly switches mode.
- So edits queued when the network drops during an online desktop session, followed by a restart, may never be sent.

The server code doesn't settle this, so it needs a test on a real Electron build.
