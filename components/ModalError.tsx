export function ModalError({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null;
  return <p className="col-span-2 text-sm text-[var(--accent-red)]">{mensagem}</p>;
}
