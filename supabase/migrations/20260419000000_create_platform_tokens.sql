create table platform_tokens (
  platform text primary key,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz
);
