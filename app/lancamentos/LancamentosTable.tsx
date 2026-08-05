"use client";

import { useMemo, useState } from "react";
import { StatusTag } from "@/components/StatusTag";
import { saldo, status as calcStatus, totalPago } from "@/lib/calculations";
import { money, formatDataBR, hoje } from "@/lib/format";
import type { LancamentoRow, PagamentoRow, Categoria } from "@/lib/types";

export function LancamentosTable({
  lancamentos,
  pagamentos,
  categorias,
}: {
  lancamentos: LancamentoRow[];
  pagamentos: PagamentoRow[];
  categorias: Categoria[];
}) {
  const [filtroStatus, setFiltroStatus] = useState<"pendentes" | "atrasado" | "quitado" | "todos">(
    "pendentes"
  );
  const [busca, setBusca] = useState("");
  const hojeStr = hoje();

  const nomeCategoria = (id: string | null) =>
    categorias.find((c) => c.id === id)?.nome ?? "—";

  const linhas = useMemo(() => {
    return lancamentos
      .map((l) => ({
        lancamento: l,
        status: calcStatus(l, pagamentos, hojeStr),
        pago: totalPago(pagamentos, l.id),
        falta: saldo(l, pagamentos),
      }))
      .filter((row) => {
        if (filtroStatus === "pendentes") return row.status !== "quitado";
        if (filtroStatus === "atrasado") return row.status === "atrasado";
        if (filtroStatus === "quitado") return row.status === "quitado";
        return true;
      })
      .filter((row) =>
        busca ? row.lancamento.descricao.toLowerCase().includes(busca.toLowerCase()) : true
      );
  }, [lancamentos, pagamentos, filtroStatus, busca, hojeStr]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(["pendentes", "atrasado", "quitado", "todos"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltroStatus(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold border border-[var(--border)] ${
              filtroStatus === f ? "bg-[var(--accent-blue)] text-[var(--bg)]" : "text-[var(--text-dim)]"
            }`}
          >
            {f === "pendentes" ? "Pendentes" : f === "atrasado" ? "Atrasadas" : f === "quitado" ? "Quitadas" : "Todas"}
          </button>
        ))}
        <input
          placeholder="Buscar por descrição"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="ml-auto px-3 py-1.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-sm"
        />
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[var(--text-dim)] text-xs uppercase border-b border-[var(--border)]">
            <th className="py-2">Vencimento</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Situação</th>
            <th className="text-right">Valor</th>
            <th className="text-right">Falta</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ lancamento, status, falta }) => (
            <tr key={lancamento.id} className="border-b border-[var(--border)]">
              <td className="py-2">{formatDataBR(lancamento.vencimento)}</td>
              <td className="font-medium">{lancamento.descricao}</td>
              <td className="text-[var(--text-dim)]">{nomeCategoria(lancamento.categoria_id)}</td>
              <td>
                <StatusTag status={status} />
              </td>
              <td className="text-right">{money(lancamento.valor)}</td>
              <td className="text-right font-semibold text-[var(--accent-red)]">{money(falta)}</td>
            </tr>
          ))}
          {linhas.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-[var(--text-dim)]">
                Nenhum lançamento com esses filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
