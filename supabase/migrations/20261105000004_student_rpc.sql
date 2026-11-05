-- =====================================================================
-- Migration 4: cadastro de aluno diretamente em uma equipe
-- SECURITY DEFINER com verificação explícita: coordenadores precisam criar o
-- aluno e o vínculo na mesma transação (antes do vínculo o aluno ainda não é visível).
-- =====================================================================
create or replace function public.add_student_to_team(
  p_team_id uuid,
  p_full_name text,
  p_registration text default null,
  p_email text default null,
  p_existing_student_id uuid default null,
  p_start_date date default current_date
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_challenge uuid;
  v_student_id uuid := p_existing_student_id;
  v_reg text := nullif(trim(p_registration), '');
begin
  select challenge_id into v_challenge from teams where id = p_team_id;
  if v_challenge is null then
    raise exception 'Equipe não encontrada' using errcode = 'P0002';
  end if;
  if not public.can_manage_challenge(v_challenge) then
    raise exception 'Sem permissão para gerenciar esta equipe' using errcode = '42501';
  end if;

  if v_student_id is null and v_reg is not null then
    select id into v_student_id from students where lower(registration) = lower(v_reg);
  end if;

  if v_student_id is null then
    if coalesce(trim(p_full_name), '') = '' then
      raise exception 'Nome do aluno é obrigatório' using errcode = '22023';
    end if;
    insert into students (registration, full_name, email)
    values (v_reg, trim(p_full_name), nullif(lower(trim(p_email)), ''))
    returning id into v_student_id;
  end if;

  if exists (select 1 from team_memberships
             where student_id = v_student_id and challenge_id = v_challenge and end_date is null) then
    raise exception 'O aluno já possui equipe ativa neste desafio. Utilize a transferência.' using errcode = '23505';
  end if;

  insert into team_memberships (student_id, team_id, challenge_id, start_date, created_by)
  values (v_student_id, p_team_id, v_challenge, coalesce(p_start_date, current_date), auth.uid());

  return v_student_id;
end $$;

revoke execute on function public.add_student_to_team(uuid, text, text, text, uuid, date) from public, anon;
grant execute on function public.add_student_to_team(uuid, text, text, text, uuid, date) to authenticated;
