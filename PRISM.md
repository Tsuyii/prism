# Prism — Claude Session Reference

> Update this file after every completed feature. It is the source of truth for project state across sessions.

---

## What Is Prism

Personal social media automation tool. Drops a video into Google Drive → AI (Claude) generates 4 platform-native content pieces (IG, TikTok, X thread, X video) → you review + approve on a mobile PWA → n8n posts via Blotato automatically.

**Core value prop:** One input → four platform-native outputs → human review → auto-post.

**Design spec:** `docs/superpowers/specs/2026-04-16-prism-design.md`

---

## Stack

| Layer | Tool |
|---|---|
| Review PWA + API | Next.js (App Router) on Vercel |
| AI brain | Claude API (Sonnet) via Anthropic SDK |
| Posting engine | n8n + Blotato |
| Database | Supabase (PostgreSQL) |
| Media source | Google Drive |
| Design source of truth | Stitch HTML files in `stitch/` |

---

## Project Structure (target)

```
prism/
├── CLAUDE.md                          ← this file
├── stitch/                            ← Stitch HTML design files per screen
│   ├── post-review-mobile.html
│   ├── dashboard-desktop.html
│   ├── settings.html
│   └── new-post-mobile.html
├── docs/
│   └── superpowers/specs/
│       └── 2026-04-16-prism-design.md
├── src/
│   ├── app/                           ← Next.js App Router
│   │   ├── page.tsx                   ← Dashboard
│   │   ├── review/[id]/page.tsx       ← Post Review (mobile PWA)
│   │   ├── settings/page.tsx          ← Schedule + platform config
│   │   ├── new/page.tsx               ← Manual pipeline trigger
│   │   └── api/
│   │       ├── pipeline/route.ts      ← Claude AI pipeline (webhook entry)
│   │       ├── approve/route.ts       ← Approve post → trigger n8n
│   │       ├── reject/route.ts        ← Reject post
│   │       ├── settings/route.ts      ← PATCH schedule config
│   │       ├── push/
│   │       │   └── subscribe/route.ts ← POST/DELETE push subscriptions
│   │       ├── cron/
│   │       │   ├── research/route.ts  ← Weekly trend research cron (TODO)
│   │       │   └── metrics/route.ts   ← Daily performance pull cron (TODO)
│   │       └── webhook/n8n/route.ts   ← Receive n8n status callbacks
│   ├── components/
│   │   ├── nav.tsx                    ← Shared bottom nav / sidebar
│   │   ├── post-card.tsx              ← Post list card
│   │   └── push-bell.tsx              ← Bell icon subscribe/unsubscribe button
│   ├── hooks/
│   │   └── usePushSubscription.ts     ← Web Push subscribe/unsubscribe hook
│   └── lib/
│       ├── supabase/
│       │   ├── client.ts              ← Browser Supabase client
│       │   ├── server.ts              ← Server Supabase client (service role)
│       │   └── types.ts               ← Generated + legacy type aliases
│       ├── claude.ts                  ← Claude API content generation
│       ├── drive.ts                   ← Google Drive service account download
│       ├── whisper.ts                 ← OpenAI Whisper transcription
│       ├── push.ts                    ← Web Push sendPushToAll() utility
│       └── utils.ts                   ← cn, formatScheduledTime, platformLabel
└── public/
    ├── manifest.json                  ← PWA manifest
    └── sw.js                          ← Service worker (cache + push handler)
```

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude API
ANTHROPIC_API_KEY=

# Google APIs
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_SERVICE_ACCOUNT_KEY=           # Service account JSON for Drive download
GOOGLE_DRIVE_FOLDER_ID=           # ID of /SocialMedia/Queue/ folder
YOUTUBE_API_KEY=

# OpenAI (Whisper for transcription)
OPENAI_API_KEY=

# Instagram Graph API
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=

# TikTok Content API
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_ACCESS_TOKEN=
TIKTOK_REFRESH_TOKEN=             # Used to auto-refresh 24h access tokens

# X (Twitter) — OAuth 1.0a (permanent, no expiry)
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=

# n8n (only needed for Google Drive trigger — no longer used for posting)
N8N_WEBHOOK_URL=                  # URL of n8n pipeline webhook
N8N_API_KEY=

