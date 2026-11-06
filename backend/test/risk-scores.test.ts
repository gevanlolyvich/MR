import { describe, expect, it } from "vitest";
import {
  IMPACT_LABELS,
  PROBABILITY_LABELS,
  probImpactSchema,
  riskLevel,
  riskScore,
} from "../src/modules/risks/risk-scores";

describe("riskScore", () => {
  it("mengalikan probability dan impact", () => {
    expect(riskScore(3, 4)).toBe(12);
    expect(riskScore(1, 1)).toBe(1);
    expect(riskScore(5, 5)).toBe(25);
  });
});

describe("riskLevel", () => {
  it("memetakan batas skor sesuai kebijakan", () => {
    expect(riskLevel(1)).toBe("LOW");
    expect(riskLevel(5)).toBe("LOW");
    expect(riskLevel(6)).toBe("MEDIUM");
    expect(riskLevel(10)).toBe("MEDIUM");
    expect(riskLevel(11)).toBe("HIGH");
    expect(riskLevel(15)).toBe("HIGH");
    expect(riskLevel(16)).toBe("VERY_HIGH");
    expect(riskLevel(25)).toBe("VERY_HIGH");
  });
});

describe("probImpactSchema", () => {
  it("menghitung skor dan level otomatis", () => {
    const result = probImpactSchema.parse({ probability: 4, impact: 5, justification: "Dampak luas" });
    expect(result).toMatchObject({
      probability: 4,
      impact: 5,
      score: 20,
      level: "VERY_HIGH",
      justification: "Dampak luas",
    });
  });

  it("mengkoersi nilai string dari form", () => {
    const result = probImpactSchema.parse({ probability: "2", impact: "3" });
    expect(result.score).toBe(6);
    expect(result.level).toBe("MEDIUM");
  });

  it("menolak nilai di luar rentang 1-5", () => {
    expect(() => probImpactSchema.parse({ probability: 0, impact: 3 })).toThrow();
    expect(() => probImpactSchema.parse({ probability: 3, impact: 6 })).toThrow();
  });
});

describe("label skala", () => {
  it("menyediakan 5 label probability dan impact", () => {
    expect(PROBABILITY_LABELS).toHaveLength(5);
    expect(IMPACT_LABELS).toHaveLength(5);
  });
});
