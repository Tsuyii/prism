# Prism — Design Spec
**Date:** 2026-04-16  
**Status:** Approved  

---

## What Is Prism

Prism is a personal social media automation tool for a video editing / social media content creator. It takes one raw video or set of assets from Google Drive, passes it through an AI brain (Claude), and refracts it into 4 platform-native content pieces — one for Instagram, one for TikTok, and two for X (a text thread + a video post). The creator reviews and approves content on a mobile PWA before anything posts. n8n handles the actual publishing via Blotato. The system learns from performance data over time and recommends what to film next.

**Core value prop:** One input → four platform-native outputs → human review → auto-post.

---

## Stack

| Layer | Tool | Cost |
|---|---|---|
| Review PWA | Next.js on Vercel | Free |
| AI brain | Claude API (Sonnet) | ~$1–5/mo |
| Posting engine | n8n + Blotato | Free |
| Database | Supabase (PostgreSQL) | Free |
| Media source | Google Drive | Free |
| **Total** | | **~$1–5/mo** |

---

## System Architecture

### Layer 1 — Content Input
Google Drive folder `/SocialMedia/Queue/` with two subfolders:
- `/reels/` — drop raw video files here
- `/carousels/` — drop carousel assets here (or leave empty for AI-generated carousel)

n8n watches this folder hourly using the existing community template:  
[Upload to Instagram, TikTok & YouTube from Google Drive](https://n8n.io/workflows/2894-upload-to-instagram-tiktok-and-youtube-from-google-drive/)

On new file detection → triggers the AI pipeline via webhook.

### Layer 2 — Claude AI Brain (custom Next.js API route)

Receives file metadata + type (reel vs carousel). Runs two parallel reads:

**Trend research (weekly cron, cached in Supabase):**
- **Trends MCP** — Claude queries Google Trends natively for rising topics in editing niche
- **YouTube Data API v3** (free, 10k units/day) — top videos in "video editing" this week: titles, tags, view counts
- **PRAW** (Python Reddit API Wrapper, free) — top posts from r/VideoEditing, r/CapCut, r/premiere, r/AfterEffects, r/content_creators
- **bellingcat/tiktok-hashtag-analysis** (open source) — trending TikTok hashtags in editing niche; EnsembleData as fallback

**Your own performance data (from Supabase):**
- Instagram Graph API (free, official) — impressions, reach, saves, video views per post
- TikTok Content API (free, requires developer approval) — views, shares, profile visits per post

Claude synthesizes all of the above and produces:

**4 content pieces:**

1. **Instagram** — video/carousel + storytelling caption (2–3 sentences, CTA at end) + 15–20 hashtags (niche + broad mix)
2. **TikTok** — video + punchy 1-liner hook caption + 3–5 trending TikTok-specific hashtags
3. **X Text Thread** — reads auto-generated transcript (via OpenAI Whisper API, free tier) → extracts key tips → writes Twitter thread (pure value, no video, no hashtags)
4. **X Video Post** — same video + short conversational caption (max 280 chars, no hashtags)

**Also produces:**
- Best posting time (derived from your historical performance + niche trend timing)
- "What to film next" recommendation (synthesized from Reddit pain points + YouTube trending gaps + your own top performers)

**Carousel generation:**  
If it's a carousel day and no assets are in `/carousels/`, Claude calls nano-banana to auto-generate carousel slides from the content topic.

### Layer 3 — Review PWA (Next.js, mobile-first)

Push notification sent when content is ready (Web Push API via PWA service worker — works on Android and desktop; iOS requires iOS 16.4+ with app added to home screen). User opens app on phone.

**Screen: Post Review**
```
[ IG ]  [ TT ]  [ X thread ]  [ X video ]   ← tabs, swipe between

┌──────────────────────────────────┐
│  [video thumbnail / carousel]    │
│                                  │
│  Caption                         │
│  "Stop doing this in CapCut..."  │
│  [tap to edit inline]            │
│                                  │
│  Hashtags                        │
│  #videoediting #capcut ...       │
│  [tap to edit inline]            │
│                                  │
│  Post to:  [IG ✓] [TT ✓] [X ✓] │
│  Time: Today 6:00 PM  [change]   │
│                                  │
│  💡 Film next:                   │
│  "5 transitions nobody shows"    │
│                                  │
│  [ ✅ APPROVE ]  [ ❌ REJECT ]   │
└──────────────────────────────────┘
```

On approve → saves final content to Supabase → fires webhook to n8n with scheduled time.  
On reject → post archived in Supabase with status `rejected`, no action taken.

### Layer 4 — n8n Posting Engine

Webhook received from PWA → waits until scheduled datetime.

Uses Blotato node to post simultaneously to:
- Instagram (Reels or Carousel)
- TikTok
- X (Text thread as thread, video post as separate tweet)

On success → Supabase post status updated to `published`.

Reference n8n templates:
- [Automate content publishing via Blotato](https://n8n.io/workflows/7187-automate-content-publishing-to-tiktok-youtube-instagram-facebook-via-blotato/)
- [Schedule & auto-post videos with Google Sheets](https://n8n.io/workflows/9786-schedule-and-auto-post-videos-to-instagram-linkedin-and-tiktok-with-google-sheets/)

### Layer 5 — Performance Feedback Loop

Daily cron (Vercel Cron Job):
- Pulls metrics from Instagram Graph API and TikTok Content API for all posts published in the last 7 days
- Stores in Supabase `performance` table
- Claude reads this on next pipeline run: learns which hooks, caption styles, and hashtag combos drive best results for this specific account

---

## Scheduling

**Hybrid model:**
- User configures schedule via a Settings screen in the PWA (writes to Supabase `schedule_config` table): which days are reel days, which are carousel days
- AI picks the best time within each day based on historical performance data
- On-demand trigger available: "New Post" button in PWA manually kicks off the pipeline for any file already in Drive

---

## Supabase Schema

```sql
posts
  id, status (pending_review | approved | rejected | published | failed),
  type (reel | carousel), drive_url, scheduled_at, created_at

post_variants
  id, post_id, platform (instagram | tiktok | x_thread | x_video),
  caption, hashtags (text[]), media_url, approved (bool)

performance
  id, post_id, platform, views, likes, saves, shares, 
  impressions, reach, fetched_at

niche_trends
  id, source (youtube | reddit | tiktok | google_trends),
  topic, score, raw_data (jsonb), fetched_at

schedule_config
  id, day_of_week (0-6), content_type (reel | carousel),
  preferred_hour (0-23), active (bool)
```

---

## Research Layer — API Details

| Source | Tool | Frequency | Free? |
|---|---|---|---|
| Google Trends | Trends MCP | Weekly | Yes |
| YouTube niche | YouTube Data API v3 | Weekly | Yes (10k/day) |
| Reddit niche | PRAW (official API) | Weekly | Yes (non-commercial) |
| TikTok hashtags | bellingcat/tiktok-hashtag-analysis | Weekly | Yes (open source) |
| TikTok hashtags backup | EnsembleData | Weekly | 7-day trial then paid |
| Your IG metrics | Instagram Graph API | Daily | Yes |
| Your TikTok metrics | TikTok Content API | Daily | Yes (requires dev approval) |

X (Twitter) performance metrics excluded from v1 due to $100/mo API cost. LinkedIn excluded from v1 — no active audience, can be added in v2.

---

## What Gets Built vs What's Plug-and-Play

**Custom build:**
- Next.js Review PWA (mobile UI, push notifications, inline editing)
- Claude AI agent (caption writing, hashtag selection, trend synthesis, recommendations)
- Research scripts (PRAW, YouTube API, Trends MCP, TikTok hashtag scraper) — run as n8n Python nodes on weekly cron, results cached in Supabase
- Performance tracking cron
- Carousel generation via nano-banana

**Plug-and-play (n8n templates, minimal config):**
- Google Drive folder watcher
- Posting to IG + TikTok + X via Blotato
- Scheduling engine

---

## Design

- **Tool:** Stitch — generates HTML design files per screen, used as the source of truth during implementation
- **Responsive:** Desktop-first with full mobile support (the Review PWA is mobile-first; the dashboard/settings are desktop-first)
- **Screens to design in Stitch:**
  - Post Review (mobile) — tabs per platform, inline editing, approve/reject
  - Dashboard (desktop) — post history, performance metrics, upcoming scheduled posts
  - Settings (desktop + mobile) — schedule config, platform toggles, Google Drive folder link
  - "New Post" trigger (mobile) — manual pipeline kick-off

---

## Project Conventions

- **GitHub:** Private repo at `github.com/<user>/prism`
- **Deployment:** Vercel (connected to GitHub, auto-deploys on push to `main`)
- **CLAUDE.md:** Lives at repo root. Updated after every completed feature. Tracks: current state, completed features, pending work, env vars needed, and n8n setup instructions.

---

## Out of Scope (v1)

- LinkedIn (add in v2 for carousels specifically)
- X performance metrics (API too expensive)
- Competitor analytics via paid tools (EnsembleData, Apify) — evaluate after free tier limits hit
- Multi-account support
- Team collaboration / multiple users

---

## App Name

**Prism** — one input, refracted into platform-native outputs.
