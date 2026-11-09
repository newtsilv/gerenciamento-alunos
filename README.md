# Acompanha — Plataforma de Acompanhamento de Desafios Educacionais

Aplicação web para monitores, professores e coordenadores acompanharem equipes de alunos em desafios reais propostos por empresas: avaliação coletiva e individual na mesma tela, histórico preservado (inclusive com transferências), entregas, dashboards e relatórios Excel diários e semanais.

**Stack:** Next.js 16 (App Router, Server Actions, Route Handlers) · TypeScript · Tailwind CSS 4 · shadcn/ui (Base UI) · Supabase (PostgreSQL, Auth, RLS) · ExcelJS · Recharts · React Hook Form + Zod · Vitest · Playwright.

---

## 1. Requisitos

- Node.js 20+ (testado com 24)
- Docker (para o Supabase local) — ou um projeto no [Supabase Cloud](https://supabase.com)
- Google Chrome (apenas para os testes E2E)

## 2. Execução local (passo a passo)

```bash
npm install

# 1) Sobe o Supabase local (Postgres, Auth, Studio) e aplica as migrations
npm run db:start

# 2) Copie as chaves exibidas por `npx supabase status` para .env.local
cp .env.example .env.local   # e preencha (ver seção 3)

# 3) Crie o primeiro administrador (login por RA + senha)
npm run create-admin -- --ra 1-000000 --password "sua-senha" --name "Seu Nome"

# 4) (opcional) Usuários de TESTE + planilha de exemplo (para os testes automatizados)
npm run seed:dev        # usuários admin01, coord01, prof01, mon01, mon02 (senha teste123); não cria desafios
npm run sample:xlsx     # gera samples/importacao-exemplo.xlsx (dados fictícios)

# 5) Inicia a aplicação
npm run dev             # http://localhost:3000 (ou a próxima porta livre)
```

Supabase Studio local: http://127.0.0.1:54323

## 3. Variáveis de ambiente

Defina em `.env.local` (nunca commitado — o `.gitignore` ignora `.env*`, exceto `.env.example`):

| Variável | Onde obter | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Local: `npx supabase status` (API URL). Cloud: *Project Settings › API › Project URL* | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Local: `anon key`. Cloud: *Project Settings › API Keys › anon / publishable* | Cliente com JWT do usuário (todas as consultas passam pelo RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Local: `service_role key`. Cloud: *Project Settings › API Keys › service_role / secret* | **Somente servidor**: gerenciamento de usuários (Auth admin), resolução RA → conta no login e scripts |
| `NEXT_PUBLIC_APP_TIMEZONE` | — | Fuso para "hoje" e datas (padrão `America/Sao_Paulo`) |

> A `service_role` ignora o RLS. Ela só é usada em código `server-only` após verificar que o usuário atual é administrador (ou, no login, apenas para localizar o e-mail técnico do RA). Nunca a exponha com prefixo `NEXT_PUBLIC_`.

### Supabase Cloud (produção)

1. Crie o projeto e preencha as variáveis acima no provedor de hospedagem (ex.: Vercel › Settings › Environment Variables).
2. Aplique as migrations: `npx supabase link --project-ref <ref>` e `npx supabase db push`.
3. Em *Authentication › Providers › Email*: mantenha e-mail/senha habilitado e **desative "Allow new users to sign up"** (contas são criadas pelo administrador).
4. Crie o primeiro admin com `npm run create-admin` apontando o `.env.local` para o projeto cloud.

## 4. Login por RA (preparado para o TOTVS RM)

O acesso é feito com **RA + senha**. O Supabase Auth exige e-mail, então usuários sem e-mail recebem um e-mail técnico (`<ra>@usuarios.acompanha.local`); o RA fica em `profiles.login`.

A resolução da identidade está isolada em `src/lib/auth-provider.ts`. Para integrar com o RM no futuro, basta trocar essa camada: validar RA/senha na API do RM, criar/atualizar o usuário no Supabase (`profiles.auth_source = 'rm'`) e abrir a sessão. Permissões, RLS e telas não mudam.

## 5. Banco de dados

Migrations em `supabase/migrations/` (aplicadas em ordem):

| Arquivo | Conteúdo |
|---|---|
| `…0001_schema.sql` | Tipos, tabelas, chaves, índices e restrições |
| `…0002_functions.sql` | Triggers (updated_at, perfil automático, critérios padrão, sessões geradas pelos dias da semana, entregas por marco, auditoria) e RPCs transacionais |
| `…0003_rls.sql` | Row Level Security de todas as tabelas |
| `…0004_student_rpc.sql` | Cadastro de aluno direto na equipe |
| `…0005_login_ra.sql` | Login por RA (`profiles.login`, `auth_source`) |
| `…0006_default_weekdays.sql` | Acompanhamentos padrão às quartas e sextas |
| `…0007_fix_challenge_delete.sql` | Permite excluir desafios com avaliações (FK adiável), mantendo critérios usados protegidos |
| `…0008_purge_orphan_students.sql` | Remove alunos sem vínculo ao excluir um desafio |

Principais entidades: `profiles`, `challenges`, `challenge_members` (papel por desafio), `teams`, `students`, `team_memberships` (histórico de participação — transferência encerra o vínculo e cria outro), `evaluation_criteria` (versionados), `monitoring_sessions`, `team_evaluations` (única por equipe+sessão), `student_evaluations` (guardam a equipe do aluno na data), `evaluation_scores` (`NULL` = "Não observado"), `project_milestones`, `team_deliverables`, `pedagogical_notes`, `reports`, `audit_logs`.

**Regras garantidas no banco:**
- Um vínculo ativo por aluno em cada desafio; transferências nunca apagam avaliações. O aluno aparece nos acompanhamentos a partir da data de entrada na equipe (na importação, o padrão é o início do desafio).
- Uma avaliação por equipe por sessão (sem duplicidade acidental); apenas o monitor autor (ou admin) edita; correções ficam em `audit_logs`.
- Critério já utilizado, ao ser editado, gera nova versão — avaliações antigas mantêm a original.
- Ausência de avaliação nunca é nota zero; "Não observado" fica fora das médias.

Comandos úteis: `npm run db:reset` (recria o banco local), `npm run db:types` (regenera `src/lib/supabase/database.types.ts`), `supabase/tests/smoke.sql` (teste SQL de RPCs e RLS — executa em transação e desfaz tudo).

## 6. Perfis e permissões

| Perfil | Escopo | Pode |
|---|---|---|
| Administrador | Global (`profiles.is_admin`) | Tudo: usuários, desafios, importação, critérios, relatórios |
| Coordenador | Por desafio | Ver o desafio, gerenciar equipes/alunos/transferências/critérios, relatórios |
| Professor | Por desafio | Consultar equipes e avaliações, observações pedagógicas |
| Monitor | Por desafio | Avaliar equipes e alunos, corrigir as próprias avaliações |

As permissões são aplicadas em três camadas: interface, Server Actions (`src/lib/auth.ts`) e **RLS no Postgres** (fonte da verdade).

## 7. Funcionalidades

- **Desafios:** dados, status, período, dias de acompanhamento (sessões geradas automaticamente), equipe de acompanhamento (quantidades livres).
- **Equipes:** cadastro, edição, distribuição entre monitores, adicionar/remover/transferir alunos, histórico de participação, exportação Excel.
- **Importação .xlsx:** seleção de aba, prévia, mapeamento livre de colunas, células mescladas, seleção das equipes a importar, validação, duplicidades (matrícula, e-mail, nome) com revisão manual, confirmação e gravação atômica.
- **Acompanhamento:** escolha livre do dia (Hoje, Ontem, dias previstos ou qualquer data passada — o dia é criado na hora), planilha de cada dia com um clique, estados Pendente/Em andamento/Concluído, avaliação coletiva + tabela individual editável na mesma tela ("aplicar a todos", N/O, ausente, situação, observações), resumo do acompanhamento anterior e verificação das dificuldades, rascunho com salvamento automático e backup local.
- **Dashboards:** geral e por desafio, com filtros (desafio, equipe, monitor, período, situação) e gráficos.
- **Relatórios Excel:** diário (4 abas), semanal (7 abas) e equipes — cabeçalhos formatados, filtros, larguras, datas e destaques de atenção.

## 8. Testes

```bash
npm test             # unitários (médias, importação, relatórios)
npm run test:e2e     # E2E Playwright: login → desafio → importação → transferência → avaliação → histórico → dashboard → relatórios
                     # requer Supabase local, `npm run seed:dev` e `npm run sample:xlsx`
                     # se o app não estiver na porta 3000: E2E_BASE_URL=http://localhost:3001 npm run test:e2e
npm run typecheck
npm run lint
```

## 9. Estrutura

```
src/
  app/(app)/…            páginas autenticadas (dashboard, desafios, acompanhamentos, alunos, relatórios, usuários)
  app/api/relatorios/…   Route Handlers que geram os arquivos .xlsx
  app/login/             login por RA
  components/            UI (shadcn/ui em components/ui) e componentes por módulo
  lib/actions/           Server Actions (validação Zod + autorização)
  lib/data/              consultas server-only
  lib/reports/           montagem dos relatórios (ExcelJS)
  lib/import/            leitura e mapeamento de planilhas
  lib/domain/            constantes, datas e regras de notas
  lib/supabase/          clientes (servidor, navegador, admin) e tipos gerados
  proxy.ts               renovação de sessão e redirecionamento (Next 16 "proxy")
supabase/migrations/     schema, funções, RLS
scripts/                 create-admin, seed-dev, generate-sample-xlsx
tests/                   unit (Vitest) e e2e (Playwright)
```

## 10. Próximas versões (fora do MVP)

- Integração de login com o TOTVS RM (camada já isolada em `auth-provider.ts`).
- Envio automático de relatórios por e-mail.
