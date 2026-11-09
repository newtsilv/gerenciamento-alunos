import { describe, expect, it } from "vitest";
import { average, delta, formatAverage, formatScore } from "@/lib/domain/scores";

describe("escala de 0 a 10", () => {
  it("zero é nota e entra na média", () => {
    expect(average([0, 10])).toBe(5);
  });

  it("não observado fica fora da média", () => {
    expect(average([null, 10])).toBe(10);
  });
});

describe("médias", () => {
  it("ignora 'Não observado' (null) e não preenchidos", () => {
    expect(average([4, null, 2, undefined])).toBe(3);
  });
  it("retorna null quando não há notas — nunca zero", () => {
    expect(average([null, undefined])).toBeNull();
    expect(average([])).toBeNull();
  });
  it("variação só é calculada quando há duas médias", () => {
    expect(delta(3, 4)).toBe(1);
    expect(delta(null, 4)).toBeNull();
  });
  it("formata para pt-BR", () => {
    expect(formatAverage(3.25)).toBe("3,3");
    expect(formatAverage(null)).toBe("—");
    expect(formatScore(null)).toBe("N/O");
  });
});
