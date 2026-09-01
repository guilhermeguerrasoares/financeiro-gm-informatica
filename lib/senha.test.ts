import { describe, it, expect } from "vitest";
import { SENHA_MINIMA, validarTrocaSenha, traduzirErroSenha } from "./senha";

describe("validarTrocaSenha", () => {
  it("aceita senha longa e confirmação igual", () => {
    expect(validarTrocaSenha("Loja#2026gm", "Loja#2026gm")).toBeNull();
  });

  it("recusa quando a confirmação não bate", () => {
    expect(validarTrocaSenha("Loja#2026gm", "Loja#2026GM")).toBe(
      "A confirmação não confere com a nova senha."
    );
  });

  it("recusa senha curta demais", () => {
    expect(validarTrocaSenha("Abc#12", "Abc#12")).toBe(
      `A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`
    );
  });

  it("recusa senha vazia", () => {
    expect(validarTrocaSenha("", "")).toBe("Informe a nova senha.");
  });

  // A regra completa (dígito, maiúscula, minúscula, símbolo) é do painel da
  // Supabase e pode mudar lá sem passar por aqui. Validar só o que não muda
  // evita a tela recusar uma senha que o servidor aceitaria, ou vice-versa.
  it("não tenta replicar a regra de complexidade do servidor", () => {
    expect(validarTrocaSenha("senhasimples", "senhasimples")).toBeNull();
  });
});

describe("traduzirErroSenha", () => {
  it("traduz senha fraca ou vazada", () => {
    expect(traduzirErroSenha("Password is known to be weak and easy to guess")).toBe(
      "Essa senha aparece em vazamentos conhecidos. Escolha outra."
    );
  });

  it("traduz comprimento insuficiente", () => {
    expect(traduzirErroSenha("Password should be at least 8 characters")).toBe(
      "A senha não atende à política mínima exigida (tamanho e tipos de caractere)."
    );
  });

  it("traduz exigência de tipos de caractere", () => {
    expect(
      traduzirErroSenha("Password should contain at least one character of each")
    ).toBe("A senha não atende à política mínima exigida (tamanho e tipos de caractere).");
  });

  it("traduz senha igual à anterior", () => {
    expect(
      traduzirErroSenha("New password should be different from the old password.")
    ).toBe("A nova senha precisa ser diferente da atual.");
  });

  it("traduz credencial inválida na reautenticação", () => {
    expect(traduzirErroSenha("Invalid login credentials")).toBe("Senha atual incorreta.");
  });

  it("cai numa mensagem genérica em português quando não reconhece", () => {
    expect(traduzirErroSenha("Some unmapped upstream failure")).toBe(
      "Não foi possível alterar a senha. Tente de novo."
    );
  });

  it("reconhece independente de caixa", () => {
    expect(traduzirErroSenha("INVALID LOGIN CREDENTIALS")).toBe("Senha atual incorreta.");
  });
});
