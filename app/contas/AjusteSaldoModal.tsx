"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ModalError } from "@/components/ModalError";
import { ajustarSaldoAction } from "./actions";
import { round2 } from "@/lib/calculations";
import { money, hoje } from "@/lib/format";
import type { ContaFinanceira } from "@/lib/types";

// Conciliação: o usuário informa o saldo que o extrato realmente mostra, e a
// diferença vira um lançamento datado de ajuste. O saldo não muda sozinho -
// fica registrado quando e quanto foi corrigido, e por quê.
export function AjusteSaldoModal({
  conta,
  saldoSistema,
  onClose,
}: {
  conta: ContaFinanceira | null;
  saldoSistema: number;
  onClose: () => void;
}) {
  const [saldoReal, setSaldoReal] = useState<number | "">("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!conta) return null;

  const diferenca = saldoReal === "" ? 0 : round2(saldoReal - saldoSistema);
  const semDiferenca = Math.abs(diferenca) < 0.005;

  return (
    <Modal open={!!conta} onClose={onClose} title={`Ajustar saldo — ${conta.nome}`}>
      <form
        action={async (formData) => {
          setErro(null);
          setEnviando(true);
          try {
            await ajustarSaldoAction(formData);
            onClose();
          } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível ajustar o saldo. Tente novamente.");
          } finally {
            setEnviando(false);
          }
        }}
        className="grid grid-cols-2 gap-3"
      >
        <input type="hidden" name="conta_financeira_id" value={conta.id} />
        <input type="hidden" name="saldo_sistema" value={saldoSistema} />
        <ModalError mensagem={erro} />

        <div className="col-span-2 rounded border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-dim)]">Saldo no sistema</span>
            <span className="font-semibold">{money(saldoSistema)}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Saldo real (R$)</label>
          <input
            type="number"
            step="0.01"
            name="saldo_real"
            value={saldoReal}
            onChange={(e) => setSaldoReal(e.target.value === "" ? "" : Number(e.target.value))}
            required
            autoFocus
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
          <p className="text-xs text-[var(--text-dim)] mt-1">O que o extrato ou a contagem do caixa mostra.</p>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Data do ajuste</label>
          <input
            type="date"
            name="data"
            defaultValue={hoje()}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Motivo (opcional)</label>
          <input
            name="observacao"
            placeholder="Ex.: tarifa não lançada, sangria sem registro"
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        {saldoReal !== "" && (
          <p
            className={`col-span-2 text-xs font-medium ${
              semDiferenca
                ? "text-[var(--text-dim)]"
                : diferenca > 0
                  ? "text-[var(--accent-green)]"
                  : "text-[var(--accent-red)]"
            }`}
          >
            {semDiferenca
              ? "Sem diferença: o saldo do sistema já bate com o real."
              : `Diferença de ${money(Math.abs(diferenca))} — será lançada como ${
                  diferenca > 0 ? "entrada" : "saída"
                } de ajuste em ${conta.nome}.`}
          </p>
        )}

        <p className="col-span-2 text-xs text-[var(--text-dim)]">
          O ajuste entra no saldo desta conta, mas fica fora do faturamento, das metas, do DRE e do fluxo — senão
          corrigir o caixa distorceria os relatórios.
        </p>

        <div className="col-span-2 flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando || saldoReal === "" || semDiferenca}
            className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded disabled:opacity-50"
          >
            {enviando ? "Ajustando..." : "Registrar ajuste"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
