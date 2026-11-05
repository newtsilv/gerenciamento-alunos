"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  Loader2Icon,
  UploadCloudIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/shared/field";
import { NativeSelect } from "@/components/shared/native-select";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import { todayISO } from "@/lib/domain/dates";
import {
  IMPORT_FIELDS,
  distinctValues,
  guessMapping,
  mapRows,
  normalizeHeader,
  type ColumnMapping,
  type ImportField,
  type MappedRow,
} from "@/lib/import/mapping";
import {
  findCandidates,
  importRoster,
  parseSpreadsheet,
  type ImportCandidate,
  type ImportSummary,
} from "@/lib/actions/import";
import type { ParsedSheet } from "@/lib/import/parse-xlsx";

type Decision = "" | "new" | string; // string = id do aluno existente
type ReviewRow = MappedRow & {
  exact?: ImportCandidate; // mesma matrícula
  possible: ImportCandidate[]; // mesmo e-mail/nome sem matrícula correspondente
  decision: Decision;
  newTeam: boolean;
};

const STEPS = ["Arquivo", "Mapeamento", "Revisão", "Concluído"];

export function ImportWizard({ challengeId, existingTeams, challengeStartDate }: { challengeId: string; existingTeams: string[]; challengeStartDate: string }) {
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [challengeFilter, setChallengeFilter] = useState<string | undefined>(undefined);
  const [fillDown, setFillDown] = useState(true);
  const [excludedTeams, setExcludedTeams] = useState<Set<string>>(new Set());
  const [review, setReview] = useState<ReviewRow[]>([]);
  const [startDate, setStartDate] = useState(() => (challengeStartDate < todayISO() ? challengeStartDate : todayISO()));
  const [filter, setFilter] = useState<"all" | "pending" | "errors">("all");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const sheet = sheets[sheetIndex];
  const teamSet = useMemo(() => new Set(existingTeams.map((t) => t.toLowerCase())), [existingTeams]);

  function selectSheet(i: number, list = sheets) {
    setSheetIndex(i);
    setMapping(guessMapping(list[i]?.headers ?? []));
    setChallengeFilter(undefined);
    setExcludedTeams(new Set());
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const r = await parseSpreadsheet(challengeId, fd);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setSheets(r.data);
      const best = r.data.findIndex((s) => s.rows.length > 0);
      selectSheet(Math.max(0, best), r.data);
    });
  }

  const challengeValues = useMemo(() => (sheet ? distinctValues(sheet.rows, mapping.challenge) : []), [sheet, mapping.challenge]);
  const fileTeams = useMemo(() => {
    if (!sheet || mapping.team_name === undefined) return [];
    const rows = mapRows(sheet.rows, mapping, {
      fillDownTeam: fillDown,
      challengeFilter: mapping.challenge !== undefined && challengeValues.length > 1 ? challengeFilter : undefined,
    });
    return [...new Set(rows.map((r) => r.team_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  }, [sheet, mapping, fillDown, challengeFilter, challengeValues.length]);

  const missingRequired = (Object.keys(IMPORT_FIELDS) as ImportField[]).filter(
    (f) => IMPORT_FIELDS[f].required && mapping[f] === undefined,
  );

  function analyze() {
    if (!sheet) return;
    if (mapping.challenge !== undefined && challengeFilter === undefined && challengeValues.length > 1) {
      toast.error("Selecione qual valor da coluna Desafio corresponde a este desafio.");
      return;
    }
    const rows = mapRows(sheet.rows, mapping, {
      challengeFilter: mapping.challenge !== undefined && challengeValues.length > 1 ? challengeFilter : undefined,
      fillDownTeam: fillDown,
      teams: new Set(fileTeams.filter((t) => !excludedTeams.has(t))),
    });
    if (!rows.length) {
      toast.error("Nenhuma linha com dados após o mapeamento.");
      return;
    }
    startTransition(async () => {
      const valid = rows.filter((r) => !r.errors.length);
      const r = await findCandidates(challengeId, {
        registrations: valid.map((v) => v.registration).filter(Boolean),
        emails: valid.map((v) => v.email).filter(Boolean),
        names: valid.map((v) => v.full_name),
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const cands = r.data;
      setReview(
        rows.map((row) => {
          const exact = row.registration
            ? cands.find((c) => c.registration?.toLowerCase() === row.registration.toLowerCase())
            : undefined;
          const possible = exact
            ? []
            : cands.filter(
                (c) =>
                  (row.email && c.email?.toLowerCase() === row.email) ||
                  normalizeHeader(c.full_name) === normalizeHeader(row.full_name),
              );
          // com matrícula nova, um homônimo com matrícula diferente não é a mesma pessoa
          const relevant = row.registration ? possible.filter((c) => !c.registration) : possible;
          return {
            ...row,
            exact,
            possible: relevant,
            decision: exact ? exact.student_id : relevant.length ? "" : "new",
            newTeam: !teamSet.has(row.team_name.toLowerCase()),
          };
        }),
      );
      setFilter("all");
      setStep(2);
    });
  }

  const importable = review.filter((r) => !r.errors.length);
  const unresolved = importable.filter((r) => r.decision === "");
  const errorRows = review.filter((r) => r.errors.length);
  const newTeams = [...new Set(importable.filter((r) => r.newTeam).map((r) => r.team_name))];
  const existingStudent = (r: ReviewRow) => r.exact ?? r.possible.find((c) => c.student_id === r.decision);
  const transfers = importable.filter((r) => {
    const c = existingStudent(r);
    return c?.current_team_name && c.current_team_name.toLowerCase() !== r.team_name.toLowerCase();
  });

  const visible = review.filter((r) =>
    filter === "errors" ? r.errors.length : filter === "pending" ? !r.errors.length && (r.decision === "" || r.warnings.length) : true,
  );

  function doImport() {
    return new Promise<boolean>((resolve) =>
      startTransition(async () => {
        const r = await importRoster(
          challengeId,
          importable.map((row) => ({
            team_name: row.team_name,
            full_name: row.full_name,
            registration: row.registration || undefined,
            email: row.email || undefined,
            existing_student_id: row.decision && row.decision !== "new" ? row.decision : undefined,
          })),
          startDate,
        );
        if (!r.ok) {
          toast.error(r.error);
          resolve(false);
          return;
        }
        toast.success("Importação concluída.");
        setSummary(r.data);
        setStep(3);
        resolve(true);
      }),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-wrap gap-2" aria-label="Etapas">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={cn(
              "flex h-8 items-center gap-2 rounded-full border px-3 text-sm",
              i === step ? "border-brand bg-brand-soft font-medium text-brand" : i < step ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span className={cn("grid size-5 place-items-center rounded-full text-xs", i <= step ? "bg-brand text-primary-foreground" : "bg-surface")}>
              {i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Selecione a planilha</CardTitle>
            <CardDescription>Arquivo .xlsx com, no mínimo, nome do aluno e equipe. A estrutura das colunas é livre.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onFile(e.dataTransfer.files?.[0]);
              }}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors hover:border-brand/40 hover:bg-brand-soft/40"
            >
              {pending ? <Loader2Icon className="size-8 animate-spin text-brand" /> : <UploadCloudIcon className="size-8 text-brand" />}
              <span className="font-medium">{fileName || "Clique ou arraste o arquivo aqui"}</span>
              <span className="text-sm text-muted-foreground">Somente .xlsx, até 8 MB</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />

            {sheets.length > 0 && sheet && (
              <>
                <Field label="Aba">
                  <div className="flex flex-wrap gap-1.5">
                    {sheets.map((s, i) => (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => selectSheet(i)}
                        className={cn(
                          "flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors",
                          i === sheetIndex ? "border-brand bg-brand-soft text-brand" : "hover:bg-surface",
                        )}
                      >
                        <FileSpreadsheetIcon className="size-4" />
                        {s.name}
                        <span className="text-xs text-muted-foreground">({s.totalRows})</span>
                      </button>
                    ))}
                  </div>
                </Field>
                <Preview sheet={sheet} />
                <div className="flex justify-end">
                  <Button onClick={() => setStep(1)} disabled={!sheet.rows.length}>
                    Continuar
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === 1 && sheet && (
        <Card>
          <CardHeader>
            <CardTitle>Mapeie as colunas</CardTitle>
            <CardDescription>
              Aba <strong>{sheet.name}</strong> · {sheet.totalRows} linha(s). Sugerimos um mapeamento a partir dos cabeçalhos — confira.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(IMPORT_FIELDS) as ImportField[]).map((field) => (
                <Field key={field} label={IMPORT_FIELDS[field].label} required={IMPORT_FIELDS[field].required}>
                  <NativeSelect
                    value={mapping[field] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [field]: e.target.value === "" ? undefined : Number(e.target.value) }))
                    }
                  >
                    <option value="">— Não importar —</option>
                    {sheet.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              ))}
              {mapping.challenge !== undefined && challengeValues.length > 1 && (
                <Field label="Importar apenas as linhas do desafio" required hint="A planilha contém mais de um desafio.">
                  <NativeSelect value={challengeFilter ?? ""} onChange={(e) => setChallengeFilter(e.target.value || undefined)}>
                    <option value="">Selecione…</option>
                    {challengeValues.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--brand)]" checked={fillDown} onChange={(e) => setFillDown(e.target.checked)} />
              <span>
                Repetir a equipe da linha anterior quando a célula estiver vazia
                <span className="block text-xs text-muted-foreground">Use quando a planilha agrupa alunos com a equipe em células mescladas.</span>
              </span>
            </label>
            {fileTeams.length > 0 && (
              <Field
                label={`Equipes a importar (${fileTeams.length - excludedTeams.size} de ${fileTeams.length})`}
                hint="Clique para incluir/excluir. Útil quando a planilha contém equipes de vários desafios."
              >
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className="h-8 rounded-lg border px-2.5 text-xs hover:bg-surface" onClick={() => setExcludedTeams(new Set())}>
                    Todas
                  </button>
                  <button type="button" className="h-8 rounded-lg border px-2.5 text-xs hover:bg-surface" onClick={() => setExcludedTeams(new Set(fileTeams))}>
                    Nenhuma
                  </button>
                  {fileTeams.map((t) => {
                    const on = !excludedTeams.has(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setExcludedTeams((cur) => {
                            const next = new Set(cur);
                            if (on) next.add(t);
                            else next.delete(t);
                            return next;
                          })
                        }
                        className={cn(
                          "h-8 rounded-lg border px-2.5 text-xs transition-colors",
                          on ? "border-brand bg-brand-soft font-medium text-brand" : "text-muted-foreground line-through hover:bg-surface",
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}
            {mapping.registration === undefined && (
              <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                Sem coluna de matrícula, os alunos serão comparados por nome e e-mail e as possíveis duplicidades exigirão revisão manual.
              </p>
            )}
            <Preview sheet={sheet} highlight={mapping} />
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>
                Voltar
              </Button>
              <Button onClick={analyze} disabled={missingRequired.length > 0 || pending || (fileTeams.length > 0 && excludedTeams.size === fileTeams.length)}>
                {pending && <Loader2Icon className="animate-spin" />}
                Analisar dados
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MiniStat label="Registros válidos" value={importable.length} tone="info" />
            <MiniStat label="Equipes novas" value={newTeams.length} tone="info" />
            <MiniStat label="Transferências" value={transfers.length} tone={transfers.length ? "warning" : "neutral"} />
            <MiniStat label="Duplicidades a revisar" value={unresolved.length} tone={unresolved.length ? "warning" : "success"} />
            <MiniStat label="Com erro (ignorados)" value={errorRows.length} tone={errorRows.length ? "danger" : "neutral"} />
          </div>

          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      ["all", `Todos (${review.length})`],
                      ["pending", `Revisar (${importable.filter((r) => r.decision === "" || r.warnings.length).length})`],
                      ["errors", `Erros (${errorRows.length})`],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={cn("h-8 rounded-lg border px-3 text-sm", filter === key ? "border-brand bg-brand-soft text-brand" : "hover:bg-surface")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {unresolved.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReview((rs) => rs.map((r) => (r.decision === "" ? { ...r, decision: "new" } : r)))}
                  >
                    Tratar pendentes como novos alunos
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-surface text-left text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-normal">Linha</th>
                      <th className="px-3 py-2 font-normal">Aluno</th>
                      <th className="px-3 py-2 font-normal">Equipe</th>
                      <th className="px-3 py-2 font-normal">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visible.slice(0, 500).map((r) => {
                      const idx = review.indexOf(r);
                      const existing = existingStudent(r);
                      const moving = existing?.current_team_name && existing.current_team_name.toLowerCase() !== r.team_name.toLowerCase();
                      return (
                        <tr key={r.rowNumber} className={cn(r.errors.length && "bg-danger-soft/50", !r.errors.length && r.decision === "" && "bg-warning-soft/50")}>
                          <td className="px-3 py-2 align-top text-muted-foreground tabular-nums">{r.rowNumber}</td>
                          <td className="px-3 py-2 align-top">
                            <p className="font-medium">{r.full_name || "—"}</p>
                            <p className="text-xs text-muted-foreground">{[r.registration, r.email].filter(Boolean).join(" · ") || "Sem matrícula/e-mail"}</p>
                          </td>
                          <td className="px-3 py-2 align-top">
                            {r.team_name || "—"}
                            {r.newTeam && r.team_name && <StatusBadge tone="info" className="ml-2">nova</StatusBadge>}
                          </td>
                          <td className="min-w-64 px-3 py-2 align-top">
                            <div className="flex flex-col gap-1.5">
                              {r.errors.map((e) => (
                                <span key={e} className="inline-flex items-center gap-1 text-danger">
                                  <XCircleIcon className="size-4" /> {e}
                                </span>
                              ))}
                              {!r.errors.length && r.exact && (
                                <span className="inline-flex items-center gap-1 text-success">
                                  <CheckCircle2Icon className="size-4" /> Aluno já cadastrado (matrícula)
                                </span>
                              )}
                              {!r.errors.length && !r.exact && r.possible.length > 0 && (
                                <NativeSelect
                                  value={r.decision}
                                  className="h-8"
                                  aria-label="Decisão sobre duplicidade"
                                  onChange={(e) =>
                                    setReview((rs) => rs.map((x, i) => (i === idx ? { ...x, decision: e.target.value } : x)))
                                  }
                                >
                                  <option value="">Possível duplicidade — decidir…</option>
                                  <option value="new">Cadastrar como novo aluno</option>
                                  {r.possible.map((c) => (
                                    <option key={c.student_id} value={c.student_id}>
                                      Mesmo aluno: {c.full_name}
                                      {c.registration ? ` (${c.registration})` : ""}
                                      {c.current_team_name ? ` · ${c.current_team_name}` : ""}
                                    </option>
                                  ))}
                                </NativeSelect>
                              )}
                              {!r.errors.length && !r.exact && !r.possible.length && <span className="text-muted-foreground">Novo aluno</span>}
                              {moving && (
                                <StatusBadge tone="warning">
                                  Transferência: {existing!.current_team_name} → {r.team_name}
                                </StatusBadge>
                              )}
                              {existing?.current_team_name && !moving && <StatusBadge>Já está nesta equipe</StatusBadge>}
                              {r.warnings.map((w) => (
                                <span key={w} className="text-xs text-warning">
                                  {w}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {visible.length > 500 && <p className="p-3 text-center text-xs text-muted-foreground">Exibindo 500 de {visible.length} linhas.</p>}
                {visible.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nada para exibir neste filtro.</p>}
              </div>

              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end sm:justify-between">
                <Field
                  label="Desde quando os alunos estão nessas equipes?"
                  htmlFor="imp-date"
                  className="sm:w-80"
                  hint="Normalmente é o início do desafio. Os alunos só aparecem nos acompanhamentos a partir desta data."
                >
                  <Input id="imp-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </Field>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Voltar
                  </Button>
                  <ConfirmDialog
                    title="Confirmar importação?"
                    description={
                      <>
                        Serão processados <strong>{importable.length}</strong> registro(s), criando <strong>{newTeams.length}</strong> equipe(s) e{" "}
                        <strong>{transfers.length}</strong> transferência(s). {errorRows.length > 0 && `${errorRows.length} linha(s) com erro serão ignoradas.`}{" "}
                        A operação é atômica: se algo falhar, nada é gravado.
                      </>
                    }
                    confirmLabel="Importar"
                    onConfirm={doImport}
                    trigger={
                      <Button disabled={!importable.length || unresolved.length > 0 || pending}>
                        {pending && <Loader2Icon className="animate-spin" />}
                        {unresolved.length ? `Revise ${unresolved.length} duplicidade(s)` : `Importar ${importable.length} registro(s)`}
                      </Button>
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 3 && summary && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-success-soft text-success">
              <CheckCircle2Icon className="size-7" />
            </span>
            <h2 className="text-xl font-semibold">Importação concluída</h2>
            <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
              <MiniStat label="Equipes criadas" value={summary.teams_created} tone="info" />
              <MiniStat label="Alunos novos" value={summary.students_created} tone="info" />
              <MiniStat label="Alunos existentes" value={summary.students_linked} tone="neutral" />
              <MiniStat label="Vínculos criados" value={summary.memberships_created} tone="success" />
              <MiniStat label="Transferências" value={summary.transfers} tone="warning" />
              <MiniStat label="Sem alteração" value={summary.unchanged} tone="neutral" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep(0); setSheets([]); setFileName(""); setReview([]); }}>
                Nova importação
              </Button>
              <Button render={<Link href={`/desafios/${challengeId}/equipes`} />}>Ver equipes</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "info" | "success" | "warning" | "danger" | "neutral" }) {
  const color = { info: "text-brand", success: "text-success", warning: "text-warning", danger: "text-danger", neutral: "text-foreground" }[tone];
  return (
    <div className="rounded-xl border bg-card p-3 text-left">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-semibold tabular-nums", color)}>{value}</p>
    </div>
  );
}

function Preview({ sheet, highlight }: { sheet: ParsedSheet; highlight?: ColumnMapping }) {
  const mapped = new Map(Object.entries(highlight ?? {}).map(([f, i]) => [i, IMPORT_FIELDS[f as ImportField].label]));
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">Prévia (primeiras 8 linhas)</p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left">
            <tr>
              {sheet.headers.map((h, i) => (
                <th key={i} className={cn("px-3 py-2 font-medium whitespace-nowrap", mapped.has(i) && "bg-brand-soft text-brand")}>
                  {h}
                  {mapped.has(i) && <span className="block text-xs font-normal">→ {mapped.get(i)}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sheet.rows.slice(0, 8).map((r) => (
              <tr key={r.rowNumber}>
                {sheet.headers.map((_, i) => (
                  <td key={i} className="px-3 py-1.5 whitespace-nowrap">
                    {r.cells[i] || <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
