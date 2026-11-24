-- 0012 — Customer email system (templates + delivery log)
--
-- Email content is stored in the database so administrators can pick a
-- professionally designed template, customise it, and send it to any
-- registered customer. Sending itself happens on the API server so the
-- Resend API key never reaches the browser.

create extension if not exists "pgcrypto";

create table if not exists public.email_templates (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  description text,
  category    text not null default 'general',
  subject     text not null,
  body        text not null,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.email_messages (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid references public.profiles(id) on delete set null,
  recipient_email  text not null,
  recipient_name   text,
  subject          text not null,
  template_key     text,
  body_text        text not null,
  html             text,
  status           text not null default 'sent' check (status in ('sent', 'failed')),
  provider_id      text,
  error            text,
  sent_by          uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists email_messages_created_at_idx on public.email_messages (created_at desc);
create index if not exists email_messages_customer_idx on public.email_messages (customer_id);

alter table public.email_templates enable row level security;
alter table public.email_messages enable row level security;

-- The API uses the service role (which bypasses RLS). These policies simply
-- prevent any accidental direct client access.
drop policy if exists "email_templates admin read" on public.email_templates;
create policy "email_templates admin read" on public.email_templates
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager','staff')));

drop policy if exists "email_messages admin read" on public.email_messages;
create policy "email_messages admin read" on public.email_messages
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','manager','staff')));

grant select on public.email_templates to authenticated;
grant select on public.email_messages to authenticated;

-- Seed a small library of on-brand, ready-to-send templates.
insert into public.email_templates (key, name, description, category, subject, body, sort_order)
values
  (
    'shipment_update',
    'Shipment status update',
    'A friendly status update with the latest movement on a shipment.',
    'shipments',
    'Update on your shipment {{tracking_number}}',
    E'Hi {{customer_name}},\n\nWe wanted to give you a quick update on shipment {{tracking_number}}.\n\nYour consignment has cleared its latest checkpoint and remains on schedule. You can follow every movement in real time on our tracking page using the number above.\n\nIf you need anything at all — a delivery window change, customs paperwork, or a question about the route — simply reply to this email and our team will take care of it.\n\nThank you for shipping with ParcelVault Logistics.\n\nWarm regards,\nThe ParcelVault Logistics Team',
    1
  ),
  (
    'payment_reminder',
    'Outstanding duties reminder',
    'A polite reminder about outstanding customs or shipping charges.',
    'billing',
    'Outstanding charges on shipment {{tracking_number}}',
    E'Hi {{customer_name}},\n\nOur records show that shipment {{tracking_number}} has outstanding duties or shipping charges that still need to be settled before delivery can be completed.\n\nYou can review the balance and pay securely from the tracking page. We accept gift cards, cryptocurrency, and bank wire transfers, and every payment is verified by our finance team.\n\nIf you have already made a payment, please disregard this message — verification can take a short while to reflect.\n\nKind regards,\nParcelVault Logistics — Accounts Team',
    2
  ),
  (
    'customs_hold',
    'Customs clearance required',
    'Notifies a customer that a shipment needs clearance information.',
    'shipments',
    'Action required: customs clearance for {{tracking_number}}',
    E'Hi {{customer_name}},\n\nShipment {{tracking_number}} is currently held at customs and needs a little information from you before it can be released.\n\nPlease reply to this email with any commercial invoice, declaration, or identification document requested by the clearance authority. Our customs desk will submit everything on your behalf the moment it arrives.\n\nWe are monitoring the file closely and will keep you updated as soon as the shipment moves again.\n\nBest regards,\nParcelVault Logistics — Customs Desk',
    3
  ),
  (
    'delivery_confirmation',
    'Delivery confirmation',
    'Confirms a successful delivery and invites feedback.',
    'shipments',
    'Your shipment {{tracking_number}} has been delivered',
    E'Hi {{customer_name}},\n\nGood news — shipment {{tracking_number}} has been delivered successfully.\n\nIt was a pleasure moving this consignment for you. If anything about the delivery was not exactly right, reply to this email and we will put it right straight away.\n\nWe would also love to hear how we did. Your feedback helps us keep raising the standard for every customer.\n\nThank you for choosing ParcelVault Logistics.\n\nWarm regards,\nThe ParcelVault Logistics Team',
    4
  ),
  (
    'general_followup',
    'General follow-up',
    'An open, friendly check-in for any customer conversation.',
    'general',
    'A quick follow-up from ParcelVault Logistics',
    E'Hi {{customer_name}},\n\nI hope this message finds you well.\n\nI am following up on your recent enquiry with ParcelVault Logistics. We want to make sure everything has been resolved to your satisfaction and that there is nothing else you need from us.\n\nIf you would like to discuss a new shipment, a quote, or any part of your account, just reply here and I will personally make sure it is handled.\n\nKind regards,\nParcelVault Logistics — Customer Support',
    5
  )
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  subject = excluded.subject,
  body = excluded.body,
  sort_order = excluded.sort_order,
  updated_at = now();
