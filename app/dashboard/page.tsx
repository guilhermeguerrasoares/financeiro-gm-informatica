import { dadosDashboard } from "@/lib/queries/dashboard";
import { Kpi } from "@/components/Kpi";
import { PeriodoSelector } from "./PeriodoSelector";
import { money, formatDataBR, hoje, ultimoDiaDoMes } from "@/lib/format";

function resolverPeriodo(searchParams: { mes?: string; inicio?: string; fim?: string }) {
  if (searchParams.inicio && searchParams.fim) {
    return {
      periodo: { inicio: searchParams.inicio, fim: searchParams.fim },
      modo: "personalizado" as const,
      mesAtual: searchParams.inicio.slice(0, 7),
    };
  }

  const mes = searchParams.mes || hoje().slice(0, 7);
  const fimDoMes = ultimoDiaDoMes(mes);
  const hojeStr = hoje();
  // Mês atual: fim = hoje (não faz sentido "vencer em 7 dias" a partir de um
  // dia que ainda não chegou). Mês passado: fim = último dia do mês mesmo.
  const fim = fimDoMes > hojeStr ? hojeStr : fimDoMes;

  return {
    periodo: { inicio: `${mes}-01`, fim },
    modo: "mes" as const,
    mesAtual: mes,
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; inicio?: string; fim?: string }>;
}) {
  const params = await searchParams;
  const { periodo, modo, mesAtual } = resolverPeriodo(params);
  const d = await dadosDashboard(periodo);
  const maiorSemana = Math.max(1, ...d.semanas.map((s) => Math.max(s.entradas, s.saidas)));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

      <PeriodoSelector mesAtual={mesAtual} inicioAtual={periodo.inicio} fimAtual={periodo.fim} modoAtual={modo} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Kpi label="Saldo consolidado" valor={money(d.saldoConsolidado)} />
        <Kpi label="Atrasado" valor={money(d.totalAtrasado)} tone="red" />
        <Kpi label="Vence em 7 dias" valor={money(d.totalSemana)} tone="amber" />
        <Kpi label="Receita do período" valor={money(d.receitaPeriodo)} tone="green" />
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5 mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-4">
          Fluxo de caixa por semana
        </h2>
        <div className="flex gap-4 items-end h-40">
          {d.semanas.map((s) => (
            <div key={s.inicio} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="flex gap-1 items-end h-32 w-full justify-center cursor-default"
                title={`${formatDataBR(s.inicio)} a ${formatDataBR(s.fim)}\nEntradas: ${money(s.entradas)}\nSaídas: ${money(s.saidas)}`}
              >
                <div
                  className="w-4 bg-[var(--accent-green)] rounded-t"
                  style={{ height: `${Math.max(2, (s.entradas / maiorSemana) * 100)}%` }}
                />
                <div
                  className="w-4 bg-[var(--accent-red)] rounded-t"
                  style={{ height: `${Math.max(2, (s.saidas / maiorSemana) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-[var(--text-dim)]">{formatDataBR(s.fim)}</span>
            </div>
          ))}
        </div>
      </div>

      {(d.contasAtrasadas > 0 || d.clientesInadimplentes > 0) && (
        <div className="bg-[var(--surface)] border border-[var(--accent-red)] rounded-lg p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--accent-red)] mb-3">
            Precisa de atenção
          </h2>
          <ul className="space-y-1 text-sm">
            {d.contasAtrasadas > 0 && (
              <li>
                {d.contasAtrasadas} conta(s) vencida(s) — {money(d.totalAtrasado)}
              </li>
            )}
            {d.clientesInadimplentes > 0 && <li>{d.clientesInadimplentes} cliente(s) marcado(s) como inadimplente</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
