export const FORMAS_PAGAMENTO: { value: string; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "permuta", label: "Permuta" },
];

export const FORMAS_PAGAMENTO_LABEL: Record<string, string> = Object.fromEntries(
  FORMAS_PAGAMENTO.map((f) => [f.value, f.label])
);