# Pipeline security (n8n sends this as Authorization: Bearer <value>)
PIPELINE_SECRET=                  # Secures /api/pipeline webhook from n8n

# Vercel Cron (set in vercel.json)
CRON_SECRET=                      # validate cron requests are from Vercel

# Web Push (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=     # VAPID public key (exposed to browser)
VAPID_PRIVATE_KEY=                # VAPID private key (server only)
VAPID_SUBJECT=                    # mailto: or https: contact URI for VAPID
```

---

## n8n Setup

1. Import template: [Upload to Instagram, TikTok & YouTube from Google Drive](https://n8n.io/workflows/2894-upload-to-instagram-tiktok-and-youtube-from-google-drive/)
2. Import template: [Automate content publishing via Blotato](https://n8n.io/workflows/7187-automate-content-publishing-to-tiktok-youtube-instagram-facebook-via-blotato/)
3. Configure Google Drive OAuth credentials
4. Configure Blotato API key (connect IG, TikTok, X accounts in Blotato dashboard)
5. Set webhook URL → copy into `N8N_WEBHOOK_URL` env var

---

## Supabase Schema

```sql
-- Run in Supabase SQL editor

create table posts (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending_review',  -- pending_review | approved | rejected | published | failed
  type text not null,                              -- reel | carousel
  drive_url text not null,
  scheduled_at timestamptz,
  created_at timestamptz default now()
);

create table post_variants (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  platform text not null,                          -- instagram | tiktok | x_thread | x_video
  caption text,
  hashtags text[],
  media_url text,
  approved boolean default false
);

