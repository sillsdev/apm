# Media persist step 06 — quota / eviction

Implements ADR 0017 Cloud-backed eviction for web Local Media Blobs.

## Module

`web/src/utils/evictLocalMediaBlobs.ts`

- `evictCloudBackedLocalMedia(projectId)` — free-space: delete Cloud-backed only for that project
- `evictLocalMediaForProjectSwitch(previousProjectId)` — same bytes; named for the post-switch call site
- `estimateCloudBackedLocalMediaBytes(projectId)` — bytes free-space would reclaim
- `discardUploadPendingLocalMedia(projectId)` — **explicit only** (step 05 confirm dialog); never used by free-space or auto switch

## Auto-evict on project switch

`useEvictLocalMediaOnProjectSwitch` in `web/src/utils/useEvictLocalMediaOnProjectSwitch.ts` is mounted in `TeamProvider` (`web/src/context/TeamContext.tsx`). On web (`!isElectron`), when the global `project` id changes from one non-empty id to another, it calls `evictLocalMediaForProjectSwitch(previous)`.

## Free-space UI (not wired here)

User menu **Clear cache** (`UserMenu` → `AppHead` `Clear`) navigates a logout/session clear path, not project-scoped media eviction. Hook free-space UI (step 05 or later) to:

- `estimateCloudBackedLocalMediaBytes(currentProjectId)` for the confirm copy
- `evictCloudBackedLocalMedia(currentProjectId)` on confirm

Do not call `discardUploadPendingLocalMedia` from free-space.
