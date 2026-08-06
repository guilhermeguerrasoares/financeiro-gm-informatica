"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { ModalError } from "@/components/ModalError";
import { PermutaItemFields } from "./PermutaItemFields";
import { salvarLancamentoAction, excluirLancamentoAction } from "./actions";
import { valorLiquido } from "@/lib/calculations";
import { money, hoje } from "@/lib/format";
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
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [valorLancamento, setValorLancamento] = useState(lancamento?.valor ?? 0);
  const [pago, setPago] = useState(false);
  const [valorPago, setValorPago] = useState(lancamento?.valor ?? 0);
  const [taxa, setTaxa] = useState<number | "">("");
  const [forma, setForma] = useState("");

  return (
    <Modal open={open} onClose={onClose} title={lancamento ? "Editar lançamento" : "Novo lançamento"}>
      <form
        ref={formRef}
        action={async (formData) => {
          setErro(null);
          setEnviando(true);
          try {
            await salvarLancamentoAction(formData);
            onClose();
          } catch {
            setErro("Não foi possível salvar o lançamento. Tente novamente.");
          } finally {
            setEnviando(false);
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
            onChange={(e) => setValorLancamento(Number(e.target.value) || 0)}
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
          <div className="col-span-2 flex items-center gap-2 pt-1">
            <input
              id="ja-pago"
              type="checkbox"
              name="registrar_pagamento"
              checked={pago}
              onChange={(e) => {
                setPago(e.target.checked);
                if (e.target.checked) setValorPago(valorLancamento);
              }}
              className="w-4 h-4"
            />
            <label htmlFor="ja-pago" className="text-sm">
              Já foi pago?
            </label>
          </div>
        )}

        {!lancamento && pago && (
          <div className="col-span-2 border border-[var(--border)] rounded p-3 bg-[var(--surface-2)] grid grid-cols-2 gap-3">
            <p className="col-span-2 text-xs text-[var(--text-dim)] uppercase tracking-wide">Pagamento</p>

            <div>
              <label className="block text-xs text-[var(--text-dim)] mb-1">Valor pago (R$)</label>
              <input
                type="number"
                step="0.01"
                name="pagamento_valor"
                value={valorPago}
                onChange={(e) => setValorPago(Number(e.target.value) || 0)}
                required
                className="w-full px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)]"
              />
            </div>

            <div>
              <label className="block text-xs text-[var(--text-dim)] mb-1">Data</label>
              <input
                type="date"
                name="data_pagamento"
                defaultValue={hoje()}
                className="w-full px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)]"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-[var(--text-dim)] mb-1">Forma de pagamento</label>
              <select
                name="forma_pagamento"
                value={forma}
                onChange={(e) => setForma(e.target.value)}
                className="w-full px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)]"
              >
                <option value="">Não informada</option>
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="boleto">Boleto</option>
                <option value="transferencia">Transferência</option>
                <option value="cartao_credito">Cartão de crédito</option>
                <option value="cartao_debito">Cartão de débito</option>
                <option value="permuta">Permuta</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-[var(--text-dim)] mb-1">Taxa paga (opcional)</label>
              <input
                type="number"
                step="0.01"
                name="taxa"
                onChange={(e) => setTaxa(e.target.value ? Number(e.target.value) : "")}
                className="w-full px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)]"
              />
              <p className="text-xs text-[var(--text-dim)] mt-1">
                Valor líquido: {money(valorLiquido(valorPago || 0, taxa === "" ? null : taxa))}
              </p>
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-[var(--text-dim)] mb-1">Comprovante (foto ou PDF)</label>
              <input
                type="file"
                name="comprovante"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && file.size > 10 * 1024 * 1024) {
                    alert("Arquivo maior que 10MB. Escolha um arquivo menor.");
                    e.target.value = "";
                  }
                }}
                className="w-full text-sm"
              />
            </div>

            {forma === "permuta" && <PermutaItemFields />}
          </div>
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
            <button
              type="submit"
              disabled={enviando}
              className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded disabled:opacity-50"
            >
              {enviando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
