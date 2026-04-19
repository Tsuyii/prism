# Plan 4: Push Notifications + n8n/Blotato Wiring

**Date:** 2026-04-19  
**Status:** Ready to execute

---

## Goal

When the AI pipeline finishes generating content, the creator gets a push notification on their phone with a direct link to the review page. Tapping it opens `/review/[id]` instantly.

Also wires up the remaining n8n env vars and documents the Blotato setup steps so posting actually works end-to-end.

---

## Scope

### What we build (code)
1. **VAPID key generation** — one-time script, keys stored in env vars
2. **`push_subscriptions` table** — Supabase table for storing Web Push subscriptions
3. **`POST /api/push/subscribe`** — saves a push subscription from the browser
4. **`DELETE /api/push/subscribe`** — removes subscription (unsubscribe)
5. **`lib/push.ts`** — `sendPushToAll(postId, title, body)` utility using `web-push`
6. **Pipeline trigger** — call `sendPushToAll` at end of `/api/pipeline` after variants are saved
7. **Client-side subscription** — `usePushSubscription` hook + subscribe button in dashboard header

### What we configure (n8n/Blotato)
- Document the two n8n templates to import
- Show what payload `/api/approve` already sends to n8n
- List env vars still needed: `N8N_WEBHOOK_URL`, `N8N_API_KEY`

---

## Tasks

### Task 1 — Install web-push and generate VAPID keys

```bash
npm install web-push
npm install --save-dev @types/web-push
```

Generate keys (run once, save output):
```bash
npx web-push generate-vapid-keys
```

Add to `.env.local` and Vercel env vars:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:kamine6666@gmail.com
```

**Files changed:** `package.json`, `.env.local` (not committed), Vercel dashboard

---

### Task 2 — Add `push_subscriptions` table to Supabase

Run in Supabase SQL editor:

```sql
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);
```

Also update `lib/supabase/types.ts` to include the new table type.

**Files changed:** `lib/supabase/types.ts`

---

### Task 3 — `lib/push.ts` utility

Create `src/lib/push.ts`:

```ts
import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/server'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export async function sendPushToAll(payload: {
  title: string
  body: string
  postId: string
}) {
  const supabase = createServiceClient()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')

  if (!subs?.length) return

  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      ).catch((err) => {
        // 410 Gone = subscription expired, clean it up
        if (err.statusCode === 410) {
          supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      })
    )
  )
}
```

**Files changed:** `src/lib/push.ts` (new)

---

### Task 4 — `/api/push/subscribe` route

Create `src/app/api/push/subscribe/route.ts`:

- `POST` — upserts subscription (endpoint + p256dh + auth keys) into `push_subscriptions`
- `DELETE` — removes subscription by endpoint

Both routes return `200` on success, `400` on missing fields.

**Files changed:** `src/app/api/push/subscribe/route.ts` (new)

---

### Task 5 — Trigger push from pipeline

At the end of `/api/pipeline/route.ts`, after variants are saved successfully, add:

```ts
// Fire push notification (non-fatal if push fails)
try {
  const { sendPushToAll } = await import('@/lib/push')
  await sendPushToAll({
    title: 'Prism — Content ready',
    body: `${contentType === 'reel' ? 'Reel' : 'Carousel'} is ready to review`,
    postId: post.id,
  })
} catch (err) {
  console.warn('[pipeline] Push notification failed (non-fatal):', err)
}
```

**Files changed:** `src/app/api/pipeline/route.ts`

---

### Task 6 — Client-side push subscription hook + button

Create `src/hooks/usePushSubscription.ts`:
- Checks `'serviceWorker' in navigator && 'PushManager' in window`
- Gets existing subscription from service worker registration
- `subscribe()` — calls `Notification.requestPermission()`, then `registration.pushManager.subscribe()` with `applicationServerKey` from `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, POSTs to `/api/push/subscribe`
- `unsubscribe()` — calls `sub.unsubscribe()`, DELETEs from `/api/push/subscribe`
- Returns `{ subscribed, subscribe, unsubscribe, supported }`

Add a small bell icon button to the dashboard header (`src/app/page.tsx`) that calls `subscribe()` when clicked. Shows filled bell when subscribed, outline when not.

**Files changed:** `src/hooks/usePushSubscription.ts` (new), `src/app/page.tsx`

---

### Task 7 — Unit tests

Add tests to `src/__tests__/`:
- `push-subscribe-route.test.ts` — POST saves subscription, DELETE removes it, 400 on missing fields
- `push-utility.test.ts` — `sendPushToAll` calls webpush for each subscription, cleans up 410 errors

Target: 6+ new tests, all passing.

**Files changed:** `src/__tests__/push-subscribe-route.test.ts` (new), `src/__tests__/push-utility.test.ts` (new)

---

## n8n / Blotato Setup (configuration, not code)

### What `/api/approve` already sends to n8n

```json
{
  "postId": "<uuid>",
  "scheduledAt": "2026-04-20T18:00:00Z",
  "variants": [
    { "platform": "instagram", "caption": "...", "hashtags": [...], "media_url": null },
    { "platform": "tiktok", "caption": "...", "hashtags": [...], "media_url": null },
    { "platform": "x_thread", "caption": "tweet1\n\n---\n\ntweet2", "hashtags": [] },
    { "platform": "x_video", "caption": "...", "hashtags": [] }
  ]
}
```

### n8n templates to import

1. [Upload to Instagram, TikTok & YouTube from Google Drive](https://n8n.io/workflows/2894)  
   → Watches `/SocialMedia/Queue/` hourly → calls `/api/pipeline` webhook

2. [Automate content publishing via Blotato](https://n8n.io/workflows/7187)  
   → Receives `/api/approve` webhook → schedules posting via Blotato

### Env vars still needed

```
N8N_WEBHOOK_URL=        # URL of the Blotato posting workflow webhook
N8N_API_KEY=            # Optional: if n8n instance requires auth
```

---

## Env Vars Added This Plan

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:kamine6666@gmail.com
```

---

## Definition of Done

- [ ] `web-push` installed
- [ ] VAPID keys in env (local + Vercel)
- [ ] `push_subscriptions` table in Supabase
- [ ] `lib/push.ts` utility working
- [ ] `/api/push/subscribe` POST + DELETE routes
- [ ] Pipeline fires push after content saved
- [ ] Dashboard has subscribe/unsubscribe bell button
- [ ] 6+ new unit tests passing
- [ ] PRISM.md updated with Plan 4 complete
