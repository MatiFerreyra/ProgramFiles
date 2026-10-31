-- ProgramFiles: cierre del bootstrap abierto de Super Admin.
-- Ejecutar después de supabase/programfiles_schema.sql.

create or replace function public.claim_initial_platform_admin()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- El alta del administrador inicial se realiza únicamente desde
  -- app/api/bootstrap-admin con SUPABASE_SERVICE_ROLE_KEY y correo autorizado.
  return private.is_platform_admin(auth.uid());
end;
$$;

revoke all on function public.claim_initial_platform_admin() from public;
revoke all on function public.claim_initial_platform_admin() from anon;
revoke all on function public.claim_initial_platform_admin() from authenticated;
