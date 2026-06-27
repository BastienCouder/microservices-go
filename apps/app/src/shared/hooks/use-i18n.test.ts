import { describe, expect, test } from "bun:test";

import { getI18nText, translateI18nText } from "./use-i18n";

const hookSource = await Bun.file(new URL("./use-i18n.ts", import.meta.url)).text();

describe("getI18nText", () => {
  test("returns the localized monitoring copy for French and English", () => {
    expect(getI18nText("monitoring-analytics-panel", "visibilityAnalyticsTitle", "fr-FR")).toBe(
      "Analyse de visibilité",
    );
    expect(getI18nText("monitoring-analytics-panel", "visibilityAnalyticsTitle", "en-US")).toBe(
      "Visibility analysis",
    );
    expect(getI18nText("monitoring-activity-panel", "criticalUpdates", "fr")).toBe(
      "Erreurs monitoring",
    );
    expect(getI18nText("monitoring-activity-panel", "criticalUpdates", "en")).toBe(
      "Monitoring errors",
    );
    expect(getI18nText("monitoring-mobile", "alerts", "fr")).toBe("Erreurs");
    expect(getI18nText("monitoring-mobile", "alerts", "en")).toBe("Errors");
  });

  test("returns the localized prompts copy for French and English", () => {
    expect(getI18nText("prompts-workspace", "responsesTab", "fr")).toBe("Réponses");
    expect(getI18nText("prompts-workspace", "responsesTab", "en")).toBe("Responses");
  });

  test("returns the localized sidebar copy for French and English", () => {
    expect(getI18nText("sidebar", "logout", "fr")).toBe("Déconnexion");
    expect(getI18nText("sidebar", "logout", "en")).toBe("Logout");
    expect(getI18nText("sidebar", "responses", "fr")).toBe("Réponses IA");
    expect(getI18nText("sidebar", "back", "en")).toBe("Back");
    expect(getI18nText("sidebar", "dashboard", "fr")).toBe("Vue d’ensemble");
    expect(getI18nText("sidebar", "contentOptimizer", "fr")).toBe("Optimisation contenu");
    expect(getI18nText("sidebar", "organizationTabProjects", "fr")).toBe("Projets");
  });

  test("humanizes unknown keys when no translation exists", () => {
    expect(getI18nText("prompts-workspace", "someMissingKey", "en")).toBe("some Missing Key");
  });
});

describe("translateI18nText", () => {
  test("supports pluralization and interpolation from translation files", () => {
    expect(
      translateI18nText("prompts-workspace", "selectedModels", "fr", {
        count: 2,
      }),
    ).toBe("2 modèles sélectionnés");
    expect(
      translateI18nText("monitoring-mobile", "selectedCompetitors", "en", {
        count: 1,
      }),
    ).toBe("1 competitor");
  });
});

describe("useScopedI18n", () => {
  test("keeps the translation callback stable between renders", () => {
    expect(hookSource.includes("const t = useCallback(")).toBe(true);
    expect(hookSource.includes("[locale, namespace]")).toBe(true);
  });
});
