# media-persist step 05 redesign (pending UI + switch gate)

Status: **implemented** on `media-persist-05-pending-ui`. Base: `media-persist-04-datachanges-drain` (contains step 02).
Product rules: ADR 0016/0017; plan PR5 (issues 6, 13, 15, 27, 28, 30).

## Goal

Surface **Upload Pending** on web the way desktop already does for its media-folder queue, and never silently drop Upload Pending when leaving a project or logging out.

## Seams

| Seam | Responsibility |
|---|---|
| `uploadPendingBlobs` | Discard Upload Pending (one blob / one project); list/count for a set of project ids; same-window change notify |
| `uploadPendingLeaveGate` | Pure “must we gate?” decision (leaving project id, entering id, pending count) |
| `useUploadPendingBlobUpload` | One web dispatcher for an Upload Pending blob: online retry, leave gate, and Pending Uploads dialog all use it |
| `UploadPendingLeaveProvider` (`context/`) | The only leave gate: mounted in `App` above the routes, renders `UploadPendingLeaveDialog`, exposes `useUploadPendingLeave()` |
| `PendingUploadsDialog` / `TeamActions` | Web badge + dialog over the signed-in user's Upload Pending (desktop unchanged) |
| `formatUploadTerminalFailureMessage` | Web-only “on this device only” + risk copy |

## Which project is being left

Team home clears `project` before the next card is clicked, and each route mounts its own `TeamProvider`, so the gate cannot rely on the current project or on per-component state. The provider remembers the last opened project per user in localStorage (`LocalKey.uploadPendingProject`). The leaving project is the current project, else that remembered one.

## Dialog flow (ADR 0017)

1. Leaving project A (switching from a project card, or logging out) while A has Upload Pending → prompt to **upload all**.
   - Upload all is disabled while offline, with a hint.
   - If it leaves recordings behind, the dialog says so and stays open.
2. Decline → **data-loss warning**.
3. Confirm warning → **discard** A’s Upload Pending Local Media Blobs, then continue. A failed discard is reported and the dialog stays.
4. Cancel at either step → stay; Upload Pending untouched.
5. Cloud-backed eviction after a successful switch remains step 06.

**Opened around the gate.** A deep link, URL edit, or reload can open project B without passing through a project card. When `project` changes to B and the remembered project A still has Upload Pending, the same dialog opens with an after-switch prompt about A. Cancel there keeps A's blobs, which upload when A is next opened.

## Which exits are gated

Logout never deletes Local Media Blobs, so an ungated logout keeps Upload Pending; it is not data loss.

| Exit | Gated | Why |
|---|---|---|
| Project card (`TeamContext.loadProject`) | Yes | Switch |
| User menu Logout / Clear and logout, Paratext “log out” | Yes | User-initiated logout in a session |
| Deep link / reload into another project | After the fact | Detected by the provider on `project` change |
| Session expired → Logout | No | Upload all cannot succeed without a token |
| Error page Logout | No | The app may be in a broken state |
| Delete my account | No | The account is gone; uploads cannot succeed |
| Access screen / Email unverified logout | No | Before a project is open |

## Scope of the badge and dialog

Local Media Blobs carry `projectId` but no user. The web badge, Pending Uploads dialog and Retry all are limited to projects loaded for the signed-in user (`useUserProjectIds`), so another user's recordings on a shared device are not shown or uploaded with this user's token. Dismissing one web row deletes its only copy, so it asks first with its own warning (`pendingUploadDismissWarn`).

## Explicit non-goals

- Quota / Cloud-backed free-space / auto-evict Cloud-backed (step 06).
- DataChanges background drain beyond what step 04 already does.
- Offline Available bulk download (step 07).

## Checklist

1. [x] Helpers: discard / list-for-projects / subscribe + leave-gate pure logic + tests.
2. [x] Messaging strings + web terminal-failure “on this device only”.
3. [x] Web pending badge/dialog, scoped to the signed-in user's projects.
4. [x] One app-level leave gate wired into `loadProject`, logout, and project changes that skip it.
