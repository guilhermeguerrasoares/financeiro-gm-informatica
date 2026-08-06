"use client";

import { useState } from "react";
import Link from "next/link";
import { ClienteModal } from "./ClienteModal";
import type { Cliente } from "@/lib/types";

const BADGE: Record<string, string> = {
  vip: "bg-amber-950 text-[var(--accent-amber)]",
  recorrente: "bg-blue-950 text-[var(--accent-blue)]",
  inadimplente: "bg-red-950 text-[var(--accent-red)]",
  padrao: "bg-[var(--surface-2)] text-[var(--text-dim)]",
};

export function ClientesList({ clientes }: { clientes: Cliente[] }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-1.5 rounded bg-[var(--accent-blue)] text-[var(--bg)] text-sm font-semibold"
        >
          + Novo cliente
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {clientes.map((c) => (
          <Link
            key={c.id}
            href={`/clientes/${c.id}`}
            className="block bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--accent-blue)]"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold">{c.nome}</h3>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${BADGE[c.classificacao]}`}>
                {c.classificacao}
              </span>
            </div>
            <p className="text-sm text-[var(--text-dim)]">{c.contato ?? "Sem contato"}</p>
          </Link>
        ))}
        {clientes.length === 0 && (
          <p className="text-[var(--text-dim)]">Nenhum cliente cadastrado ainda.</p>
        )}
      </div>

      <ClienteModal open={modalOpen} onClose={() => setModalOpen(false)} cliente={null} />
    </div>
  );
}
