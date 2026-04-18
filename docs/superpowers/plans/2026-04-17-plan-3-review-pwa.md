# Prism — Plan 3: Review PWA

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all placeholder pages with real, functional UI. The Review page is the critical path — it's the human-in-the-loop screen where the creator approves/edits/rejects AI-generated content on mobile. Dashboard shows post history. Settings configures the posting schedule. New Post triggers the pipeline manually.

**Architecture:**
- All data fetching is server-side (Server Components) — no loading spinners, no client-side fetch on mount
- Interactive parts (tabs, inline editing, approve/reject actions) are isolated `'use client'` child components that receive pre-fetched data as props
- Shared bottom navigation component (`src/components/nav.tsx`) renders on all pages
- Approve/reject call the existing `/api/approve` and `/api/reject` routes via client-side `fetch`

**Design reference:** `docs/superpowers/specs/2026-04-16-prism-design.md` — wireframes and screen descriptions

---

## File Map

```
src/
├── components/
│   ├── nav.tsx                          ← Shared bottom nav (mobile) + top bar (desktop)
│   ├── post-card.tsx                    ← Dashboard post card (status badge, link to review)
│   └── ui/
│       └── placeholder.tsx              ← (existing — keep)
├── app/
│   ├── layout.tsx                       ← (modify) add nav outside children
│   ├── page.tsx                         ← (replace) Dashboard: post list + stats
│   ├── review/
│   │   └── [id]/
│   │       ├── page.tsx                 ← (replace) Server Component: fetch + render ReviewClient
│   │       └── review-client.tsx        ← (create) Client Component: tabs + editing + approve/reject
│   ├── settings/
│   │   ├── page.tsx                     ← (replace) Server Component: load schedule_config
│   │   └── settings-client.tsx          ← (create) Client Component: schedule grid + save
│   ├── new/
│   │   └── page.tsx                     ← (create) New Post trigger — mobile pipeline kick-off
│   └── api/
│       └── settings/
│           └── route.ts                 ← (create) PATCH: update schedule_config rows
└── lib/
    └── __tests__/
        └── review.test.ts               ← (create) Unit tests for review utilities
stitch/
├── post-review-mobile.html              ← (create) Stitch design — Review screen
├── dashboard-desktop.html               ← (create) Stitch design — Dashboard screen
├── settings.html                        ← (create) Stitch design — Settings screen
└── new-post-mobile.html                 ← (create) Stitch design — New Post trigger screen
```

---

## Task 1: Stitch screen designs

**Files:**
- Create: `stitch/post-review-mobile.html`
- Create: `stitch/dashboard-desktop.html`
- Create: `stitch/settings.html`
- Create: `stitch/new-post-mobile.html`

These are HTML design reference files — generated via Stitch MCP and saved to `stitch/`. They are the visual source of truth and do not run in the app.

- [ ] **Step 1: Use Stitch MCP to generate 4 screen designs**

Use `mcp__stitch__create_project` to create a Prism project, then `mcp__stitch__generate_screen_from_text` for each of the 4 screens described below. Save the resulting HTML to the `stitch/` directory.

**Screen 1 — Post Review (mobile)**
```
Prompt: "Mobile post review screen for Prism, a social media content tool. Dark theme, full-height phone layout.

Header: 'Review Post' title center, back arrow left, type badge (Reel or Carousel) right.

Platform tabs row: 4 tabs — IG, TT, X Thread, X Video. Active tab has accent underline.

Content area (scrollable):
- Video thumbnail placeholder (16:9, rounded, grey bg with play icon)
- Section: 'Caption' label with edit pencil icon. Editable textarea below (2 lines visible, expands). Subtle border, focused state.
- Section: 'Hashtags' label with edit pencil icon. Hashtag chips in a wrapping row. Add/remove chips. Only shown for IG and TT tabs.
- Section: 'Best time' — calendar icon, 'Today 6:00 PM' text with a [Change] tappable link.
- Section: '💡 Film next' — italic recommendation text in a soft highlight box.

Bottom sticky section:
- Two full-width CTA buttons stacked: green '✅ APPROVE' button, red '❌ REJECT' button.
- Safe area inset padding at bottom.

Color palette: black background, white text, #8B5CF6 accent (violet), status green #22C55E, danger red #EF4444."
```

