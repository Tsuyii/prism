# Prism — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js app, apply the Supabase schema, configure the PWA manifest, and get a live Vercel deployment that serves the three app routes (dashboard, review, settings).

**Architecture:** Next.js 15 App Router with TypeScript and Tailwind. Supabase as the database via `@supabase/ssr` for server components and `@supabase/supabase-js` for client components. No auth — this is a single-user personal tool, protected only by obscurity of the URL (add auth in a later plan if needed). PWA manifest + service worker skeleton so the app is installable on mobile.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Supabase (PostgreSQL), Vercel, Vitest

---

## Pre-requisites (do before any task)

- [ ] Create a Supabase project at supabase.com → copy `Project URL` and `anon key` and `service_role key`
- [ ] Create a Vercel project connected to `github.com/Tsuyii/prism`
- [ ] Have Node.js 20+ installed

---

## File Map

```
prism/
├── package.json
├── next.config.ts
├── vercel.json                          ← cron job definitions (empty for now)
├── tsconfig.json
├── tailwind.config.ts
├── public/
│   ├── manifest.json                    ← PWA manifest
│   └── sw.js                           ← service worker skeleton
├── src/
│   ├── app/
│   │   ├── layout.tsx                  ← root layout, loads PWA manifest
│   │   ├── page.tsx                    ← dashboard (placeholder)
│   │   ├── review/
│   │   │   └── [id]/
│   │   │       └── page.tsx            ← post review (placeholder)
│   │   └── settings/
│   │       └── page.tsx                ← settings (placeholder)
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts               ← browser Supabase client
│   │   │   ├── server.ts               ← server Supabase client (SSR)
│   │   │   └── types.ts                ← DB type definitions
│   │   └── utils.ts                    ← shared helpers (cn(), formatDate())
│   └── components/
│       └── ui/
│           └── placeholder.tsx         ← "coming soon" card for stub pages
├── supabase/
│   └── schema.sql                      ← full schema to run in Supabase SQL editor
└── .env.local.example                  ← template for env vars
```

---

## Task 1: Scaffold the Next.js project

**Files:**
- Create: project root (all scaffold files)

- [ ] **Step 1: Run create-next-app inside the Prism folder**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-git
```

When prompted:
- Would you like to use ESLint? → Yes
- Would you like to use Turbopack? → Yes

- [ ] **Step 2: Install Supabase and testing dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Add Vitest config to package.json**

Open `package.json`. Replace the `scripts` block with:

```json
"scripts": {
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest",
  "test:run": "vitest run"
}
```

- [ ] **Step 4: Create vitest.config.ts at project root**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 5: Create test setup file**

Create `src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Verify the scaffold runs**

```bash
npm run dev
```

Expected: `✓ Ready in Xms` and browser opens to Next.js default page at `localhost:3000`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 app with Supabase and Vitest"
git push
```

---

## Task 2: Environment variables

**Files:**
- Create: `.env.local.example`
- Create: `.env.local` (local only, not committed)

- [ ] **Step 1: Create .env.local.example**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Google APIs
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_DRIVE_FOLDER_ID=
YOUTUBE_API_KEY=

# OpenAI (Whisper transcription)
OPENAI_API_KEY=

# Instagram Graph API
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=

# TikTok Content API
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_ACCESS_TOKEN=

# n8n
N8N_WEBHOOK_URL=
N8N_API_KEY=

# Cron security
CRON_SECRET=generate-a-random-string-here
```

- [ ] **Step 2: Create .env.local with your real Supabase values**

Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase dashboard → Project Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same page, "anon public" key
- `SUPABASE_SERVICE_ROLE_KEY` — same page, "service_role" key (keep secret)

Leave the rest blank for now — they're filled in later plans.

- [ ] **Step 3: Ensure .env.local is gitignored**

Check `.gitignore` contains `.env.local`. If not, add it:

```bash
grep ".env.local" .gitignore || echo ".env.local" >> .gitignore
```

