"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ModalError } from "@/components/ModalError";
import { venderItemPermutaAction } from "./actions";
import { hoje } from "@/lib/format";
import type { ItemPermuta } from "@/lib/queries/itensPermuta";
import type { Categoria, ContaFinanceira } from "@/lib/types";

export function VenderModal({
  item,
  onClose,
  categorias,
  contas,
}: {
  item: ItemPermuta | null;
  onClose: () => void;
  categorias: Categoria[];
  contas: ContaFinanceira[];
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  return (
    <Modal open={item !== null} onClose={onClose} title={item ? `Marcar como vendido: ${item.descricao}` : ""}>
      {item && (
        <form
          key={item.id}
          action={async (formData) => {
            setErro(null);
            setEnviando(true);
            try {
              await venderItemPermutaAction(formData);
              onClose();
            } catch {
              setErro("Não foi possível registrar a venda. Tente novamente.");
            } finally {
              setEnviando(false);
            }
          }}
          className="grid grid-cols-2 gap-3"
        >
          <input type="hidden" name="item_id" value={item.id} />
          <input type="hidden" name="descricao_item" value={item.descricao} />
          <ModalError mensagem={erro} />

          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Valor da venda (R$)</label>
            <input
              type="number"
              step="0.01"
              name="valor_venda"
              defaultValue={item.valor_estimado ?? ""}
              required
              className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Data da venda</label>
            <input
              type="date"
              name="data_venda"
              defaultValue={hoje()}
              required
              className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Forma de pagamento</label>
            <select
              name="forma_pagamento"
              defaultValue=""
              className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
            >
              <option value="">Não informada</option>
              <option value="pix">Pix</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="boleto">Boleto</option>
              <option value="transferencia">Transferência</option>
              <option value="cartao_credito">Cartão de crédito</option>
              <option value="cartao_debito">Cartão de débito</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Conta financeira</label>
            <select
              name="conta_financeira_id"
              defaultValue=""
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

          <div className="col-span-2">
            <label className="block text-xs text-[var(--text-dim)] mb-1">Categoria (opcional)</label>
            <select
              name="categoria_id"
              defaultValue=""
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

          <div className="col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded disabled:opacity-50"
            >
              {enviando ? "Salvando..." : "Confirmar venda"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
