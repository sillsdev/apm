# pwa-clean.md

Your config actually makes this cleaner than the debugging session suggested. The key line is vite.config.ts:79-81: devOptions.enabled: false — the dev server never registers a service worker. So the SW that kept fighting us wasn't from npm start; it was a leftover from an earlier production/preview visit that shares the same origin (http://localhost:3000). Once truly cleared, it stays gone in dev.

Here's the best way, in order of preference:

1. Chrome DevTools → "Clear site data" (most reliable, one click)

   F12 → Application tab → Storage (left panel) → Clear site data button. This unregisters service workers, empties Cache Storage, and clears localStorage/IndexedDB for the origin in one shot.

If you want to keep your auth session (localStorage), instead go to Application → Service Workers and click Unregister, then Application → Cache storage and delete the caches — leaves other storage intact.

2. The gotcha that bit us — close all tabs

   A service worker keeps controlling every already-open page until they're all closed or navigated away. A single reload can still be served by the old SW mid-teardown (that's exactly why my first attempt reverted). So the reliable sequence is:

Clear/unregister → close every tab on that origin → reopen.

3. While actively developing — turn on the two checkboxes

   In Application → Service Workers, tick "Update on reload" and "Bypass for network". As long as those are on, the SW won't serve stale content while you work — no clearing needed each time.

## Preventing it entirely

The root cause is the prod preview build and the dev server sharing localhost:3000. Two fixes:

- **Run the preview build on a different port** (e.g. vite preview --port 4000) so it can never register a SW on the dev server's origin. Since devOptions.enabled is already false, this fully isolates them.

- **For real users stuck on a stale SW in production,** VitePWA supports selfDestroying: true — you ship one build whose SW unregisters itself and cleans caches. That's the sanctioned "kill switch," better than asking users to clear site data. (Not needed for local dev.)

## Reusable programmatic purge

The snippet I used, handy to paste into any DevTools console on the origin:

```javascript
(async () => {
  const rs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(rs.map((r) => r.unregister()));
  const ks = await caches.keys();
  await Promise.all(ks.map((k) => caches.delete(k)));
  location.reload();
})();
```

For your day-to-day, option 3 (the two checkboxes) is the least-friction choice; option 1 is the "just make it clean" hammer.
