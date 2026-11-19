# BOLD Offline described

The Careful Speech → LWC translation prototype is in place. On web, a take recorded offline now appears in later steps straight away, and when you're back online the uploaded take becomes the same Orbit record instead of a second copy. The 1,685 tests across upload, crud, utils and PassageDetail pass, and typecheck and lint are clean. I haven't run it in a browser, so your DevTools test is the real check.

## How it works

- **Saving offline** ([actions.tsx](web/src/store/upload/actions.tsx)): when a web take can't reach the server, the upload no longer retries 5 times while you're offline. It returns the take's Upload Pending key.
  - [useMediaUpload.ts](web/src/crud/useMediaUpload.ts) then creates the Orbit mediafile with **id = that key** and `audioUrl = local-media:<key>`. Playback finds the take by that id.
  - Careful Speech counts the clause as done, and LWC translation sees the take.
  - The only message shown is the existing "saved on this device" notice; the raw upload error that used to overwrite it is suppressed.
- **Keeping it off the server** ([localOnlyMedia.ts](web/src/crud/localOnlyMedia.ts), wired into `remote-update` in [Sources.tsx](web/src/Sources.tsx)): changes to a local-only take are never sent through Orbit's remote queue. Clearing a local-only take also deletes its blob, so the drain won't upload a take you discarded.
- **Back online** ([useUploadPendingBlobUpload.ts](web/src/crud/useUploadPendingBlobUpload.ts)): the drain uploads the take, links the server id to the existing record, then pulls the server data into it. If a data sync already pulled the new row in as a second copy, that copy is removed.

LWC takes link to the vernacular passage media, which already has a server id, so offline LWC recordings don't depend on the careful speech takes being uploaded first. The drain still converts a local `sourceMediaId` to its server id, or waits, in case another step needs it.

## To test

1. Set DevTools to **Offline** and record careful speech for every clause. Each save should be quick, with no 5-retry wait.
2. Go to **LWC translation**. It should open, and the careful speech takes should play.
3. Optionally record LWC takes while still offline.
4. Switch to **No throttling**. In the Network panel, one `POST mediafiles` and PUT per take should go out, oldest first.
5. Check there's one row per take and nothing appears twice. Reloading should show the same thing.

## Limits of this prototype

- **Edits to an offline take aren't sent.** For example, a transcription or segments change made while the take is still local-only isn't sent to the server. When it uploads, the server's version (the values at record time) replaces it. Careful/LWC transcription done offline on these takes would hit this.
- **Links from other records to an offline take are kept on this device only.** A section resource is one example, and an info message is logged. Careful Speech and LWC don't create such links.
- **Online but before the drain:** if you're back online and record something linked to a take that's still local, that upload's POST is rejected. In practice the drain runs as soon as you reconnect.
- Other upload types haven't been reviewed for this flow.
