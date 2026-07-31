-- This project's config.toml does NOT set `auto_expose_new_tables = true`,
-- so new tables/functions are reachable by NO Data API role (not even
-- service_role) until an explicit GRANT is issued below.

create table plans (
  id text primary key,
  quota int not null,
  price_cents int not null,
  stripe_price_id text not null,
  active boolean not null default true
);

alter table plans enable row level security;

-- Pricing is not sensitive: exposing it publicly lets /buy read prices
-- straight from the DB instead of duplicating them in frontend code.
create policy "public read active plans" on plans
  for select using (active = true);

grant select on table plans to anon;
grant select on table plans to service_role;

create table license_keys (
  id uuid primary key default gen_random_uuid(),
  key_hash bytea not null,
  key_prefix text not null,
  plan_id text not null references plans (id),
  quota_total int not null,
  quota_used int not null default 0,
  status text not null default 'active' check (status in ('active', 'revoked')),
  customer_email text,
  stripe_checkout_session_id text not null unique,
  email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 months'),
  revoked_at timestamptz,
  revoked_reason text
);

create unique index license_keys_key_hash_idx on license_keys (key_hash);

alter table license_keys enable row level security;

grant select, insert, update on table license_keys to service_role;

create table payment_events (
  stripe_event_id text primary key,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'queued', 'failed')),
  received_at timestamptz not null default now()
);

alter table payment_events enable row level security;

grant select, insert, update on table payment_events to service_role;

create table generation_events (
  id bigint generated always as identity primary key,
  license_key_id uuid references license_keys (id),
  ip_address inet,
  success boolean not null,
  created_at timestamptz not null default now()
);

alter table generation_events enable row level security;

grant select, insert on table generation_events to service_role;

create table rate_limit_buckets (
  scope text not null,
  identifier text not null,
  tokens numeric not null,
  updated_at timestamptz not null default now(),
  primary key (scope, identifier)
);

alter table rate_limit_buckets enable row level security;

grant select, insert, update on table rate_limit_buckets to service_role;

create or replace function consume_generation(p_license_key_id uuid, p_ip inet)
returns table (ok boolean, quota_used int, quota_total int)
language plpgsql security definer as $$
declare
  v_row license_keys%rowtype;
  v_key_exists boolean;
begin
  -- Table alias + qualified columns are required: `quota_used`/`quota_total`
  -- are also OUT parameter names from `returns table (...)`, so bare
  -- references are ambiguous between the column and the variable.
  update license_keys as lk
     set quota_used = lk.quota_used + 1
   where lk.id = p_license_key_id
     and lk.status = 'active'
     and lk.quota_used < lk.quota_total
     and lk.expires_at > now()
  returning lk.* into v_row;

  -- A wholly unknown p_license_key_id has no matching row, so it can't be
  -- logged as-is without violating generation_events' FK — fall back to
  -- NULL to still capture the attempt without crashing.
  select exists (select 1 from license_keys where id = p_license_key_id) into v_key_exists;

  insert into generation_events (license_key_id, ip_address, success)
  values (case when v_key_exists then p_license_key_id else null end, p_ip, v_row.id is not null);

  if v_row.id is null then
    return query select false, null::int, null::int;
  end if;
  return query select true, v_row.quota_used, v_row.quota_total;
end;
$$;

revoke all on function consume_generation(uuid, inet) from public, anon, authenticated;
grant execute on function consume_generation(uuid, inet) to service_role;

create or replace function rl_check(
  p_scope text,
  p_identifier text,
  p_capacity numeric,
  p_refill_per_sec numeric
)
returns boolean
language plpgsql security definer as $$
declare
  v_tokens numeric;
  v_updated_at timestamptz;
  v_elapsed numeric;
  v_new_tokens numeric;
begin
  insert into rate_limit_buckets (scope, identifier, tokens, updated_at)
  values (p_scope, p_identifier, p_capacity - 1, now())
  on conflict (scope, identifier) do nothing;

  if found then
    return true;
  end if;

  select tokens, updated_at into v_tokens, v_updated_at
    from rate_limit_buckets
   where scope = p_scope and identifier = p_identifier
   for update;

  v_elapsed := extract(epoch from (now() - v_updated_at));
  v_new_tokens := least(p_capacity, v_tokens + v_elapsed * p_refill_per_sec);

  if v_new_tokens < 1 then
    update rate_limit_buckets
       set tokens = v_new_tokens, updated_at = now()
     where scope = p_scope and identifier = p_identifier;
    return false;
  end if;

  update rate_limit_buckets
     set tokens = v_new_tokens - 1, updated_at = now()
   where scope = p_scope and identifier = p_identifier;
  return true;
end;
$$;

revoke all on function rl_check(text, text, numeric, numeric) from public, anon, authenticated;
grant execute on function rl_check(text, text, numeric, numeric) to service_role;

-- `pgmq` is not in config.toml's exposed API schemas, so Edge Functions
-- can't call pgmq.* via PostgREST directly — these wrappers are the boundary.
select pgmq.create('key_issuance_queue');

create or replace function enqueue_key_issuance(p_message jsonb)
returns bigint
language sql security definer as $$
  select pgmq.send('key_issuance_queue', p_message);
$$;

revoke all on function enqueue_key_issuance(jsonb) from public, anon, authenticated;
grant execute on function enqueue_key_issuance(jsonb) to service_role;

create or replace function read_key_issuance_queue(p_qty int default 10, p_vt int default 30)
returns setof pgmq.message_record
language sql security definer as $$
  select * from pgmq.read('key_issuance_queue', p_vt, p_qty);
$$;

revoke all on function read_key_issuance_queue(int, int) from public, anon, authenticated;
grant execute on function read_key_issuance_queue(int, int) to service_role;

create or replace function delete_key_issuance_queue_message(p_msg_id bigint)
returns boolean
language sql security definer as $$
  select pgmq.delete('key_issuance_queue', p_msg_id);
$$;

revoke all on function delete_key_issuance_queue_message(bigint) from public, anon, authenticated;
grant execute on function delete_key_issuance_queue_message(bigint) to service_role;
