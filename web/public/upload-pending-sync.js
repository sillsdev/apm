/* global self, MessageChannel */
/**
 * Imported into the vite-plugin-pwa service worker (vite.config.ts
 * workbox.importScripts). On the Upload Pending Background Sync, asks one open
 * tab at a time to drain and waits for its reply; the worker itself cannot
 * upload (no token, presigned URL, or Orbit). See
 * src/store/upload/uploadPendingBackgroundSync.ts for the contract; its
 * literals are repeated here because this file is not bundled.
 */
(function () {
  var SYNC_TAG = 'upload-pending';
  var DRAIN_MESSAGE_TYPE = 'UPLOAD_PENDING_DRAIN';
  // Chrome ends a sync event after about five minutes; stop waiting first.
  var REPLY_TIMEOUT_MS = 4 * 60 * 1000;

  /** Resolves 'drained', 'pending', or 'skipped'; silence counts as pending. */
  function askClientToDrain(client) {
    return new Promise(function (resolve) {
      var channel = new MessageChannel();
      var timer = setTimeout(function () {
        resolve('pending');
      }, REPLY_TIMEOUT_MS);
      channel.port1.onmessage = function (event) {
        clearTimeout(timer);
        var result = event.data && event.data.result;
        resolve(
          result === 'drained' || result === 'skipped' ? result : 'pending'
        );
      };
      client.postMessage({ type: DRAIN_MESSAGE_TYPE }, [channel.port2]);
    });
  }

  /**
   * One tab at a time, so two tabs never upload the same blob. With no tab
   * able to drain, the sync succeeds: the next app open drains instead.
   */
  function drainThroughClients(clients, index) {
    if (index >= clients.length) return Promise.resolve();
    return askClientToDrain(clients[index]).then(function (result) {
      if (result === 'skipped') return drainThroughClients(clients, index + 1);
      if (result === 'pending') {
        // Rejecting makes the browser retry the sync later with backoff.
        throw new Error('Upload Pending remains after drain');
      }
    });
  }

  self.addEventListener('sync', function (event) {
    if (event.tag !== SYNC_TAG) return;
    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then(function (clients) {
          return drainThroughClients(clients, 0);
        })
    );
  });
})();
