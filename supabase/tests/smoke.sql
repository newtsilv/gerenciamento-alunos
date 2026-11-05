-- Teste de fumaça das regras do banco (executa em transação e desfaz tudo)
begin;
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-0000-0000-00000000000a','admin@t.dev','{"full_name":"Admin"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-00000000000b','mon@t.dev','{"full_name":"Monitor"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-00000000000c','prof@t.dev','{"full_name":"Prof"}','authenticated','authenticated'),
 ('00000000-0000-0000-0000-00000000000d','outro@t.dev','{"full_name":"Outro"}','authenticated','authenticated');
update profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000a';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';

insert into challenges (id, name, start_date, end_date, status, monitoring_weekdays)
values ('10000000-0000-0000-0000-000000000001','Desafio X','2026-11-02','2026-11-30','ativo','{2,4}');
select 'sessions' t, count(*) from monitoring_sessions where challenge_id='10000000-0000-0000-0000-000000000001';
select 'criteria' t, count(*) from evaluation_criteria where challenge_id='10000000-0000-0000-0000-000000000001';
insert into challenge_members (challenge_id, user_id, role) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','monitor'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','professor');
insert into project_milestones (challenge_id, title) values ('10000000-0000-0000-0000-000000000001','Requisitos');

select import_roster('10000000-0000-0000-0000-000000000001',
 '[{"team_name":"Equipe 01","registration":"M1","full_name":"João","email":"j@x.com"},
   {"team_name":"Equipe 01","registration":"M2","full_name":"Maria"},
   {"team_name":"Equipe 04","registration":"M3","full_name":"Ana"}]'::jsonb, '2026-11-02');
select 'deliverables' t, count(*) from team_deliverables;

-- monitor avalia equipe 01 na sessão de 03/11
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select save_team_evaluation(jsonb_build_object(
  'session_id', (select id from monitoring_sessions where session_date='2026-11-03' and challenge_id='10000000-0000-0000-0000-000000000001'),
  'team_id', (select id from teams where name='Equipe 01' and challenge_id='10000000-0000-0000-0000-000000000001'),
  'status','concluida','difficulties','API',
  'team_scores', (select jsonb_agg(jsonb_build_object('criterion_id', id, 'score', case when position=1 then null else 4 end)) from evaluation_criteria where scope='equipe' and challenge_id='10000000-0000-0000-0000-000000000001'),
  'students', jsonb_build_array(jsonb_build_object('student_id',(select id from students where registration='M1'),'followup_status','precisa_atencao',
     'scores',(select jsonb_agg(jsonb_build_object('criterion_id', id, 'score', 3)) from evaluation_criteria where scope='aluno' and challenge_id='10000000-0000-0000-0000-000000000001')))
)) is not null as saved;
-- correção (update) gera auditoria
select save_team_evaluation(jsonb_build_object(
  'session_id', (select id from monitoring_sessions where session_date='2026-11-03' and challenge_id='10000000-0000-0000-0000-000000000001'),
  'team_id', (select id from teams where name='Equipe 01' and challenge_id='10000000-0000-0000-0000-000000000001'),
  'status','rascunho','difficulties','API corrigida','team_scores','[]'::jsonb,'students','[]'::jsonb)) is not null as corrected;
select status, difficulties from team_evaluations where challenge_id='10000000-0000-0000-0000-000000000001';
select 'scores' t, count(*) from evaluation_scores;

-- monitor não pode transferir
savepoint s1;
do $$ begin
  perform transfer_student((select id from students where registration='M1'), (select id from teams where name='Equipe 04' and challenge_id='10000000-0000-0000-0000-000000000001'), '2026-11-05', 'x');
  raise exception 'FALHA: monitor transferiu';
exception when insufficient_privilege then raise notice 'OK: monitor bloqueado na transferência';
end $$;

-- admin transfere João para Equipe 04
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select transfer_student((select id from students where registration='M1'), (select id from teams where name='Equipe 04' and challenge_id='10000000-0000-0000-0000-000000000001'), '2026-11-05', 'Rebalanceamento') is not null as transferred;
select s.full_name, t.name, tm.start_date, tm.end_date from team_memberships tm join students s on s.id=tm.student_id join teams t on t.id=tm.team_id order by s.full_name, tm.start_date;
select se.team_id = (select id from teams where name='Equipe 01' and challenge_id='10000000-0000-0000-0000-000000000001') as eval_keeps_old_team from student_evaluations se where se.student_id = (select id from students where registration='M1');
select table_name, action, count(*) from audit_logs where challenge_id='10000000-0000-0000-0000-000000000001' group by 1,2 order by 1,2;

-- usuário sem vínculo não vê nada
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}';
select 'outsider sees challenges (esperado 0)' t, count(*) from challenges;
select 'outsider sees students' t, count(*) from students;
-- professor vê alunos, mas não avalia
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select 'prof sees students (esperado >= 3)' t, count(*) from students;
do $$ begin
  perform save_team_evaluation(jsonb_build_object('session_id',(select id from monitoring_sessions where session_date='2026-11-05' and challenge_id='10000000-0000-0000-0000-000000000001'),'team_id',(select id from teams where name='Equipe 04' and challenge_id='10000000-0000-0000-0000-000000000001')));
  raise exception 'FALHA: professor avaliou';
exception when insufficient_privilege then raise notice 'OK: professor não avalia';
end $$;
rollback;
