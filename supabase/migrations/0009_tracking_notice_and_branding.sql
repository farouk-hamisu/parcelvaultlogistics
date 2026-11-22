-- ============================================================
-- ParcelVault Logistics branding + editable tracking notice
-- ============================================================

-- Editable delivery notice shown inside the public tracking timeline.
alter table public.site_settings
  add column if not exists tracking_notice text not null
  default 'Please contact your dispatch desk if any holds have been placed on your package for delivery purposes.';

update public.site_settings
set tracking_notice = 'Please contact your dispatch desk if any holds have been placed on your package for delivery purposes.'
where id = 1 and (tracking_notice is null or btrim(tracking_notice) = '');

-- Bring existing projects onto the new brand without touching operational data.
update public.site_settings
set
  site_name = 'ParcelVault Logistics',
  contact_email = case
    when contact_email is null or contact_email = 'support@diamondthrivelogistics.com'
      then 'support@parcelvaultlogistics.com'
    else contact_email
  end,
  ach_account_holder = case
    when ach_account_holder is null or ach_account_holder = 'DiamondThriveLogistics'
      then 'ParcelVault Logistics'
    else ach_account_holder
  end,
  seo_title = replace(coalesce(seo_title, ''), 'DiamondThriveLogistics', 'ParcelVault Logistics'),
  seo_description = replace(coalesce(seo_description, ''), 'DiamondThriveLogistics', 'ParcelVault Logistics')
where id = 1;

update public.testimonials
set quote = replace(quote, 'DiamondThriveLogistics', 'ParcelVault Logistics')
where quote like '%DiamondThriveLogistics%';

update public.testimonials
set quote = replace(quote, 'DTL ', 'ParcelVault ')
where quote like '%DTL %';

update public.shipments
set tracking_number = 'PVL-DEMO-0001'
where tracking_number = 'DTL-DEMO-0001'
  and not exists (
    select 1 from public.shipments where tracking_number = 'PVL-DEMO-0001'
  );