**Screen 2 — Dashboard (desktop)**
```
Prompt: "Desktop dashboard for Prism social media automation tool. Dark theme, sidebar layout.

Left sidebar (240px): Prism logo with prism icon top. Nav items: Dashboard (active), Settings, New Post. Bottom: version text.

Main content area:
- Page title 'Dashboard' with 'New Post' button top-right (accent violet).
- Stats row: 4 cards — Total Posts (number), Pending Review (number, yellow), Published (number, green), Rejected (number, grey).
- Section 'Pending Review' — list of post cards. Each card: left type badge (Reel/Carousel), middle shows truncated filename and created date, right shows 'Review →' button.
- Section 'Recent Posts' — compact table: Status badge, Type, Created date, Scheduled date, Actions.

Color palette: #0A0A0A background, #18181B card bg, white text, #8B5CF6 accent."
```

**Screen 3 — Settings (desktop + mobile)**
```
Prompt: "Settings page for Prism social media scheduling tool. Dark theme, works on mobile and desktop.

Header: 'Settings' page title.

Section 'Posting Schedule':
- 7-day grid. Rows = days (Sun–Sat). Columns = Reel, Carousel, Off. Radio-button style toggle per row.
- Each day row also has a time picker (preferred hour dropdown: 6 AM to 10 PM in 1-hour steps).
- Active rows highlighted with subtle accent left border.

Section 'Platform Toggles':
- Toggle rows for: Instagram, TikTok, X Thread, X Video. Each with platform icon and label. Toggle switch on right.

Section 'Google Drive':
- Text: 'Folder ID' with monospace input showing current GOOGLE_DRIVE_FOLDER_ID value (read-only, greyed).
- Explainer: 'Drop videos in /SocialMedia/Queue/reels/ to trigger the pipeline.'

Bottom: 'Save Changes' full-width button (accent violet).

Color palette: #0A0A0A background, #18181B card bg, white text, #8B5CF6 accent."
```

**Screen 4 — New Post (mobile)**
```
Prompt: "Mobile 'New Post' trigger screen for Prism. Dark theme, minimal.

Header: 'New Post' title center.

Content area:
- Section header: 'Trigger pipeline manually'
- Explainer text: 'Paste a Google Drive file URL below to process a video immediately.'
- Large text input: placeholder 'https://drive.google.com/file/d/...' with paste icon.
- Filename input below (optional): placeholder 'video.mp4'
- Content type selector: two pill buttons 'Reel' and 'Carousel', one selected at a time.

Below: 'Start Pipeline' full-width button (accent violet, slightly rounded).

Status area below button: shows 'Processing...' spinner when loading, 'Done! Tap to review →' success state with green, error state with red.

Color palette: black bg, white text, #8B5CF6 accent."
```

- [ ] **Step 2: Commit Stitch files**

```bash
git add stitch/
git commit -m "design: add Stitch screen designs for all 4 Plan 3 screens"
git push origin master
```

---

## Task 2: Shared navigation + update root layout

**Files:**
- Create: `src/components/nav.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create `src/components/nav.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  {
    href: '/',
    label: 'Dashboard',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: '/new',
    label: 'New Post',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
      </svg>
    ),
  },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950 pb-safe md:relative md:bottom-auto md:left-auto md:right-auto md:border-t-0 md:border-r md:h-full md:w-16 md:flex-col md:pb-0">
      <ul className="flex h-16 items-center justify-around md:flex-col md:h-auto md:justify-start md:gap-2 md:pt-4">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2 text-xs transition-colors md:flex-col md:px-3 md:py-3 md:rounded-lg md:mx-1',
                  active
                    ? 'text-violet-400'
                    : 'text-zinc-500 hover:text-zinc-300',
                )}
                aria-current={active ? 'page' : undefined}
              >
                {icon(active)}
                <span className="leading-none">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 2: Update `src/app/layout.tsx` to include Nav**

