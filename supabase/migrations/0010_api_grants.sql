-- ============================================================
-- API role grants
-- Supabase no longer guarantees default public-schema grants on fresh
-- projects, so grant the roles used by PostgREST explicitly.
-- RLS policies still decide which rows each role can access.
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant insert on public.contact_requests, public.newsletter_subscribers to anon;
grant all privileges on all sequences in schema public to authenticated;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
alter default privileges in schema public grant select on tables to anon, authenticated;
alter default privileges in schema public grant insert, update, delete on tables to authenticated;
