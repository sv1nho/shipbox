-- Target URL + service_role key are environment-specific, so they're not
-- hardcoded here — run once per environment before this can actually fire:
--   select vault.create_secret('https://dnrxyznvlscnaqsslkmu.supabase.co', 'project_url');
--   select vault.create_secret('<service_role_key>', 'service_role_key');
-- (Local dev: use http://host.docker.internal:54321 — NOT 127.0.0.1, which
-- inside the db container resolves to the container itself, not the host
-- running `supabase functions serve`.)

create extension if not exists supabase_vault cascade;

create or replace function trigger_process_key_issuance_queue()
returns trigger
language plpgsql
security definer as $$
declare
  v_project_url text;
  v_service_role_key text;
begin
  select decrypted_secret into v_project_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_service_role_key from vault.decrypted_secrets where name = 'service_role_key';

  if v_project_url is null or v_service_role_key is null then
    raise warning 'key issuance webhook: vault secrets project_url/service_role_key not configured yet, skipping';
    return new;
  end if;

  perform net.http_post(
    url := v_project_url || '/functions/v1/process-key-issuance-queue',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_service_role_key, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  return new;
end;
$$;

create trigger on_key_issuance_queue_insert
after insert on pgmq.q_key_issuance_queue
for each row execute function trigger_process_key_issuance_queue();

select cron.schedule(
  'process-key-issuance-queue-backup',
  '* * * * *',
  $cron$
  select net.http_post(
    url := v.project_url || '/functions/v1/process-key-issuance-queue',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v.service_role_key, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  )
  from (
    select
      (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') as project_url,
      (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key') as service_role_key
  ) v
  where v.project_url is not null and v.service_role_key is not null;
  $cron$
);
