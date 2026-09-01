import { describe, it, expect } from "vitest";
import {
  sanitizarNomeArquivo,
  validarComprovante,
  montarCaminhoComprovante,
  TAMANHO_MAXIMO_BYTES,
} from "./comprovantes";

describe("sanitizarNomeArquivo", () => {
  it("descarta diretórios do nome", () => {
    expect(sanitizarNomeArquivo("../../etc/passwd")).toBe("passwd");
  });

  it("tira acento e espaço, preservando a extensão", () => {
    expect(sanitizarNomeArquivo("Nota Fiscal Março.pdf")).toBe("nota-fiscal-marco.pdf");
  });

  it("colapsa separadores repetidos", () => {
    expect(sanitizarNomeArquivo("nota   ---   2.pdf")).toBe("nota-2.pdf");
  });

  it("devolve um nome utilizável quando não sobra nada", () => {
    expect(sanitizarNomeArquivo("///")).toBe("arquivo");
  });

  it("limita o comprimento", () => {
    expect(sanitizarNomeArquivo("a".repeat(200) + ".pdf").length).toBeLessThanOrEqual(80);
  });
});

describe("validarComprovante", () => {
  it("aceita PDF dentro do limite", () => {
    expect(validarComprovante({ type: "application/pdf", size: 1024 })).toBeNull();
  });

  it("aceita imagem dentro do limite", () => {
    expect(validarComprovante({ type: "image/png", size: 1024 })).toBeNull();
  });

  it("recusa tipo fora da lista", () => {
    expect(validarComprovante({ type: "text/html", size: 1024 })).toBe(
      "Comprovante deve ser JPG, PNG, WEBP ou PDF."
    );
  });

  it("recusa arquivo acima do limite", () => {
    expect(validarComprovante({ type: "application/pdf", size: TAMANHO_MAXIMO_BYTES + 1 })).toBe(
      "Comprovante deve ter no máximo 10 MB."
    );
  });
});

describe("montarCaminhoComprovante", () => {
  it("prefixa com o lançamento e o instante, com o nome já limpo", () => {
    expect(montarCaminhoComprovante("abc-123", "Nota Fiscal.pdf", 1700000000000)).toBe(
      "abc-123/1700000000000-nota-fiscal.pdf"
    );
  });
});
