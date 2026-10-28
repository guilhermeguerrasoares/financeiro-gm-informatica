"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ModalError } from "@/components/ModalError";
import { ajustarDividaAction } from "./actions";
import { round2 } from "@/lib/calculations";
import { money, hoje } from "@/lib/format";
import type { Fornecedor } from "@/lib/types";

// Conciliação da dívida: o dono informa quanto deve de verdade, e a diferença
// vira um lançamento datado de ajuste. A dívida não muda sozinha - fica
// registrado quando e quanto foi corrigido, e por quê. Mesmo desenho do
// ajuste de saldo das contas.
export function AjusteDividaModal({
  fornecedor,
  dividaSistema,
  open,
  onClose,
}: {
  fornecedor: Fornecedor;
  dividaSistema: number;
  open: boolean;
  onClose: () => void;
}) {
  const [dividaReal, setDividaReal] = useState<number | "">("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const diferenca = dividaReal === "" ? 0 : round2(dividaReal - dividaSistema);
  const semDiferenca = Math.abs(diferenca) < 0.005;

  return (
    <Modal open={open} onClose={onClose} title={`Ajustar dívida — ${fornecedor.nome}`}>
      <form
        action={async (formData) => {
          setErro(null);
          setEnviando(true);
          try {
            await ajustarDividaAction(formData);
            setDividaReal("");
            onClose();
          } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível ajustar a dívida. Tente novamente.");
          } finally {
            setEnviando(false);
          }
        }}
        className="grid grid-cols-2 gap-3"
      >
        <input type="hidden" name="fornecedor_id" value={fornecedor.id} />
        <input type="hidden" name="divida_sistema" value={dividaSistema} />
        <ModalError mensagem={erro} />

        <div className="col-span-2 rounded border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-dim)]">Dívida no sistema</span>
            <span className="font-semibold">{money(dividaSistema)}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Dívida real (R$)</label>
          <input
            type="number"
            step="0.01"
            name="divida_real"
            value={dividaReal}
            onChange={(e) => setDividaReal(e.target.value === "" ? "" : Number(e.target.value))}
            required
            autoFocus
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
          <p className="text-xs text-[var(--text-dim)] mt-1">Quanto você deve a ele de verdade hoje.</p>
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
            placeholder="Ex.: compras de agosto que não foram lançadas"
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        {dividaReal !== "" && (
          <p
            className={`col-span-2 text-xs font-medium ${
              semDiferenca
                ? "text-[var(--text-dim)]"
                : diferenca > 0
                  ? "text-[var(--accent-red)]"
                  : "text-[var(--accent-green)]"
            }`}
          >
            {semDiferenca
              ? "Sem diferença: a dívida do sistema já bate com a real."
              : `Diferença de ${money(Math.abs(diferenca))} — será registrada como ${
                  diferenca > 0 ? "aumento" : "abatimento"
                } da dívida com ${fornecedor.nome}.`}
          </p>
        )}

        <p className="col-span-2 text-xs text-[var(--text-dim)]">
          O ajuste serve para dívida que <strong>não está lançada compra a compra</strong>. Se as compras dele já
          estão cadastradas uma a uma, elas já somam aqui — informar o total por cima contaria duas vezes.
        </p>

        <p className="col-span-2 text-xs text-[var(--text-dim)]">
          Ele não entra no saldo das contas, no faturamento, nas metas, no DRE nem no fluxo: reconhecer que você
          deve não é ter gasto. O que conta como despesa é o pagamento, quando ele acontecer.
        </p>

        <div className="col-span-2 flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando || dividaReal === "" || semDiferenca}
            className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded disabled:opacity-50"
          >
            {enviando ? "Ajustando..." : "Registrar ajuste"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
