/* Order Studio phone app: background helper for notifications (Nov 2026).
   It only shows notifications and opens the app when one is tapped. It does not cache anything, so the app
   always loads fresh from the website exactly as before. */
var API_URL = 'https://script.google.com/macros/s/AKfycbzg84RXS8672czlZKC7Y78cQ2ieEuD6-y3MO1_yFlNdU67Vxj4zXEDIMLaPXWYfZbo/exec';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
function idb() {
  return new Promise(function (res, rej) {
    var r = indexedDB.open('os-push', 1);
    r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
    r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
  });
}
function kv(k, v) {
  return idb().then(function (db) {
    return new Promise(function (res) {
      var st = db.transaction('kv', v === undefined ? 'readonly' : 'readwrite').objectStore('kv');
      var q = v === undefined ? st.get(k) : st.put(v, k);
      q.onsuccess = function () { res(v === undefined ? q.result : v); }; q.onerror = function () { res(undefined); };
    });
  });
}
function show(title, body, tag, url) {
  return self.registration.showNotification(title || 'Order Studio', { body: body || '', tag: tag || 'os', data: { url: url || '' }, icon: 'icon-192.png', badge: 'icon-192.png' });
}
function handlePush() {
  var shown = 0;
  return Promise.all([kv('token'), kv('lastAt')]).then(function (a) {
    if (!a[0]) return;
    return fetch(API_URL + '?action=rpc', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: a[0], fn: 'pushInbox', args: [a[1] || ''] }), redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var notes = (j && j.ok && j.data) || [];
        return notes.reduce(function (p, n) { return p.then(function () { shown++; return show(n.title, n.body, n.id, n.url); }); }, Promise.resolve())
          .then(function () { if (notes.length) return kv('lastAt', notes[notes.length - 1].at); });
      });
  }).catch(function () {}).then(function () {
    if (!shown) return show('Order Studio', 'Something new in your studio. Tap to open.', 'os-new', '');   // a notification must always show
  });
}
self.addEventListener('push', function (e) { e.waitUntil(handlePush()); });
self.addEventListener('notificationclick', function (e) {
  var url = (e.notification.data && e.notification.data.url) || '#today';
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) { if ('focus' in cs[i]) { cs[i].postMessage({ osOpen: url }); return cs[i].focus(); } }
    return self.clients.openWindow(self.registration.scope + url);
  }));
});
