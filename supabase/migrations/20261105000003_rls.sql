-- =====================================================================
-- Migration 3: Row Level Security
-- Papéis: admin (global), coordenador / professor / monitor (por desafio)
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;
alter table public.teams enable row level security;
alter table public.students enable row level security;
alter table public.team_memberships enable row level security;
alter table public.evaluation_criteria enable row level security;
alter table public.monitoring_sessions enable row level security;
alter table public.team_evaluations enable row level security;
alter table public.student_evaluations enable row level security;
alter table public.evaluation_scores enable row level security;
alter table public.project_milestones enable row level security;
alter table public.team_deliverables enable row level security;
alter table public.pedagogical_notes enable row level security;
alter table public.reports enable row level security;
alter table public.audit_logs enable row level security;

-- anon não acessa nada
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.is_any_coordinator() or public.shares_challenge_with(id));
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- inserção feita pelo trigger handle_new_user; exclusão via auth.users (service role)

-- ---------------------------------------------------------------- challenges
create policy challenges_select on public.challenges for select to authenticated
  using (public.can_view_challenge(id));
create policy challenges_insert on public.challenges for insert to authenticated
  with check (public.is_admin());
create policy challenges_update on public.challenges for update to authenticated
  using (public.can_manage_challenge(id)) with check (public.can_manage_challenge(id));
create policy challenges_delete on public.challenges for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------- challenge_members
create policy challenge_members_select on public.challenge_members for select to authenticated
  using (public.can_view_challenge(challenge_id));
create policy challenge_members_write on public.challenge_members for all to authenticated
  using (public.can_manage_challenge(challenge_id)) with check (public.can_manage_challenge(challenge_id));

-- ---------------------------------------------------------------- teams
create policy teams_select on public.teams for select to authenticated
  using (public.can_view_challenge(challenge_id));
create policy teams_write on public.teams for all to authenticated
  using (public.can_manage_challenge(challenge_id)) with check (public.can_manage_challenge(challenge_id));

-- ---------------------------------------------------------------- students
-- Dados individuais: apenas quem participa de um desafio em que o aluno está/esteve
create policy students_select on public.students for select to authenticated
  using (public.can_view_student(id));
create policy students_insert on public.students for insert to authenticated
  with check (public.is_admin() or public.is_any_coordinator());
create policy students_update on public.students for update to authenticated
  using (public.is_admin() or (public.is_any_coordinator() and public.can_view_student(id)))
  with check (public.is_admin() or public.is_any_coordinator());
create policy students_delete on public.students for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------- team_memberships
create policy memberships_select on public.team_memberships for select to authenticated
  using (public.can_view_challenge(challenge_id));
create policy memberships_write on public.team_memberships for all to authenticated
  using (public.can_manage_challenge(challenge_id)) with check (public.can_manage_challenge(challenge_id));

-- ---------------------------------------------------------------- evaluation_criteria
create policy criteria_select on public.evaluation_criteria for select to authenticated
  using (public.can_view_challenge(challenge_id));
create policy criteria_write on public.evaluation_criteria for all to authenticated
  using (public.can_manage_challenge(challenge_id)) with check (public.can_manage_challenge(challenge_id));

-- ---------------------------------------------------------------- monitoring_sessions
create policy sessions_select on public.monitoring_sessions for select to authenticated
  using (public.can_view_challenge(challenge_id));
create policy sessions_insert on public.monitoring_sessions for insert to authenticated
  with check (public.can_manage_challenge(challenge_id) or public.can_evaluate_challenge(challenge_id));
create policy sessions_update on public.monitoring_sessions for update to authenticated
  using (public.can_manage_challenge(challenge_id)) with check (public.can_manage_challenge(challenge_id));
create policy sessions_delete on public.monitoring_sessions for delete to authenticated
  using (public.can_manage_challenge(challenge_id));

-- ---------------------------------------------------------------- team_evaluations
create policy team_eval_select on public.team_evaluations for select to authenticated
  using (public.can_view_challenge(challenge_id));
create policy team_eval_insert on public.team_evaluations for insert to authenticated
  with check (monitor_id = auth.uid() and public.can_evaluate_challenge(challenge_id));
