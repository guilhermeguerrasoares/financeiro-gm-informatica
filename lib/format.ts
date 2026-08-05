export function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function money(n: number | null | undefined): string {
  return brl.format(n ?? 0);
}

export function formatDataBR(iso: string | null): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
