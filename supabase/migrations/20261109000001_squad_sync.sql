-- Squad Sync: perguntas respondidas por cada aluno, notas de 0 a 10 e os cinco pontos
-- de avaliação individual. Os dados antigos são preservados.

-- ---------------------------------------------------------------------
-- Perguntas do aluno ("dificuldades" reaproveita a coluna difficulty)
-- ---------------------------------------------------------------------
alter table public.student_evaluations
  add column activities text not null default '',
  add column deliveries text not null default '',
  add column commitments text not null default '';

-- ---------------------------------------------------------------------
-- Escala de 0 a 10: as notas de 1 a 5 são multiplicadas por 2.
-- É uma conversão de escala, não uma correção: não entra na auditoria nem em updated_at.
-- ---------------------------------------------------------------------
alter table public.evaluation_scores drop constraint evaluation_scores_score_check;
alter table public.evaluation_scores disable trigger audit;
alter table public.evaluation_scores disable trigger set_updated_at;
update public.evaluation_scores set score = score * 2 where score is not null;
alter table public.evaluation_scores enable trigger audit;
alter table public.evaluation_scores enable trigger set_updated_at;
alter table public.evaluation_scores
  add constraint evaluation_scores_score_check check (score between 0 and 10);

-- ---------------------------------------------------------------------
-- Pontos de avaliação individual. Critérios antigos só são desativados:
-- as notas já lançadas neles continuam nas avaliações em que foram usados.
-- ---------------------------------------------------------------------
update public.evaluation_criteria
   set is_active = false
 where scope = 'aluno' and is_active
   and name <> all (array['Comprometimento','Produtividade','Proatividade','Colaboração','Evolução']);

with desired (name, description, pos) as (
  values
    ('Comprometimento', 'Cumprimento das responsabilidades e dos prazos.', 1::smallint),
    ('Produtividade', 'Realização e qualidade das entregas.', 2::smallint),
    ('Proatividade', 'Iniciativa para resolver problemas.', 3::smallint),
    ('Colaboração', 'Participação efetiva nas atividades do squad.', 4::smallint),
    ('Evolução', 'Desenvolvimento de conhecimentos e competências.', 5::smallint)
)
update public.evaluation_criteria ec
   set description = d.description, position = d.pos
  from desired d
 where ec.scope = 'aluno' and ec.is_active and ec.name = d.name;

with desired (name, description, pos) as (
  values
    ('Comprometimento', 'Cumprimento das responsabilidades e dos prazos.', 1::smallint),
    ('Produtividade', 'Realização e qualidade das entregas.', 2::smallint),
    ('Proatividade', 'Iniciativa para resolver problemas.', 3::smallint),
    ('Colaboração', 'Participação efetiva nas atividades do squad.', 4::smallint),
    ('Evolução', 'Desenvolvimento de conhecimentos e competências.', 5::smallint)
)
insert into public.evaluation_criteria (challenge_id, scope, name, description, position)
select c.id, 'aluno', d.name, d.description, d.pos
  from public.challenges c
 cross join desired d
 where not exists (
   select 1 from public.evaluation_criteria ec
    where ec.challenge_id = c.id and ec.scope = 'aluno' and ec.is_active and ec.name = d.name
 );

create or replace function public.seed_default_criteria()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into evaluation_criteria (challenge_id, scope, name, position)
  select new.id, 'equipe', n, ord::smallint
  from unnest(array['Organização','Comunicação','Colaboração','Cumprimento das atividades',
                    'Evolução do projeto','Autonomia na resolução de problemas']) with ordinality as x(n, ord);

  insert into evaluation_criteria (challenge_id, scope, name, description, position)
  select new.id, 'aluno', d.name, d.description, d.pos
  from (values
    ('Comprometimento', 'Cumprimento das responsabilidades e dos prazos.', 1::smallint),
    ('Produtividade', 'Realização e qualidade das entregas.', 2::smallint),
    ('Proatividade', 'Iniciativa para resolver problemas.', 3::smallint),
    ('Colaboração', 'Participação efetiva nas atividades do squad.', 4::smallint),
    ('Evolução', 'Desenvolvimento de conhecimentos e competências.', 5::smallint)
  ) as d (name, description, pos);
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Salvar avaliação com as perguntas do aluno
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
      or coalesce(trim(s ->> 'activities'), '') <> ''
      or coalesce(trim(s ->> 'deliveries'), '') <> ''
      or coalesce(trim(s ->> 'commitments'), '') <> ''
      or coalesce(trim(s ->> 'difficulty'), '') <> ''
      or coalesce(trim(s ->> 'guidance'), '') <> ''
      or jsonb_array_length(coalesce(s -> 'scores', '[]')) > 0;

    if not v_has_content then
      delete from student_evaluations where team_evaluation_id = v_eval_id and student_id = v_student_id;
      continue;
    end if;

    insert into student_evaluations (team_evaluation_id, student_id, team_id, membership_id, absent,
                                     followup_status, notes, difficulty, guidance,
                                     activities, deliveries, commitments)
    values (v_eval_id, v_student_id, v_team.id, v_membership_id,
            coalesce((s ->> 'absent')::boolean, false),
            nullif(s ->> 'followup_status', '')::followup_status,
            coalesce(s ->> 'notes', ''), coalesce(s ->> 'difficulty', ''), coalesce(s ->> 'guidance', ''),
            coalesce(s ->> 'activities', ''), coalesce(s ->> 'deliveries', ''), coalesce(s ->> 'commitments', ''))
    on conflict (team_evaluation_id, student_id) do update set
      absent = excluded.absent,
      followup_status = excluded.followup_status,
      notes = excluded.notes,
      difficulty = excluded.difficulty,
      guidance = excluded.guidance,
      activities = excluded.activities,
      deliveries = excluded.deliveries,
      commitments = excluded.commitments,
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