create policy team_eval_update on public.team_evaluations for update to authenticated
  using ((monitor_id = auth.uid() and public.can_evaluate_challenge(challenge_id)) or public.is_admin())
  with check ((monitor_id = auth.uid() and public.can_evaluate_challenge(challenge_id)) or public.is_admin());
create policy team_eval_delete on public.team_evaluations for delete to authenticated
  using ((monitor_id = auth.uid() and status = 'rascunho') or public.is_admin());

-- Função auxiliar: o usuário pode editar a avaliação coletiva?
create or replace function public.can_edit_team_evaluation(p_team_evaluation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_evaluations te
    where te.id = p_team_evaluation_id
      and ((te.monitor_id = auth.uid() and public.can_evaluate_challenge(te.challenge_id)) or public.is_admin())
  );
$$;

create or replace function public.can_view_team_evaluation(p_team_evaluation_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from team_evaluations te
    where te.id = p_team_evaluation_id and public.can_view_challenge(te.challenge_id)
  );
$$;

-- ---------------------------------------------------------------- student_evaluations
create policy student_eval_select on public.student_evaluations for select to authenticated
  using (public.can_view_team_evaluation(team_evaluation_id));
create policy student_eval_write on public.student_evaluations for all to authenticated
  using (public.can_edit_team_evaluation(team_evaluation_id))
  with check (public.can_edit_team_evaluation(team_evaluation_id));

-- ---------------------------------------------------------------- evaluation_scores
create or replace function public.score_team_evaluation_id(p_team_eval uuid, p_student_eval uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(p_team_eval, (select team_evaluation_id from student_evaluations where id = p_student_eval));
$$;

create policy scores_select on public.evaluation_scores for select to authenticated
  using (public.can_view_team_evaluation(public.score_team_evaluation_id(team_evaluation_id, student_evaluation_id)));
create policy scores_write on public.evaluation_scores for all to authenticated
  using (public.can_edit_team_evaluation(public.score_team_evaluation_id(team_evaluation_id, student_evaluation_id)))
  with check (public.can_edit_team_evaluation(public.score_team_evaluation_id(team_evaluation_id, student_evaluation_id)));

-- ---------------------------------------------------------------- project_milestones
create policy milestones_select on public.project_milestones for select to authenticated
  using (public.can_view_challenge(challenge_id));
create policy milestones_write on public.project_milestones for all to authenticated
  using (public.can_manage_challenge(challenge_id)) with check (public.can_manage_challenge(challenge_id));

-- ---------------------------------------------------------------- team_deliverables
create policy deliverables_select on public.team_deliverables for select to authenticated
  using (public.can_view_challenge(public.team_challenge_id(team_id)));
create policy deliverables_insert on public.team_deliverables for insert to authenticated
  with check (public.can_manage_challenge(public.team_challenge_id(team_id)));
-- monitores e professores também atualizam status das entregas durante o acompanhamento
create policy deliverables_update on public.team_deliverables for update to authenticated
  using (public.can_view_challenge(public.team_challenge_id(team_id)))
  with check (public.can_view_challenge(public.team_challenge_id(team_id)));
create policy deliverables_delete on public.team_deliverables for delete to authenticated
  using (public.can_manage_challenge(public.team_challenge_id(team_id)));

-- ---------------------------------------------------------------- pedagogical_notes
create policy notes_select on public.pedagogical_notes for select to authenticated
  using (public.can_view_challenge(challenge_id));
create policy notes_insert on public.pedagogical_notes for insert to authenticated
  with check (author_id = auth.uid() and public.can_view_challenge(challenge_id)
              and public.team_challenge_id(team_id) = challenge_id);
create policy notes_update on public.pedagogical_notes for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy notes_delete on public.pedagogical_notes for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------- reports
create policy reports_select on public.reports for select to authenticated
  using (public.can_view_challenge(challenge_id));
create policy reports_insert on public.reports for insert to authenticated
  with check (generated_by = auth.uid() and public.can_view_challenge(challenge_id));

-- ---------------------------------------------------------------- audit_logs
-- somente leitura; gravação apenas pelo trigger (security definer)
create policy audit_select on public.audit_logs for select to authenticated
  using (public.is_admin() or (challenge_id is not null and public.can_view_challenge(challenge_id)));
