# Aina Cloud — PWA Mobile App (From Scratch)

A complete guide to building the Aina Cloud mobile frontend as a
Progressive Web App using Next.js. This is a **separate project** from the
backend (`aina-cloud`). It calls the backend API and runs as an installable
app on iOS and Android.

---

## Prerequisites

- Node.js 20.9 or later
- The `aina-cloud` backend running (locally or deployed)
- A 1024×1024 PNG app icon ready (for generating all icon sizes)

---

## Step 1 — Create the project

```bash
npx create-next-app@latest aina-app
```

When prompted, choose:

```
Would you like to use TypeScript? Yes
Which linter? ESLint
Would you like to use React Compiler? No
Would you like to use Tailwind CSS? Yes
Would you like your code inside a src/ directory? No
Would you like to use App Router? Yes
Would you like to customize the import alias? No  (@/* is fine)
Would you like to include AGENTS.md? Yes
```

Then:

```bash
cd aina-app
npm run dev
```

Visit `http://localhost:3001` (or 3000 if the backend isn't running) to confirm it works.

---

## Step 2 — Install PWA dependencies

```bash
npm install @serwist/next serwist
npm install --save-dev @types/node
```

> **Why Serwist?** `next-pwa` is not maintained for Next.js App Router.
> Serwist is the actively maintained successor and has first-class App Router support.

---

## Step 3 — Environment variables

Create `.env.local` at the project root:

```bash
# URL of the aina-cloud backend
NEXT_PUBLIC_API_URL=http://localhost:3000
```

In production, set this to your deployed backend URL.

---

## Step 4 — Configure Serwist

Rename `next.config.ts` (or `.js`) if it exists, otherwise create it:

```ts
// next.config.ts
import type { NextConfig } from 'next'
import withSerwist from '@serwist/next'

const withPWA = withSerwist({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {}

export default withPWA(nextConfig)
```

> Setting `disable: true` in development means you don't fight a stale service
> worker cache while building the UI. Remove or set to `false` when you want to
> test the SW locally.

---

## Step 5 — Add the service worker

```ts
// app/sw.ts
import { defaultCache } from '@serwist/next/worker'
import { Serwist } from 'serwist'

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Latest device reading — network first, fall back to cache
    {
      matcher: /\/api\/devices\/.+\/latest$/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'device-latest',
        expiration: { maxEntries: 20, maxAgeSeconds: 3600 },
      },
    },
    // Reading history — network first, short cache
    {
      matcher: /\/api\/devices\/.+\/readings/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'device-readings',
        expiration: { maxEntries: 20, maxAgeSeconds: 300 },
      },
    },
    // Plant list — stale while revalidate (changes rarely)
    {
      matcher: /\/api\/plants$/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'plants',
        expiration: { maxEntries: 10, maxAgeSeconds: 86400 },
      },
    },
    // Next.js static assets and pages
    ...defaultCache,
  ],
})

serwist.addEventListeners()
```

---

## Step 6 — Icons

Place all icon files in `public/icons/`. Generate them from your 1024×1024
source PNG using [realfavicongenerator.net](https://realfavicongenerator.net).

| File | Size | Purpose |
|---|---|---|
| `icon-16.png` | 16×16 | Browser tab |
| `icon-32.png` | 32×32 | Browser tab |
| `icon-180.png` | 180×180 | iOS "Add to Home Screen" |
| `icon-192.png` | 192×192 | Android home screen (maskable) |
| `icon-512.png` | 512×512 | Android splash screen |

**Maskable icons:** The `icon-192.png` will be clipped into a circle or squircle
on Android. Make sure important content stays within the inner 80% of the canvas
(the "safe zone"). Preview at [maskable.app/editor](https://maskable.app/editor).

Also copy one of them to `app/favicon.ico` (or replace the default that
`create-next-app` generates).

---

## Step 7 — Web App Manifest

Next.js generates the manifest automatically from `app/manifest.ts` — no
plugin or package needed.

```ts
// app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Aina Cloud',
    short_name: 'Aina',
    description: 'Plant monitoring dashboard',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f172a',
    theme_color: '#16a34a',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
```

---

## Step 8 — Root layout

Replace `app/layout.tsx` with the following. The `viewport` export is
**required as a separate named export** in Next.js App Router — putting it
inside `metadata` will throw a warning.

```tsx
// app/layout.tsx
import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: 'Aina Cloud',
  description: 'Plant monitoring dashboard',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Aina',
  },
  icons: {
    apple: '/icons/icon-180.png',
    icon: [
      { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-16.png', sizes: '16x16', type: 'image/png' },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  )
}
```

---

## Step 9 — Service Worker registration component

```tsx
// components/ServiceWorkerRegistration.tsx
'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.error('SW registration failed:', err))
    }
  }, [])

  return null
}
```

---

## Step 10 — API client

Create a thin fetch helper so every page uses the same base URL and error handling.

```ts
// lib/api.ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) throw new Error(`API error ${res.status} on ${path}`)
  return res.json() as Promise<T>
}
```

---

## Step 11 — Pages

### Dashboard — list all devices

```tsx
// app/dashboard/page.tsx
import { apiFetch } from '@/lib/api'

type DeviceSummary = {
  device: { id: string; name: string; locationName: string | null; lastSeenAt: string | null }
  plant: { name: string; type: string | null } | null
  latestReading: { soilMoisture: number; temperature: number | null; createdAt: string } | null
}

export default async function DashboardPage() {
  // Fetch all devices then their latest readings
  const { devices } = await apiFetch<{ devices: { id: string; name: string; locationName: string | null; lastSeenAt: string | null }[] }>('/api/devices')

  const summaries = await Promise.all(
    devices.map((d) =>
      apiFetch<DeviceSummary>(`/api/devices/${d.id}/latest`)
    )
  )

  return (
    <main>
      <h1>Aina Cloud</h1>
      {summaries.map(({ device, plant, latestReading }) => (
        <a key={device.id} href={`/dashboard/${device.id}`}>
          <h2>{device.name}</h2>
          {plant && <p>{plant.name}</p>}
          {latestReading && <p>Soil: {latestReading.soilMoisture}%</p>}
        </a>
      ))}
    </main>
  )
}
```

> **Note:** `GET /api/devices` doesn't exist in the backend yet — it lists all
> devices. Add it following the same pattern as `GET /api/plants` in the
> `aina-cloud` repo.

### Device detail page

```tsx
// app/dashboard/[deviceId]/page.tsx
import { apiFetch } from '@/lib/api'

export default async function DevicePage({
  params,
}: {
  params: Promise<{ deviceId: string }>
}) {
  const { deviceId } = await params

  const { device, plant, latestReading } = await apiFetch<{
    device: { id: string; name: string; locationName: string | null }
    plant: { name: string; targetMinMoisture: number; targetMaxMoisture: number } | null
    latestReading: {
      soilMoisture: number
      temperature: number | null
      humidity: number | null
      watered: boolean
      createdAt: string
    } | null
  }>(`/api/devices/${deviceId}/latest`)

  return (
    <main>
      <h1>{device.name}</h1>
      {device.locationName && <p>{device.locationName}</p>}
      {plant && (
        <p>
          {plant.name} — target {plant.targetMinMoisture}%–{plant.targetMaxMoisture}%
        </p>
      )}
      {latestReading ? (
        <ul>
          <li>Soil moisture: {latestReading.soilMoisture}%</li>
          {latestReading.temperature != null && <li>Temp: {latestReading.temperature}°C</li>}
          {latestReading.humidity != null && <li>Humidity: {latestReading.humidity}%</li>}
          <li>Watered: {latestReading.watered ? 'Yes' : 'No'}</li>
          <li>Updated: {new Date(latestReading.createdAt).toLocaleString()}</li>
        </ul>
      ) : (
        <p>No readings yet.</p>
      )}
    </main>
  )
}
```

---

## Step 12 — Offline fallback page

```tsx
// app/offline/page.tsx
export default function OfflinePage() {
  return (
    <main>
      <h1>You're offline</h1>
      <p>The last cached readings are still available on the dashboard.</p>
    </main>
  )
}
```

Register it in `app/sw.ts` by adding this entry to `runtimeCaching`:

```ts
{
  matcher: ({ request }: { request: Request }) => request.mode === 'navigate',
  handler: 'NetworkOnly',
  options: {
    precacheFallback: { fallbackURL: '/offline' },
  },
},
```

---

## Step 13 — Install prompt (optional)

Show your own "Add to Home Screen" button instead of relying on the browser's
default prompt.

```ts
// types/pwa.d.ts
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
```

```tsx
// components/InstallPrompt.tsx
'use client'

import { useEffect, useState } from 'react'

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt) return null

  return (
    <button onClick={() => prompt.prompt()}>
      Install Aina Cloud
    </button>
  )
}
```

Place `<InstallPrompt />` anywhere visible in your layout or dashboard page.

> iOS Safari does not fire `beforeinstallprompt`. On iOS, the user installs via
> Share → Add to Home Screen. You can detect iOS and show a manual instruction
> banner instead: check `navigator.userAgent` for `iPhone` or `iPad`.

---

## Step 14 — Push notifications (optional)

For low-moisture alerts sent from the backend to the device.

### Generate VAPID keys (run once)

```bash
npx web-push generate-vapid-keys
```

Add to `.env.local`:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<your public key>
VAPID_PRIVATE_KEY=<your private key>
VAPID_EMAIL=mailto:you@example.com
```

### Subscribe the browser

```ts
// lib/push-subscribe.ts
export async function subscribeToPush() {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  })
  await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/push/subscribe`, {
    method: 'POST',
    body: JSON.stringify(sub),
    headers: { 'Content-Type': 'application/json' },
  })
}
```

### Handle push in the service worker

Add to `app/sw.ts`:

```ts
self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Aina Cloud', {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url ?? '/dashboard' },
    })
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url))
})
```

This requires a corresponding `POST /api/push/subscribe` route in the
`aina-cloud` backend, and a `PushSubscription` model in the Prisma schema.

---

## Step 15 — .gitignore additions

```
# Generated service worker
/public/sw.js
/public/sw.js.map
/public/workbox-*.js
/public/workbox-*.js.map
```

---

## Final project structure

```
aina-app/
├── app/
│   ├── layout.tsx                  ← Root layout with viewport export + SW registration
│   ├── manifest.ts                 ← Web App Manifest (auto-served at /manifest.webmanifest)
│   ├── sw.ts                       ← Service worker source (compiled → public/sw.js)
│   ├── globals.css
│   ├── page.tsx                    ← Redirect to /dashboard
│   ├── dashboard/
│   │   ├── page.tsx                ← Device list
│   │   └── [deviceId]/
│   │       └── page.tsx            ← Device detail + readings
│   └── offline/
│       └── page.tsx                ← Shown when offline and page isn't cached
├── components/
│   ├── ServiceWorkerRegistration.tsx
│   └── InstallPrompt.tsx
├── lib/
│   └── api.ts                      ← Fetch wrapper with base URL
├── types/
│   └── pwa.d.ts                    ← BeforeInstallPromptEvent type
├── public/
│   ├── icons/
│   │   ├── icon-16.png
│   │   ├── icon-32.png
│   │   ├── icon-180.png
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   └── sw.js                       ← Generated, gitignored
├── next.config.ts                  ← Wrapped with withSerwist
└── .env.local                      ← NEXT_PUBLIC_API_URL
```

---

## Step 16 — Build and test

```bash
# Build (generates public/sw.js)
npm run build

# Start production server
npm start
```

Open in Chrome and check:

| Check | Where in DevTools |
|---|---|
| Manifest parsed | Application → Manifest |
| Service worker active | Application → Service Workers |
| Assets cached | Application → Cache Storage |
| Install icon in address bar | Address bar (desktop Chrome) |

Run a Lighthouse audit: DevTools → Lighthouse → select "Progressive Web App" → Analyze page load.

### iOS testing

1. Open in Safari on iPhone
2. Share → Add to Home Screen
3. Launch from home screen — no Safari chrome should appear (standalone mode)
4. Turn on airplane mode — the dashboard should still load from cache

---

## Backend change needed

The dashboard page fetches `GET /api/devices` (all devices).
Add this route to `aina-cloud`:

```ts
// app/api/devices/route.ts  — add a GET export alongside the existing POST
export async function GET() {
  const devices = await prisma.device.findMany({ orderBy: { createdAt: 'asc' } })
  return Response.json({ devices })
}
```
