-- ============================================================
-- 0011 — Multi-method payments (gift card / crypto / bank wire)
--
-- Adds an admin-managed payment_methods table so crypto wallets and
-- bank transfer details live in the database instead of the frontend,
-- and extends payments with the fields needed to record crypto
-- transaction hashes and bank wire references.
-- ============================================================

create table if not exists public.payment_methods (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null check (kind in ('crypto', 'bank')),
  name              text not null,
  currency          text,
  network           text,
  wallet_address    text,
  beneficiary_name  text,
  bank_name         text,
  account_number    text,
  swift_bic         text,
  iban              text,
  routing_number    text,
  account_type      text,
  bank_address      text,
  instructions      text,
  reference_label   text,
  sort_order        integer not null default 0,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists payment_methods_kind_idx
  on public.payment_methods (kind, sort_order);

alter table public.payment_methods enable row level security;

drop policy if exists "payment methods public read" on public.payment_methods;
create policy "payment methods public read" on public.payment_methods
  for select using (true);

drop policy if exists "payment methods admin write" on public.payment_methods;
create policy "payment methods admin write" on public.payment_methods
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- Extend payments with crypto / bank submission fields
-- ------------------------------------------------------------
alter table public.payments
  add column if not exists payment_method_id uuid references public.payment_methods (id) on delete set null,
  add column if not exists network          text,
  add column if not exists tx_hash          text;

create index if not exists payments_method_idx on public.payments (method);

-- ------------------------------------------------------------
-- Seed the methods that were previously hard-coded in site_settings
-- so existing behaviour is preserved after the migration.
-- ------------------------------------------------------------
insert into public.payment_methods
  (kind, name, currency, network, wallet_address, sort_order, active)
select 'crypto', 'USDT', 'USDT', 'TRC20', s.usdt_trc20_address, 1, true
from public.site_settings s
where s.id = 1
  and coalesce(btrim(s.usdt_trc20_address), '') <> ''
  and not exists (
    select 1 from public.payment_methods p
    where p.kind = 'crypto' and p.wallet_address = s.usdt_trc20_address
  );

insert into public.payment_methods
  (kind, name, currency, network, beneficiary_name, bank_name, account_number,
   routing_number, account_type, bank_address, instructions, sort_order, active)
select
  'bank',
  coalesce(nullif(btrim(s.ach_bank), ''), 'Bank wire transfer'),
  'USD', null,
  s.ach_account_holder,
  s.ach_bank,
  s.ach_account_number,
  s.ach_routing_number,
  s.ach_account_type,
  s.ach_bank_address,
  'Use your tracking number as the payment reference so we can match the transfer to your shipment.',
  1,
  true
from public.site_settings s
where s.id = 1
  and coalesce(btrim(s.ach_account_number), '') <> ''
  and not exists (
    select 1 from public.payment_methods p
    where p.kind = 'bank' and p.account_number = s.ach_account_number
  );

-- ------------------------------------------------------------
-- Keep updated_at fresh
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payment_methods_touch on public.payment_methods;
create trigger payment_methods_touch
  before update on public.payment_methods
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- Grants (fresh projects have no default public-schema grants)
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant select on public.payment_methods to anon, authenticated;
grant insert, update, delete on public.payment_methods to authenticated;
grant all privileges on public.payment_methods to service_role;
grant select, insert, update on public.payments to authenticated;
grant all privileges on public.payments to service_role;

-- ------------------------------------------------------------
-- Storage limits: allow videos and PDF documents, not just images.
-- ------------------------------------------------------------
update storage.buckets
set file_size_limit = 104857600  -- 100 MB
where id in ('shipment-images', 'gallery', 'homepage', 'documents', 'payment-receipts');

insert into storage.buckets (id, name, public, file_size_limit)
values ('shipment-media', 'shipment-media', true, 104857600)
on conflict (id) do update set public = true, file_size_limit = 104857600;

drop policy if exists "public read shipment-media" on storage.objects;
create policy "public read shipment-media" on storage.objects for select
  using (bucket_id = 'shipment-media');

drop policy if exists "admin write shipment-media" on storage.objects;
create policy "admin write shipment-media" on storage.objects for insert
  with check (bucket_id = 'shipment-media' and public.is_admin());

drop policy if exists "admin delete shipment-media" on storage.objects;
create policy "admin delete shipment-media" on storage.objects for delete
  using (bucket_id = 'shipment-media' and public.is_admin());