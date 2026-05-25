export type RichTextBlock =
  | { type: "heading"; level: number; content: string }
  | { type: "paragraph"; content: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

export function normalizeResponseRichText(source: string) {
  return source
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([^\n])\s+(#{1,6}\s)/g, "$1\n\n$2")
    .replace(/([^\n])\s+(\*\*(?:sources?|references?)\s*:)/gi, "$1\n\n$2")
    .replace(/([^\n])\s+(\*\*[^\n*]{1,80}:\*\*)/g, "$1\n\n$2")
    .replace(/([^\n])\s+([*-]\s+)/g, "$1\n$2")
    .replace(/([^\n])\s+(\d+\.\s+(?:\*\*|[A-ZÀ-ÿ]))/g, "$1\n$2")
    .replace(/\n([*-]|\d+\.)\s+/g, "\n$1 ")
    .trim();
}

export function parseResponseRichTextBlocks(source: string): RichTextBlock[] {
  const normalized = normalizeResponseRichText(source);
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const blocks: RichTextBlock[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    blocks.push({ type: "paragraph", content: paragraphBuffer.join(" ").trim() });
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!listType || listBuffer.length === 0) return;
    blocks.push({ type: listType, items: listBuffer });
    listBuffer = [];
    listType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2] ?? "",
      });
      continue;
    }

    const unorderedMatch = line.match(/^[*-]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listBuffer.push(unorderedMatch[1] ?? "");
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listBuffer.push(orderedMatch[1] ?? "");
      continue;
    }

    flushList();
    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}
