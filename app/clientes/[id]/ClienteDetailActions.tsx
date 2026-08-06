"use client";

import { useState } from "react";
import { ClienteModal } from "../ClienteModal";
import { EquipamentoModal } from "./EquipamentoModal";
import type { Cliente } from "@/lib/types";

export function ClienteDetailActions({ cliente }: { cliente: Cliente }) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [equipamentoModalOpen, setEquipamentoModalOpen] = useState(false);

  return (
    <div className="flex gap-2 mb-6">
      <button
        onClick={() => setEditModalOpen(true)}
        className="px-3 py-1.5 rounded border border-[var(--border)] text-sm font-semibold"
      >
        Editar cliente
      </button>
      <button
        onClick={() => setEquipamentoModalOpen(true)}
        className="px-3 py-1.5 rounded bg-[var(--accent-blue)] text-[var(--bg)] text-sm font-semibold"
      >
        + Novo equipamento
      </button>

      <ClienteModal open={editModalOpen} onClose={() => setEditModalOpen(false)} cliente={cliente} />
      <EquipamentoModal
        open={equipamentoModalOpen}
        onClose={() => setEquipamentoModalOpen(false)}
        clienteId={cliente.id}
      />
    </div>
  );
}
