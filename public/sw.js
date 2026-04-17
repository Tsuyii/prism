// Prism Service Worker
const CACHE_NAME = 'prism-v1'
const STATIC_ASSETS = ['/', '/settings']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})

self.addEventListener('push', (event) => {
  let data
  try {
    data = event.data?.json()
  } catch {
    data = null
  }
  data ??= { title: 'Prism', body: 'New post ready for review' }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const postId = event.notification.data?.postId
  const url = postId ? `/review/${postId}` : '/'
  event.waitUntil(clients.openWindow(url))
})
