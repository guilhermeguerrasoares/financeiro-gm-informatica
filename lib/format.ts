export function hoje(): string {
  // en-CA formats as YYYY-MM-DD; pinned to the store's timezone so "hoje" matches
  // the local calendar day instead of drifting a few hours around UTC midnight.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
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
