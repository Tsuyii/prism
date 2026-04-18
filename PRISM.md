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
│   └── app/                           ← Next.js App Router
│       ├── page.tsx                   ← Dashboard
│       ├── review/[id]/page.tsx       ← Post Review (mobile PWA)
│       ├── settings/page.tsx          ← Schedule + platform config
│       ├── api/
│       │   ├── pipeline/route.ts      ← Claude AI pipeline (webhook entry)
│       │   ├── approve/route.ts       ← Approve post → trigger n8n
│       │   ├── reject/route.ts        ← Reject post
│       │   ├── cron/
│       │   │   ├── research/route.ts  ← Weekly trend research cron
│       │   │   └── metrics/route.ts   ← Daily performance pull cron
│       │   └── webhook/n8n/route.ts   ← Receive n8n status callbacks
├── lib/
│   ├── supabase.ts
│   ├── claude.ts                      ← Claude API calls
│   ├── drive.ts                       ← Google Drive OAuth + file reads
│   └── research/
│       ├── youtube.ts
│       ├── reddit.ts                  ← PRAW via n8n Python node
│       └── tiktok.ts
└── public/
    └── manifest.json                  ← PWA manifest
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

# n8n
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
  source text not null,                            -- youtube | reddit | tiktok | google_trends
  topic text not null,
  score numeric,
  raw_data jsonb,
  fetched_at timestamptz default now()
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
| Plan 4: n8n + Blotato | TBD | Not written yet |
| Plan 5: Research tab + spy cron | TBD | Not written yet |
| Plan 6: Metrics tab + performance loop | TBD | Not written yet |

---

## Completed Features

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

## In Progress

_Plan 4: n8n + Blotato posting engine + push notifications — not yet written._

---

## Pending (build order)

1. [x] **Plan 1** — Supabase schema + Next.js scaffold + Vercel deploy + PWA manifest
2. [x] Stitch screen designs (4 screens: post-review-mobile, dashboard-desktop, settings, new-post-mobile)
3. [x] **Plan 2** — Google Drive + Whisper + Claude AI pipeline + approve/reject/n8n callback routes
4. [x] **Plan 3** — Review PWA screens (Stitch designs → real UI: review, dashboard, settings)
5. [ ] **Plan 4** — n8n + Blotato posting engine + push notifications
6. [ ] **Plan 5** — Research tab UI + weekly spy cron (YouTube, TikTok, Reddit trending content with Claude analysis)
7. [ ] **Plan 6** — Metrics tab + daily performance pull + personal engagement loop
8. [ ] Carousel generation via nano-banana (standalone)
9. [ ] LinkedIn support (v2)
