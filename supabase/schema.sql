-- SavvySignal schema v2
-- Run this in Supabase SQL Editor

-- Enable PostGIS for spatial queries
create extension if not exists postgis;

-- All hotels/accommodations on earth (seeded from OSM, read-only)
create table if not exists places (
  id          bigserial primary key,
  osm_id      bigint unique,
  name        text not null,
  latitude    double precision not null,
  longitude   double precision not null,
  country     text,
  city        text,
  location    geography(Point, 4326) generated always as (
                st_makepoint(longitude, latitude)::geography
              ) stored
);

-- Spatial index for fast "find nearby" queries
create index if not exists idx_places_location on places using gist(location);
create index if not exists idx_places_name on places(name);

-- Speed reports posted by users
create table if not exists speed_posts (
  id            uuid primary key default gen_random_uuid(),
  device_id     text not null,
  place_id      bigint references places(id) on delete set null,
  hotel_name    text not null check (char_length(hotel_name) >= 2 and char_length(hotel_name) <= 100),
  download_speed numeric(8,2) not null check (download_speed >= 0.5 and download_speed <= 2000),
  upload_speed  numeric(8,2) not null check (upload_speed >= 0.1 and upload_speed <= 1000),
  ping_ms       integer not null check (ping_ms >= 0 and ping_ms <= 9999),
  latitude      double precision not null,
  longitude     double precision not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_speed_posts_device on speed_posts(device_id, created_at desc);
create index if not exists idx_speed_posts_place on speed_posts(place_id);
create index if not exists idx_speed_posts_created on speed_posts(created_at desc);

-- RLS
alter table places enable row level security;
alter table speed_posts enable row level security;

create policy "Anyone can read places" on places for select using (true);
create policy "Public read posts" on speed_posts for select using (true);
create policy "Insert own posts" on speed_posts for insert with check (true);
create policy "Delete own posts" on speed_posts for delete using (device_id = current_setting('request.headers', true)::json->>'x-device-id');

-- Rate limit: max 20 posts per device per day
create or replace function check_rate_limit()
returns trigger language plpgsql as $$
declare post_count integer;
begin
  select count(*) into post_count
  from speed_posts
  where device_id = new.device_id
    and created_at > now() - interval '24 hours';
  if post_count >= 20 then
    raise exception 'Rate limit: max 20 check-ins per day';
  end if;
  return new;
end;
$$;

create trigger enforce_rate_limit
  before insert on speed_posts
  for each row execute function check_rate_limit();

-- Function: find nearby places (returns places within X meters)
create or replace function nearby_places(
  user_lat double precision,
  user_lng double precision,
  radius_m integer default 5000,
  max_results integer default 30
)
returns table (
  id bigint, name text, latitude double precision,
  longitude double precision, city text, country text, distance_m double precision
)
language sql stable as $$
  select
    p.id, p.name, p.latitude, p.longitude, p.city, p.country,
    st_distance(p.location, st_makepoint(user_lng, user_lat)::geography) as distance_m
  from places p
  where st_dwithin(p.location, st_makepoint(user_lng, user_lat)::geography, radius_m)
  order by distance_m asc
  limit max_results;
$$;
