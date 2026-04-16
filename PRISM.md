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

# Vercel Cron (set in vercel.json)
CRON_SECRET=                      # validate cron requests are from Vercel
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

## Completed Features

_None yet — project initialized._

---

## In Progress

_Nothing started yet._

---

## Pending (build order)

1. [ ] Supabase schema setup
2. [ ] Next.js project scaffold + Vercel deploy
3. [ ] Stitch screen designs (4 screens)
4. [ ] Google Drive OAuth + folder watcher integration
5. [ ] Claude AI pipeline (caption + hashtag generation for all 4 variants)
6. [ ] Whisper transcription (for X thread generation)
7. [ ] Review PWA — post review screen (mobile)
8. [ ] Review PWA — settings screen
9. [ ] Review PWA — dashboard screen
10. [ ] n8n workflow setup (Drive watcher + Blotato posting)
11. [ ] Push notifications (Web Push API + service worker)
12. [ ] Weekly research cron (YouTube + Reddit + TikTok hashtags)
13. [ ] Daily performance pull cron (IG + TikTok metrics)
14. [ ] Carousel generation via nano-banana
15. [ ] LinkedIn support (v2)
