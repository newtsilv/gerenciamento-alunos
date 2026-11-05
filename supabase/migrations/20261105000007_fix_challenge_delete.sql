-- Corrige a exclusão de desafios com avaliações. Com RESTRICT/NO ACTION, a checagem
-- da FK roda antes de a cascata (desafio → avaliações → notas) remover as notas.
-- DEFERRABLE INITIALLY DEFERRED checa ao final da transação: a exclusão do desafio
-- funciona e apagar diretamente um critério já usado continua bloqueado.
alter table public.evaluation_scores drop constraint evaluation_scores_criterion_id_fkey;
alter table public.evaluation_scores
  add constraint evaluation_scores_criterion_id_fkey
  foreign key (criterion_id) references public.evaluation_criteria (id)
  on delete no action deferrable initially deferred;
