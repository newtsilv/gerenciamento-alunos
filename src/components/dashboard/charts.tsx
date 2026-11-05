"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TipPayload = { dataKey?: unknown; value?: unknown; name?: unknown; color?: string };
type TipProps = { active?: boolean; payload?: readonly TipPayload[]; label?: unknown; labelFormatter?: (l: string) => string };
import { DELIVERABLE_STATUS, type DeliverableStatus } from "@/lib/domain/constants";
import { formatAverage } from "@/lib/domain/scores";
import { formatDate } from "@/lib/domain/dates";

const axis = { stroke: "var(--muted-foreground)", fontSize: 12, tickLine: false, axisLine: false } as const;

function ChartTooltip({ active, payload, label, labelFormatter }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 text-muted-foreground">{labelFormatter ? labelFormatter(String(label)) : String(label)}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="h-0.5 w-3 rounded-full" style={{ background: p.color }} />
          <strong className="tabular-nums">{typeof p.value === "number" ? formatAverage(p.value, 2) : "—"}</strong>
          <span className="text-muted-foreground">{String(p.name)}</span>
        </p>
      ))}
    </div>
  );
}

export function EvolutionChart({ data }: { data: { date: string; equipes: number | null; alunos: number | null }[] }) {
  if (!data.length) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Ainda não há avaliações no período.</p>;
  }
  return (
    <div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, "dd/MM")} {...axis} />
            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...axis} />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              content={(props) => <ChartTooltip {...(props as TipProps)} labelFormatter={(l) => formatDate(l)} />}
            />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
            <Line type="monotone" dataKey="equipes" name="Média coletiva" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "var(--card)" }} activeDot={{ r: 5 }} connectNulls />
            <Line type="monotone" dataKey="alunos" name="Média individual" stroke="var(--series-2)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: "var(--card)" }} activeDot={{ r: 5 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground">Ver tabela</summary>
        <table className="mt-2 w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">Data</th>
              <th className="py-1 font-normal">Média coletiva</th>
              <th className="py-1 font-normal">Média individual</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date} className="border-t">
                <td className="py-1">{formatDate(d.date)}</td>
                <td className="py-1 tabular-nums">{formatAverage(d.equipes, 2)}</td>
                <td className="py-1 tabular-nums">{formatAverage(d.alunos, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

const DELIV_COLORS: Record<DeliverableStatus, string> = {
  concluida: "var(--success)",
  em_andamento: "var(--brand)",
  bloqueada: "var(--danger)",
  nao_iniciada: "var(--border)",
};

export function DeliverablesChart({
  data,
}: {
  data: { team: string; nao_iniciada: number; em_andamento: number; concluida: number; bloqueada: number }[];
}) {
  if (!data.length || data.every((d) => d.concluida + d.em_andamento + d.bloqueada + d.nao_iniciada === 0)) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Nenhuma entrega cadastrada.</p>;
  }
  const height = Math.max(220, data.length * 30 + 60);
  const order: DeliverableStatus[] = ["concluida", "em_andamento", "bloqueada", "nao_iniciada"];
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }} barCategoryGap={6}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} {...axis} />
          <YAxis type="category" dataKey="team" width={90} {...axis} />
          <Tooltip
            cursor={{ fill: "var(--surface)" }}
            content={(props) => {
              const { active, payload, label } = props as TipProps;
              return active && payload?.length ? (
                <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
                  <p className="mb-1 font-medium">{String(label)}</p>
                  {payload.map((p) => (
                    <p key={String(p.dataKey)} className="flex items-center gap-2">
                      <span className="size-2 rounded-sm" style={{ background: p.color }} />
                      <strong className="tabular-nums">{String(p.value)}</strong>
                      <span className="text-muted-foreground">{String(p.name)}</span>
                    </p>
                  ))}
                </div>
              ) : null;
            }}
          />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
          {order.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              name={DELIVERABLE_STATUS[k]}
              stackId="s"
              fill={DELIV_COLORS[k]}
              stroke="var(--card)"
              strokeWidth={2}
              radius={i === order.length - 1 ? [0, 4, 4, 0] : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
