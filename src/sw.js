import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.skipWaiting()
clientsClaim()

const manifest = self.__WB_MANIFEST
precacheAndRoute(manifest)
cleanupOutdatedCaches()

const indexUrl = manifest
  .map((entry) => (typeof entry === 'string' ? entry : entry.url))
  .find((url) => /(^|\/)index\.html$/.test(url))

if (indexUrl) {
  registerRoute(new NavigationRoute(createHandlerBoundToURL(indexUrl)))
}
