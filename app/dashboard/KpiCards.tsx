"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Scale, Wallet, Repeat } from "lucide-react";
import { Kpi } from "@/components/Kpi";
import { Modal } from "@/components/Modal";
import { money, formatDataBR } from "@/lib/format";
import type { ItemPermutaComLucro, PagamentoComLancamento } from "@/lib/queries/dashboard";
import type { ContaFinanceira } from "@/lib/types";

type ModalAberto = "entradas" | "saidas" | "resultado" | "contas" | "permutas" | null;

export function KpiCards({
  totalEntradas,
  totalSaidas,
  resultado,
  saldoContas,
  saldoPorConta,
  pagamentosPeriodo,
  lucroPermutas,
  itensPermutaVendidos,
}: {
  totalEntradas: number;
  totalSaidas: number;
  resultado: number;
  saldoContas: number;
  saldoPorConta: { conta: ContaFinanceira; saldo: number }[];
  pagamentosPeriodo: PagamentoComLancamento[];
  lucroPermutas: number;
  itensPermutaVendidos: ItemPermutaComLucro[];
}) {
  const [modalAberto, setModalAberto] = useState<ModalAberto>(null);

  const entradas = pagamentosPeriodo.filter((p) => p.lancamento.tipo === "receita");
  const saidas = pagamentosPeriodo.filter((p) => p.lancamento.tipo === "despesa");

  const titulo = {
    entradas: "Entradas do período",
    saidas: "Saídas do período",
    resultado: "Resultado do período",
    contas: "Saldo em contas",
    permutas: "Lucro em permutas do período",
  }[modalAberto ?? "entradas"];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <button type="button" onClick={() => setModalAberto("entradas")} className="text-left">
          <Kpi label="Entradas" valor={money(totalEntradas)} tone="green" icon={TrendingUp} />
        </button>
        <button type="button" onClick={() => setModalAberto("saidas")} className="text-left">
          <Kpi label="Saídas" valor={money(totalSaidas)} tone="red" icon={TrendingDown} />
        </button>
        <button type="button" onClick={() => setModalAberto("resultado")} className="text-left">
          <Kpi
            label="Resultado"
            valor={money(resultado)}
            tone={resultado >= 0 ? "green" : "red"}
            icon={Scale}
          />
        </button>
        <button type="button" onClick={() => setModalAberto("contas")} className="text-left">
          <Kpi label="Saldo em contas" valor={money(saldoContas)} icon={Wallet} />
        </button>
        <button type="button" onClick={() => setModalAberto("permutas")} className="text-left">
          <Kpi
            label="Lucro em permutas"
            valor={money(lucroPermutas)}
            tone={lucroPermutas >= 0 ? "green" : "red"}
            icon={Repeat}
          />
        </button>
      </div>

      <Modal open={modalAberto !== null} onClose={() => setModalAberto(null)} title={titulo}>
        {modalAberto === "contas" ? (
          <ul className="space-y-1">
            {saldoPorConta.map(({ conta, saldo }) => (
              <li key={conta.id} className="text-sm flex justify-between border-b border-[var(--border)] py-1.5">
                <span>{conta.nome}</span>
                <span className={saldo >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}>
                  {money(saldo)}
                </span>
              </li>
            ))}
            {saldoPorConta.length === 0 && (
              <li className="text-sm text-[var(--text-dim)]">Nenhuma conta cadastrada.</li>
            )}
          </ul>
        ) : modalAberto === "permutas" ? (
          <ul className="space-y-1">
            {itensPermutaVendidos.map(({ item, lucro }) => (
              <li key={item.id} className="text-sm flex justify-between gap-3 border-b border-[var(--border)] py-1.5">
                <span className="min-w-0">
                  <span className="block truncate">{item.descricao}</span>
                  <span className="text-xs text-[var(--text-dim)]">
                    {formatDataBR(item.data_venda)} · Recebido por {money(item.valor_estimado)}, vendido por {money(item.valor_venda)}
                  </span>
                </span>
                <span className={`shrink-0 font-semibold ${lucro >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
                  {lucro >= 0 ? "+" : "−"} {money(Math.abs(lucro))}
                </span>
              </li>
            ))}
            {itensPermutaVendidos.length === 0 && (
              <li className="text-sm text-[var(--text-dim)]">Nenhuma permuta vendida no período.</li>
            )}
          </ul>
        ) : (
          <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
            {(modalAberto === "entradas" ? entradas : modalAberto === "saidas" ? saidas : pagamentosPeriodo).map(
              ({ pagamento, lancamento }) => (
                <li key={pagamento.id} className="text-sm flex justify-between gap-3 border-b border-[var(--border)] py-1.5">
                  <span className="min-w-0">
                    <span className="block truncate">{lancamento.descricao}</span>
                    <span className="text-xs text-[var(--text-dim)]">{formatDataBR(pagamento.data_pagamento)}</span>
                  </span>
                  <span
                    className={`shrink-0 font-semibold ${
                      lancamento.tipo === "receita" ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"
                    }`}
                  >
                    {lancamento.tipo === "receita" ? "+" : "−"} {money(pagamento.valor)}
                  </span>
                </li>
              )
            )}
            {(modalAberto === "entradas" ? entradas : modalAberto === "saidas" ? saidas : pagamentosPeriodo).length ===
              0 && <li className="text-sm text-[var(--text-dim)]">Nenhuma transação no período.</li>}
          </ul>
        )}
      </Modal>
    </>
  );
}