create table performance (
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

create table niche_trends (
  id uuid primary key default gen_random_uuid(),
  source text not null,                            -- youtube | reddit | tiktok | google_trends | claude
  topic text not null,
  score numeric,
  raw_data jsonb,
  fetched_at timestamptz default now()
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

create table schedule_config (
  id uuid primary key default gen_random_uuid(),
  day_of_week int not null,                        -- 0=Sun, 6=Sat
  content_type text not null,                      -- reel | carousel
  preferred_hour int not null,                     -- 0-23
  active boolean default true
);
```

---

## Execution Method

**Subagent-driven development** — always use `superpowers:subagent-driven-development` when executing plans. One fresh subagent per task, review between tasks.

**Push policy — push every task to master:**
After each task passes spec + code quality review, commit and push directly to master. This ensures every task gets a GitHub contribution and triggers a Vercel deploy.

---

## Implementation Plans

| Plan | File | Status |
|---|---|---|
| Plan 1: Foundation | `docs/superpowers/plans/2026-04-16-plan-1-foundation.md` | Complete |
| Plan 2: Drive + AI Pipeline | `docs/superpowers/plans/2026-04-17-plan-2-drive-ai-pipeline.md` | Complete |
| Plan 3: Review PWA | `docs/superpowers/plans/2026-04-17-plan-3-review-pwa.md` | Complete |
| Plan 4: Push Notifications | `docs/superpowers/plans/2026-04-19-plan-4-push-notifications.md` | Complete |
| Plan 5: Research tab + spy cron | `docs/superpowers/plans/2026-04-19-plan-5-research-cron.md` | Complete |
| Plan 6: Direct platform posting (replace Blotato) | `docs/superpowers/plans/2026-04-19-plan-6-direct-posting.md` | Complete |
| Plan 7: Intelligence Upgrade | `docs/superpowers/plans/2026-04-22-plan-7-intelligence-upgrade.md` | Complete |
| Plan 8: UI Polish | TBD | Not written yet |

---

## Completed Features

### Plan 4: Push Notifications (2026-04-19)
- [x] `web-push` v3.6.7 installed, VAPID keys generated
- [x] `push_subscriptions` table in Supabase (endpoint unique, p256dh, auth)
- [x] `src/lib/push.ts` — `sendPushToAll()` utility (410 cleanup, Promise.allSettled)
- [x] `POST/DELETE /api/push/subscribe` — save/remove push subscriptions
- [x] Pipeline fires push notification after content variants saved (non-fatal, dynamic import)
- [x] `src/hooks/usePushSubscription.ts` — subscribe/unsubscribe hook with permission flow
- [x] Bell icon button in dashboard header (yellow when subscribed, outline when not)
- [x] Unit tests (10 new, 30 total passing)

### Plan 3: Review PWA (2026-04-18)
- [x] Stitch screen designs (4 HTML files in `stitch/`: post-review-mobile, dashboard-desktop, settings, new-post-mobile)
- [x] Shared bottom nav (`src/components/nav.tsx`) — mobile bottom bar + md sidebar, violet active state, safe-area env fix, viewport-fit cover
- [x] Root layout updated (`src/app/layout.tsx`) — Nav wired in, bg-zinc-950, proper body/main flex structure
- [x] Review page `/review/[id]` — platform tabs, inline caption/hashtag editing, approve/reject, schedule time, film next
- [x] Dashboard page `/` — post list, status badges, stats
- [x] Settings page `/settings` + `PATCH /api/settings` — 7-day schedule grid with content type + preferred hour, input validation
- [x] New Post page `/new` — manual Drive URL pipeline trigger
- [x] Unit tests (5 new, 20 total passing)

### Plan 2: Drive + AI Pipeline (2026-04-17)
- [x] Google Drive client (service account, file download)
- [x] Whisper transcription (25 MB limit guard, multi-format)
- [x] Claude Sonnet content generation (cached system prompt, Zod structured output)
- [x] 4 platform variants: Instagram, TikTok, X Thread, X Video
- [x] Pipeline webhook `/api/pipeline` (n8n → Whisper → Claude → Supabase)
- [x] Approve route `/api/approve` (updates Supabase + fires n8n webhook)
- [x] Reject route `/api/reject`
- [x] n8n callback `/api/webhook/n8n` (published/failed status update)
- [x] Unit tests (6 new, 14 total passing)

### Plan 1: Foundation (2026-04-17)
- [x] Next.js 15 scaffold (App Router, TypeScript, Tailwind, Turbopack)
- [x] Supabase clients (browser + server, typed with exhaustive Record checks)
- [x] Database schema applied (5 tables, seeded schedule)
- [x] Shared utilities (cn, formatScheduledTime, platformLabel)
- [x] Placeholder pages: dashboard (/), review (/review/[id]), settings (/settings)
- [x] PWA manifest + service worker (GET-only fetch guard, safe push handler, split icon purposes)
- [x] Live Vercel deployment (env vars set, auto-deploy on push)
- [x] Vitest test suite (8 passing tests)

---

## Design Variants (pending selection)

All screens live in Stitch project `12320735979743494453`. Tell Claude which to implement.

---

### Dashboard — Desktop (14 variants)

| # | Screen ID | Style |
|---|-----------|-------|
| D1 | `e784ffd0a1c34c6ead7ea01c71b47181` | Editorial Powerhouse — wide sidebar, hero stats, magazine cards |
| D2 | `b0d3f2a23f0d4f438cfe8bde5ea5ae13` | Command Center — 3-panel split, obsidian + dark orchid layers |
| D3 | `346541e07e594a1ba10ea908b9fe3779` | Modern Minimalist Studio — top nav, 3-col grid, violet Pulse bar |
| D4 | `614187a3eea3452fb211171940848f96` | Base Dashboard Desktop |
| D5 | `0c05ccd466bf4f8291e056aada4551dc` | Cinematic Command — horizontal filmstrip queue, oversized stats |
| D6 | `3ad9fc08ab184518a4a2599447de7f35` | Multi-Channel Orchestrator — 3 vertical platform lanes |
| D7 | `67e90c4b98594b14bb18ab1a67db8cbe` | Editorial Minimalism — centered timeline, ticker stats bar |
| D8 | `edde7d49bafe4bd0b1ff3d02a1dd1e0c` | Visual Bento — immersive card grid, media blurs |
| D9 | `13c996b39ef44d23a18353d80ba6c1bd` | Split-Screen Workspace — 30% insights panel + 70% feed |
| D10 | `386aad37ec754d2c910d4bffec17073a` | Midnight Editorial Gallery — dynamic masonry grid |
| D11 | `837a1953c6ad471a8bde61217394d749` | Cinematic Focus — full-bleed hero post + slim right queue |
| D12 | `161d169aa6d642d9bbd9dc8b70aaef26` | Terminal Noir — command-line monochrome, violet accents only |
| D13 | `5ff2995425b740279ca2a8640d8eddb1` | Temporal Flow — horizontal timeline + vertical content queue |
| D14 | `3af7db2e01bb4efb9c16fb18b2ea46b1` | Impact-First — giant typographic stats top half |

---

### Dashboard — Mobile (10 variants)

| # | Screen ID | Style |
|---|-----------|-------|
| M1 | `e2e06a38476a4154aec4e1b80cf0c074` | Base Mobile Dashboard — stats strip, post queue, FAB |
| M2 | `8945a3c883a04753bd2fa5e8412338c2` | Review Deck — swipeable full-screen card stack |
| M3 | `9fd0cb8055f54bc498c27e2cca8d6725` | Data-Dense Utility — compact neon-dot rows, pull-to-reveal stats |
| M4 | `bda8e426aa6f4dac8c472a6d4af7d5fe` | Cinematic Spotlight — full-bleed hero + draggable bottom sheet |
| M5 | `6b47c0a4aa1c4e17bfcc69f0012c764c` | Timeline-First — week-strip calendar + chronological queue |
| M6 | `ae440e1dc48946969a8b3cedfd38d3ee` | Task-Centric Launcher — 2×2 action grid with glowing stats |
| M7 | `10bf43404a7d4e8187463d982e0d0c2f` | Split-Screen Analytical — stats chart top / card carousel bottom |
| M8 | `2a278dedc96a46e993ba0886b07f9020` | Grouped Notification Feed — inbox grouped by platform |
| M9 | `77985a88c2c442b182049a33e95b2451` | Glassmorphic Card Grid — 2-col translucent grid |
| M10 | `9ffba1c648eb455595327b807dcf1fb5` | Platform Status Board — full-width color-coded platform rows |

---

### Review Post — Mobile (4 variants)

| # | Screen ID | Style |
|---|-----------|-------|
| R1 | `e494fbaba2914a709b0fe61c25afbb16` | Base Review Post Mobile |
| R2 | `27b118b65caf4a0b8b72be4f4510cd2e` | Atmospheric Immersion — violet nebula, glassmorphism, floating Approve |
| R3 | `821cbf7de07a48cca238cada40d427f9` | Cyber-Editorial — true black, violet glows, glass tabs |
| R4 | `4b07d05db25c419eae2c46071d3757e6` | Bold Brutalist — neon-violet, ultra-large caption, radial Approve |

---

### Settings — Desktop (6 variants)

| # | Screen ID | Style |
|---|-----------|-------|
| SD1 | `1d0919d5e6184cec8bbd937ea995c6f8` | Base Settings Desktop |
| SD2 | `6227a7a3adba4218aada0e11a41c7e6c` | Full-bleed horizontal timeline visualizer, glassmorphic energy orbs |
| SD3 | `f52a734330bc4852914b4d3df5f2d3db` | Asymmetric Command Center — masonry grid + floating glass sidebar |
| SD4 | `c2e9a51fc8714535acb02772f32f2a7c` | Focused Card Stack — expandable overlapping day deck |
| SD5 | `fd1c76186ab84b7b84e840ce4f64b646` | Bento Box Matrix — glass containers of varying sizes |
| SD6 | `b4b8c9a49b144f9e9ca2a26713167c2f` | Typography-First — massive glowing day labels, luxury editorial |

---

### Settings — Mobile (6 variants)

| # | Screen ID | Style |
|---|-----------|-------|
| SM1 | `e042ac2170d74d63a3317d42f2cc1cbe` | Base Settings Mobile |
| SM2 | `e1b6be836eec4248b125a591cea1166d` | Full-Screen Weekly Heat-Map — 24h × 7 day glassmorphic grid |
| SM3 | `89f1d14a57234d6db5b73ef238652abe` | Gesture Picker — floating day pills + circular time dial bottom sheet |
| SM4 | `2adb9080212c43f9a91d8d99ecb7e61c` | Magazine Editorial — oversized serif day labels, flowing layout |
| SM5 | `b15e1269ebc24cf9bb7f05a03f61d171` | Neon-Minimalist — pure black canvas, glowing toggles, monospace |
| SM6 | `d1f2f8c1088b4448a8bc15b4d7b0d27c` | Spotify-Style — scrollable rounded preference cards |

---

### New Post — Mobile (1 variant)

| # | Screen ID | Style |
|---|-----------|-------|
| NP1 | `2c7f68a8c42e48a1a58e6a1c8224bace` | Base New Post Mobile |

---

## Session Progress (2026-04-21 — UI Design Session)

### Stitch UI generation (2026-04-21)
- Generated 41 new screen variants across all screens in Stitch project `12320735979743494453`
- All variants catalogued in the **Design Variants** section above with screen IDs and style descriptions
- Organised by category: Dashboard Desktop (14), Dashboard Mobile (10), Review Post Mobile (4), Settings Desktop (6), Settings Mobile (6), New Post Mobile (1)
- **Next session:** Pick variants to implement — tell Claude which IDs (e.g. "D11, M4, SM5") and it will pull the HTML and build them out. Manually arrange on Stitch canvas if needed (MCP has no move tool).

---

## Session Progress (2026-04-21)

### Bugs fixed
- `PLATFORMS` exported from `'use client'` file and imported in server component → moved to `lib/utils.ts`, removed `.in()` filter from server query
- `PIPELINE_SECRET` had quotes + `\n` in `.env.local` → cleaned up, added `NEXT_PUBLIC_PIPELINE_SECRET` to Vercel
- `CRON_SECRET` had whitespace in Vercel env → removed and re-added clean
- Cron schedule `*/15 * * * *` blocked Hobby plan deploy → changed to `0 9 * * *`
- Approve/Reject buttons fixed at bottom overlapping video → moved inline into scroll flow

### Features added
- Google Drive video embedded in review page via `/preview` iframe
- Full end-to-end pipeline tested and working on Vercel: Drive URL → Whisper → Claude → review page

### Env vars status
- `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_DRIVE_FOLDER_ID`, `PIPELINE_SECRET`, `NEXT_PUBLIC_PIPELINE_SECRET`, `CRON_SECRET` — all set locally and on Vercel
- Still missing: `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`, `TIKTOK_*`, `X_*`, `YOUTUBE_API_KEY`, `PERPLEXITY_API_KEY`

---

## Next Session — Intelligence Upgrade

Build order decided (2026-04-21):

1. **Perplexity trend research** — rewrite `/api/cron/research` to query Perplexity API for real-time niche trend data (what hooks/formats are performing in the editing niche this week). Store in `niche_trends`. Feeds into Claude at pipeline time. Needs `PERPLEXITY_API_KEY`.
2. **Instagram performance feedback loop** — pull own post metrics via Graph API → store in `performance` table → Claude uses this to learn what works for your specific audience. Needs `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_BUSINESS_ACCOUNT_ID`.
3. **Auto-repurpose top posts** — dashboard button to take your top 3 posts and have Claude rewrite them with fresh hooks as new content.

**Why:** Captions are currently generic because Claude has no niche context. With Perplexity data + own Instagram performance, captions become trend-aware and audience-tuned.

**Cost:** ~$0 added (Perplexity: fractions of a cent/month for 4 weekly calls).

---

## In Progress

_Social platform keys (Instagram, TikTok, X) still needed before posting works. Pipeline fully tested end-to-end._

---

## Pending (build order)

1. [x] **Plan 1** — Supabase schema + Next.js scaffold + Vercel deploy + PWA manifest
2. [x] Stitch screen designs (4 screens: post-review-mobile, dashboard-desktop, settings, new-post-mobile)
3. [x] **Plan 2** — Google Drive + Whisper + Claude AI pipeline + approve/reject/n8n callback routes
4. [x] **Plan 3** — Review PWA screens (Stitch designs → real UI: review, dashboard, settings)
5. [x] **Plan 4** — Push notifications (VAPID, push_subscriptions table, subscribe route, pipeline trigger, bell button)
6. [x] **Plan 5** — Research tab UI + weekly spy cron (YouTube, TikTok, Reddit trending content with Claude analysis)
7. [x] **Plan 6** — Direct platform posting (Instagram Graph API, TikTok Content API, X API v2 — replaces Blotato)
8. [ ] **Plan 7** — Perplexity trend research + Instagram feedback loop + auto-repurpose (intelligence upgrade)
9. [ ] **Plan 8** — Metrics tab + daily performance pull
10. [ ] Carousel generation via nano-banana (standalone)
11. [ ] LinkedIn support (v2)
