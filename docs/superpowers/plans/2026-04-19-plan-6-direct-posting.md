# Plan 6 — Direct Platform Posting (Replace Blotato)

**Goal:** Remove Blotato + n8n from the posting flow. Post to Instagram, TikTok, and X directly from Prism via their native APIs. Saves ~$19–39/mo. Token refresh handled automatically via Supabase.

**Status:** Not started

---

## Architecture Change

**Before:**
```
/api/approve → n8n webhook → Blotato → Instagram / TikTok / X
```

**After:**
```
/api/approve → mark approved + set scheduled_at
/api/cron/post (every 15 min) → fetch due posts → post to each platform directly
```

Scheduling is handled by a new Vercel cron that checks every 15 minutes for approved posts where `scheduled_at <= now()`.

---

## New Env Vars Required

```bash
# X (Twitter) — OAuth 1.0a (permanent, no expiry)
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=

# Instagram — already planned, token refreshes every 60 days
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=

# TikTok — already planned, auto-refreshed via refresh token
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_ACCESS_TOKEN=
TIKTOK_REFRESH_TOKEN=
```

---

## Tasks

### Task 1 — Supabase migration: `platform_tokens` table
**File:** Supabase SQL (apply via MCP or dashboard)

```sql
create table platform_tokens (
  platform text primary key,          -- instagram | tiktok | x
  access_token text not null,
  refresh_token text,                  -- null for X (OAuth 1.0a never expires)
  expires_at timestamptz               -- null for X
);
```

Seed initial tokens from env vars on first use (done inside the posting libs, not a migration seed).

---

### Task 2 — `src/lib/post-instagram.ts`
Instagram Graph API direct posting.

**Responsibilities:**
- Accept `{ caption, mediaUrl, platform: 'instagram' }` 
- POST to `/{ig-user-id}/reels` to create a media container
- Poll until container status = `FINISHED`
- POST to `/{ig-user-id}/media_publish` to publish
- Auto-refresh token if < 7 days from expiry (call `/refresh_access_token` endpoint, store new token in `platform_tokens`)

**Key API endpoints:**
- `https://graph.facebook.com/v21.0/{id}/reels` — upload reel
- `https://graph.facebook.com/v21.0/{id}/media_publish` — publish
- `https://graph.facebook.com/v21.0/refresh_access_token` — refresh

---

### Task 3 — `src/lib/post-x.ts`
X API v2 direct posting.

**Responsibilities:**
- Accept `{ text }` (thread text or video caption)
- POST to `https://api.twitter.com/2/tweets` with OAuth 1.0a signature
- Use `twitter-api-v2` npm package (handles OAuth signing)
- For X Thread variant: split on `\n\n` and post as a reply chain

**No token refresh needed** — OAuth 1.0a tokens are permanent.

---

### Task 4 — `src/lib/post-tiktok.ts`
TikTok Content Posting API.

**Responsibilities:**
- Accept `{ caption, videoUrl }`
- POST to `https://open.tiktokapis.com/v2/post/publish/video/init/` — init upload
- Upload video bytes to the upload URL returned
- POST to publish endpoint
- Auto-refresh: exchange `TIKTOK_REFRESH_TOKEN` for new access token when expired (24h TTL), store in `platform_tokens`

**Graceful degradation:** If TikTok app review is pending, log a warning and skip — don't fail the whole post.

---

### Task 5 — `src/lib/platform-tokens.ts`
Token management utility used by all three posting libs.

```ts
getToken(platform: 'instagram' | 'tiktok' | 'x'): Promise<string>
saveToken(platform, accessToken, refreshToken?, expiresAt?): Promise<void>
```

- On first call: reads from env vars, seeds `platform_tokens` table
- On subsequent calls: reads from `platform_tokens`, refreshes if expired

---

### Task 6 — `src/app/api/cron/post/route.ts`
New Vercel cron route — runs every 15 minutes.

**Logic:**
1. Query Supabase for posts where `status = 'approved'` AND `scheduled_at <= now()`
2. For each post, fetch its `post_variants`
3. Call `postInstagram()`, `postX()`, `postTikTok()` in parallel (Promise.allSettled)
4. On success: update post status to `published`
5. On failure: update post status to `failed`, log error per platform

**Security:** Validate `Authorization: Bearer <CRON_SECRET>` header.

---

### Task 7 — Update `src/app/api/approve/route.ts`
Remove the n8n webhook block entirely. The approve route now only:
- Validates postId
- Updates post status to `approved` + sets `scheduled_at`
- Marks all variants `approved: true`
- Returns `{ success: true }`

If `scheduledAt` is null or in the past, the cron will pick it up within 15 minutes.

---

### Task 8 — Update `vercel.json`
Add the new posting cron:

```json
{
  "path": "/api/cron/post",
  "schedule": "*/15 * * * *"
}
```

---

### Task 9 — Install `twitter-api-v2`
```bash
npm install twitter-api-v2
```

---

## What Happens to n8n

n8n was used for two things:
1. **Google Drive trigger** → watches folder, fires `/api/pipeline` webhook
2. **Posting** → called by `/api/approve`, forwarded to Blotato

After this plan, n8n is only needed for (1). If you want to remove n8n entirely later, replace the Drive trigger with a Vercel cron that polls the Drive folder — but that's a separate plan. For now, keep n8n for the trigger only.

---

## Test Coverage

Each posting lib gets unit tests with mocked fetch:
- `post-instagram.test.ts` — happy path, token refresh path, container poll timeout
- `post-x.test.ts` — happy path, thread splitting
- `post-tiktok.test.ts` — happy path, graceful skip when not approved
- `platform-tokens.test.ts` — first-run seed, refresh logic
- `cron/post` route test — due posts fetched and dispatched, status updated

---

## Rollout

1. Build + test all lib files (Tasks 2–5)
2. Build cron route (Task 6)
3. Update approve route (Task 7)
4. Update vercel.json + install package (Tasks 8–9)
5. Add env vars to Vercel dashboard
6. Deploy + manually trigger `/api/cron/post` to verify end-to-end

---

## Cost After This Plan

| Before | After |
|--------|-------|
| Blotato $19/mo | $0 |
| n8n cloud $20/mo (if applicable) | n8n still needed for Drive trigger only — consider self-host |
| **Total saving** | **$19–39/mo** |
