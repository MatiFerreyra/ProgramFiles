-- ============================================================
-- ProgramFiles - esquema final multiempresa / seguridad / SaaS
-- Fecha: 2026-08
-- Ejecutar en Supabase > SQL Editor con rol postgres.
-- Idempotente: no elimina datos existentes.
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create schema if not exists private;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

-- ---------- Núcleo ----------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  logo_url text,
  primary_color text not null default '#0ea5e9',
  sidebar_color text not null default '#0b1220',
  status text not null default 'active' check (status in ('active','suspended','archived')),
  modules jsonb not null default '{"dashboard":true,"customers":true,"inventory":true,"sales":true,"quotes":true,"cash":false,"schedule":false,"suppliers":false,"employees":false,"reports":true}'::jsonb,
  owner_name text,
  owner_email text,
  owner_phone text,
  business_type text,
  address text,
  city text,
  province text,
  notes text,
  custom_domain text,
  updated_at timestamptz not null default now()
);
alter table public.tenant_settings add column if not exists custom_domain text;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner','admin','manager','sales','cashier','inventory','reception','viewer')),
  permissions jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id,user_id)
);

create index if not exists tenant_members_user_idx on public.tenant_members(user_id);
create unique index if not exists user_profiles_email_unique on public.user_profiles(lower(email)) where email is not null;
create index if not exists tenant_members_tenant_idx on public.tenant_members(tenant_id);
create index if not exists tenant_settings_status_idx on public.tenant_settings(status);
create unique index if not exists tenant_settings_custom_domain_unique on public.tenant_settings(lower(custom_domain)) where custom_domain is not null and custom_domain <> '';

-- Copia datos básicos de Auth a perfil público.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_profiles(user_id,email,full_name)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'))
  on conflict(user_id) do update set email=excluded.email, full_name=coalesce(excluded.full_name,public.user_profiles.full_name), updated_at=now();
  return new;
end;
$$;

drop trigger if exists programfiles_auth_user_profile on auth.users;
create trigger programfiles_auth_user_profile after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.user_profiles(user_id,email,full_name)
select id,email,coalesce(raw_user_meta_data->>'full_name',raw_user_meta_data->>'name') from auth.users
on conflict(user_id) do update set email=excluded.email;

