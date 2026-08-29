"use client";

import { Fragment, useMemo, useState } from "react";
import { Pencil, Paperclip, ChevronRight, ChevronDown, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { StatusTag } from "@/components/StatusTag";
import { saldo, status as calcStatus, totalPago, type StatusLancamento } from "@/lib/calculations";
import { money, formatDataBR, hoje } from "@/lib/format";
import type { LancamentoRow, PagamentoRow, Categoria, Cliente, Fornecedor, ContaFinanceira } from "@/lib/types";
import { LancamentoModal } from "./LancamentoModal";
import { PagamentoModal } from "./PagamentoModal";
import {
  getComprovanteUrlAction,
  anexarComprovanteAction,
  estornarPagamentoAction,
  alterarContaPagamentoAction,
} from "./pagamentoActions";
import { uploadComprovante } from "./uploadComprovante";
import { FORMAS_PAGAMENTO_LABEL } from "@/lib/formasPagamento";

function VerComprovanteButton({ path }: { path: string }) {
  const [carregando, setCarregando] = useState(false);

  return (
    <button
      type="button"
      disabled={carregando}
      onClick={async (e) => {
        e.stopPropagation();
        setCarregando(true);
        try {
          const url = await getComprovanteUrlAction(path);
          window.open(url, "_blank", "noopener,noreferrer");
        } catch {
          alert("Não foi possível abrir o comprovante.");
        } finally {
          setCarregando(false);
        }
      }}
      className="text-xs text-[var(--accent-blue)] underline disabled:opacity-50"
    >
      {carregando ? "Abrindo..." : "Ver comprovante"}
    </button>
  );
}

function AnexarComprovanteButton({ pagamentoId, lancamentoId }: { pagamentoId: string; lancamentoId: string }) {
  const [enviando, setEnviando] = useState(false);

  return (
    <label className={`text-xs text-[var(--accent-blue)] underline cursor-pointer ${enviando ? "opacity-50" : ""}`}>
      {enviando ? "Enviando..." : "Anexar comprovante"}
      <input
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        disabled={enviando}
        onClick={(e) => e.stopPropagation()}
        onChange={async (e) => {
          const file = e.target.files?.[0] ?? null;
          if (!file) return;
          if (file.size > 10 * 1024 * 1024) {
            alert("Arquivo maior que 10MB. Escolha um arquivo menor.");
            e.target.value = "";
            return;
          }
          setEnviando(true);
          try {
            const path = await uploadComprovante(file, lancamentoId);
            await anexarComprovanteAction(pagamentoId, path);
          } catch {
            alert("Não foi possível anexar o comprovante.");
          } finally {
            setEnviando(false);
          }
        }}
      />
    </label>
  );
}

// Troca a conta de um pagamento já registrado, direto na linha. Salva na
// hora: é um campo só, e obrigar um "salvar" para uma escolha única seria
// atrito à toa. Pagamento em permuta não passa por conta nenhuma, então ali
// o campo nem aparece.
function ContaPagamentoSelect({
  pagamentoId,
  contaAtual,
  contas,
  ehPermuta,
}: {
  pagamentoId: string;
  contaAtual: string | null;
  contas: ContaFinanceira[];
  ehPermuta: boolean;
}) {
  const [salvando, setSalvando] = useState(false);

  if (ehPermuta) {
    return <span className="text-[var(--text-dim)]" title="Permuta não passa por conta: é item de estoque.">—</span>;
  }

  return (
    <select
      value={contaAtual ?? ""}
      disabled={salvando}
      onClick={(e) => e.stopPropagation()}
      onChange={async (e) => {
        const novaConta = e.target.value || null;
        setSalvando(true);
        try {
          await alterarContaPagamentoAction(pagamentoId, novaConta);
        } catch {
          alert("Não foi possível alterar a conta deste pagamento.");
        } finally {
          setSalvando(false);
        }
      }}
      className={`text-xs px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--surface)] disabled:opacity-50 ${
        contaAtual ? "" : "text-[var(--accent-amber)]"
      }`}
      title={contaAtual ? "Conta onde este dinheiro entrou/saiu" : "Sem conta: este pagamento não entra em nenhum saldo"}
    >
      <option value="">Sem conta</option>
      {contas.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nome}
        </option>
      ))}
    </select>
  );
}

