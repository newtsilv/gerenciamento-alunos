-- =====================================================================
-- Migration 5: login por RA (registro acadêmico)
-- Preparação para integração futura com o TOTVS RM: o RA é o identificador
-- de acesso; o e-mail no Supabase Auth pode ser técnico (<ra>@usuarios.local).
-- =====================================================================
alter table public.profiles add column login text;
create unique index profiles_login_key on public.profiles (lower(login)) where login is not null;
alter table public.profiles add column auth_source text not null default 'local'
  check (auth_source in ('local', 'rm'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, login)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data ->> 'login'), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;
