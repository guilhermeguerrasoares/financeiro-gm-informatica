"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { ModalError } from "@/components/ModalError";
import { salvarLancamentoAction, excluirLancamentoAction } from "./actions";
import type { Categoria, LancamentoRow } from "@/lib/types";

export function LancamentoModal({
  open,
  onClose,
  lancamento,
  categorias,
  onCriado,
}: {
  open: boolean;
  onClose: () => void;
  lancamento: LancamentoRow | null;
  categorias: Categoria[];
  onCriado?: (lancamento: LancamentoRow) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} title={lancamento ? "Editar lançamento" : "Novo lançamento"}>
      <form
        ref={formRef}
        action={async (formData) => {
          setErro(null);
          try {
            const salvo = await salvarLancamentoAction(formData);
            const eraNovo = !lancamento;
            onClose();
            if (eraNovo && onCriado) onCriado(salvo);
          } catch {
            setErro("Não foi possível salvar o lançamento. Tente novamente.");
          }
        }}
        className="grid grid-cols-2 gap-3"
      >
        {lancamento && <input type="hidden" name="id" value={lancamento.id} />}
        <ModalError mensagem={erro} />

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Descrição</label>
          <input
            name="descricao"
            defaultValue={lancamento?.descricao}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Tipo</label>
          <select
            name="tipo"
            defaultValue={lancamento?.tipo ?? "despesa"}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="despesa">Saída (conta a pagar)</option>
            <option value="receita">Entrada (a receber)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Categoria</label>
          <select
            name="categoria_id"
            defaultValue={lancamento?.categoria_id ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="">Selecione</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Vencimento</label>
          <input
            type="date"
            name="vencimento"
            defaultValue={lancamento?.vencimento ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            name="valor"
            defaultValue={lancamento?.valor}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Custo/CMV (opcional)</label>
          <input
            type="number"
            step="0.01"
            name="custo"
            defaultValue={lancamento?.custo ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Observação</label>
          <input
            name="observacao"
            defaultValue={lancamento?.observacao ?? ""}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        {!lancamento && (
          <p className="col-span-2 text-xs text-[var(--text-dim)]">
            Depois de salvar, a tela de registrar pagamento abre em seguida — é lá que você escolhe a forma de
            pagamento (inclusive permuta) e anexa o comprovante. Se ainda não foi pago, é só cancelar naquela tela.
          </p>
        )}

        <div className="col-span-2 flex justify-between mt-2">
          {lancamento ? (
            <button
              type="button"
              onClick={async () => {
                if (!confirm(`Excluir "${lancamento.descricao}"? Essa ação não pode ser desfeita.`)) return;
                try {
                  await excluirLancamentoAction(lancamento.id);
                  onClose();
                } catch {
                  setErro("Não foi possível excluir o lançamento. Tente novamente.");
                }
              }}
              className="text-[var(--accent-red)] text-sm font-semibold"
            >
              Excluir lançamento
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded">
              Salvar
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
