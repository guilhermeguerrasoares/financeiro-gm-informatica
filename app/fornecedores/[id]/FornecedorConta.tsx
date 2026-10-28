"use client";

import { useMemo, useState } from "react";
import { StatusTag } from "@/components/StatusTag";
import { LancamentoModal } from "@/app/lancamentos/LancamentoModal";
import { AjusteDividaModal } from "./AjusteDividaModal";
import { saldoDevedor, movimentosDoFornecedor } from "@/lib/fornecedores";
import { classeDoSaldo } from "@/lib/corSituacao";
import { money, formatDataBR, hoje, dataLocal } from "@/lib/format";
import type {
  Fornecedor,
  LancamentoRow,
  PagamentoRow,
  Categoria,
  Cliente,
  ContaFinanceira,
} from "@/lib/types";

function Cartao({ titulo, valor, cor }: { titulo: string; valor: string; cor?: string }) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
      <div className="text-xs text-[var(--text-dim)] uppercase">{titulo}</div>
      <div className={`text-xl font-semibold ${cor ?? ""}`}>{valor}</div>
    </div>
  );
}

export function FornecedorConta({
  fornecedor,
  lancamentos,
  pagamentos,
  categorias,
  clientes,
  contas,
}: {
  fornecedor: Fornecedor;
  lancamentos: LancamentoRow[];
  pagamentos: PagamentoRow[];
  categorias: Categoria[];
  clientes: Cliente[];
  contas: ContaFinanceira[];
}) {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [ajustando, setAjustando] = useState(false);
  const [comprando, setComprando] = useState(false);

  const hojeStr = hoje();

  // O saldo devedor NUNCA passa pelo filtro de período: "quanto devo" é o
  // total de hoje. Dívida filtrada por mês é um número sem significado - não
  // "conserte" isso depois ligando o filtro aqui.
  const devo = saldoDevedor(fornecedor.id, lancamentos, pagamentos);

  const todos = useMemo(
    () => movimentosDoFornecedor(fornecedor.id, lancamentos, pagamentos, hojeStr),
    [fornecedor.id, lancamentos, pagamentos, hojeStr]
  );

  const linhas = useMemo(
    () =>
      de || ate
        ? movimentosDoFornecedor(fornecedor.id, lancamentos, pagamentos, hojeStr, { de, ate })
        : todos,
    [de, ate, fornecedor.id, lancamentos, pagamentos, hojeStr, todos]
  );

  const emAberto = todos.filter((l) => l.status !== "quitado" && l.lancamento.movimento_fornecedor === "compra");
  const maisAntiga = emAberto[0];
  const ultimaCompra = todos
    .filter((l) => l.lancamento.movimento_fornecedor === "compra")
    .map((l) => dataLocal(l.lancamento.created_at))
    .sort()
    .at(-1);
  const proximoVencimento =
    emAberto
      .map((l) => l.lancamento.vencimento)
      .filter((v): v is string => v !== null)
      .sort()[0] ?? null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-1">{fornecedor.nome}</h1>
      <p className="text-[var(--text-dim)] mb-4">
        {fornecedor.contato ?? "Sem contato"} · {fornecedor.tipo ?? "—"}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Cartao
          titulo="Devo"
          valor={money(devo)}
          cor={devo > 0.004 ? "text-[var(--accent-red)]" : "text-[var(--accent-green)]"}
        />
        <Cartao
          titulo="Mais antiga em aberto"
          valor={maisAntiga ? `${maisAntiga.diasEmAberto} dia${maisAntiga.diasEmAberto === 1 ? "" : "s"}` : "—"}
        />
        <Cartao titulo="Última compra" valor={ultimaCompra ? formatDataBR(ultimaCompra) : "—"} />
        <Cartao titulo="Próximo vencimento" valor={formatDataBR(proximoVencimento)} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setComprando(true)}
            className="px-4 py-1.5 rounded bg-[var(--accent-blue)] text-[var(--bg)] text-sm font-semibold"
          >
            + Adicionar compra
          </button>
          <button
            onClick={() => setAjustando(true)}
            className="px-4 py-1.5 rounded border border-[var(--border)] text-sm font-semibold"
          >
            Ajustar dívida
          </button>
        </div>

        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">De</label>
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="px-3 py-1.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-dim)] mb-1">Até</label>
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="px-3 py-1.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-sm"
            />
          </div>
          {(de || ate) && (
            <button
              onClick={() => {
                setDe("");
                setAte("");
              }}
              className="px-3 py-1.5 text-sm text-[var(--text-dim)] hover:text-[var(--text)]"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[var(--text-dim)] text-xs uppercase border-b border-[var(--border)]">
            <th className="py-2">Descrição</th>
            <th>Adicionada</th>
            <th>Vencimento</th>
            <th className="text-right">Valor</th>
            <th className="text-right">Falta</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ lancamento, falta, status, diasEmAberto }) => {
            const ehAjuste = lancamento.movimento_fornecedor === "ajuste";
            return (
              <tr key={lancamento.id} className="border-b border-[var(--border)]">
                <td className="py-2">
                  {lancamento.descricao}
                  {ehAjuste && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide border border-[var(--border)] text-[var(--text-dim)]">
                      ajuste de dívida
                    </span>
                  )}
                  {lancamento.movimento_fornecedor === "quitacao" && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide border border-[var(--border)] text-[var(--text-dim)]">
                      pagamento de dívida
                    </span>
                  )}
                </td>
                <td>
                  {formatDataBR(dataLocal(lancamento.created_at))}
                  <span className="text-[var(--text-dim)]"> · há {diasEmAberto}d</span>
                </td>
                <td>{formatDataBR(lancamento.vencimento)}</td>
                <td className="text-right">{money(lancamento.valor)}</td>
                <td className={`text-right font-semibold ${ehAjuste ? "" : classeDoSaldo(status)}`}>
                  {money(falta)}
                </td>
                <td>{ehAjuste ? <span className="text-[var(--text-dim)] text-xs">—</span> : <StatusTag status={status} />}</td>
              </tr>
            );
          })}
          {linhas.length === 0 && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-[var(--text-dim)]">
                {de || ate
                  ? "Nenhum movimento com este fornecedor no período."
                  : "Nenhum movimento com este fornecedor ainda."}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <AjusteDividaModal
        fornecedor={fornecedor}
        dividaSistema={devo}
        open={ajustando}
        onClose={() => setAjustando(false)}
      />

      <LancamentoModal
        open={comprando}
        onClose={() => setComprando(false)}
        lancamento={null}
        categorias={categorias}
        clientes={clientes}
        fornecedores={[fornecedor]}
        contas={contas}
        fornecedorPadrao={fornecedor.id}
      />
    </div>
  );
}
