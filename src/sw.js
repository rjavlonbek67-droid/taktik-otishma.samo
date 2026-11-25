import { cacheNames, clientsClaim, setCacheNameDetails } from 'workbox-core'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { BUILD, CACHE } from './build.js'

setCacheNameDetails({
  prefix: CACHE,
  suffix: '',
  precache: 'precache',
  runtime: 'runtime',
})

const shell = new NetworkFirst({
  cacheName: CACHE,
  plugins: [new CacheableResponsePlugin({ statuses: [200] })],
})

function isAppShell({ request, url }) {
  if (url.origin !== self.location.origin) return false
  if (request.mode === 'navigate') return true
  return /\/index\.html$/.test(url.pathname)
    || /\/sw\.js$/.test(url.pathname)
    || /\/assets\/.+\.(js|css)$/.test(url.pathname)
}

async function precacheFallback(request) {
  const direct = await caches.match(request, { ignoreSearch: true })
  if (direct) return direct
  if (request.mode !== 'navigate') return undefined
  const keys = await caches.keys()
  for (const key of keys) {
    const cache = await caches.open(key)
    const hit = await cache.match('index.html') || await cache.match('./index.html')
    if (hit) return hit
  }
  return undefined
}

registerRoute(isAppShell, async (args) => {
  try {
    const response = await shell.handle(args)
    if (response) return response
  } catch {
    /* offline or empty runtime cache */
  }
  return (await precacheFallback(args.request)) || Response.error()
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([cacheNames.precache, cacheNames.runtime, CACHE])
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key)))
    await self.clients.claim()
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      client.postMessage({ type: 'SW_UPDATED', build: BUILD })
    }
  })())
})

self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
