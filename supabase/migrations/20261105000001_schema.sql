-- =====================================================================
-- Plataforma de Acompanhamento de Desafios Educacionais
-- Migration 1: estrutura (tipos, tabelas, índices, restrições)
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.challenge_status as enum ('planejado', 'ativo', 'encerrado', 'arquivado');
create type public.challenge_role as enum ('coordenador', 'professor', 'monitor');
create type public.session_status as enum ('aberta', 'encerrada');
create type public.evaluation_status as enum ('rascunho', 'concluida');
create type public.criterion_scope as enum ('equipe', 'aluno');
create type public.followup_status as enum ('evoluindo_bem', 'precisa_atencao', 'necessita_intervencao');
create type public.previous_difficulty_status as enum ('resolvidas', 'parcialmente', 'nao_resolvidas', 'sem_dificuldades');
create type public.deliverable_status as enum ('nao_iniciada', 'em_andamento', 'concluida', 'bloqueada');
create type public.report_type as enum ('diario', 'semanal');

-- ---------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  is_admin boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));

-- ---------------------------------------------------------------------
-- Desafios
-- ---------------------------------------------------------------------
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  company text not null default '',
  description text not null default '',
  start_date date not null,
  end_date date not null,
  status public.challenge_status not null default 'planejado',
  -- Dias da semana de acompanhamento (0 = domingo ... 6 = sábado)
  monitoring_weekdays smallint[] not null default '{2,4}',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint challenges_dates_check check (end_date >= start_date),
  constraint challenges_weekdays_check check (
    monitoring_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
  )
);
create index challenges_status_idx on public.challenges (status);

-- Vínculo de usuários a desafios (uma pessoa pode ter papéis distintos em desafios distintos)
create table public.challenge_members (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.challenge_role not null,
  created_at timestamptz not null default now(),
  unique (challenge_id, user_id, role)
);
create index challenge_members_user_idx on public.challenge_members (user_id);
create index challenge_members_challenge_idx on public.challenge_members (challenge_id, role);

-- ---------------------------------------------------------------------
-- Equipes
-- ---------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  project_title text not null default '',
  description text not null default '',
  assigned_monitor_id uuid references public.profiles (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, challenge_id)
);
create unique index teams_challenge_name_key on public.teams (challenge_id, lower(name));
create index teams_monitor_idx on public.teams (assigned_monitor_id);

-- ---------------------------------------------------------------------
-- Alunos
-- ---------------------------------------------------------------------
create table public.students (
  id uuid primary key default gen_random_uuid(),
  registration text, -- matrícula / identificador estável
  full_name text not null check (length(trim(full_name)) > 0),
  email text,
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index students_registration_key on public.students (lower(registration)) where registration is not null;
create index students_email_idx on public.students (lower(email));
create index students_name_idx on public.students (lower(full_name));

-- Histórico de participação em equipes (nunca sobrescrever: encerrar e criar novo vínculo)
create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  team_id uuid not null,
  challenge_id uuid not null,
  start_date date not null default current_date,
  end_date date,
  end_reason text,
  created_by uuid references public.profiles (id) on delete set null,
  ended_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (team_id, challenge_id) references public.teams (id, challenge_id) on delete cascade,
  constraint team_memberships_dates_check check (end_date is null or end_date >= start_date)
);
-- No máximo um vínculo ativo por aluno em cada desafio
create unique index team_memberships_one_active on public.team_memberships (student_id, challenge_id) where end_date is null;
create index team_memberships_team_idx on public.team_memberships (team_id);
create index team_memberships_student_idx on public.team_memberships (student_id);

-- ---------------------------------------------------------------------
-- Critérios de avaliação (versionados)
-- Ao editar um critério já utilizado, cria-se nova versão e a anterior é desativada.
-- ---------------------------------------------------------------------
create table public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  scope public.criterion_scope not null,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  position smallint not null default 0,
  version smallint not null default 1,
  previous_version_id uuid references public.evaluation_criteria (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index evaluation_criteria_challenge_idx on public.evaluation_criteria (challenge_id, scope, is_active, position);

-- ---------------------------------------------------------------------
-- Sessões de acompanhamento (um dia de acompanhamento de um desafio)
-- ---------------------------------------------------------------------
create table public.monitoring_sessions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  session_date date not null,
  status public.session_status not null default 'aberta',
  notes text not null default '',
  is_extra boolean not null default false,
  created_at timestamptz not null default now(),
  unique (challenge_id, session_date),
  unique (id, challenge_id)
);
create index monitoring_sessions_date_idx on public.monitoring_sessions (session_date);

