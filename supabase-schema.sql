create extension if not exists pgcrypto;

create table if not exists public.tracking_records (
  id uuid primary key default gen_random_uuid(),
  tracking_id text not null unique,
  full_name text not null default '',
  email text not null default '',
  phone text not null default '',
  passport_number text not null default '',
  form_data jsonb not null default '{}'::jsonb,
  current_step smallint not null default 0 check (current_step between 0 and 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tracking_records add column if not exists full_name text not null default '';
alter table public.tracking_records add column if not exists email text not null default '';
alter table public.tracking_records add column if not exists phone text not null default '';
alter table public.tracking_records add column if not exists passport_number text not null default '';
alter table public.tracking_records add column if not exists form_data jsonb not null default '{}'::jsonb;
alter table public.tracking_records alter column current_step set default 0;
alter table public.tracking_records drop constraint if exists tracking_records_current_step_check;
alter table public.tracking_records add constraint tracking_records_current_step_check check (current_step between 0 and 3);

create table if not exists public.payment_accounts (
  id integer primary key default 1 check (id = 1),
  bank_account text not null default '',
  upi_id text not null default '',
  paypal text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.stage_submissions (
  id uuid primary key default gen_random_uuid(),
  tracking_id text not null references public.tracking_records(tracking_id) on delete cascade,
  stage smallint not null check (stage between 0 and 3),
  payment_method text not null default '',
  payment_screenshot_path text,
  form_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists stage_submissions_tracking_id_idx on public.stage_submissions(tracking_id);
insert into storage.buckets (id, name, public)
values ('payment-screenshots', 'payment-screenshots', false)
on conflict (id) do update set public = false;

alter table public.tracking_records enable row level security;
alter table public.payment_accounts enable row level security;
alter table public.stage_submissions enable row level security;

create or replace function public.get_tracking_status(p_tracking_id text)
returns table (tracking_id text, current_step smallint)
language sql
security definer
set search_path = public
as $$
  select t.tracking_id, t.current_step
  from public.tracking_records t
  where lower(t.tracking_id) = lower(trim(p_tracking_id))
  limit 1;
$$;

revoke all on function public.get_tracking_status(text) from public;
grant execute on function public.get_tracking_status(text) to anon, authenticated;

create or replace function public.find_or_create_tracking_record(
  p_full_name text,
  p_email text,
  p_phone text,
  p_passport_number text,
  p_form_data jsonb default '{}'::jsonb
)
returns table (tracking_id text, already_exists boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_record public.tracking_records%rowtype;
  new_tracking_id text;
begin
  select * into existing_record
  from public.tracking_records
  where lower(nullif(trim(email), '')) = lower(nullif(trim(p_email), ''))
     or nullif(trim(phone), '') = nullif(trim(p_phone), '')
     or lower(nullif(trim(passport_number), '')) = lower(nullif(trim(p_passport_number), ''))
  order by created_at asc
  limit 1;

  if existing_record.id is not null then
    return query select existing_record.tracking_id, true;
    return;
  end if;

  loop
    new_tracking_id := 'VFX-IND-' || lpad((floor(random() * 900000) + 100000)::text, 6, '0');
    exit when not exists (select 1 from public.tracking_records where tracking_records.tracking_id = new_tracking_id);
  end loop;

  insert into public.tracking_records (tracking_id, full_name, email, phone, passport_number, form_data)
  values (new_tracking_id, trim(coalesce(p_full_name, '')), trim(coalesce(p_email, '')), trim(coalesce(p_phone, '')), trim(coalesce(p_passport_number, '')), coalesce(p_form_data, '{}'::jsonb));

  return query select new_tracking_id, false;
end;
$$;

revoke all on function public.find_or_create_tracking_record(text, text, text, text, jsonb) from public;
grant execute on function public.find_or_create_tracking_record(text, text, text, text, jsonb) to anon, authenticated;

drop policy if exists "Anyone can create a tracking record" on public.tracking_records;
create policy "Anyone can create a tracking record"
  on public.tracking_records for insert to anon, authenticated
  with check (current_step = 0);

drop policy if exists "Agents can read tracking records" on public.tracking_records;
create policy "Agents can read tracking records"
  on public.tracking_records for select to authenticated
  using (true);

drop policy if exists "Agents can update tracking records" on public.tracking_records;
create policy "Agents can update tracking records"
  on public.tracking_records for update to authenticated
  using (true)
  with check (current_step between 0 and 3);

drop policy if exists "Agents can delete tracking records" on public.tracking_records;
create policy "Agents can delete tracking records"
  on public.tracking_records for delete to authenticated
  using (true);

drop policy if exists "Customers can save stage submissions" on public.stage_submissions;
create policy "Customers can save stage submissions"
  on public.stage_submissions for insert to anon, authenticated
  with check (stage between 0 and 3);

drop policy if exists "Agents can read stage submissions" on public.stage_submissions;
create policy "Agents can read stage submissions"
  on public.stage_submissions for select to authenticated
  using (true);

drop policy if exists "Anyone can read active payment accounts" on public.payment_accounts;
create policy "Anyone can read active payment accounts"
  on public.payment_accounts for select to anon, authenticated
  using (true);

drop policy if exists "Agents can manage payment accounts" on public.payment_accounts;
create policy "Agents can manage payment accounts"
  on public.payment_accounts for all to authenticated
  using (true)
  with check (id = 1);

insert into public.payment_accounts (id)
values (1)
on conflict (id) do nothing;

drop policy if exists "Customers can upload payment screenshots" on storage.objects;
create policy "Customers can upload payment screenshots"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'payment-screenshots');

drop policy if exists "Agents can read payment screenshots" on storage.objects;
create policy "Agents can read payment screenshots"
  on storage.objects for select to authenticated
  using (bucket_id = 'payment-screenshots');

drop policy if exists "Agents can delete payment screenshots" on storage.objects;
create policy "Agents can delete payment screenshots"
  on storage.objects for delete to authenticated
  using (bucket_id = 'payment-screenshots');
