"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Modal } from "@/components/Modal";
import { ModalError } from "@/components/ModalError";
import { transferirAction } from "./actions";
import { validarTransferencia } from "@/lib/transferencias";
import { money, hoje } from "@/lib/format";
import type { ContaFinanceira } from "@/lib/types";

// Dinheiro que muda de lugar dentro da própria loja: depósito do caixa no
// banco, envio de um banco para outro. Não é venda nem despesa, então mexe só
// no saldo das duas contas - fica fora de faturamento, metas, DRE e fluxo.
export function TransferenciaModal({
  open,
  onClose,
  contas,
  saldoPorConta,
}: {
  open: boolean;
  onClose: () => void;
  contas: ContaFinanceira[];
  saldoPorConta: Record<string, number>;
}) {
  const [origemId, setOrigemId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [valor, setValor] = useState<number | "">("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Identifica este preenchimento do formulário, não a linha: é o que deixa o
  // banco recusar o segundo envio do mesmo preenchimento (migração 0021).
  // Nasce quando o modal abre e morre quando ele fecha.
  const [chave, setChave] = useState("");

  useEffect(() => {
    if (!open) return;
    setChave(crypto.randomUUID());
    setOrigemId("");
    setDestinoId("");
    setValor("");
    setErro(null);
  }, [open]);

  const problema = validarTransferencia({ origemId, destinoId, valor: valor === "" ? 0 : valor });
  const saldoOrigem = origemId ? saldoPorConta[origemId] : undefined;

  return (
    <Modal open={open} onClose={onClose} title="Transferir entre contas">
      <form
        action={async (formData) => {
          setErro(null);
          setEnviando(true);
          try {
            await transferirAction(formData);
            onClose();
          } catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível registrar a transferência. Tente novamente.");
          } finally {
            setEnviando(false);
          }
        }}
        className="grid grid-cols-2 gap-3"
      >
        <input type="hidden" name="idempotency_key" value={chave} />
        <ModalError mensagem={erro} />

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">De (sai desta conta)</label>
          <select
            name="conta_origem_id"
            value={origemId}
            onChange={(e) => setOrigemId(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="">Selecione</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          {saldoOrigem !== undefined && (
            <p className="text-xs text-[var(--text-dim)] mt-1">Saldo hoje: {money(saldoOrigem)}</p>
          )}
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Para (entra nesta conta)</label>
          <select
            name="conta_destino_id"
            value={destinoId}
            onChange={(e) => setDestinoId(e.target.value)}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="">Selecione</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            name="valor"
            value={valor}
            onChange={(e) => setValor(e.target.value === "" ? "" : Number(e.target.value))}
            required
            autoFocus
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Data</label>
          <input
            type="date"
            name="data"
            defaultValue={hoje()}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Observação (opcional)</label>
          <input
            name="observacao"
            placeholder="Ex.: depósito da venda do sábado"
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        {origemId && destinoId && valor !== "" && !problema && (
          <p className="col-span-2 flex items-center gap-2 text-xs text-[var(--text-dim)]">
            {contas.find((c) => c.id === origemId)?.nome}
            <ArrowRight size={12} className="shrink-0" />
            {contas.find((c) => c.id === destinoId)?.nome}
            <span className="font-semibold text-[var(--text)]">{money(valor)}</span>
          </p>
        )}
        {problema && origemId && destinoId && <p className="col-span-2 text-xs text-[var(--accent-amber)]">{problema}</p>}

        <p className="col-span-2 text-xs text-[var(--text-dim)]">
          A transferência muda o saldo das duas contas, mas fica fora do faturamento, das metas, do DRE e do fluxo —
          mover o próprio dinheiro de lugar não é venda nem despesa.
        </p>

        <div className="col-span-2 flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando || problema !== null}
            className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded disabled:opacity-50"
          >
            {enviando ? "Transferindo..." : "Transferir"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