- [ ] **Step 4: Commit .env.local.example**

```bash
git add .env.local.example .gitignore
git commit -m "feat: add env var template"
git push
```

---

## Task 3: Supabase clients

**Files:**
- Create: `src/lib/supabase/types.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`

- [ ] **Step 1: Write the DB type definitions**

Create `src/lib/supabase/types.ts`:

```typescript
export type PostStatus = 'pending_review' | 'approved' | 'rejected' | 'published' | 'failed'
export type ContentType = 'reel' | 'carousel'
export type Platform = 'instagram' | 'tiktok' | 'x_thread' | 'x_video'
export type TrendSource = 'youtube' | 'reddit' | 'tiktok' | 'google_trends'

export interface Post {
  id: string
  status: PostStatus
  type: ContentType
  drive_url: string
  scheduled_at: string | null
  created_at: string
}

export interface PostVariant {
  id: string
  post_id: string
  platform: Platform
  caption: string | null
  hashtags: string[] | null
  media_url: string | null
  approved: boolean
}

export interface Performance {
  id: string
  post_id: string
  platform: Platform
  views: number
  likes: number
  saves: number
  shares: number
  impressions: number
  reach: number
  fetched_at: string
}

export interface NicheTrend {
  id: string
  source: TrendSource
  topic: string
  score: number | null
  raw_data: Record<string, unknown> | null
  fetched_at: string
}

export interface ScheduleConfig {
  id: string
  day_of_week: number
  content_type: ContentType
  preferred_hour: number
  active: boolean
}

export interface Database {
  public: {
    Tables: {
      posts: { Row: Post; Insert: Omit<Post, 'id' | 'created_at'>; Update: Partial<Post> }
      post_variants: { Row: PostVariant; Insert: Omit<PostVariant, 'id'>; Update: Partial<PostVariant> }
      performance: { Row: Performance; Insert: Omit<Performance, 'id' | 'fetched_at'>; Update: Partial<Performance> }
      niche_trends: { Row: NicheTrend; Insert: Omit<NicheTrend, 'id' | 'fetched_at'>; Update: Partial<NicheTrend> }
      schedule_config: { Row: ScheduleConfig; Insert: Omit<ScheduleConfig, 'id'>; Update: Partial<ScheduleConfig> }
    }
  }
}
```

- [ ] **Step 2: Write the browser Supabase client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Write the server Supabase client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 4: Write a test for the type definitions**

Create `src/lib/supabase/__tests__/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { Post, PostVariant, PostStatus, Platform } from '../types'

describe('Supabase types', () => {
  it('Post type has required fields', () => {
    const post: Post = {
      id: '123',
      status: 'pending_review',
      type: 'reel',
      drive_url: 'https://drive.google.com/file/123',
      scheduled_at: null,
      created_at: new Date().toISOString(),
    }
    expect(post.status).toBe('pending_review')
    expect(post.type).toBe('reel')
  })

  it('PostVariant platform covers all 4 platforms', () => {
    const platforms: Platform[] = ['instagram', 'tiktok', 'x_thread', 'x_video']
    expect(platforms).toHaveLength(4)
  })

  it('PostStatus covers all valid states', () => {
    const statuses: PostStatus[] = ['pending_review', 'approved', 'rejected', 'published', 'failed']
    expect(statuses).toHaveLength(5)
  })
})
```

- [ ] **Step 5: Run the test**

```bash
npm run test:run
```

Expected: `✓ src/lib/supabase/__tests__/types.test.ts (3 tests)`

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/ 
git commit -m "feat: add Supabase client setup and DB type definitions"
git push
```

---

## Task 4: Apply Supabase schema

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Create the schema file**

Create `supabase/schema.sql`:

```sql
-- Prism Database Schema
-- Run this in Supabase Dashboard → SQL Editor → New Query

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'published', 'failed')),
  type text not null
    check (type in ('reel', 'carousel')),
  drive_url text not null,
  scheduled_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists post_variants (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  platform text not null
    check (platform in ('instagram', 'tiktok', 'x_thread', 'x_video')),
  caption text,
  hashtags text[],
  media_url text,
  approved boolean default false
);