function EstornarPagamentoButton({ pagamentoId }: { pagamentoId: string }) {
  const [enviando, setEnviando] = useState(false);

  return (
    <button
      type="button"
      aria-label="Excluir pagamento"
      title="Excluir este pagamento"
      disabled={enviando}
      onClick={async (e) => {
        e.stopPropagation();
        if (
          !confirm(
            "Excluir este pagamento? Se ele tiver um item de permuta vinculado, o item também será removido. Essa ação não pode ser desfeita."
          )
        )
          return;
        setEnviando(true);
        try {
          await estornarPagamentoAction(pagamentoId);
        } catch (e) {
          alert(e instanceof Error ? e.message : "Não foi possível excluir o pagamento.");
        } finally {
          setEnviando(false);
        }
      }}
      className="p-1 rounded text-[var(--text-dim)] hover:text-[var(--accent-red)] hover:bg-[var(--surface)] disabled:opacity-50"
    >
      <Trash2 size={12} />
    </button>
  );
}

export function LancamentosTable({
  lancamentos,
  pagamentos,
  categorias,
  clientes,
  fornecedores,
  contas,
}: {
  lancamentos: LancamentoRow[];
  pagamentos: PagamentoRow[];
  categorias: Categoria[];
  clientes: Cliente[];
  fornecedores: Fornecedor[];
  contas: ContaFinanceira[];
}) {
  const [filtroStatus, setFiltroStatus] = useState<"pendentes" | "atrasado" | "quitado" | "todos">(
    "pendentes"
  );
  const [busca, setBusca] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<LancamentoRow | null>(null);
  const [pagando, setPagando] = useState<{ lancamento: LancamentoRow; falta: number } | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"data" | "situacao" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const hojeStr = hoje();

  const nomeCategoria = (id: string | null) =>
    categorias.find((c) => c.id === id)?.nome ?? "—";

  const toggleSort = (campo: "data" | "situacao") => {
    if (sortBy === campo) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(campo);
      setSortDir("asc");
    }
  };

  const SITUACAO_ORDEM: Record<StatusLancamento, number> = {
    atrasado: 0,
    aberto: 1,
    parcial: 2,
    quitado: 3,
  };

  const linhas = useMemo(() => {
    const filtradas = lancamentos
      .map((l) => ({
        lancamento: l,
        status: calcStatus(l, pagamentos, hojeStr),
        pago: totalPago(pagamentos, l.id),
        falta: saldo(l, pagamentos),
      }))
      .filter((row) => {
        if (filtroStatus === "pendentes") return row.status !== "quitado";
        if (filtroStatus === "atrasado") return row.status === "atrasado";
        if (filtroStatus === "quitado") return row.status === "quitado";
        return true;
      })
      .filter((row) =>
        busca ? row.lancamento.descricao.toLowerCase().includes(busca.toLowerCase()) : true
      );

    if (!sortBy) return filtradas;

    const sinal = sortDir === "asc" ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      if (sortBy === "data") {
        const dataA = a.lancamento.vencimento ?? "";
        const dataB = b.lancamento.vencimento ?? "";
        return dataA.localeCompare(dataB) * sinal;
      }
      return (SITUACAO_ORDEM[a.status] - SITUACAO_ORDEM[b.status]) * sinal;
    });
  }, [lancamentos, pagamentos, filtroStatus, busca, hojeStr, sortBy, sortDir]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(["pendentes", "atrasado", "quitado", "todos"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltroStatus(f)}
            aria-pressed={filtroStatus === f}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold border border-[var(--border)] ${
              filtroStatus === f ? "bg-[var(--accent-blue)] text-[var(--bg)]" : "text-[var(--text-dim)]"
            }`}
          >
            {f === "pendentes" ? "Pendentes" : f === "atrasado" ? "Atrasadas" : f === "quitado" ? "Quitadas" : "Todas"}
          </button>
        ))}
        <input
          placeholder="Buscar por descrição"
          aria-label="Buscar por descrição"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="px-3 py-1.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-sm"
        />
        <button
          onClick={() => {
            setEditando(null);
            setModalOpen(true);
          }}
          className="ml-auto px-4 py-1.5 rounded bg-[var(--accent-blue)] text-[var(--bg)] text-sm font-semibold"
        >
          + Novo lançamento
        </button>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[var(--text-dim)] text-xs uppercase border-b border-[var(--border)]">
            <th className="py-2 w-10">Anexos</th>
            <th>
              <button
                type="button"
                onClick={() => toggleSort("data")}
                className="flex items-center gap-1 uppercase text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)]"
              >
                Vencimento
                {sortBy === "data" ? (
                  sortDir === "asc" ? (
                    <ArrowUp size={12} />
                  ) : (
                    <ArrowDown size={12} />
                  )
                ) : (
                  <ArrowUpDown size={12} className="opacity-40" />
                )}
              </button>
            </th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>
              <button
                type="button"
                onClick={() => toggleSort("situacao")}
                className="flex items-center gap-1 uppercase text-xs font-semibold text-[var(--text-dim)] hover:text-[var(--text)]"
              >
                Situação
                {sortBy === "situacao" ? (
                  sortDir === "asc" ? (
                    <ArrowUp size={12} />
                  ) : (
                    <ArrowDown size={12} />
                  )
                ) : (
                  <ArrowUpDown size={12} className="opacity-40" />
                )}
              </button>
            </th>
            <th className="text-right">Valor</th>
            <th className="text-right">Falta</th>
            <th className="text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ lancamento, status, falta }) => {
            const pagamentosDoLancamento = pagamentos.filter((p) => p.lancamento_id === lancamento.id);
            const estaExpandido = expandido === lancamento.id;
            const totalComprovantes = pagamentosDoLancamento.filter((p) => p.comprovante_url).length;

            return (
              <Fragment key={lancamento.id}>
                <tr
                  onClick={() => {
                    setEditando(lancamento);
                    setModalOpen(true);
                  }}
                  className="border-b border-[var(--border)] cursor-pointer hover:bg-[var(--surface-2)]"
                >
                  <td className="py-2">
                    {pagamentosDoLancamento.length > 0 && (
                      <button
                        type="button"
                        aria-label={estaExpandido ? "Recolher pagamentos" : "Ver pagamentos e anexos"}
                        title={
                          totalComprovantes > 0
                            ? `${totalComprovantes} comprovante(s)`
                            : "Ver pagamentos"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandido(estaExpandido ? null : lancamento.id);
                        }}
                        className="flex items-center gap-1 text-[var(--text-dim)] hover:text-[var(--text)]"
                      >
                        {estaExpandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {totalComprovantes > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px]">
                            <Paperclip size={12} />
                            {totalComprovantes}
                          </span>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="py-2">{formatDataBR(lancamento.vencimento)}</td>
                  <td className="font-medium">
                    {lancamento.descricao}
                    {/* Marca visível para o ajuste não ser lido como venda ou
                        despesa de verdade ao bater o extrato. */}
                    {lancamento.ajuste_saldo && (
                      <span
                        className="ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide border border-[var(--border)] text-[var(--text-dim)]"
                        title="Conciliação de conta: entra no saldo, fora do faturamento e do DRE."
                      >
                        ajuste
                      </span>
                    )}
                  </td>
                  <td className="text-[var(--text-dim)]">{nomeCategoria(lancamento.categoria_id)}</td>
                  <td>
                    <StatusTag status={status} />
                  </td>
                  <td className="text-right">{money(lancamento.valor)}</td>
                  <td className="text-right font-semibold text-[var(--accent-red)]">{money(falta)}</td>
                  <td className="text-right">
                    <div className="flex justify-end items-center gap-2">
                      {falta > 0.004 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPagando({ lancamento, falta });
                          }}
                          className="px-3 py-1 text-xs bg-[var(--accent-green)] text-[var(--bg)] font-semibold rounded"
                        >
                          Pagar
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label="Editar lançamento"
                        title="Editar"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditando(lancamento);
                          setModalOpen(true);
                        }}
                        className="p-1.5 rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                {estaExpandido && (
                  <tr key={`${lancamento.id}-pagamentos`} className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                    <td></td>
                    <td colSpan={7} className="py-2 pr-4">
                      <table className="w-full text-xs">
                        <tbody>
                          {pagamentosDoLancamento.map((p) => (
                            <tr key={p.id}>
                              <td className="py-1 text-[var(--text-dim)]">{formatDataBR(p.data_pagamento)}</td>
                              <td className="py-1 text-[var(--text-dim)]">
                                {p.forma_pagamento ? FORMAS_PAGAMENTO_LABEL[p.forma_pagamento] ?? p.forma_pagamento : "—"}
                              </td>
                              <td className="py-1">
                                <ContaPagamentoSelect
                                  pagamentoId={p.id}
                                  contaAtual={p.conta_financeira_id}
                                  contas={contas}
                                  ehPermuta={p.forma_pagamento === "permuta"}
                                />
                              </td>
                              <td className="py-1 text-right">{money(p.valor)}</td>
                              <td className="py-1 text-right w-32">
                                {p.comprovante_url ? (
                                  <VerComprovanteButton path={p.comprovante_url} />
                                ) : (
                                  <AnexarComprovanteButton pagamentoId={p.id} lancamentoId={lancamento.id} />
                                )}
                              </td>
                              <td className="py-1 text-right w-8">
                                <EstornarPagamentoButton pagamentoId={p.id} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {linhas.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-[var(--text-dim)]">
                Nenhum lançamento com esses filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <LancamentoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        lancamento={editando}
        categorias={categorias}
        clientes={clientes}
        fornecedores={fornecedores}
        contas={contas}
      />

      <PagamentoModal
        key={pagando?.lancamento.id ?? "fechado"}
        open={!!pagando}
        onClose={() => setPagando(null)}
        lancamento={pagando?.lancamento ?? null}
        falta={pagando?.falta ?? 0}
        contas={contas}
      />
    </div>
  );
}
