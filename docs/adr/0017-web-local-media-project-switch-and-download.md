# Web Local Media Blob project switch and download modes

Web loads one project at a time. Freeing device space removes **Cloud-backed** **Local Media Blobs** for the **current project** only (no all-device clear).

Before switching or logging into another project, the user is prompted to upload all **Upload Pending** media. Continuing without uploading requires a data-loss warning; on confirm, that previous project’s Upload Pending Local Media Blobs are discarded. After a successful switch to a new project, the previous project’s **Cloud-backed** Local Media Blobs are automatically evicted. Upload Pending is never silently dropped.

**Download modes:** by default, open-project media is fetched **lazily per passage** as the user starts work. When the user marks the project **Offline Available** (needs to work disconnected), the app downloads everything needed for that offline work (same amount choices as desktop Project Download: missing / filtered / project) into Local Media Blobs. New recordings are always saved as Local Media Blobs regardless of mode.
