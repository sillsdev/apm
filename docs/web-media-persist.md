### When content is saved to the indexedDb, when is this content persisted to the disk?

Content is not written to disk when you call `put()` / `add()`. Persistence is tied to **transaction commit**, and how durable that commit is depends on the transaction’s **durability** hint.

**When the transaction completes (`oncomplete`):**
- **`relaxed` (typical default today, including Chrome):** the browser has handed the write to the OS. Data is usually still only in the OS page cache; the OS flushes to disk on its own schedule (often within a few seconds). Survives a browser crash; may be lost on sudden power loss before the OS flush.
- **`strict`:** the browser treats the commit as done only after it has verified the changes are on a persistent medium (in practice, flushing OS I/O buffers). `complete` fires later and more slowly. Still not a hard guarantee against every power-loss edge case.

You can request that explicitly:

```js
db.transaction("store", "readwrite", { durability: "strict" });
```

**Bottom line:** IndexedDB persists on **successful transaction commit**, not on each write call. Disk flush timing is **`relaxed` ≈ OS buffer flush later** vs **`strict` ≈ flush before `complete`**.

### ok, what if I store a large media file to the indexedDb? If the user is having trouble saving to the cloud because their Internet connection is interrupted, can media files that have been recorded be persisted to the indexedDb until they can successfully be written to the cloud and then have the local copy

Yes. That’s a standard offline upload-queue pattern, and IndexedDB is a good place for the local copy.

**How it works**
1. On record complete, write the media as a `Blob`/`File` into IndexedDB (plus metadata: id, status, retry count, createdAt).
2. Wait for the write transaction to `complete` before treating the recording as safely saved locally.
3. Attempt cloud upload. On network failure, leave the record marked `pending`.
4. When online again (and/or via Background Sync), upload pending items.
5. Only after the cloud confirms success, delete that IndexedDB entry.

**Why IndexedDB fits**
- It stores binary `Blob`s without base64 bloat.
- Data survives tab/browser restarts (unlike memory or `sessionStorage`).
- You can index by status and drain a queue.

**Practical constraints**
- **Quota:** large video can fill origin storage. Check `navigator.storage.estimate()`, and for important recordings request `navigator.storage.persist()` so the browser is less likely to evict under pressure.
- **Durability:** for irreplaceable media, prefer `{ durability: "strict" }` on the save transaction.
- **Don’t rely on the page staying open:** use a service worker + Background Sync (or your own online retry loop) so uploads continue after the tab closes.
- **Upload carefully:** stream/chunk large files; don’t read the whole blob into memory twice if you can avoid it.
- **Failure modes:** private/incognito modes, user clearing site data, and Safari storage limits can still wipe local media—surface “saved on this device only” until cloud sync succeeds.

So yes: persist locally in IndexedDB while offline, sync when the connection returns, then remove the local copy after a confirmed cloud write.
