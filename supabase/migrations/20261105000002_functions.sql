-- =====================================================================
-- Migration 2: funções auxiliares, triggers e RPCs
-- =====================================================================

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','challenges','teams','students','team_evaluations',
                           'student_evaluations','evaluation_scores','team_deliverables']
  loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Perfil criado automaticamente ao cadastrar usuário no Supabase Auth
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Funções de autorização (usadas nas políticas RLS)
-- SECURITY DEFINER para evitar recursão de RLS.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_admin and active);
$$;

create or replace function public.has_challenge_role(p_challenge_id uuid, p_roles public.challenge_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from challenge_members m
    join profiles p on p.id = m.user_id and p.active
    where m.challenge_id = p_challenge_id and m.user_id = auth.uid() and m.role = any (p_roles)
  );
$$;

create or replace function public.can_view_challenge(p_challenge_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or public.has_challenge_role(p_challenge_id, '{coordenador,professor,monitor}');
$$;

create or replace function public.can_manage_challenge(p_challenge_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_challenge_role(p_challenge_id, '{coordenador}');
$$;

create or replace function public.can_evaluate_challenge(p_challenge_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.has_challenge_role(p_challenge_id, '{monitor}');
$$;

create or replace function public.team_challenge_id(p_team_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select challenge_id from teams where id = p_team_id;
$$;

create or replace function public.can_view_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from team_memberships tm
    where tm.student_id = p_student_id and public.can_view_challenge(tm.challenge_id)
  );
$$;

create or replace function public.is_any_coordinator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from challenge_members m join profiles p on p.id = m.user_id and p.active
    where m.user_id = auth.uid() and m.role = 'coordenador'
  );
$$;

create or replace function public.shares_challenge_with(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from challenge_members a
    join challenge_members b on b.challenge_id = a.challenge_id
    where a.user_id = auth.uid() and b.user_id = p_user_id
  );
$$;

-- ---------------------------------------------------------------------
-- Critérios padrão ao criar um desafio
-- ---------------------------------------------------------------------
create or replace function public.seed_default_criteria()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into evaluation_criteria (challenge_id, scope, name, position)
  select new.id, 'equipe', n, ord::smallint
  from unnest(array['Organização','Comunicação','Colaboração','Cumprimento das atividades',
                    'Evolução do projeto','Autonomia na resolução de problemas']) with ordinality as x(n, ord);

  insert into evaluation_criteria (challenge_id, scope, name, position)
  select new.id, 'aluno', n, ord::smallint
  from unnest(array['Participação','Comunicação','Colaboração','Evolução técnica',
                    'Autonomia','Cumprimento das atividades']) with ordinality as x(n, ord);
  return new;
end $$;

create trigger seed_default_criteria after insert on public.challenges
  for each row execute function public.seed_default_criteria();

-- ---------------------------------------------------------------------
-- Sessões de acompanhamento geradas a partir dos dias configurados
-- ---------------------------------------------------------------------
create or replace function public.sync_challenge_sessions(p_challenge_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.challenges;
begin
  select * into c from challenges where id = p_challenge_id;
  if not found then return; end if;

  insert into monitoring_sessions (challenge_id, session_date)
  select c.id, d::date
  from generate_series(c.start_date::timestamp, c.end_date::timestamp, interval '1 day') d
  where extract(dow from d)::smallint = any (c.monitoring_weekdays)
  on conflict (challenge_id, session_date) do nothing;

  -- Remove sessões que deixaram de existir no calendário, desde que não tenham avaliações
  delete from monitoring_sessions s
  where s.challenge_id = c.id and not s.is_extra
    and (s.session_date < c.start_date or s.session_date > c.end_date
         or not (extract(dow from s.session_date)::smallint = any (c.monitoring_weekdays)))
    and not exists (select 1 from team_evaluations te where te.session_id = s.id);
end $$;

create or replace function public.trg_sync_sessions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_challenge_sessions(new.id);
  return new;
end $$;

create trigger sync_sessions_insert after insert on public.challenges
  for each row execute function public.trg_sync_sessions();
create trigger sync_sessions_update after update of start_date, end_date, monitoring_weekdays on public.challenges
  for each row execute function public.trg_sync_sessions();

-- ---------------------------------------------------------------------
-- Entregas: cada marco do desafio gera uma entrega para cada equipe
-- ---------------------------------------------------------------------
create or replace function public.trg_milestone_deliverables()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into team_deliverables (team_id, milestone_id, title, description, due_date)
    select t.id, new.id, new.title, new.description, new.due_date
    from teams t where t.challenge_id = new.challenge_id
    on conflict (team_id, milestone_id) do nothing;
  elsif tg_op = 'UPDATE' then
    update team_deliverables
       set title = new.title, description = new.description, due_date = new.due_date
     where milestone_id = new.id;
  end if;
  return new;
end $$;

create trigger milestone_deliverables after insert or update on public.project_milestones
  for each row execute function public.trg_milestone_deliverables();

create or replace function public.trg_team_deliverables()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into team_deliverables (team_id, milestone_id, title, description, due_date)
  select new.id, m.id, m.title, m.description, m.due_date
  from project_milestones m where m.challenge_id = new.challenge_id
  on conflict (team_id, milestone_id) do nothing;
  return new;
end $$;

create trigger team_deliverables_seed after insert on public.teams
  for each row execute function public.trg_team_deliverables();

-- Data de conclusão automática da entrega
create or replace function public.trg_deliverable_completed()
returns trigger language plpgsql as $$
begin
  if new.status = 'concluida' and new.completed_at is null then
    new.completed_at := current_date;
  elsif new.status <> 'concluida' then
    new.completed_at := null;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end $$;

create trigger deliverable_completed before insert or update on public.team_deliverables
  for each row execute function public.trg_deliverable_completed();

-- ---------------------------------------------------------------------
-- Auditoria genérica
-- ---------------------------------------------------------------------
create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_challenge uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;

  if tg_op = 'UPDATE' and (v_old - 'updated_at') = (v_new - 'updated_at') then
    return null; -- nada mudou de fato
  end if;

  v_row := coalesce(v_new, v_old);
  v_challenge := nullif(v_row ->> 'challenge_id', '')::uuid;

  if v_challenge is null then
    if tg_table_name = 'student_evaluations' then
      select challenge_id into v_challenge from team_evaluations
       where id = (v_row ->> 'team_evaluation_id')::uuid;
    elsif tg_table_name = 'evaluation_scores' then
      if v_row ->> 'team_evaluation_id' is not null then
        select challenge_id into v_challenge from team_evaluations
         where id = (v_row ->> 'team_evaluation_id')::uuid;
      else
        select te.challenge_id into v_challenge
          from student_evaluations se join team_evaluations te on te.id = se.team_evaluation_id
         where se.id = (v_row ->> 'student_evaluation_id')::uuid;
      end if;
    elsif tg_table_name = 'team_deliverables' then
      select challenge_id into v_challenge from teams where id = (v_row ->> 'team_id')::uuid;
    elsif tg_table_name = 'challenges' then
      v_challenge := (v_row ->> 'id')::uuid;
    end if;
  end if;

  insert into audit_logs (table_name, record_id, challenge_id, action, old_data, new_data, changed_by)
  values (tg_table_name, (v_row ->> 'id')::uuid, v_challenge, tg_op, v_old, v_new, auth.uid());
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['challenges','challenge_members','teams','students','team_memberships',
                           'evaluation_criteria','team_evaluations','student_evaluations',
                           'evaluation_scores','team_deliverables','project_milestones']
  loop
    execute format('create trigger audit after insert or update or delete on public.%I
                    for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

-- =====================================================================
-- RPCs
-- =====================================================================

-- ---------------------------------------------------------------------
-- Transferência de aluno: encerra vínculo atual e cria novo.
-- SECURITY INVOKER: RLS de team_memberships também se aplica.
-- ---------------------------------------------------------------------
create or replace function public.transfer_student(
  p_student_id uuid,
  p_to_team_id uuid,
  p_date date default current_date,
  p_reason text default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_challenge uuid;
  v_current team_memberships;
  v_new_id uuid;
begin
  select challenge_id into v_challenge from teams where id = p_to_team_id;
  if v_challenge is null then
    raise exception 'Equipe de destino não encontrada' using errcode = 'P0002';
  end if;
  if not public.can_manage_challenge(v_challenge) then
    raise exception 'Sem permissão para transferir alunos neste desafio' using errcode = '42501';
  end if;

  select * into v_current from team_memberships
   where student_id = p_student_id and challenge_id = v_challenge and end_date is null
   for update;

  if found then
    if v_current.team_id = p_to_team_id then
      raise exception 'O aluno já pertence a esta equipe' using errcode = 'P0001';
    end if;
    if p_date < v_current.start_date then
      raise exception 'A data da transferência não pode ser anterior ao início do vínculo atual (%)',
        to_char(v_current.start_date, 'DD/MM/YYYY') using errcode = 'P0001';
    end if;
    update team_memberships
       set end_date = p_date, ended_by = auth.uid(),
           end_reason = coalesce(nullif(trim(p_reason), ''), 'Transferência de equipe')
     where id = v_current.id;
  end if;

  insert into team_memberships (student_id, team_id, challenge_id, start_date, created_by)
  values (p_student_id, p_to_team_id, v_challenge, p_date, auth.uid())
  returning id into v_new_id;

  return v_new_id;
end $$;

-- ---------------------------------------------------------------------
-- Busca de possíveis duplicidades na importação
-- ---------------------------------------------------------------------
create or replace function public.find_import_candidates(
  p_challenge_id uuid,
  p_registrations text[],
  p_emails text[],
  p_names text[]
) returns table (
  student_id uuid,
  registration text,
  full_name text,
  email text,
  current_team_id uuid,
  current_team_name text
) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_manage_challenge(p_challenge_id) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  return query
  select s.id, s.registration, s.full_name, s.email, t.id, t.name
  from students s
  left join team_memberships tm on tm.student_id = s.id and tm.challenge_id = p_challenge_id and tm.end_date is null
  left join teams t on t.id = tm.team_id
  where lower(s.registration) = any (select lower(x) from unnest(p_registrations) x)
     or lower(s.email) = any (select lower(x) from unnest(p_emails) x)
     or lower(s.full_name) = any (select lower(x) from unnest(p_names) x);
end $$;

-- ---------------------------------------------------------------------
-- Importação de equipes e alunos (transacional)
-- p_rows: [{ team_name, registration?, full_name, email?, existing_student_id? }]
-- ---------------------------------------------------------------------
create or replace function public.import_roster(
  p_challenge_id uuid,
  p_rows jsonb,
  p_start_date date default current_date
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  v_team_id uuid;
  v_student_id uuid;
  v_current team_memberships;
  v_reg text;
  v_email text;
  v_name text;
  v_team_name text;
  c_teams int := 0;
  c_students int := 0;
  c_linked int := 0;
  c_memberships int := 0;
  c_transfers int := 0;
  c_unchanged int := 0;
begin
  if not public.can_manage_challenge(p_challenge_id) then
    raise exception 'Sem permissão para importar neste desafio' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Formato inválido' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_team_name := nullif(trim(r ->> 'team_name'), '');
    v_name := nullif(trim(r ->> 'full_name'), '');
    v_reg := nullif(trim(r ->> 'registration'), '');
    v_email := nullif(lower(trim(r ->> 'email')), '');

    if v_team_name is null or v_name is null then
      raise exception 'Linha inválida: equipe e nome do aluno são obrigatórios (%).', r using errcode = '22023';
    end if;

    -- Equipe
    select id into v_team_id from teams
     where challenge_id = p_challenge_id and lower(name) = lower(v_team_name);
    if v_team_id is null then
      insert into teams (challenge_id, name) values (p_challenge_id, v_team_name) returning id into v_team_id;
      c_teams := c_teams + 1;
    end if;

    -- Aluno
    v_student_id := nullif(r ->> 'existing_student_id', '')::uuid;
    if v_student_id is null and v_reg is not null then
      select id into v_student_id from students where lower(registration) = lower(v_reg);
    end if;

    if v_student_id is null then
      insert into students (registration, full_name, email)
      values (v_reg, v_name, v_email) returning id into v_student_id;
      c_students := c_students + 1;
    else
      update students
         set email = coalesce(email, v_email),
             registration = coalesce(registration, v_reg)
       where id = v_student_id;
      c_linked := c_linked + 1;
    end if;

    -- Vínculo
    select * into v_current from team_memberships
     where student_id = v_student_id and challenge_id = p_challenge_id and end_date is null;
    if found then
      if v_current.team_id = v_team_id then
        c_unchanged := c_unchanged + 1;
        continue;
      end if;
      update team_memberships
         set end_date = greatest(p_start_date, v_current.start_date), ended_by = auth.uid(),
             end_reason = 'Transferência via importação de planilha'
       where id = v_current.id;
      c_transfers := c_transfers + 1;
    end if;

    insert into team_memberships (student_id, team_id, challenge_id, start_date, created_by)
    values (v_student_id, v_team_id, p_challenge_id,
            case when v_current.id is not null then greatest(p_start_date, v_current.start_date) else p_start_date end,
            auth.uid());
    c_memberships := c_memberships + 1;
    v_current := null;
  end loop;

  return jsonb_build_object(
    'teams_created', c_teams,
    'students_created', c_students,
    'students_linked', c_linked,
    'memberships_created', c_memberships,
    'transfers', c_transfers,
    'unchanged', c_unchanged
  );
end $$;

-- ---------------------------------------------------------------------
-- Edição versionada de critério
-- ---------------------------------------------------------------------
create or replace function public.update_criterion(
  p_criterion_id uuid,
  p_name text,
  p_description text
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  c evaluation_criteria;
  v_new uuid;
begin
  select * into c from evaluation_criteria where id = p_criterion_id;
  if not found then
    raise exception 'Critério não encontrado' using errcode = 'P0002';
  end if;
  if not public.can_manage_challenge(c.challenge_id) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  if exists (select 1 from evaluation_scores where criterion_id = c.id) then
    -- Já utilizado: preserva a versão antiga e cria uma nova
    update evaluation_criteria set is_active = false where id = c.id;
    insert into evaluation_criteria (challenge_id, scope, name, description, position, version, previous_version_id)
    values (c.challenge_id, c.scope, trim(p_name), coalesce(p_description, ''), c.position, c.version + 1, c.id)
    returning id into v_new;
    return v_new;
  end if;

  update evaluation_criteria set name = trim(p_name), description = coalesce(p_description, '') where id = c.id;
  return c.id;
end $$;

-- ---------------------------------------------------------------------
-- Salvamento atômico de um acompanhamento (avaliação coletiva + individuais)
-- SECURITY INVOKER: RLS garante que apenas o monitor responsável (ou admin) grave.
-- ---------------------------------------------------------------------
create or replace function public.save_team_evaluation(p jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_session monitoring_sessions;
  v_team teams;
  v_eval team_evaluations;
  v_eval_id uuid;
  v_status evaluation_status := coalesce(nullif(p ->> 'status', ''), 'rascunho')::evaluation_status;
  s jsonb;
  sc jsonb;
  v_student_id uuid;
  v_membership_id uuid;
  v_se_id uuid;
  v_has_content boolean;
  v_crit_ids uuid[];
begin
  select * into v_session from monitoring_sessions where id = (p ->> 'session_id')::uuid;
  if not found then
    raise exception 'Sessão de acompanhamento não encontrada' using errcode = 'P0002';
  end if;
  select * into v_team from teams where id = (p ->> 'team_id')::uuid and challenge_id = v_session.challenge_id;
  if not found then
    raise exception 'Equipe não encontrada neste desafio' using errcode = 'P0002';
  end if;
  if not public.can_evaluate_challenge(v_session.challenge_id) then
    raise exception 'Apenas monitores do desafio podem registrar acompanhamentos' using errcode = '42501';
  end if;

  select * into v_eval from team_evaluations
   where session_id = v_session.id and team_id = v_team.id for update;

  if found then
    if v_eval.monitor_id <> auth.uid() and not public.is_admin() then
      raise exception 'Esta equipe já foi avaliada nesta sessão por outro monitor' using errcode = '23505';
    end if;
    if v_eval.status = 'concluida' then
      v_status := 'concluida'; -- correções mantêm a avaliação concluída (histórico na auditoria)
    end if;
    update team_evaluations set
      status = v_status,
      developed = coalesce(p ->> 'developed', ''),
      difficulties = coalesce(p ->> 'difficulties', ''),
      deliveries_completed = coalesce(p ->> 'deliveries_completed', ''),
      next_steps = coalesce(p ->> 'next_steps', ''),
      general_notes = coalesce(p ->> 'general_notes', ''),
      previous_difficulties_status = nullif(p ->> 'previous_difficulties_status', '')::previous_difficulty_status,
      previous_followup_notes = coalesce(p ->> 'previous_followup_notes', ''),
      submitted_at = case when v_status = 'concluida' then coalesce(submitted_at, now()) else null end
    where id = v_eval.id;
    v_eval_id := v_eval.id;
  else
    insert into team_evaluations (
      session_id, team_id, challenge_id, monitor_id, status, developed, difficulties,
      deliveries_completed, next_steps, general_notes, previous_difficulties_status,
      previous_followup_notes, submitted_at
    ) values (
      v_session.id, v_team.id, v_session.challenge_id, auth.uid(), v_status,
      coalesce(p ->> 'developed', ''), coalesce(p ->> 'difficulties', ''),
      coalesce(p ->> 'deliveries_completed', ''), coalesce(p ->> 'next_steps', ''),
      coalesce(p ->> 'general_notes', ''),
      nullif(p ->> 'previous_difficulties_status', '')::previous_difficulty_status,
      coalesce(p ->> 'previous_followup_notes', ''),
      case when v_status = 'concluida' then now() end
    ) returning id into v_eval_id;
  end if;

  -- Notas coletivas
  select coalesce(array_agg((x ->> 'criterion_id')::uuid), '{}') into v_crit_ids
    from jsonb_array_elements(coalesce(p -> 'team_scores', '[]')) x;

  if exists (
    select 1 from unnest(v_crit_ids) cid
    where not exists (select 1 from evaluation_criteria ec
                      where ec.id = cid and ec.challenge_id = v_session.challenge_id and ec.scope = 'equipe')
  ) then
    raise exception 'Critério coletivo inválido' using errcode = '22023';
  end if;

  delete from evaluation_scores where team_evaluation_id = v_eval_id and not (criterion_id = any (v_crit_ids));
  for sc in select * from jsonb_array_elements(coalesce(p -> 'team_scores', '[]')) loop
    insert into evaluation_scores (team_evaluation_id, criterion_id, score)
    values (v_eval_id, (sc ->> 'criterion_id')::uuid, nullif(sc ->> 'score', '')::smallint)
    on conflict (team_evaluation_id, criterion_id) where team_evaluation_id is not null
    do update set score = excluded.score
    where evaluation_scores.score is distinct from excluded.score;
  end loop;

  -- Avaliações individuais
  for s in select * from jsonb_array_elements(coalesce(p -> 'students', '[]')) loop
    v_student_id := (s ->> 'student_id')::uuid;

    select tm.id into v_membership_id from team_memberships tm
     where tm.student_id = v_student_id and tm.team_id = v_team.id
       and tm.start_date <= v_session.session_date
       and (tm.end_date is null or tm.end_date > v_session.session_date)
     order by tm.start_date desc limit 1;

    if v_membership_id is null then
      raise exception 'Aluno não pertence a esta equipe na data do acompanhamento' using errcode = '22023';
    end if;

    v_has_content := coalesce((s ->> 'absent')::boolean, false)
      or nullif(s ->> 'followup_status', '') is not null
      or coalesce(trim(s ->> 'notes'), '') <> ''
      or coalesce(trim(s ->> 'difficulty'), '') <> ''
      or coalesce(trim(s ->> 'guidance'), '') <> ''
      or jsonb_array_length(coalesce(s -> 'scores', '[]')) > 0;

    if not v_has_content then
      delete from student_evaluations where team_evaluation_id = v_eval_id and student_id = v_student_id;
      continue;
    end if;

    insert into student_evaluations (team_evaluation_id, student_id, team_id, membership_id, absent,
                                     followup_status, notes, difficulty, guidance)
    values (v_eval_id, v_student_id, v_team.id, v_membership_id,
            coalesce((s ->> 'absent')::boolean, false),
            nullif(s ->> 'followup_status', '')::followup_status,
            coalesce(s ->> 'notes', ''), coalesce(s ->> 'difficulty', ''), coalesce(s ->> 'guidance', ''))
    on conflict (team_evaluation_id, student_id) do update set
      absent = excluded.absent,
      followup_status = excluded.followup_status,
      notes = excluded.notes,
      difficulty = excluded.difficulty,
      guidance = excluded.guidance,
      membership_id = excluded.membership_id
    returning id into v_se_id;

    select coalesce(array_agg((x ->> 'criterion_id')::uuid), '{}') into v_crit_ids
      from jsonb_array_elements(coalesce(s -> 'scores', '[]')) x;

    if exists (
      select 1 from unnest(v_crit_ids) cid
      where not exists (select 1 from evaluation_criteria ec
                        where ec.id = cid and ec.challenge_id = v_session.challenge_id and ec.scope = 'aluno')
    ) then
      raise exception 'Critério individual inválido' using errcode = '22023';
    end if;

    delete from evaluation_scores where student_evaluation_id = v_se_id and not (criterion_id = any (v_crit_ids));
    for sc in select * from jsonb_array_elements(coalesce(s -> 'scores', '[]')) loop
      insert into evaluation_scores (student_evaluation_id, criterion_id, score)
      values (v_se_id, (sc ->> 'criterion_id')::uuid, nullif(sc ->> 'score', '')::smallint)
      on conflict (student_evaluation_id, criterion_id) where student_evaluation_id is not null
      do update set score = excluded.score
      where evaluation_scores.score is distinct from excluded.score;
    end loop;
  end loop;

  return v_eval_id;
end $$;

-- As RPCs só podem ser chamadas por usuários autenticados
revoke execute on function public.transfer_student(uuid, uuid, date, text) from public, anon;
revoke execute on function public.find_import_candidates(uuid, text[], text[], text[]) from public, anon;
revoke execute on function public.import_roster(uuid, jsonb, date) from public, anon;
revoke execute on function public.update_criterion(uuid, text, text) from public, anon;
revoke execute on function public.save_team_evaluation(jsonb) from public, anon;
revoke execute on function public.sync_challenge_sessions(uuid) from public, anon, authenticated;
grant execute on function public.transfer_student(uuid, uuid, date, text) to authenticated;
grant execute on function public.find_import_candidates(uuid, text[], text[], text[]) to authenticated;
grant execute on function public.import_roster(uuid, jsonb, date) to authenticated;
grant execute on function public.update_criterion(uuid, text, text) to authenticated;
grant execute on function public.save_team_evaluation(jsonb) to authenticated;
