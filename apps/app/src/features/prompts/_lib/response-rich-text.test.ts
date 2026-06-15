import { describe, expect, test } from "bun:test";

import { normalizeResponseRichText, parseResponseRichTextBlocks } from "./response-rich-text";

describe("normalizeResponseRichText", () => {
  test("separates inline bold section labels and lists into readable blocks", () => {
    const normalized = normalizeResponseRichText(
      "Resume global **Forces :** Acme ressort bien. **Faiblesses :** Peu de sources. - Ajouter des cas clients - Citer des preuves",
    );

    expect(normalized.includes("Resume global\n\n**Forces :**")).toBe(true);
    expect(normalized.includes("**Faiblesses :**")).toBe(true);
    expect(normalized.includes("\n- Ajouter des cas clients")).toBe(true);
    expect(normalized.includes("\n- Citer des preuves")).toBe(true);
  });

  test("expands compact markdown tables into separate rows", () => {
    const normalized = normalizeResponseRichText(
      "| Bar | Adresse | |-----|---------| | Le 106 | Rouen | | Le Bazar | Rouen |",
    );

    expect(normalized.includes("| Bar | Adresse |")).toBe(true);
    expect(/\n\|\s*-+\|-+\s*\|/.test(normalized)).toBe(true);
    expect(normalized.includes("\n| Le 106 | Rouen |")).toBe(true);
    expect(normalized.includes("\n| Le Bazar | Rouen |")).toBe(true);
  });
});

describe("parseResponseRichTextBlocks", () => {
  test("parses headings, paragraphs, unordered and ordered lists from compact llm output", () => {
    const blocks = parseResponseRichTextBlocks(
      "## Synthese Acme est souvent citee. **Sources :** https://acme.test - Point fort principal - Preuve produit 1. Premier axe 2. Deuxieme axe",
    );

    expect(blocks).toEqual([
      { type: "heading", level: 2, content: "Synthese Acme est souvent citee." },
      { type: "paragraph", content: "**Sources :** https://acme.test" },
      { type: "ul", items: ["Point fort principal", "Preuve produit"] },
      { type: "ol", items: ["Premier axe", "Deuxieme axe"] },
    ]);
  });

  test("parses markdown tables into structured table blocks", () => {
    const blocks = parseResponseRichTextBlocks(
      "Voici une selection.\n\n| Bar | Adresse | |-----|---------| | Le 106 | Rouen | | Le Bazar | Centre-ville |\n\nFin de liste.",
    );

    expect(blocks).toEqual([
      { type: "paragraph", content: "Voici une selection." },
      {
        type: "table",
        headers: ["Bar", "Adresse"],
        rows: [
          ["Le 106", "Rouen"],
          ["Le Bazar", "Centre-ville"],
        ],
      },
      { type: "paragraph", content: "Fin de liste." },
    ]);
  });
});