create table if not exists performance (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  platform text not null,
  views int default 0,
  likes int default 0,
  saves int default 0,
  shares int default 0,
  impressions int default 0,
  reach int default 0,
  fetched_at timestamptz default now()
);

create table if not exists niche_trends (
  id uuid primary key default gen_random_uuid(),
  source text not null
    check (source in ('youtube', 'reddit', 'tiktok', 'google_trends')),
  topic text not null,
  score numeric,
  raw_data jsonb,
  fetched_at timestamptz default now()
);

create table if not exists schedule_config (
  id uuid primary key default gen_random_uuid(),
  day_of_week int not null check (day_of_week between 0 and 6),
  content_type text not null check (content_type in ('reel', 'carousel')),
  preferred_hour int not null check (preferred_hour between 0 and 23),
  active boolean default true
);

-- Seed default schedule (Mon/Wed/Fri = reels at 6pm, Tue/Thu = carousels at 12pm)
insert into schedule_config (day_of_week, content_type, preferred_hour) values
  (1, 'reel', 18),
  (2, 'carousel', 12),
  (3, 'reel', 18),
  (4, 'carousel', 12),
  (5, 'reel', 18)
on conflict do nothing;
```

- [ ] **Step 2: Run the schema in Supabase**

1. Open Supabase dashboard → your project → SQL Editor
2. Click "New query"
3. Paste the entire contents of `supabase/schema.sql`
4. Click "Run"

Expected: `Success. No rows returned`

- [ ] **Step 3: Verify tables exist**

In Supabase dashboard → Table Editor, confirm these tables exist:
- `posts`
- `post_variants`
- `performance`
- `niche_trends`
- `schedule_config` (with 5 seeded rows)

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add Supabase schema with seed schedule"
git push
```

---

## Task 5: Shared utilities

**Files:**
- Create: `src/lib/utils.ts`
- Create: `src/lib/__tests__/utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { cn, formatScheduledTime, platformLabel } from '../utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })
})

describe('formatScheduledTime', () => {
  it('formats a future ISO string as readable time', () => {
    const iso = '2026-04-16T18:00:00.000Z'
    const result = formatScheduledTime(iso)
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it('returns "Not scheduled" for null', () => {
    expect(formatScheduledTime(null)).toBe('Not scheduled')
  })
})

describe('platformLabel', () => {
  it('returns human labels for all platforms', () => {
    expect(platformLabel('instagram')).toBe('Instagram')
    expect(platformLabel('tiktok')).toBe('TikTok')
    expect(platformLabel('x_thread')).toBe('X Thread')
    expect(platformLabel('x_video')).toBe('X Video')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm run test:run
```

Expected: FAIL — `Cannot find module '../utils'`

- [ ] **Step 3: Implement utils**

Create `src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Platform } from './supabase/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatScheduledTime(iso: string | null): string {
  if (!iso) return 'Not scheduled'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function platformLabel(platform: Platform): string {
  const labels: Record<Platform, string> = {
    instagram: 'Instagram',
    tiktok: 'TikTok',
    x_thread: 'X Thread',
    x_video: 'X Video',
  }
  return labels[platform]
}
```

- [ ] **Step 4: Install clsx and tailwind-merge**

```bash
npm install clsx tailwind-merge
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm run test:run
```

Expected: `✓ src/lib/__tests__/utils.test.ts (5 tests)`

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils.ts src/lib/__tests__/utils.test.ts
git commit -m "feat: add shared utilities (cn, formatScheduledTime, platformLabel)"
git push
```

---

## Task 6: App layout + placeholder pages

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/review/[id]/page.tsx`
- Create: `src/app/settings/page.tsx`
- Create: `src/components/ui/placeholder.tsx`

