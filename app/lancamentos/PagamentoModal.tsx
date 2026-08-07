"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ModalError } from "@/components/ModalError";
import { registrarPagamentoAction } from "./pagamentoActions";
import { uploadComprovante } from "./uploadComprovante";
import { PermutaItemFields } from "./PermutaItemFields";
import { valorLiquido } from "@/lib/calculations";
import { money, hoje } from "@/lib/format";
import { FORMAS_PAGAMENTO } from "@/lib/formasPagamento";
import type { LancamentoRow } from "@/lib/types";

export function PagamentoModal({
  open,
  onClose,
  lancamento,
  falta,
}: {
  open: boolean;
  onClose: () => void;
  lancamento: LancamentoRow | null;
  falta: number;
}) {
  const [valor, setValor] = useState(falta);
  const [taxa, setTaxa] = useState<number | "">("");
  const [forma, setForma] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [incluiuPermuta, setIncluiuPermuta] = useState(false);
  const [valorPermuta, setValorPermuta] = useState(0);
  const valorCaixa = Math.max(0, valor - (incluiuPermuta ? valorPermuta : 0));

  if (!lancamento) return null;

  return (
    <Modal open={open} onClose={onClose} title="Registrar pagamento">
      <form
        action={async (formData) => {
          setEnviando(true);
          setErro(null);
          try {
            // Uploads before creating the pagamento row (same non-transactional
            // tradeoff as the permuta item in pagamentoActions.ts): if
            // registrarPagamentoAction fails after this succeeds, the file is
            // orphaned in Storage with nothing pointing at it. Accepted for v1.
            if (arquivo) {
              const path = await uploadComprovante(arquivo, lancamento.id);
              formData.set("comprovante_path", path);
            }
            await registrarPagamentoAction(formData);
            onClose();
          } catch {
            setErro("Não foi possível registrar o pagamento. Tente novamente.");
          } finally {
            setEnviando(false);
          }
        }}
        className="grid grid-cols-2 gap-3"
      >
        <input type="hidden" name="lancamento_id" value={lancamento.id} />
        <p className="col-span-2 text-sm text-[var(--text-dim)]">
          {lancamento.descricao} · falta {money(falta)}
        </p>
        <ModalError mensagem={erro} />

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Valor pago (R$)</label>
          <input
            type="number"
            step="0.01"
            name="valor"
            defaultValue={falta}
            onChange={(e) => setValor(Number(e.target.value))}
            required
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div>
          <label className="block text-xs text-[var(--text-dim)] mb-1">Data</label>
          <input
            type="date"
            name="data_pagamento"
            defaultValue={hoje()}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">
            Forma de pagamento{incluiuPermuta ? " (parte em dinheiro/outro)" : ""}
          </label>
          <select
            name="forma_pagamento"
            value={forma}
            onChange={(e) => setForma(e.target.value)}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          >
            <option value="">Não informada</option>
            {FORMAS_PAGAMENTO.filter((f) => f.value !== "permuta").map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Taxa paga (opcional)</label>
          <input
            type="number"
            step="0.01"
            name="taxa"
            onChange={(e) => setTaxa(e.target.value ? Number(e.target.value) : "")}
            className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
          />
          <p className="text-xs text-[var(--text-dim)] mt-1">
            Valor líquido: {money(valorLiquido(valorCaixa || 0, taxa === "" ? null : taxa))}
          </p>
        </div>

        <div className="col-span-2">
          <label className="block text-xs text-[var(--text-dim)] mb-1">Comprovante (foto ou PDF)</label>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (file && file.size > 10 * 1024 * 1024) {
                alert("Arquivo maior que 10MB. Escolha um arquivo menor.");
                e.target.value = "";
                setArquivo(null);
                return;
              }
              setArquivo(file);
            }}
            className="w-full text-sm"
          />
        </div>

        <div className="col-span-2 flex items-center gap-2 pt-1 border-t border-[var(--border)] mt-1">
          <input
            id="incluiu-permuta-pag"
            type="checkbox"
            checked={incluiuPermuta}
            onChange={(e) => {
              setIncluiuPermuta(e.target.checked);
              if (!e.target.checked) setValorPermuta(0);
            }}
            className="w-4 h-4"
          />
          <label htmlFor="incluiu-permuta-pag" className="text-sm">
            Uma parte foi recebida em permuta?
          </label>
        </div>

        {incluiuPermuta && (
          <>
            <div className="col-span-2">
              <label className="block text-xs text-[var(--text-dim)] mb-1">Valor recebido em permuta (R$)</label>
              <input
                type="number"
                step="0.01"
                name="permuta_valor"
                max={valor}
                value={valorPermuta}
                onChange={(e) => setValorPermuta(Number(e.target.value) || 0)}
                required
                className="w-full px-3 py-2 rounded bg-[var(--surface-2)] border border-[var(--border)]"
              />
              <p className="text-xs text-[var(--text-dim)] mt-1">
                Restante em {forma ? FORMAS_PAGAMENTO.find((f) => f.value === forma)?.label : "dinheiro/outro"}:{" "}
                {money(valorCaixa)}
              </p>
            </div>
            <PermutaItemFields />
          </>
        )}

        <div className="col-span-2 flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border)] rounded">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="px-4 py-2 text-sm bg-[var(--accent-blue)] text-[var(--bg)] font-semibold rounded disabled:opacity-50"
          >
            {enviando ? "Enviando..." : "Registrar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