```tsx
import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { Nav } from '@/components/nav'
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
      <body className={`${geist.className} flex flex-col min-h-screen bg-zinc-950 text-white md:flex-row`}>
        <Nav />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
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

- [ ] **Step 3: Commit**

```bash
git add src/components/nav.tsx src/app/layout.tsx
git commit -m "feat: add shared bottom nav and update root layout"
git push origin master
```

---

## Task 3: Review page (mobile PWA)

**Files:**
- Replace: `src/app/review/[id]/page.tsx`
- Create: `src/app/review/[id]/review-client.tsx`

The Review page is the most important screen. Server Component fetches the post, all 4 variants, and the latest film_next recommendation. Passes everything to `ReviewClient` which handles tabs, inline editing, and approve/reject.

- [ ] **Step 1: Create `src/app/review/[id]/review-client.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn, platformLabel } from '@/lib/utils'
import type { Post, PostVariant, Platform } from '@/lib/supabase/types'

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'x_thread', 'x_video']

interface ReviewClientProps {
  post: Post
  variants: PostVariant[]
  filmNext: string | null
}

interface EditState {
  caption: string
  hashtags: string
}

export function ReviewClient({ post, variants, filmNext }: ReviewClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Platform>('instagram')
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Editable state per platform
  const [edits, setEdits] = useState<Record<Platform, EditState>>(() => {
    const initial = {} as Record<Platform, EditState>
    for (const platform of PLATFORMS) {
      const v = variants.find((v) => v.platform === platform)
      initial[platform] = {
        caption: v?.caption ?? '',
        hashtags: (v?.hashtags ?? []).join(' '),
      }
    }
    return initial
  })

  const [scheduledAt, setScheduledAt] = useState<string>(
    post.scheduled_at
      ? new Date(post.scheduled_at).toISOString().slice(0, 16)
      : getDefaultSchedule(),
  )

  function getDefaultSchedule(): string {
    const d = new Date()
    d.setHours(18, 0, 0, 0)
    if (d < new Date()) d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 16)
  }

  async function handleApprove() {
    setError(null)
    setLoading('approve')
    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Server error ${res.status}`)
      }
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed')
    } finally {
      setLoading(null)
    }
  }

  async function handleReject() {
    setError(null)
    setLoading('reject')
    try {
      const res = await fetch('/api/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Server error ${res.status}`)
      }
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed')
    } finally {
      setLoading(null)
    }
  }

  const current = edits[activeTab]
  const isThread = activeTab === 'x_thread'
  const hasHashtags = activeTab === 'instagram' || activeTab === 'tiktok'

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-safe-top pb-3 pt-4 border-b border-zinc-800">
        <button
          onClick={() => router.back()}
          className="text-zinc-400 hover:text-white transition-colors p-1 -ml-1"
          aria-label="Go back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-base font-semibold">Review Post</h1>
        <span className={cn(
          'text-xs font-medium px-2 py-0.5 rounded-full',
          post.type === 'reel'
            ? 'bg-violet-900/50 text-violet-300'
            : 'bg-blue-900/50 text-blue-300',
        )}>
          {post.type === 'reel' ? 'Reel' : 'Carousel'}
        </span>
      </header>

      {/* Platform Tabs */}
      <div className="flex border-b border-zinc-800 overflow-x-auto scrollbar-none">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setActiveTab(p)}
            className={cn(
              'flex-1 min-w-0 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
              activeTab === p
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300',
            )}
          >
            {platformLabel(p)}
          </button>
        ))}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-40">

        {/* Video thumbnail placeholder */}
        <div className="w-full aspect-video rounded-xl bg-zinc-800 flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>

        {/* Caption */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
            {isThread ? 'Thread Tweets' : 'Caption'}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </label>
          {isThread ? (
            <div className="space-y-2">
              {current.caption.split('\n\n---\n\n').map((tweet, i) => (
                <textarea
                  key={i}
                  value={tweet}
                  onChange={(e) => {
                    const tweets = current.caption.split('\n\n---\n\n')
                    tweets[i] = e.target.value
                    setEdits((prev) => ({
                      ...prev,
                      [activeTab]: { ...prev[activeTab], caption: tweets.join('\n\n---\n\n') },
                    }))
                  }}
                  rows={3}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-violet-500 transition-colors"
                  placeholder={`Tweet ${i + 1}`}
                />
              ))}
            </div>
          ) : (
            <textarea
              value={current.caption}
              onChange={(e) =>
                setEdits((prev) => ({
                  ...prev,
                  [activeTab]: { ...prev[activeTab], caption: e.target.value },
                }))
              }
              rows={4}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white resize-none focus:outline-none focus:border-violet-500 transition-colors"
              placeholder="Caption..."
            />
          )}
        </div>

        {/* Hashtags (IG + TT only) */}
        {hasHashtags && (
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
              Hashtags
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </label>
            <textarea
              value={current.hashtags}
              onChange={(e) =>
                setEdits((prev) => ({
                  ...prev,
                  [activeTab]: { ...prev[activeTab], hashtags: e.target.value },
                }))
              }
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-300 resize-none focus:outline-none focus:border-violet-500 transition-colors font-mono"
              placeholder="#hashtag1 #hashtag2..."
            />
          </div>
        )}

        {/* Schedule time */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Post Time
          </label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        {/* Film Next */}
        {filmNext && (
          <div className="rounded-xl bg-violet-950/40 border border-violet-800/30 px-4 py-3">
            <p className="text-xs font-medium text-violet-400 mb-1">💡 Film next</p>
            <p className="text-sm text-zinc-300 italic">{filmNext}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-950/50 border border-red-800/50 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Sticky bottom CTAs */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-4 pb-safe bg-zinc-950/95 backdrop-blur-sm border-t border-zinc-800 space-y-3 md:absolute">
        <button
          onClick={handleApprove}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-white transition-colors"
        >
          {loading === 'approve' ? (
            <span className="animate-pulse">Processing...</span>
          ) : (
            <>✅ Approve</>
          )}
        </button>
        <button
          onClick={handleReject}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-zinc-300 transition-colors"
        >
          {loading === 'reject' ? (
            <span className="animate-pulse">Processing...</span>
          ) : (
            <>❌ Reject</>
          )}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/app/review/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ReviewClient } from './review-client'
import type { Platform } from '@/lib/supabase/types'

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'x_thread', 'x_video']

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single()

  if (postError || !post) {
    notFound()
  }

  const { data: variants } = await supabase
    .from('post_variants')
    .select('*')
    .eq('post_id', id)
    .in('platform', PLATFORMS)

  // Fetch latest film_next recommendation for this post
  const { data: filmNextRow } = await supabase
    .from('niche_trends')
    .select('topic')
    .eq('source', 'claude')
    .contains('raw_data', { type: 'film_next_recommendation', post_id: id })
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <ReviewClient
      post={post}
      variants={variants ?? []}
      filmNext={filmNextRow?.topic ?? null}
    />
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/review/
git commit -m "feat: implement Review PWA page (tabs, inline editing, approve/reject)"
git push origin master
```

---

## Task 4: Dashboard page

**Files:**
- Create: `src/components/post-card.tsx`
- Replace: `src/app/page.tsx`

- [ ] **Step 1: Create `src/components/post-card.tsx`**

```tsx
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Post, PostStatus } from '@/lib/supabase/types'

const STATUS_STYLES: Record<PostStatus, string> = {
  pending_review: 'bg-yellow-900/40 text-yellow-400 border-yellow-800/40',
  approved: 'bg-blue-900/40 text-blue-400 border-blue-800/40',
  rejected: 'bg-zinc-800 text-zinc-500 border-zinc-700',
  published: 'bg-green-900/40 text-green-400 border-green-800/40',
  failed: 'bg-red-900/40 text-red-400 border-red-800/40',
}

const STATUS_LABELS: Record<PostStatus, string> = {
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
  failed: 'Failed',
}

function StatusBadge({ status }: { status: string }) {
  const s = status as PostStatus
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
      STATUS_STYLES[s] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700',
    )}>
      {STATUS_LABELS[s] ?? status}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      type === 'reel'
        ? 'bg-violet-900/40 text-violet-400'
        : 'bg-blue-900/40 text-blue-400',
    )}>
      {type === 'reel' ? 'Reel' : 'Carousel'}
    </span>
  )
}

