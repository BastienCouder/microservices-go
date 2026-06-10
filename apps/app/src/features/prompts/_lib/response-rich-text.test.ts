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
});
