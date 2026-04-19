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

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

-- Seed default schedule (Mon/Wed/Fri = reels at 6pm, Tue/Thu = carousels at 12pm)
insert into schedule_config (day_of_week, content_type, preferred_hour) values
  (1, 'reel', 18),
  (2, 'carousel', 12),
  (3, 'reel', 18),
  (4, 'carousel', 12),
  (5, 'reel', 18)
on conflict do nothing;
