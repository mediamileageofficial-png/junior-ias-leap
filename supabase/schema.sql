-- ============================================================
--  Junior IAS · LEAP — Supabase (Postgres) schema
--  Already applied to project xtrqjkuydrjbgotrrann. Kept here so
--  the database can be recreated in a new Supabase project:
--  Supabase dashboard → SQL Editor → paste → Run.
-- ============================================================

create table public.registrations (
  id                  bigint generated always as identity primary key,
  created_at          timestamptz not null default now(),
  parent_name         text not null check (char_length(parent_name) between 2 and 120),
  child_name          text not null check (char_length(child_name) between 2 and 120),
  child_class         text not null check (child_class in ('Class 6th','Class 7th','Class 8th','Class 9th','Class 10th')),
  mobile              text not null check (mobile ~ '^[6-9][0-9]{9}$'),
  whatsapp            text check (whatsapp ~ '^[6-9][0-9]{9}$'),
  email               text check (char_length(email) <= 160),
  city                text check (char_length(city) <= 120),
  source              text check (char_length(source) <= 60),
  consent             boolean not null default false,
  status              text not null default 'new' check (status in ('new','contacted','enrolled','not_interested')),
  notes               text check (char_length(notes) <= 2000),
  ip_address          text,
  user_agent          text,
  confirmation_status text
);
create index registrations_created_at_idx on public.registrations (created_at desc);
create index registrations_status_idx on public.registrations (status);
create index registrations_mobile_idx on public.registrations (mobile);

-- Dashboard access list: Supabase Auth users whose id is here can manage registrations.
create table public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

alter table public.registrations enable row level security;
alter table public.admin_users   enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()));
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create policy "admins read registrations"   on public.registrations for select to authenticated using ((select public.is_admin()));
create policy "admins update registrations" on public.registrations for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete registrations" on public.registrations for delete to authenticated using ((select public.is_admin()));
create policy "admins read own admin row"   on public.admin_users   for select to authenticated using (user_id = (select auth.uid()));

-- Public form submissions go through these two functions only (no direct table access for anon).
create or replace function public.submit_registration(
  p_parent_name text, p_child_name text, p_child_class text, p_mobile text,
  p_whatsapp text, p_email text, p_city text, p_source text, p_consent boolean,
  p_ip text, p_user_agent text
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare new_id bigint;
begin
  insert into public.registrations
    (parent_name, child_name, child_class, mobile, whatsapp, email, city, source, consent, ip_address, user_agent, confirmation_status)
  values
    (p_parent_name, p_child_name, p_child_class, p_mobile, nullif(p_whatsapp,''), nullif(p_email,''),
     nullif(p_city,''), nullif(p_source,''), coalesce(p_consent,false), p_ip, left(p_user_agent,255), 'pending')
  returning id into new_id;
  return new_id;
end $$;

-- Only lets a just-created 'pending' row record its e-mail outcome.
create or replace function public.set_registration_mail_status(p_id bigint, p_status text) returns void
language sql security definer set search_path = '' as $$
  update public.registrations
     set confirmation_status = p_status
   where id = p_id
     and confirmation_status = 'pending'
     and p_status in ('sent','sent_customer','sent_admin','failed','disabled')
     and created_at > now() - interval '10 minutes';
$$;

revoke execute on function public.submit_registration(text,text,text,text,text,text,text,text,boolean,text,text) from public;
revoke execute on function public.set_registration_mail_status(bigint,text) from public;
grant execute on function public.submit_registration(text,text,text,text,text,text,text,text,boolean,text,text) to anon, authenticated;
grant execute on function public.set_registration_mail_status(bigint,text) to anon, authenticated;
