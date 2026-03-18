import { describe, expect, test } from "bun:test";

import { buildBillingBusinessModes } from "./business-modes";

describe("buildBillingBusinessModes", () => {
  test("returns ordered business modes with the selected plan highlighted", () => {
    const result = buildBillingBusinessModes("growth", "yearly");
    const growthMode = result[1];
    const proMode = result[2];
    const enterpriseMode = result[3];

    expect(result.map((mode) => mode.id)).toEqual([
      "starter",
      "growth",
      "pro",
      "agency-enterprise",
    ]);

    expect(growthMode).toEqual({
      id: "growth",
      label: "Growth",
      badge: "Equipe en acceleration",
      isCurrent: true,
      quotaLabel: "200 analyses / mois",
      modelLimitLabel: "6 modeles IA actifs",
      cycleLabel: "Annuel",
      ctaLabel: "Plan actuel",
    });

    expect(proMode).toEqual({
      id: "pro",
      label: "Pro",
      badge: "Scale multi-marques",
      isCurrent: false,
      quotaLabel: "Quota quasi illimite",
      modelLimitLabel: "Modeles IA illimites",
      cycleLabel: "Annuel",
      ctaLabel: "Passer en Pro",
    });

    expect(enterpriseMode).toEqual({
      id: "agency-enterprise",
      label: "Agency / Enterprise",
      badge: "Sur mesure",
      isCurrent: false,
      quotaLabel: "Quota personnalise",
      modelLimitLabel: "Modeles IA illimites",
      cycleLabel: "Contrat annuel",
      ctaLabel: "Parler a l equipe",
    });
  });
});