- [ ] **Step 1: Create the placeholder component**

Create `src/components/ui/placeholder.tsx`:

```typescript
interface PlaceholderProps {
  title: string
  description: string
}

export function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="text-center">
        <div className="mb-4 text-5xl">🌈</div>
        <h1 className="mb-2 text-2xl font-bold text-white">{title}</h1>
        <p className="text-gray-400">{description}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update root layout**

Replace the contents of `src/app/layout.tsx`:

```typescript
import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Prism',
  description: 'One video. Four platforms.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Prism',
  },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={geist.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Update dashboard page**

Replace `src/app/page.tsx`:

```typescript
import { Placeholder } from '@/components/ui/placeholder'

export default function DashboardPage() {
  return (
    <Placeholder
      title="Prism Dashboard"
      description="Post history, performance and upcoming schedule — coming in Plan 3."
    />
  )
}
```

- [ ] **Step 4: Create review page**

Create `src/app/review/[id]/page.tsx`:

```typescript
import { Placeholder } from '@/components/ui/placeholder'

export default function ReviewPage({ params }: { params: { id: string } }) {
  return (
    <Placeholder
      title="Review Post"
      description={`Review and approve post ${params.id} — coming in Plan 3.`}
    />
  )
}
```

- [ ] **Step 5: Create settings page**

Create `src/app/settings/page.tsx`:

```typescript
import { Placeholder } from '@/components/ui/placeholder'

export default function SettingsPage() {
  return (
    <Placeholder
      title="Settings"
      description="Schedule config and platform toggles — coming in Plan 3."
    />
  )
}
```

- [ ] **Step 6: Verify all routes work**

```bash
npm run dev
```

Check in browser:
- `localhost:3000` → "Prism Dashboard"
- `localhost:3000/review/test-id` → "Review Post"
- `localhost:3000/settings` → "Settings"

- [ ] **Step 7: Commit**

```bash
git add src/app/ src/components/
git commit -m "feat: add placeholder pages for dashboard, review, and settings routes"
git push
```

---

## Task 7: PWA manifest + service worker

**Files:**
- Create: `public/manifest.json`
- Create: `public/sw.js`

- [ ] **Step 1: Create PWA manifest**

Create `public/manifest.json`:

```json
{
  "name": "Prism",
  "short_name": "Prism",
  "description": "One video. Four platforms.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Create service worker skeleton**

Create `public/sw.js`:

```javascript
// Prism Service Worker
// Handles push notifications and offline caching

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
  // Network first, cache fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})

// Push notification handler — wired up in Plan 3
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'Prism', body: 'New post ready for review' }
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
```

- [ ] **Step 3: Register service worker in layout**

Add this script tag inside the `<body>` in `src/app/layout.tsx`, before the closing tag:

```typescript
// In layout.tsx, add after the {children} line:
<script
  dangerouslySetInnerHTML={{
    __html: `
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js')
        })
      }
    `,
  }}
/>
```

The full updated `src/app/layout.tsx` body:

```typescript
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={geist.className}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                })
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Add placeholder icons**

Create two 1x1 black PNG placeholders (real icons designed in Stitch later):

```bash
# Install sharp CLI to generate placeholder icons
npx sharp-cli --input <(convert -size 192x192 xc:black png:-) --output public/icon-192.png 2>/dev/null || \
  curl -s "https://via.placeholder.com/192/000000/000000.png" -o public/icon-192.png && \
  curl -s "https://via.placeholder.com/512/000000/000000.png" -o public/icon-512.png
```

If curl isn't available, create any 192x192 and 512x512 black PNG and name them accordingly. These are placeholder icons — real ones come with the Stitch design phase.

- [ ] **Step 5: Verify PWA is installable**

```bash
npm run dev
```

Open `localhost:3000` in Chrome → DevTools → Application → Manifest. Confirm:
- Name: Prism
- Start URL: /
- Icons: shown (even if placeholder)
- Installable: no errors

