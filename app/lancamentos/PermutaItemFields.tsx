export function PermutaItemFields() {
  return (
    <div className="col-span-2 border border-[var(--border)] rounded p-3 bg-[var(--surface-2)]">
      <p className="text-xs text-[var(--text-dim)] mb-2 uppercase tracking-wide">Item recebido em permuta</p>
      <label className="block text-xs text-[var(--text-dim)] mb-1">Descrição do item</label>
      <input
        name="permuta_descricao"
        placeholder="Ex: Notebook Dell usado"
        required
        className="w-full px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)]"
      />
    </div>
  );
}
