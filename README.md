# Prism

> Drop a video → AI writes the captions → you approve → it posts.

Prism is a personal social media automation tool built as a mobile PWA. Upload a video to Google Drive, and Prism handles the rest: transcription, AI-generated platform-native captions for Instagram, TikTok, and X, a mobile review interface, and automated posting — all with one human approval step.

---

## How it works

```
Google Drive (video drop)
        ↓
  OpenAI Whisper (transcription)
        ↓
  Claude Sonnet (4 platform captions)
        ↓
  Supabase (store post + variants)
        ↓
  Web Push → mobile review PWA
        ↓
  Approve / edit / reject
        ↓
  Direct API posting (Instagram · TikTok · X)
```

---

## Features

- **AI pipeline** — Whisper transcription + Claude Sonnet generates captions and hashtags natively tuned for each platform
- **Mobile-first review PWA** — installable on iOS/Android, offline-capable via service worker
- **Web Push notifications** — get pinged the moment a new post is ready to review
- **Per-platform editing** — tweak caption and hashtags per platform before approving
- **Schedule config** — set preferred posting days/hours per content type
- **Research tab** — weekly trend analysis from YouTube, TikTok, and Reddit via Claude
- **Direct posting** — Instagram Graph API, TikTok Content API, X API v2 (no third-party intermediary)
- **Performance loop** *(in progress)* — pull own post metrics, feed back into Claude to tune future captions

---

## Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| AI — transcription | OpenAI Whisper |
| AI — content generation | Claude Sonnet (Anthropic SDK) |
| Media source | Google Drive (service account) |
| Automation | n8n |
| Deployment | Vercel |
| Push notifications | Web Push (VAPID) |

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                  # Dashboard
│   ├── review/[id]/page.tsx      # Post review (mobile PWA)
│   ├── settings/page.tsx         # Schedule config
│   ├── new/page.tsx              # Manual pipeline trigger
│   └── api/
│       ├── pipeline/             # Webhook: Drive URL → Whisper → Claude → Supabase
│       ├── approve/              # Approve → post to platforms
│       ├── reject/               # Reject post
│       ├── settings/             # PATCH schedule config
│       ├── push/subscribe/       # Web Push subscription management
│       ├── cron/research/        # Weekly trend research cron
│       └── webhook/n8n/          # n8n status callbacks
├── components/
│   ├── nav.tsx                   # Bottom nav (mobile) / sidebar (desktop)
│   ├── post-card.tsx             # Post list card
│   └── push-bell.tsx             # Subscribe/unsubscribe bell
├── hooks/
│   └── usePushSubscription.ts    # Web Push hook
└── lib/
    ├── claude.ts                 # Claude content generation
    ├── drive.ts                  # Google Drive download
    ├── whisper.ts                # Whisper transcription
    ├── push.ts                   # sendPushToAll() utility
    └── supabase/                 # Browser + server clients
public/
├── manifest.json                 # PWA manifest
└── sw.js                         # Service worker
```

---

## Database schema

Five tables in Supabase:

- **`posts`** — one row per video (status: pending_review → approved → published)
- **`post_variants`** — one row per platform per post (caption, hashtags, media_url)
- **`performance`** — daily metrics pull (views, likes, saves, shares, reach)
- **`niche_trends`** — weekly trend data (YouTube, Reddit, TikTok, Claude analysis)
- **`push_subscriptions`** — VAPID endpoint/key storage

---

## Environment variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude
ANTHROPIC_API_KEY=

# Google
GOOGLE_SERVICE_ACCOUNT_KEY=     # Service account JSON (base64 or raw)
GOOGLE_DRIVE_FOLDER_ID=         # Drive folder to watch

# OpenAI (Whisper)
OPENAI_API_KEY=

# Instagram Graph API
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=

# TikTok Content API
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_ACCESS_TOKEN=
TIKTOK_REFRESH_TOKEN=

# X (Twitter) OAuth 1.0a
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=

# n8n
N8N_WEBHOOK_URL=
N8N_API_KEY=

# Security
PIPELINE_SECRET=                # Secures /api/pipeline from n8n
CRON_SECRET=                    # Vercel cron auth

# Web Push (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=                  # mailto: or https: URI
```

---

## Running locally

```bash
pnpm install
pnpm dev
```

Requires a Supabase project with the schema applied and all env vars set in `.env.local`.

---

## Roadmap

- [x] Google Drive + Whisper + Claude pipeline
- [x] Mobile review PWA (installable, offline)
- [x] Web Push notifications
- [x] Direct platform posting (Instagram, TikTok, X)
- [x] Weekly trend research cron
- [ ] Perplexity real-time trend feed → richer captions
- [ ] Instagram performance feedback loop → audience-tuned captions
- [ ] Auto-repurpose top-performing posts
- [ ] Metrics tab + daily performance pull
- [ ] Carousel generation
- [ ] LinkedIn support
