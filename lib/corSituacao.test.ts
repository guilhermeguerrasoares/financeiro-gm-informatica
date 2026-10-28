import { describe, it, expect } from "vitest";
import { classeDoSaldo } from "./corSituacao";

describe("classeDoSaldo", () => {
  it("vermelho só quando atrasado", () => {
    expect(classeDoSaldo("atrasado")).toContain("--accent-red");
  });

  it("âmbar quando parcial", () => {
    expect(classeDoSaldo("parcial")).toContain("--accent-amber");
  });

  it("não usa vermelho em aberto nem quitado", () => {
    expect(classeDoSaldo("aberto")).not.toContain("--accent-red");
    expect(classeDoSaldo("quitado")).not.toContain("--accent-red");
  });
});
