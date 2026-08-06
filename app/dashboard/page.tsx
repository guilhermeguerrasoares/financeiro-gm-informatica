import { dadosDashboard } from "@/lib/queries/dashboard";
import { DonutChart } from "@/components/DonutChart";
import { PeriodoSelector } from "./PeriodoSelector";
import { KpiCards } from "./KpiCards";
import { FluxoDiario } from "./FluxoDiario";
import { FluxoSemanal } from "./FluxoSemanal";
import { MetasProgresso } from "./MetasProgresso";
import { AtencaoCard } from "./AtencaoCard";
import { money, hoje, ultimoDiaDoMes } from "@/lib/format";

function resolverPeriodo(searchParams: { mes?: string; inicio?: string; fim?: string }) {
  if (searchParams.inicio && searchParams.fim) {
    return {
      periodo: { inicio: searchParams.inicio, fim: searchParams.fim },
      periodoFluxo: { inicio: searchParams.inicio, fim: searchParams.fim },
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
    // O fluxo diário cobre o mês inteiro (mesmo além de hoje) para mostrar
    // previsão, diferente do período acima que trava em hoje.
    periodoFluxo: { inicio: `${mes}-01`, fim: fimDoMes },
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
  const { periodo, periodoFluxo, modo, mesAtual } = resolverPeriodo(params);
  const d = await dadosDashboard(periodo, periodoFluxo);

  const totalMovimentado = d.totalEntradasPeriodo + d.totalSaidasPeriodo;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">
          Bem-vindo de volta <span className="brand-text">GM Stúdio Gamer</span>
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">Aqui está o panorama financeiro do período.</p>
      </div>

      <PeriodoSelector mesAtual={mesAtual} inicioAtual={periodo.inicio} fimAtual={periodo.fim} modoAtual={modo} />

      <KpiCards
        totalEntradas={d.totalEntradasPeriodo}
        totalSaidas={d.totalSaidasPeriodo}
        resultado={d.resultadoPeriodo}
        saldoContas={d.saldoConsolidado}
        saldoPorConta={d.saldoPorConta}
        pagamentosPeriodo={d.pagamentosPeriodo}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <FluxoDiario
          fluxoDiario={d.fluxoDiario}
          lancamentosFluxo={d.lancamentosFluxo}
          pagamentosFluxo={d.pagamentosFluxo}
        />

        <div className="glass glow-ring rounded-2xl p-5 flex flex-col items-center justify-center">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-dim)] mb-4 self-start">
            Entradas x Saídas
          </h2>
          <div className="relative">
            <DonutChart entradas={d.totalEntradasPeriodo} saidas={d.totalSaidasPeriodo} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs text-[var(--text-dim)]">Total</span>
              <span className="text-sm font-semibold">{money(totalMovimentado)}</span>
            </div>
          </div>
          <div className="flex gap-4 mt-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-green)]" /> Entradas ·{" "}
              {money(d.totalEntradasPeriodo)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-red)]" /> Saídas ·{" "}
              {money(d.totalSaidasPeriodo)}
            </span>
          </div>
        </div>
      </div>

      <FluxoSemanal
        semanas={d.fluxoSemanal}
        lancamentosFluxo={d.lancamentosFluxo}
        pagamentosFluxo={d.pagamentosFluxo}
      />

      <MetasProgresso progressos={d.progressoMetas} />

      <AtencaoCard
        atrasados={d.atrasados}
        clientesInadimplentes={d.clientesInadimplentesLista}
        totalAtrasado={d.totalAtrasado}
      />
    </div>
  );
}
