"use client";

import { useMemo, useState } from "react";
import { money, formatDataBR, diffDias, dataLocal, hoje } from "@/lib/format";
import { lucroPermuta } from "@/lib/calculations";
import { VenderModal } from "./VenderModal";
import { DesmembrarModal } from "./DesmembrarModal";
import { NovaPermutaModal } from "./NovaPermutaModal";
import type { ItemPermuta } from "@/lib/queries/itensPermuta";
import type { Categoria, ContaFinanceira } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  em_estoque: "Em estoque",
  revendido: "Vendido",
  usado_em_conserto: "Usado em conserto",
  descartado: "Descartado",
};

const STATUS_COLOR: Record<string, string> = {
  em_estoque: "text-[var(--accent-blue)]",
  revendido: "text-[var(--accent-green)]",
  usado_em_conserto: "text-[var(--text-dim)]",
  descartado: "text-[var(--accent-red)]",
};

export function PermutasList({
  itens,
  categorias,
  contas,
}: {
  itens: ItemPermuta[];
  categorias: Categoria[];
  contas: ContaFinanceira[];
}) {
  const [vendendo, setVendendo] = useState<ItemPermuta | null>(null);
  const [desmembrando, setDesmembrando] = useState<ItemPermuta | null>(null);
  const [criandoAvulsa, setCriandoAvulsa] = useState(false);
  const hojeStr = hoje();

  const resumo = useMemo(() => {
    let totalRecebido = 0;
    let totalEmEstoque = 0;
    let totalVendido = 0;
    let lucroTotal = 0;
    let qtdEmEstoque = 0;
    let qtdVendidos = 0;
    let somaDiasEstoque = 0;

    for (const item of itens) {
      totalRecebido += item.valor_estimado ?? 0;
      if (item.status === "em_estoque") {
        totalEmEstoque += item.valor_estimado ?? 0;
        qtdEmEstoque += 1;
      }
      if (item.status === "revendido" && item.valor_venda != null) {
        totalVendido += item.valor_venda;
        lucroTotal += lucroPermuta(item);
        qtdVendidos += 1;
        somaDiasEstoque += diffDias(dataLocal(item.created_at), item.data_venda ?? hojeStr);
      }
    }

    return {
      totalRecebido,
      totalEmEstoque,
      totalVendido,
      lucroTotal,
      qtdEmEstoque,
      qtdVendidos,
      tempoMedioEstoque: qtdVendidos > 0 ? Math.round(somaDiasEstoque / qtdVendidos) : null,
    };
  }, [itens, hojeStr]);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => setCriandoAvulsa(true)}
          className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded"
        >
          Nova permuta
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-[var(--text-dim)] uppercase tracking-wide">Recebido em permutas</p>
          <p className="text-lg font-semibold mt-1">{money(resumo.totalRecebido)}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-[var(--text-dim)] uppercase tracking-wide">Em estoque</p>
          <p className="text-lg font-semibold mt-1">{money(resumo.totalEmEstoque)}</p>
          <p className="text-xs text-[var(--text-dim)]">{resumo.qtdEmEstoque} item(ns)</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-[var(--text-dim)] uppercase tracking-wide">Vendido</p>
          <p className="text-lg font-semibold mt-1 text-[var(--accent-green)]">{money(resumo.totalVendido)}</p>
          <p className="text-xs text-[var(--text-dim)]">{resumo.qtdVendidos} item(ns)</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-[var(--text-dim)] uppercase tracking-wide">Lucro</p>
          <p className={`text-lg font-semibold mt-1 ${resumo.lucroTotal >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>
            {money(resumo.lucroTotal)}
          </p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs text-[var(--text-dim)] uppercase tracking-wide">Tempo médio em estoque</p>
          <p className="text-lg font-semibold mt-1">
            {resumo.tempoMedioEstoque !== null ? `${resumo.tempoMedioEstoque} dias` : "—"}
          </p>
        </div>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[var(--text-dim)] text-xs uppercase border-b border-[var(--border)]">
            <th className="py-2">Item</th>
            <th>Recebido em</th>
            <th>Status</th>
            <th className="text-right">Valor estimado</th>
            <th className="text-right">Valor vendido</th>
            <th className="text-right">Lucro</th>
            <th className="text-right">Dias em estoque</th>
            <th className="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => {
            const recebidoEm = dataLocal(item.created_at);
            const dias = diffDias(recebidoEm, item.data_venda ?? hojeStr);
            const temLucro = item.status === "revendido" && item.valor_venda != null;
            const lucro = temLucro ? lucroPermuta(item) : null;
            return (
              <tr key={item.id} className="border-b border-[var(--border)]">
                <td className="py-2">{item.descricao}</td>
                <td className="text-[var(--text-dim)]">{formatDataBR(recebidoEm)}</td>
                <td className={STATUS_COLOR[item.status]}>{STATUS_LABEL[item.status]}</td>
                <td className="text-right">{money(item.valor_estimado)}</td>
                <td className="text-right">{item.valor_venda ? money(item.valor_venda) : "—"}</td>
                <td className={`text-right ${lucro !== null ? (lucro >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]") : ""}`}>
                  {lucro !== null ? money(lucro) : "—"}
                </td>
                <td className="text-right">{dias}</td>
                <td className="text-right">
                  {item.status === "em_estoque" && (
                    <div className="flex justify-end gap-2">
                      {/* Só faz sentido dividir o que ainda tem valor a dividir:
                          um item de valor zero não tem como sustentar dois. */}
                      {(item.valor_estimado ?? 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => setDesmembrando(item)}
                          className="px-3 py-1 text-xs border border-[var(--border)] rounded"
                        >
                          Desmembrar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setVendendo(item)}
                        className="px-3 py-1 text-xs bg-[var(--accent-green)] text-[var(--bg)] font-semibold rounded"
                      >
                        Marcar como vendido
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {itens.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-[var(--text-dim)]">
                Nenhum item de permuta registrado ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <VenderModal item={vendendo} onClose={() => setVendendo(null)} categorias={categorias} contas={contas} />
      <DesmembrarModal item={desmembrando} onClose={() => setDesmembrando(null)} />
      <NovaPermutaModal
        open={criandoAvulsa}
        onClose={() => setCriandoAvulsa(false)}
        categorias={categorias}
        contas={contas}
      />
    </div>
  );
}