-- ---------------------------------------------------------------------
-- Avaliação coletiva (uma por equipe por sessão — evita duplicidade)
-- ---------------------------------------------------------------------
create table public.team_evaluations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  team_id uuid not null,
  challenge_id uuid not null,
  monitor_id uuid not null references public.profiles (id) on delete restrict,
  status public.evaluation_status not null default 'rascunho',
  developed text not null default '',
  difficulties text not null default '',
  deliveries_completed text not null default '',
  next_steps text not null default '',
  general_notes text not null default '',
  previous_difficulties_status public.previous_difficulty_status,
  previous_followup_notes text not null default '',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (session_id, challenge_id) references public.monitoring_sessions (id, challenge_id) on delete cascade,
  foreign key (team_id, challenge_id) references public.teams (id, challenge_id) on delete cascade,
  unique (session_id, team_id)
);
create index team_evaluations_team_idx on public.team_evaluations (team_id, created_at desc);
create index team_evaluations_challenge_idx on public.team_evaluations (challenge_id, status);
create index team_evaluations_monitor_idx on public.team_evaluations (monitor_id);

-- ---------------------------------------------------------------------
-- Avaliação individual (vinculada à avaliação coletiva e à equipe do aluno na data)
-- ---------------------------------------------------------------------
create table public.student_evaluations (
  id uuid primary key default gen_random_uuid(),
  team_evaluation_id uuid not null references public.team_evaluations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete restrict,
  team_id uuid not null references public.teams (id) on delete cascade,
  membership_id uuid references public.team_memberships (id) on delete set null,
  absent boolean not null default false,
  followup_status public.followup_status,
  notes text not null default '',
  difficulty text not null default '',
  guidance text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_evaluation_id, student_id)
);
create index student_evaluations_student_idx on public.student_evaluations (student_id);

-- ---------------------------------------------------------------------
-- Notas por critério. score NULL = "Não observado" (não entra na média).
-- Ausência de linha = critério não preenchido.
-- ---------------------------------------------------------------------
create table public.evaluation_scores (
  id uuid primary key default gen_random_uuid(),
  team_evaluation_id uuid references public.team_evaluations (id) on delete cascade,
  student_evaluation_id uuid references public.student_evaluations (id) on delete cascade,
  criterion_id uuid not null references public.evaluation_criteria (id) on delete restrict,
  score smallint check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evaluation_scores_owner_check check (
    (team_evaluation_id is not null)::int + (student_evaluation_id is not null)::int = 1
  )
);
create unique index evaluation_scores_team_key on public.evaluation_scores (team_evaluation_id, criterion_id) where team_evaluation_id is not null;
create unique index evaluation_scores_student_key on public.evaluation_scores (student_evaluation_id, criterion_id) where student_evaluation_id is not null;
create index evaluation_scores_criterion_idx on public.evaluation_scores (criterion_id);

-- ---------------------------------------------------------------------
-- Marcos do desafio e entregas das equipes
-- ---------------------------------------------------------------------
create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  due_date date,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);
create index project_milestones_challenge_idx on public.project_milestones (challenge_id, position);

create table public.team_deliverables (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  milestone_id uuid references public.project_milestones (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  due_date date,
  status public.deliverable_status not null default 'nao_iniciada',
  completed_at date,
  notes text not null default '',
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, milestone_id)
);
create index team_deliverables_team_idx on public.team_deliverables (team_id, status);

-- ---------------------------------------------------------------------
-- Observações pedagógicas (professores, coordenadores, monitores)
-- ---------------------------------------------------------------------
create table public.pedagogical_notes (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (length(trim(content)) > 0),
  created_at timestamptz not null default now()
);
create index pedagogical_notes_team_idx on public.pedagogical_notes (team_id, created_at desc);

-- ---------------------------------------------------------------------
-- Relatórios gerados (registro de geração/download)
-- ---------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  type public.report_type not null,
  period_start date not null,
  period_end date not null,
  generated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index reports_challenge_idx on public.reports (challenge_id, created_at desc);

-- ---------------------------------------------------------------------
-- Auditoria (histórico de alterações)
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  challenge_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz not null default now()
);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id, changed_at desc);
create index audit_logs_challenge_idx on public.audit_logs (challenge_id, changed_at desc);
