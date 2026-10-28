"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ContaModal } from "./ContaModal";
import { AjusteSaldoModal } from "./AjusteSaldoModal";
import { TransferenciaModal } from "./TransferenciaModal";
import { excluirContaAction } from "./actions";
import { money } from "@/lib/format";
import type { ContaFinanceira } from "@/lib/types";

export function ContasList({
  contas,
  saldoPorConta,
  pagamentosPorConta,
  saldoConsolidado,
}: {
  contas: ContaFinanceira[];
  saldoPorConta: Record<string, number>;
  pagamentosPorConta: Record<string, number>;
  saldoConsolidado: number;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const [ajustando, setAjustando] = useState<ContaFinanceira | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  async function excluir(conta: ContaFinanceira) {
    const qtdPagamentos = pagamentosPorConta[conta.id] ?? 0;
    // Mensagem montada aqui, e não vinda do erro da action: em produção o
    // Next troca o texto de erro de Server Action por um genérico.
    if (qtdPagamentos > 0) {
      alert(
        `"${conta.nome}" não pode ser excluída: tem ${qtdPagamentos} pagamento(s) registrados nela. ` +
          "Apagar a conta tiraria esse dinheiro de todos os saldos. Mude a conta desses pagamentos em Lançamentos e tente de novo."
      );
      return;
    }
    if (!confirm(`Excluir "${conta.nome}"? Essa ação não pode ser desfeita.`)) return;

    setExcluindo(conta.id);
    try {
      await excluirContaAction(conta.id);
    } catch {
      alert("Não foi possível excluir a conta. Recarregue a página e tente novamente.");
    } finally {
      setExcluindo(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-1.5 rounded bg-[var(--accent-blue)] text-[var(--bg)] text-sm font-semibold"
          >
            + Nova conta
          </button>
          <button
            onClick={() => setTransferindo(true)}
            disabled={contas.length < 2}
            title={contas.length < 2 ? "É preciso ter pelo menos duas contas para transferir." : undefined}
            className="px-4 py-1.5 rounded border border-[var(--border)] text-sm font-semibold disabled:opacity-50"
          >
            Transferir
          </button>
        </div>
        <div className="text-right">
          <div className="text-xs text-[var(--text-dim)] uppercase">Saldo consolidado</div>
          <div className="text-xl font-semibold">{money(saldoConsolidado)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {contas.map((c) => (
          <div key={c.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-semibold">{c.nome}</h3>
              <button
                type="button"
                aria-label="Excluir conta"
                title="Excluir"
                disabled={excluindo === c.id}
                onClick={() => excluir(c)}
                className="p-1.5 -mt-1 -mr-1 rounded text-[var(--text-dim)] hover:text-[var(--accent-red)] hover:bg-[var(--surface-2)] disabled:opacity-50"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <p className="text-xs text-[var(--text-dim)] mb-3 uppercase">{c.tipo}</p>
            <div className="flex items-end justify-between gap-2">
              <div className="text-lg font-semibold">{money(saldoPorConta[c.id] ?? 0)}</div>
              <button
                type="button"
                onClick={() => setAjustando(c)}
                className="text-xs text-[var(--accent-blue)] underline"
              >
                Ajustar saldo
              </button>
            </div>
          </div>
        ))}
        {contas.length === 0 && <p className="text-[var(--text-dim)]">Nenhuma conta cadastrada ainda.</p>}
      </div>

      <ContaModal open={modalOpen} onClose={() => setModalOpen(false)} />

      <TransferenciaModal
        open={transferindo}
        onClose={() => setTransferindo(false)}
        contas={contas}
        saldoPorConta={saldoPorConta}
      />

      <AjusteSaldoModal
        key={ajustando?.id ?? "fechado"}
        conta={ajustando}
        saldoSistema={ajustando ? saldoPorConta[ajustando.id] ?? 0 : 0}
        onClose={() => setAjustando(null)}
      />
    </div>
  );
}
