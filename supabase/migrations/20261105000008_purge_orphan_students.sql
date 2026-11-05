-- Remove alunos sem nenhum vínculo de equipe nem avaliação (ex.: após excluir um desafio).
create or replace function public.purge_orphan_students()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  delete from students s
   where not exists (select 1 from team_memberships tm where tm.student_id = s.id)
     and not exists (select 1 from student_evaluations se where se.student_id = s.id);
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke execute on function public.purge_orphan_students() from public, anon;
grant execute on function public.purge_orphan_students() to authenticated;