- [ ] **Step 6: Commit**

```bash
git add public/ src/app/layout.tsx
git commit -m "feat: add PWA manifest and service worker skeleton"
git push
```

---

## Task 8: Vercel deployment

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create vercel.json**

Create `vercel.json` at project root:

```json
{
  "crons": []
}
```

(Cron jobs added in Plans 2 and 5 when those routes exist.)

- [ ] **Step 2: Add Supabase env vars to Vercel**

In Vercel dashboard → your Prism project → Settings → Environment Variables, add:

```
NEXT_PUBLIC_SUPABASE_URL       = (your value)
NEXT_PUBLIC_SUPABASE_ANON_KEY  = (your value)
SUPABASE_SERVICE_ROLE_KEY      = (your value)
```

Set all three for: Production, Preview, Development.

- [ ] **Step 3: Trigger a deploy**

```bash
git add vercel.json
git commit -m "feat: add vercel.json for cron config"
git push
```

Vercel auto-deploys on push to `main`/`master`. Watch the deploy in the Vercel dashboard.

- [ ] **Step 4: Verify live deployment**

Open your Vercel deployment URL (e.g. `https://prism-xyz.vercel.app`).

Check:
- `/` → "Prism Dashboard" placeholder
- `/review/abc` → "Review Post" placeholder
- `/settings` → "Settings" placeholder
- DevTools → Application → Manifest → installable, no errors

- [ ] **Step 5: Test on mobile**

Open the Vercel URL on your phone in Chrome/Safari.
- Android: tap "Add to Home Screen" in Chrome menu
- iOS: tap Share → "Add to Home Screen"

Confirm the app icon appears and opens in standalone mode (no browser chrome).

---

## Task 9: Update PRISM.md

**Files:**
- Modify: `PRISM.md`

- [ ] **Step 1: Update the Completed Features and Pending sections**

In `PRISM.md`, update the `## Completed Features` section:

```markdown
## Completed Features

### Plan 1: Foundation (2026-04-16)
- [x] Next.js 15 scaffold (App Router, TypeScript, Tailwind, Turbopack)
- [x] Supabase clients (browser + server, typed)
- [x] Database schema applied (5 tables, seeded schedule)
- [x] Shared utilities (cn, formatScheduledTime, platformLabel)
- [x] Placeholder pages: dashboard (/), review (/review/[id]), settings (/settings)
- [x] PWA manifest + service worker skeleton (push notification handler ready)
- [x] Live Vercel deployment
- [x] Vitest test suite (8 passing tests)
```

Update `## In Progress`:

```markdown
## In Progress

_Plan 2: Google Drive ingestion + Claude AI pipeline_
```

Update `## Pending`:

```markdown
## Pending (remaining plans)

- [ ] Plan 2: Google Drive OAuth + Claude AI pipeline (4 content variants)
- [ ] Plan 3: Review PWA screens (Stitch designs → real UI)
- [ ] Plan 4: n8n + Blotato posting engine
- [ ] Plan 5: Research crons + daily metrics pull
```

- [ ] **Step 2: Commit**

```bash
git add PRISM.md
git commit -m "docs: update PRISM.md — Plan 1 complete"
git push
```

---

## Self-Review

**Spec coverage check:**
- ✓ Next.js on Vercel — Task 1, 8
- ✓ Supabase schema (all 5 tables) — Task 4
- ✓ PWA manifest + service worker — Task 7
- ✓ Three routes (dashboard, review, settings) — Task 6
- ✓ Env var template — Task 2
- ✓ Typed DB layer — Task 3
- ✓ PRISM.md updated — Task 9
- ✓ Tests for all utility code — Tasks 3, 5

**No placeholders found.**

**Type consistency:** `Platform`, `PostStatus`, `ContentType` defined in `types.ts` in Task 3 and used consistently in `utils.ts` in Task 5.
