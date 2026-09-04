"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ModalError } from "@/components/ModalError";
import { criarPermutaAvulsaAction } from "./actions";
import { validarPermutaAvulsa } from "@/lib/permutas";
import { hoje } from "@/lib/format";
import { FORMAS_PAGAMENTO } from "@/lib/formasPagamento";
import { ContaSelect } from "@/components/ContaSelect";
import type { Categoria, ContaFinanceira } from "@/lib/types";

// Item que entrou fora de uma venda. Dois casos, o mesmo formulário: veio sem
// custo nenhum (só descrição e valor), ou veio com dinheiro por cima - e aí o
// bloco de baixo cria a despesa quitada na conta escolhida, para o dinheiro
// sair do saldo de verdade.
export function NovaPermutaModal({
  open,
  onClose,
  categorias,
  contas,
}: {
  open: boolean;
  onClose: () => void;
  categorias: Categoria[];
  contas: ContaFinanceira[];
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pagou, setPagou] = useState(false);

  function fechar() {
    setErro(null);
    setPagou(false);
    onClose();
  }

  return (
    <Modal open={open} onClose={fechar} title="Nova permuta">
      <form
        action={async (formData) => {
          const valorPago = pagou ? Number(formData.get("valor_pago") || 0) : 0;
          const erroValidacao = validarPermutaAvulsa({
            descricao: (formData.get("descricao") as string) ?? "",
            valorEstimado: Number(formData.get("valor_estimado") ?? 0),
            dataEntrada: (formData.get("data_entrada") as string) ?? "",
            valorPago,
            contaFinanceiraId: (formData.get("conta_financeira_id") as string) || null,
          });
          if (erroValidacao) {
            setErro(erroValidacao);
            return;
          }
          setErro(null);
          setEnviando(true);
          try {
            // Sem o bloco de pagamento aberto, o valor pago não vai junto -
            // um número digitado e depois escondido não pode virar despesa.
            if (!pagou) formData.set("valor_pago", "0");
            await criarPermutaAvulsaAction(formData);
            fechar();
          } catch (err) {
            console.error(err);
            setErro("Não foi possível cadastrar a permuta. Tente novamente.");
          } finally {
            setEnviando(false);
          }
        }}
        className="grid grid-cols-2 gap-3"
      >
        <ModalError mensagem={erro} />

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Descrição do item</label>
          <input
            name="descricao"
            placeholder="Ex: Notebook Dell usado"
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Valor estimado (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            name="valor_estimado"
            defaultValue="0"
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
          <p className="text-xs text-[var(--text-dim)] mt-1">
            Quanto o item custou para você. É deste valor que sai o lucro na revenda — se entrou de graça, deixe zero.
          </p>
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Data de entrada</label>
          <input
            type="date"
            name="data_entrada"
            defaultValue={hoje()}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Observação (opcional)</label>
          <input
            name="observacao"
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div className="col-span-2 border border-[var(--border)] rounded p-3 bg-[var(--surface-2)]">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pagou} onChange={(e) => setPagou(e.target.checked)} />
            Paguei dinheiro por este item
          </label>

          {pagou && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <p className="col-span-2 text-xs text-[var(--text-dim)]">
                Cria uma despesa já quitada na conta escolhida, com a data de entrada acima.
              </p>

              <div>
                <label className="block text-xs text-[var(--text-dim)] mb-1">Valor pago (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  name="valor_pago"
                  required
                  className="w-full px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)]"
                />
              </div>

              <ContaSelect contas={contas} />

              <div>
                <label className="block text-xs text-[var(--text-dim)] mb-1">Forma de pagamento</label>
                <select
                  name="forma_pagamento"
                  defaultValue=""
                  className="w-full px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)]"
                >
                  <option value="">Não informada</option>
                  {FORMAS_PAGAMENTO.filter((f) => f.value !== "permuta").map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-[var(--text-dim)] mb-1">Categoria (opcional)</label>
                <select
                  name="categoria_id"
                  defaultValue=""
                  className="w-full px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)]"
                >
                  <option value="">Selecione</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="col-span-2 flex justify-end gap-2 mt-2">
          <button type="button" onClick={fechar} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded disabled:opacity-50"
          >
            {enviando ? "Salvando..." : "Cadastrar permuta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
