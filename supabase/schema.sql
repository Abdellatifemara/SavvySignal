-- SavvySignal schema
-- Run this in Supabase SQL Editor after creating the project

create table if not exists speed_posts (
  id            uuid primary key default gen_random_uuid(),
  device_id     text not null,
  hotel_name    text not null check (char_length(hotel_name) >= 2 and char_length(hotel_name) <= 100),
  place_type    text not null check (place_type in ('Hotel','Motel','Hostel','Airbnb','Resort','Other')),
  download_speed numeric(8,2) not null check (download_speed >= 0.5 and download_speed <= 2000),
  upload_speed  numeric(8,2) not null check (upload_speed >= 0.1 and upload_speed <= 1000),
  ping_ms       integer not null check (ping_ms >= 0 and ping_ms <= 9999),
  latitude      double precision not null check (latitude between -90 and 90),
  longitude     double precision not null check (longitude between -180 and 180),
  created_at    timestamptz not null default now()
);

-- Index for device feed queries
create index if not exists idx_speed_posts_device on speed_posts(device_id, created_at desc);
-- Index for global feed
create index if not exists idx_speed_posts_created on speed_posts(created_at desc);

-- Enable RLS
alter table speed_posts enable row level security;

-- Anyone can read (premium gate is enforced client-side + subscription check)
create policy "Public read"
  on speed_posts for select
  using (true);

-- Devices can only insert with their own device_id
create policy "Insert own device"
  on speed_posts for insert
  with check (device_id = current_setting('request.headers')::json->>'x-device-id');

-- Devices can only delete their own posts
create policy "Delete own posts"
  on speed_posts for delete
  using (device_id = current_setting('request.headers')::json->>'x-device-id');

-- Rate limit function: max 10 posts per device per day
create or replace function check_rate_limit()
returns trigger language plpgsql as $$
declare
  post_count integer;
begin
  select count(*) into post_count
  from speed_posts
  where device_id = new.device_id
    and created_at > now() - interval '24 hours';

  if post_count >= 10 then
    raise exception 'Rate limit exceeded: max 10 check-ins per day per device';
  end if;

  return new;
end;
$$;

create trigger enforce_rate_limit
  before insert on speed_posts
  for each row execute function check_rate_limit();