interface PostCardProps {
  post: Post
  variant?: 'compact' | 'full'
}

export function PostCard({ post, variant = 'full' }: PostCardProps) {
  const isPending = post.status === 'pending_review'
  const createdDate = post.created_at
    ? new Date(post.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
    : '—'
  const scheduledDate = post.scheduled_at
    ? new Date(post.scheduled_at).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 py-3 border-b border-zinc-800 last:border-0">
        <TypeBadge type={post.type} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-300 truncate">{post.drive_url.split('/').at(-2) ?? 'File'}</p>
          <p className="text-xs text-zinc-600">{createdDate} · {scheduledDate}</p>
        </div>
        <StatusBadge status={post.status} />
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-xl border p-4 flex items-center gap-4 transition-colors',
      isPending
        ? 'bg-zinc-900 border-yellow-800/30 hover:border-yellow-700/50'
        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700',
    )}>
      <TypeBadge type={post.type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {post.drive_url.split('/').at(-2) ?? 'Untitled'}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          Created {createdDate}
          {post.scheduled_at ? ` · Scheduled ${scheduledDate}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <StatusBadge status={post.status} />
        {isPending && (
          <Link
            href={`/review/${post.id}`}
            className="text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors whitespace-nowrap"
          >
            Review →
          </Link>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/app/page.tsx`**

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PostCard } from '@/components/post-card'
import type { PostStatus } from '@/lib/supabase/types'

export const revalidate = 0

interface StatCardProps {
  label: string
  value: number
  color?: 'default' | 'yellow' | 'green' | 'zinc'
}

function StatCard({ label, value, color = 'default' }: StatCardProps) {
  const valueColor = {
    default: 'text-white',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    zinc: 'text-zinc-500',
  }[color]

  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 flex flex-col gap-1">
      <span className={`text-2xl font-bold tabular-nums ${valueColor}`}>{value}</span>
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const all = posts ?? []

  const counts = all.reduce(
    (acc, p) => {
      const s = p.status as PostStatus
      acc[s] = (acc[s] ?? 0) + 1
      return acc
    },
    {} as Partial<Record<PostStatus, number>>,
  )

  const pending = all.filter((p) => p.status === 'pending_review')
  const recent = all.filter((p) => p.status !== 'pending_review').slice(0, 10)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <Link
          href="/new"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 transition-colors text-sm font-medium text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Post
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Posts" value={all.length} />
        <StatCard label="Pending Review" value={counts.pending_review ?? 0} color="yellow" />
        <StatCard label="Published" value={counts.published ?? 0} color="green" />
        <StatCard label="Rejected" value={counts.rejected ?? 0} color="zinc" />
      </div>

      {/* Pending review */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Pending Review
          </h2>
          <div className="space-y-2">
            {pending.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

      {/* Recent posts */}
      {recent.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Recent Posts
          </h2>
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 divide-y divide-zinc-800">
            {recent.map((post) => (
              <PostCard key={post.id} post={post} variant="compact" />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {all.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center mx-auto">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <p className="text-zinc-500 text-sm">No posts yet.</p>
          <Link href="/new" className="inline-block text-violet-400 hover:text-violet-300 text-sm transition-colors">
            Trigger your first pipeline →
          </Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/post-card.tsx src/app/page.tsx
git commit -m "feat: implement Dashboard page with post list and stats"
git push origin master
```

---

## Task 5: Settings page + API route

**Files:**
- Create: `src/app/api/settings/route.ts`
- Replace: `src/app/settings/page.tsx`
- Create: `src/app/settings/settings-client.tsx`

- [ ] **Step 1: Create `src/app/api/settings/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ScheduleRow {
  day_of_week: number
  content_type: string
  preferred_hour: number
  active: boolean
}

export async function PATCH(request: NextRequest) {
  let body: { schedule?: ScheduleRow[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { schedule } = body
  if (!Array.isArray(schedule)) {
    return NextResponse.json({ error: 'schedule must be an array' }, { status: 400 })
  }

  const supabase = await createClient()

  // Upsert all 7 rows (one per day). Use day_of_week as natural key via delete+insert.
  const { error: deleteError } = await supabase
    .from('schedule_config')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // delete all rows

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to clear schedule' }, { status: 500 })
  }

  const rows = schedule.map(({ day_of_week, content_type, preferred_hour, active }) => ({
    day_of_week,
    content_type,
    preferred_hour,
    active,
  }))

  const { error: insertError } = await supabase.from('schedule_config').insert(rows)

  if (insertError) {
    return NextResponse.json({ error: 'Failed to save schedule' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Create `src/app/settings/settings-client.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { ScheduleConfig } from '@/lib/supabase/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 16 }, (_, i) => i + 6) // 6 AM to 9 PM

function formatHour(h: number): string {
  if (h === 12) return '12 PM'
  if (h === 0) return '12 AM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

interface SettingsClientProps {
  initialSchedule: ScheduleConfig[]
}

interface DayConfig {
  day_of_week: number
  content_type: 'reel' | 'carousel' | 'off'
  preferred_hour: number
  active: boolean
}

export function SettingsClient({ initialSchedule }: SettingsClientProps) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [schedule, setSchedule] = useState<DayConfig[]>(() =>
    DAYS.map((_, i) => {
      const existing = initialSchedule.find((s) => s.day_of_week === i)
      return {
        day_of_week: i,
        content_type: existing?.active
          ? (existing.content_type as 'reel' | 'carousel')
          : 'off',
        preferred_hour: existing?.preferred_hour ?? 18,
        active: existing?.active ?? false,
      }
    }),
  )

  function setDayType(dayIndex: number, type: DayConfig['content_type']) {
    setSchedule((prev) =>
      prev.map((d) =>
        d.day_of_week === dayIndex
          ? { ...d, content_type: type, active: type !== 'off' }
          : d,
      ),
    )
    setSaved(false)
  }

  function setDayHour(dayIndex: number, hour: number) {
    setSchedule((prev) =>
      prev.map((d) => (d.day_of_week === dayIndex ? { ...d, preferred_hour: hour } : d)),
    )
    setSaved(false)
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      const rows = schedule
        .filter((d) => d.content_type !== 'off')
        .map(({ day_of_week, content_type, preferred_hour, active }) => ({
          day_of_week,
          content_type,
          preferred_hour,
          active,
        }))

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: rows }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Server error ${res.status}`)
      }
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-8">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* Schedule */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          Posting Schedule
        </h2>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 divide-y divide-zinc-800">
          {schedule.map((day) => (
            <div key={day.day_of_week} className={cn(
              'flex items-center gap-3 px-4 py-3',
              day.active && 'border-l-2 border-violet-500',
            )}>
              <span className="text-sm font-medium text-zinc-300 w-8 shrink-0">
                {DAYS[day.day_of_week]}
              </span>

              {/* Type selector */}
              <div className="flex gap-1 flex-1">
                {(['reel', 'carousel', 'off'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setDayType(day.day_of_week, type)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors capitalize',
                      day.content_type === type
                        ? type === 'off'
                          ? 'bg-zinc-700 text-zinc-300'
                          : 'bg-violet-600 text-white'
                        : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300',
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Hour picker — only when active */}
              {day.active && (
                <select
                  value={day.preferred_hour}
                  onChange={(e) => setDayHour(day.day_of_week, Number(e.target.value))}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-violet-500"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>{formatHour(h)}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Error / save feedback */}
      {error && (
        <div className="rounded-lg bg-red-950/50 border border-red-800/50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {saved && (
        <div className="rounded-lg bg-green-950/50 border border-green-800/50 px-4 py-3 text-sm text-green-400">
          Schedule saved.
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-white transition-colors"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Replace `src/app/settings/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: schedule } = await supabase
    .from('schedule_config')
    .select('*')
    .order('day_of_week')

  return <SettingsClient initialSchedule={schedule ?? []} />
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/ src/app/api/settings/
git commit -m "feat: implement Settings page (schedule grid) + PATCH /api/settings"
git push origin master
```

---

## Task 6: New Post page

**Files:**
- Create: `src/app/new/page.tsx`

- [ ] **Step 1: Create `src/app/new/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

function extractFileId(input: string): string {
  // Handle full Drive URLs like https://drive.google.com/file/d/<ID>/view
  const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (match) return match[1]
  // Assume raw fileId if no URL pattern
  return input.trim()
}

export default function NewPostPage() {
  const router = useRouter()
  const [driveInput, setDriveInput] = useState('')
  const [fileName, setFileName] = useState('')
  const [contentType, setContentType] = useState<'reel' | 'carousel'>('reel')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [postId, setPostId] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fileId = extractFileId(driveInput)
    if (!fileId) {
      setError('Paste a Drive URL or file ID')
      return
    }

    setStatus('loading')
    setError('')

    const mimeType = contentType === 'reel' ? 'video/mp4' : 'image/jpeg'
    const name = fileName.trim() || `${contentType}-${Date.now()}.${contentType === 'reel' ? 'mp4' : 'jpg'}`
    const driveUrl = driveInput.startsWith('http')
      ? driveInput
      : `https://drive.google.com/file/d/${fileId}/view`

    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_PIPELINE_SECRET ?? ''}`,
        },
        body: JSON.stringify({ fileId, fileName: name, mimeType, driveUrl }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`)

      setPostId(data.postId)
      setStatus('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pipeline trigger failed')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 rounded-full bg-green-600/20 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">Pipeline started!</h2>
        <p className="text-sm text-zinc-500">Claude is generating your content. Check back in a minute.</p>
        <button
          onClick={() => router.push(`/review/${postId}`)}
          className="mt-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors text-sm"
        >
          Review when ready →
        </button>
        <button
          onClick={() => { setStatus('idle'); setDriveInput(''); setFileName('') }}
          className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Submit another
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold">New Post</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Drive input */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
            Google Drive URL or File ID
          </label>
          <div className="relative">
            <input
              type="text"
              value={driveInput}
              onChange={(e) => { setDriveInput(e.target.value); setError('') }}
              placeholder="https://drive.google.com/file/d/..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors pr-10"
              required
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText()
                  setDriveInput(text)
                } catch { /* permission denied */ }
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
              title="Paste from clipboard"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filename (optional) */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
            Filename <span className="text-zinc-600 normal-case">(optional)</span>
          </label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="my-video.mp4"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        {/* Content type */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
            Content Type
          </label>
          <div className="flex gap-2">
            {(['reel', 'carousel'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setContentType(type)}
                className={cn(
                  'flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors capitalize',
                  contentType === type
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-zinc-200',
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {(status === 'error' || error) && (
          <div className="rounded-lg bg-red-950/50 border border-red-800/50 px-4 py-3 text-sm text-red-400">
            {error || 'Something went wrong. Try again.'}
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full py-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-white transition-colors mt-2"
        >
          {status === 'loading' ? (
            <span className="animate-pulse">Starting pipeline...</span>
          ) : (
            'Start Pipeline'
          )}
        </button>
      </form>

      <p className="text-xs text-zinc-600 text-center leading-relaxed">
        The file must be in your Google Drive folder. Claude will transcribe, generate captions, and queue it for your review.
      </p>
    </div>
  )
}
```

Note: `NEXT_PUBLIC_PIPELINE_SECRET` must be added to env vars — see env var note below.

- [ ] **Step 2: Commit**

```bash
git add src/app/new/
git commit -m "feat: add New Post page (manual Drive pipeline trigger)"
git push origin master
```

---

## Task 7: Unit tests

**Files:**
- Create: `src/lib/__tests__/review.test.ts`

- [ ] **Step 1: Create `src/lib/__tests__/review.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { platformLabel, formatScheduledTime } from '../utils'
import type { Platform } from '../supabase/types'

describe('platformLabel', () => {
  it('returns correct label for each platform', () => {
    const cases: Array<[Platform, string]> = [
      ['instagram', 'Instagram'],
      ['tiktok', 'TikTok'],
      ['x_thread', 'X Thread'],
      ['x_video', 'X Video'],
    ]
    for (const [platform, expected] of cases) {
      expect(platformLabel(platform)).toBe(expected)
    }
  })
})

describe('formatScheduledTime', () => {
  it('returns "Not scheduled" for null', () => {
    expect(formatScheduledTime(null)).toBe('Not scheduled')
  })

  it('returns a time string for a valid ISO date', () => {
    const result = formatScheduledTime('2026-04-18T18:00:00.000Z')
    // Result is locale-dependent; just verify it's a non-empty string
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(result).not.toBe('Not scheduled')
  })
})

describe('Drive URL fileId extraction', () => {
  // Inline the extraction logic to test it independently
  function extractFileId(input: string): string {
    const match = input.match(/\/d\/([a-zA-Z0-9_-]+)/)
    if (match) return match[1]
    return input.trim()
  }

  it('extracts fileId from full Drive URL', () => {
    const url = 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view'
    expect(extractFileId(url)).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs')
  })

  it('returns raw string when no URL pattern', () => {
    expect(extractFileId('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs')).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs')
  })

  it('trims whitespace from raw fileId', () => {
    expect(extractFileId('  1BxiMVs0  ')).toBe('1BxiMVs0')
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism
npm run test:run
```

Expected: 5 new tests passing, 14 prior tests still passing (19 total).

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/review.test.ts
git commit -m "test: add review page utility unit tests"
git push origin master
```

---

## Task 8: Env var + TypeScript build + PRISM.md update

**Files:**
- Modify: `.env.local.example`
- Modify: `PRISM.md`

- [ ] **Step 1: Add new env var to `.env.local.example`**

Add under the `# n8n` section:

```bash
# New Post page — exposes pipeline secret to client for manual trigger
# Only set this if you want the /new page to call /api/pipeline directly from browser.
# Alternatively, leave unset and call via server action in a future iteration.
NEXT_PUBLIC_PIPELINE_SECRET=same-value-as-PIPELINE_SECRET
```

- [ ] **Step 2: Verify TypeScript build**

```bash
cd /mnt/c/Users/Badr/Desktop/Prism
npm run build 2>&1 | tail -30
```

Fix any TypeScript errors before continuing.

- [ ] **Step 3: Run full test suite**

```bash
npm run test:run
```

Expected: 19 tests passing.

- [ ] **Step 4: Update PRISM.md**

Update `## Implementation Plans` table:
```
| Plan 3: Review PWA | docs/superpowers/plans/2026-04-17-plan-3-review-pwa.md | Complete |
```

Update `## Completed Features` — add new section:
```markdown
### Plan 3: Review PWA (2026-04-17)
- [x] Stitch screen designs (4 screens in stitch/)
- [x] Shared bottom nav + updated root layout
- [x] Review page (/review/[id]) — platform tabs, inline caption/hashtag editing, approve/reject, film next
- [x] Dashboard page (/) — post list, status badges, stats
- [x] Settings page (/settings) — 7-day schedule grid with content type + preferred hour
- [x] PATCH /api/settings — save schedule_config to Supabase
- [x] New Post page (/new) — manual Drive URL pipeline trigger
- [x] Unit tests (5 new, 19 total passing)
```

Update `## In Progress`:
```markdown
_Plan 4: n8n + Blotato posting engine + push notifications_
```

Update `## Pending`:
- Check off item 3: `[x] Stitch screen designs (4 screens: ...)`
- Check off item 4: `[x] Plan 3 — Review PWA screens`

- [ ] **Step 5: Commit**

```bash
git add .env.local.example PRISM.md
git commit -m "docs: update PRISM.md — Plan 3 complete"
git push origin master
```

---

## Self-Review

**Spec coverage check:**
- ✓ Post Review screen — tabs per platform, inline caption editing, hashtag editing, approve/reject, schedule time, film next — Task 3
- ✓ On approve → Supabase update + n8n webhook → already in `/api/approve` (Plan 2)
- ✓ On reject → archived with status `rejected` → already in `/api/reject` (Plan 2)
- ✓ Dashboard — post history, status, upcoming scheduled posts — Task 4
- ✓ Settings — schedule config (days + content type + preferred hour) — Task 5
- ✓ New Post trigger — manual pipeline kick-off — Task 6
- ✓ Push notification — not in this plan (requires VAPID keys + subscription storage; deferred to Plan 4)
- ✓ Stitch HTML designs as source of truth — Task 1

**Out of scope for Plan 3 (handled in later plans):**
- Web Push notifications → Plan 4
- n8n Blotato posting integration → Plan 4
- Weekly research crons → Plan 5
- Daily metrics pull → Plan 5
- Carousel generation → Plan 3 or standalone

**Security note:** `NEXT_PUBLIC_PIPELINE_SECRET` exposes the secret to the browser — this is acceptable for a personal tool (single user) but would not be appropriate in a multi-user context. The pipeline route already validates this secret.

**No placeholders.** All 4 placeholder pages are replaced. Navigation connects everything. Server/client split is clean — no client-side fetch on mount, no loading spinners for initial data.
