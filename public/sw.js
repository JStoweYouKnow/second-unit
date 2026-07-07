/* eslint-disable no-restricted-globals */
self.addEventListener('push', (event) => {
  let data = { title: 'The Callsheet', body: '', link: '/' }
  try {
    data = { ...data, ...(event.data ? event.data.json() : {}) }
  } catch {
    data.body = event.data?.text() || ''
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'The Callsheet', {
      body: data.body || '',
      icon: '/favicon-512.png',
      badge: '/favicon-512.png',
      data: { link: data.link || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data?.link || '/'
  const url = new URL(link, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
      return undefined
    })
  )
})
