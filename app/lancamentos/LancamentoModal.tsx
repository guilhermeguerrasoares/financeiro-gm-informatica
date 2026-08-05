"use client";

import { useRef } from "react";
import { Modal } from "@/components/Modal";
import { salvarLancamentoAction, excluirLancamentoAction } from "./actions";
import type { Categoria, LancamentoRow } from "@/lib/types";

export function LancamentoModal({
  open,
  onClose,
  lancamento,
  categorias,
}: {
  open: boolean;
  onClose: () => void;
  lancamento: LancamentoRow | null;
  categorias: Categoria[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Modal open={open} onClose={onClose} title={lancamento ? "Editar lançamento" : "Novo lançamento"}>
      <form
        ref={formRef}
        action={async (formData) => {
          await salvarLancamentoAction(formData);
          onClose();
        }}
        className="grid grid-cols-2 gap-3"
      >
        {lancamento && <input type="hidden" name="id" value={lancamento.id} />}

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

        <div className="col-span-2 flex justify-between mt-2">
          {lancamento ? (
            <button
              type="button"
              onClick={async () => {
                await excluirLancamentoAction(lancamento.id);
                onClose();
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