-- ---------- Permisos privados usados por RLS ----------
create or replace function private.is_platform_admin(target_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select target_user is not null and exists(select 1 from public.platform_admins pa where pa.user_id=target_user)
$$;

create or replace function private.can_access_tenant(target_tenant uuid, target_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select private.is_platform_admin(target_user) or exists(
    select 1 from public.tenant_members tm
    where tm.tenant_id=target_tenant and tm.user_id=target_user and tm.active
  )
$$;

create or replace function private.has_permission(target_tenant uuid, permission_key text, target_user uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r text; p jsonb;
begin
  if private.is_platform_admin(target_user) then return true; end if;
  select role,permissions into r,p from public.tenant_members
    where tenant_id=target_tenant and user_id=target_user and active limit 1;
  if r is null then return false; end if;
  if r in ('owner','admin') then return true; end if;
  if p ? permission_key then return coalesce((p->>permission_key)::boolean,false); end if;
  return case r
    when 'manager' then permission_key <> 'view_billing'
    when 'sales' then permission_key in ('view_customers','manage_customers','view_sales','manage_sales','view_quotes','manage_quotes','view_reports')
    when 'cashier' then permission_key in ('view_sales','manage_sales','view_cash','manage_cash','view_reports')
    when 'inventory' then permission_key in ('view_inventory','manage_inventory','view_suppliers','manage_suppliers','view_reports')
    when 'reception' then permission_key in ('view_customers','manage_customers','view_schedule','manage_schedule')
    when 'viewer' then permission_key in ('view_customers','view_inventory','view_sales','view_quotes','view_cash','view_schedule','view_suppliers','view_reports')
    else false end;
end;
$$;

grant execute on function private.is_platform_admin(uuid) to authenticated;
grant execute on function private.can_access_tenant(uuid,uuid) to authenticated;
grant execute on function private.has_permission(uuid,text,uuid) to authenticated;

-- El primer usuario autenticado puede reclamar la consola CEO UNA sola vez.
create or replace function public.claim_initial_platform_admin()
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then return false; end if;
  if exists(select 1 from public.platform_admins) then
    return exists(select 1 from public.platform_admins where user_id=auth.uid());
  end if;
  insert into public.platform_admins(user_id) values(auth.uid()) on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.claim_initial_platform_admin() from public;
grant execute on function public.claim_initial_platform_admin() to authenticated;

-- ---------- Operación de cada empresa ----------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null, email text, phone text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null, price numeric not null default 0, cost numeric not null default 0, stock integer not null default 0,
  sku text, category text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.products add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
alter table public.products add column if not exists cost numeric default 0;
alter table public.products add column if not exists stock integer default 0;
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists category text;
alter table public.products add column if not exists updated_at timestamptz default now();

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_name text, description text, total numeric not null default 0, status text default 'completed', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_name text, description text, total numeric not null default 0, status text default 'draft', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  concept text not null, type text not null default 'income', amount numeric not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_name text not null, scheduled_at timestamptz, notes text, status text default 'scheduled', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null, email text, phone text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- ---------- Comercial de ProgramFiles ----------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan text not null default 'starter',
  status text not null default 'active',
  mrr numeric default 0,
  monthly_price numeric default 0,
  currency text default 'ARS',
  due_date date,
  grace_days integer not null default 5,
  auto_suspend boolean not null default false,
  payment_url text,
  external_reference text,
  last_paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
alter table public.subscriptions add column if not exists plan text default 'starter';
alter table public.subscriptions add column if not exists status text default 'active';
alter table public.subscriptions add column if not exists mrr numeric default 0;
alter table public.subscriptions add column if not exists created_at timestamptz default now();
alter table public.subscriptions add column if not exists monthly_price numeric default 0;
alter table public.subscriptions add column if not exists currency text default 'ARS';
alter table public.subscriptions add column if not exists due_date date;
alter table public.subscriptions add column if not exists grace_days integer default 5;
alter table public.subscriptions add column if not exists auto_suspend boolean default false;
alter table public.subscriptions add column if not exists payment_url text;
alter table public.subscriptions add column if not exists external_reference text;
alter table public.subscriptions add column if not exists last_paid_at timestamptz;
alter table public.subscriptions add column if not exists updated_at timestamptz default now();
create index if not exists subscriptions_tenant_idx on public.subscriptions(tenant_id);
create index if not exists subscriptions_due_idx on public.subscriptions(due_date);

create table if not exists public.commercial_quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  prospect_name text not null,
  description text,
  total numeric not null default 0,
  status text not null default 'draft',
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  period text,
  amount numeric not null default 0,
  currency text not null default 'ARS',
  status text not null default 'pending',
  due_date date,
  payment_url text,
  arca_cae text,
  arca_voucher_number bigint,
  arca_payload jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  subject text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.support_tickets add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
alter table public.support_tickets add column if not exists subject text;
alter table public.support_tickets add column if not exists status text default 'open';
alter table public.support_tickets add column if not exists priority text default 'normal';
alter table public.support_tickets add column if not exists message text;
alter table public.support_tickets add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.support_tickets add column if not exists created_at timestamptz default now();
alter table public.support_tickets add column if not exists updated_at timestamptz default now();

-- ---------- Auditoría ----------
create table if not exists public.audit_logs (
  id bigint generated by default as identity primary key,
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_tenant_created_idx on public.audit_logs(tenant_id,created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_user_id);

create or replace function public.programfiles_audit_trigger()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare n jsonb; o jsonb; tid uuid; rid text;
begin
  n := case when TG_OP='DELETE' then null else to_jsonb(NEW) end;
  o := case when TG_OP='INSERT' then null else to_jsonb(OLD) end;
  begin
    tid := coalesce((n->>'tenant_id')::uuid,(o->>'tenant_id')::uuid,
      case when TG_TABLE_NAME='tenants' then coalesce((n->>'id')::uuid,(o->>'id')::uuid) else null end);
  exception when others then tid := null; end;
  rid := coalesce(n->>'id',o->>'id',n->>'tenant_id',o->>'tenant_id');
  insert into public.audit_logs(tenant_id,actor_user_id,action,table_name,record_id,old_data,new_data)
  values(tid,auth.uid(),lower(TG_OP),TG_TABLE_NAME,rid,o,n);
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end;
$$;

-- ---------- Updated_at ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin NEW.updated_at=now(); return NEW; end $$;

-- ---------- RLS ----------
alter table public.platform_admins enable row level security;
alter table public.user_profiles enable row level security;
alter table public.tenant_members enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.commercial_quotes enable row level security;
alter table public.invoices enable row level security;
alter table public.support_tickets enable row level security;
alter table public.audit_logs enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.quotes enable row level security;
alter table public.cash_movements enable row level security;
alter table public.appointments enable row level security;
alter table public.suppliers enable row level security;

-- Elimina políticas permisivas de versiones anteriores.
do $$ declare r record; begin
  for r in select schemaname,tablename,policyname from pg_policies
    where schemaname='public' and tablename in ('platform_admins','user_profiles','tenant_members','tenants','tenant_settings','subscriptions','commercial_quotes','invoices','support_tickets','audit_logs','customers','products','sales','quotes','cash_movements','appointments','suppliers')
  loop execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename); end loop;
end $$;

create policy platform_admin_self_read on public.platform_admins for select to authenticated using (user_id=(select auth.uid()));
create policy profiles_self_read on public.user_profiles for select to authenticated using (user_id=(select auth.uid()) or private.is_platform_admin());
create policy tenant_members_read on public.tenant_members for select to authenticated using (private.can_access_tenant(tenant_id));
create policy tenant_members_write on public.tenant_members for all to authenticated using (private.has_permission(tenant_id,'manage_users')) with check (private.has_permission(tenant_id,'manage_users'));

create policy tenants_read on public.tenants for select to authenticated using (private.can_access_tenant(id));
create policy tenants_admin_insert on public.tenants for insert to authenticated with check (private.is_platform_admin());
create policy tenants_admin_update on public.tenants for update to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy tenants_admin_delete on public.tenants for delete to authenticated using (private.is_platform_admin());

create policy tenant_settings_read on public.tenant_settings for select to authenticated using (private.can_access_tenant(tenant_id));
create policy tenant_settings_write on public.tenant_settings for all to authenticated using (private.has_permission(tenant_id,'manage_settings')) with check (private.has_permission(tenant_id,'manage_settings'));

create policy subscriptions_read on public.subscriptions for select to authenticated using (private.is_platform_admin() or private.has_permission(tenant_id,'view_billing'));
create policy subscriptions_admin_write on public.subscriptions for all to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy invoices_read on public.invoices for select to authenticated using (private.is_platform_admin() or private.has_permission(tenant_id,'view_billing'));
create policy invoices_admin_write on public.invoices for all to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy commercial_quotes_admin on public.commercial_quotes for all to authenticated using (private.is_platform_admin()) with check (private.is_platform_admin());

create policy tickets_read on public.support_tickets for select to authenticated using (private.is_platform_admin() or (tenant_id is not null and private.can_access_tenant(tenant_id)));
create policy tickets_insert on public.support_tickets for insert to authenticated with check (private.is_platform_admin() or (tenant_id is not null and private.can_access_tenant(tenant_id)));
create policy tickets_update on public.support_tickets for update to authenticated using (private.is_platform_admin() or (tenant_id is not null and private.has_permission(tenant_id,'manage_settings'))) with check (private.is_platform_admin() or (tenant_id is not null and private.has_permission(tenant_id,'manage_settings')));

create policy audit_read on public.audit_logs for select to authenticated using (private.is_platform_admin() or (tenant_id is not null and private.has_permission(tenant_id,'manage_settings')));

-- Políticas operativas por módulo.
create policy customers_read on public.customers for select to authenticated using (private.has_permission(tenant_id,'view_customers'));
create policy customers_insert on public.customers for insert to authenticated with check (private.has_permission(tenant_id,'manage_customers'));
create policy customers_update on public.customers for update to authenticated using (private.has_permission(tenant_id,'manage_customers')) with check (private.has_permission(tenant_id,'manage_customers'));
create policy customers_delete on public.customers for delete to authenticated using (private.has_permission(tenant_id,'manage_customers'));

create policy products_read on public.products for select to authenticated using (private.has_permission(tenant_id,'view_inventory'));
create policy products_insert on public.products for insert to authenticated with check (private.has_permission(tenant_id,'manage_inventory'));
create policy products_update on public.products for update to authenticated using (private.has_permission(tenant_id,'manage_inventory')) with check (private.has_permission(tenant_id,'manage_inventory'));
create policy products_delete on public.products for delete to authenticated using (private.has_permission(tenant_id,'manage_inventory'));

create policy sales_read on public.sales for select to authenticated using (private.has_permission(tenant_id,'view_sales'));
create policy sales_insert on public.sales for insert to authenticated with check (private.has_permission(tenant_id,'manage_sales'));
create policy sales_update on public.sales for update to authenticated using (private.has_permission(tenant_id,'manage_sales')) with check (private.has_permission(tenant_id,'manage_sales'));
create policy sales_delete on public.sales for delete to authenticated using (private.has_permission(tenant_id,'manage_sales'));

create policy quotes_read on public.quotes for select to authenticated using (private.has_permission(tenant_id,'view_quotes'));
create policy quotes_insert on public.quotes for insert to authenticated with check (private.has_permission(tenant_id,'manage_quotes'));
create policy quotes_update on public.quotes for update to authenticated using (private.has_permission(tenant_id,'manage_quotes')) with check (private.has_permission(tenant_id,'manage_quotes'));
create policy quotes_delete on public.quotes for delete to authenticated using (private.has_permission(tenant_id,'manage_quotes'));

create policy cash_read on public.cash_movements for select to authenticated using (private.has_permission(tenant_id,'view_cash'));
create policy cash_insert on public.cash_movements for insert to authenticated with check (private.has_permission(tenant_id,'manage_cash'));
create policy cash_update on public.cash_movements for update to authenticated using (private.has_permission(tenant_id,'manage_cash')) with check (private.has_permission(tenant_id,'manage_cash'));
create policy cash_delete on public.cash_movements for delete to authenticated using (private.has_permission(tenant_id,'manage_cash'));

create policy appointments_read on public.appointments for select to authenticated using (private.has_permission(tenant_id,'view_schedule'));
create policy appointments_insert on public.appointments for insert to authenticated with check (private.has_permission(tenant_id,'manage_schedule'));
create policy appointments_update on public.appointments for update to authenticated using (private.has_permission(tenant_id,'manage_schedule')) with check (private.has_permission(tenant_id,'manage_schedule'));
create policy appointments_delete on public.appointments for delete to authenticated using (private.has_permission(tenant_id,'manage_schedule'));

create policy suppliers_read on public.suppliers for select to authenticated using (private.has_permission(tenant_id,'view_suppliers'));
create policy suppliers_insert on public.suppliers for insert to authenticated with check (private.has_permission(tenant_id,'manage_suppliers'));
create policy suppliers_update on public.suppliers for update to authenticated using (private.has_permission(tenant_id,'manage_suppliers')) with check (private.has_permission(tenant_id,'manage_suppliers'));
create policy suppliers_delete on public.suppliers for delete to authenticated using (private.has_permission(tenant_id,'manage_suppliers'));

-- ---------- Storage para logos públicos ----------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tenant-assets','tenant-assets',true,5242880,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'programfiles_%'
  loop execute format('drop policy if exists %I on storage.objects',r.policyname); end loop;
end $$;

create policy programfiles_assets_insert on storage.objects for insert to authenticated with check (
  bucket_id='tenant-assets' and private.has_permission(((storage.foldername(name))[1])::uuid,'manage_settings')
);
create policy programfiles_assets_update on storage.objects for update to authenticated using (
  bucket_id='tenant-assets' and private.has_permission(((storage.foldername(name))[1])::uuid,'manage_settings')
) with check (
  bucket_id='tenant-assets' and private.has_permission(((storage.foldername(name))[1])::uuid,'manage_settings')
);
create policy programfiles_assets_delete on storage.objects for delete to authenticated using (
  bucket_id='tenant-assets' and private.has_permission(((storage.foldername(name))[1])::uuid,'manage_settings')
);

-- ---------- Triggers ----------
do $$ declare t text; begin
  foreach t in array array['tenants','tenant_settings','tenant_members','subscriptions','commercial_quotes','invoices','support_tickets','customers','products','sales','quotes','cash_movements','appointments','suppliers'] loop
    execute format('drop trigger if exists programfiles_audit on public.%I',t);
    execute format('create trigger programfiles_audit after insert or update or delete on public.%I for each row execute function public.programfiles_audit_trigger()',t);
  end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array['tenant_settings','tenant_members','subscriptions','commercial_quotes','support_tickets','customers','products','sales','quotes','appointments','suppliers','user_profiles'] loop
    execute format('drop trigger if exists programfiles_updated_at on public.%I',t);
    execute format('create trigger programfiles_updated_at before update on public.%I for each row execute function public.set_updated_at()',t);
  end loop;
end $$;

-- ---------- Mantenimiento de suscripciones ----------
create or replace function public.run_billing_maintenance()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is not null and not private.is_platform_admin() then raise exception 'Solo ProgramFiles puede ejecutar mantenimiento de cobros'; end if;

  insert into public.invoices(tenant_id,subscription_id,period,amount,currency,status,due_date,payment_url)
  select s.tenant_id,s.id,to_char(coalesce(s.due_date,current_date),'YYYY-MM'),coalesce(s.monthly_price,s.mrr,0),coalesce(s.currency,'ARS'),'pending',s.due_date,s.payment_url
  from public.subscriptions s
  where s.status in ('active','trialing','past_due') and coalesce(s.monthly_price,s.mrr,0)>0
    and not exists(select 1 from public.invoices i where i.subscription_id=s.id and i.period=to_char(coalesce(s.due_date,current_date),'YYYY-MM'));

  update public.subscriptions set status='past_due',updated_at=now()
    where due_date is not null and due_date<current_date and status in ('active','trialing');

  update public.tenant_settings ts set status='suspended',updated_at=now()
  where ts.status='active' and exists(
    select 1 from public.subscriptions s
    where s.tenant_id=ts.tenant_id and s.auto_suspend=true and s.status='past_due'
      and s.due_date is not null and current_date > (s.due_date + coalesce(s.grace_days,5))
  );
end;
$$;
revoke all on function public.run_billing_maintenance() from public;
grant execute on function public.run_billing_maintenance() to authenticated;

-- Un cron diario. Si ya existe uno con este nombre, lo reemplaza.
do $$ declare jid bigint; begin
  select jobid into jid from cron.job where jobname='programfiles-billing-maintenance' limit 1;
  if jid is not null then perform cron.unschedule(jid); end if;
  perform cron.schedule('programfiles-billing-maintenance','15 3 * * *',$cron$select public.run_billing_maintenance();$cron$);
exception when others then
  raise notice 'No se pudo programar Cron automáticamente: %',SQLERRM;
end $$;

-- ---------- Grants básicos ----------
grant select,insert,update,delete on public.tenants,public.tenant_settings,public.tenant_members,public.subscriptions,public.commercial_quotes,public.invoices,public.support_tickets,public.customers,public.products,public.sales,public.quotes,public.cash_movements,public.appointments,public.suppliers to authenticated;
grant select on public.audit_logs,public.platform_admins,public.user_profiles to authenticated;
grant usage,select on sequence public.audit_logs_id_seq to authenticated;

-- Ejecutá este esquema y luego iniciá sesión con tu cuenta CEO.
-- La app llamará claim_initial_platform_admin(): la primera cuenta autenticada
-- se convertirá en Super Admin. A partir de ahí, solo esa cuenta (o las que
-- agregues manualmente a platform_admins) administrará toda la plataforma.
