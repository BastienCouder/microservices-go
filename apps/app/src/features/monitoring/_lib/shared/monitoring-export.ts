import type {
  MonitoringData,
  MonitoringPrompt,
} from "./monitoring-data";
import type { MonitoringFiltersSnapshot } from "./use-monitoring-filters";

type CellValue = string | number | boolean | null | undefined;

type Worksheet = {
  name: string;
  rows: CellValue[][];
  widths?: number[];
};

type MonitoringExportArgs = {
  data: MonitoringData;
  filteredPrompts: MonitoringPrompt[];
  filters: MonitoringFiltersSnapshot;
};

const BOOLEAN_LABELS = {
  true: "Oui",
  false: "Non",
} as const;

const SENTIMENT_LABELS: Record<string, string> = {
  positive: "Positif",
  neutral: "Neutre",
  negative: "Negatif",
};

function cleanSheetName(value: string) {
  return value.replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Feuille";
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeText(value: CellValue) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") {
    return value ? BOOLEAN_LABELS.true : BOOLEAN_LABELS.false;
  }
  return String(value);
}

function cellToXml(value: CellValue, styleId?: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell${styleId ? ` ss:StyleID="${styleId}"` : ""}><Data ss:Type="Number">${Math.round(value)}</Data></Cell>`;
  }

  return `<Cell${styleId ? ` ss:StyleID="${styleId}"` : ""}><Data ss:Type="String">${escapeXml(normalizeText(value))}</Data></Cell>`;
}

function rowToXml(row: CellValue[], rowIndex: number) {
  const styleId = rowIndex === 0 ? "Header" : undefined;
  return `<Row>${row.map((cell) => cellToXml(cell, styleId)).join("")}</Row>`;
}

function worksheetToXml(worksheet: Worksheet) {
  const columns = (worksheet.widths ?? [])
    .map((width) => `<Column ss:Width="${width}"/>`)
    .join("");
  const title = `<Row ss:Height="24"><Cell ss:StyleID="Title"><Data ss:Type="String">${escapeXml(worksheet.name)}</Data></Cell></Row><Row/>`;
  const rows = worksheet.rows.map(rowToXml).join("");

  return `<Worksheet ss:Name="${escapeXml(cleanSheetName(worksheet.name))}"><Table>${columns}${title}${rows}</Table></Worksheet>`;
}

function buildWorkbookXml(worksheets: Worksheet[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Top" ss:WrapText="1"/>
   <Font ss:FontName="Arial" ss:Size="10"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Arial" ss:Size="14" ss:Bold="1"/>
   <Interior ss:Color="#EEF2F6" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1F2937" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Top" ss:WrapText="1"/>
  </Style>
 </Styles>
 ${worksheets.map(worksheetToXml).join("")}
</Workbook>`;
}

function average(values: number[]) {
  const validValues = values.filter((value) => Number.isFinite(value));
  if (validValues.length === 0) return 0;
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function percent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function scoreWithGrade(score: number) {
  const rounded = Math.round(score);
  if (rounded >= 85) return `${rounded}/100 - tres bon`;
  if (rounded >= 70) return `${rounded}/100 - bon`;
  if (rounded >= 50) return `${rounded}/100 - a renforcer`;
  return `${rounded}/100 - prioritaire`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Non renseigne";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatPeriod(filters: MonitoringFiltersSnapshot) {
  if (filters.dateRange?.from || filters.dateRange?.to) {
    const from = filters.dateRange.from ? formatDate(filters.dateRange.from.toISOString()) : "";
    const to = filters.dateRange.to ? formatDate(filters.dateRange.to.toISOString()) : "";
    return [from, to].filter(Boolean).join(" - ");
  }
  if (filters.period === "today") return "24h";
  return filters.period || "Historique complet";
}

function selectedFilterLabel(values: string[], fallback: string) {
  return values.length > 0 ? values.join(", ") : fallback;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function getPromptMetrics(prompts: MonitoringPrompt[]) {
  const total = prompts.length;
  const mentions = prompts.filter((prompt) => prompt.mention).length;
  const citations = prompts.filter((prompt) => prompt.citationFound).length;
  const rankedPrompts = prompts.filter((prompt) => typeof prompt.rank === "number");

  return {
    mentionRate: percent(mentions, total),
    citationRate: percent(citations, total),
    visibilityScore: Math.round(average(prompts.map((prompt) => prompt.score))),
    avgPosition:
      rankedPrompts.length > 0
        ? Number(average(rankedPrompts.map((prompt) => prompt.rank ?? 0)).toFixed(1))
        : 0,
    mentions,
    citations,
    total,
  };
}

function getSentimentRows(prompts: MonitoringPrompt[]) {
  const counts = prompts.reduce<Record<string, number>>(
    (acc, prompt) => {
      acc[prompt.sentiment] = (acc[prompt.sentiment] ?? 0) + 1;
      return acc;
    },
    { positive: 0, neutral: 0, negative: 0 },
  );

  return Object.entries(SENTIMENT_LABELS).map(([key, label]) => [
    label,
    counts[key] ?? 0,
    percent(counts[key] ?? 0, prompts.length),
  ]);
}

function buildModelRows(data: MonitoringData, prompts: MonitoringPrompt[]) {
  const modelNames = new Map(
    data.models.map((model) => [
      model.id,
      model.displayName || model.groupName || model.providerModelId || model.id,
    ]),
  );
  const grouped = new Map<string, MonitoringPrompt[]>();

  for (const prompt of prompts) {
    const key = prompt.modelId || prompt.modelDisplayName || prompt.modelGroupName;
    grouped.set(key, [...(grouped.get(key) ?? []), prompt]);
  }

  return Array.from(grouped.entries())
    .map(([modelId, modelPrompts]) => {
      const metrics = getPromptMetrics(modelPrompts);
      return [
        modelNames.get(modelId) || modelPrompts[0]?.modelDisplayName || modelPrompts[0]?.modelGroupName || modelId,
        metrics.mentionRate,
        metrics.visibilityScore,
        metrics.citationRate,
        metrics.avgPosition || "Non classe",
      ];
    })
    .sort((left, right) => Number(right[2]) - Number(left[2]));
}

function buildBrandRows(data: MonitoringData, prompts: MonitoringPrompt[]) {
  const projectName = data.project.name.trim();
  const brands = [
    ...(projectName
      ? [
          {
            name: projectName,
            mentions: prompts.filter((prompt) => prompt.mention).length,
            type: "Marque",
          },
        ]
      : []),
    ...data.project.competitors.map((competitor) => ({
      name: competitor.name,
      mentions: prompts.filter((prompt) =>
        prompt.competitorsMentioned.some(
          (name) => normalizeName(name) === normalizeName(competitor.name),
        ),
      ).length,
      type: "Concurrent",
    })),
  ].filter((brand) => brand.name.trim() !== "");
  const totalMentions = brands.reduce((sum, brand) => sum + brand.mentions, 0);

  return brands
    .map((brand) => [
      brand.name,
      brand.type,
      brand.mentions,
      percent(brand.mentions, prompts.length),
      percent(brand.mentions, totalMentions),
    ])
    .sort((left, right) => Number(right[4]) - Number(left[4]));
}

function buildCitedPageRows(prompts: MonitoringPrompt[]) {
  const pages = new Map<string, number>();

  for (const prompt of prompts) {
    for (const rawUrl of prompt.citedUrls) {
      const normalized = rawUrl.trim();
      if (!normalized) continue;
      pages.set(normalized, (pages.get(normalized) ?? 0) + 1);
    }
  }

  const totalCitations = Array.from(pages.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(pages.entries())
    .map(([page, count]) => [page, count, percent(count, totalCitations)])
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, 20);
}

function buildWorksheets(args: MonitoringExportArgs): Worksheet[] {
  const { data, filteredPrompts, filters } = args;
  const metrics = getPromptMetrics(filteredPrompts);
  const periodLabel = formatPeriod(filters);

  return [
    {
      name: "Resume client",
      widths: [220, 520],
      rows: [
        ["Indicateur", "Valeur"],
        ["Marque", data.project.name],
        ["Periode analysee", periodLabel],
        ["Modeles inclus", selectedFilterLabel(filters.selectedModels, "Tous les modeles")],
        ["Personas inclus", selectedFilterLabel(filters.selectedPersonas, "Tous les personas")],
        ["Score de visibilite", scoreWithGrade(metrics.visibilityScore)],
        ["Taux de mention", `${metrics.mentionRate}%`],
        ["Taux de citation/source", `${metrics.citationRate}%`],
        ["Position moyenne", metrics.avgPosition || "Non classe"],
        ["Export genere le", formatDate(new Date().toISOString())],
      ],
    },
    {
      name: "Scores cles",
      widths: [220, 130, 420],
      rows: [
        ["Indicateur", "Valeur", "Lecture"],
        ["Taux de mention", `${metrics.mentionRate}%`, "Part des analyses IA ou la marque est citee."],
        ["Score de visibilite", metrics.visibilityScore, "Score moyen de presence et de qualite dans les reponses IA."],
        ["Taux de citation/source", `${metrics.citationRate}%`, "Part des reponses IA qui citent une source."],
        ["Position moyenne", metrics.avgPosition || "Non classe", "Rang moyen lorsque la marque est classee dans une reponse."],
      ],
    },
    {
      name: "Sentiment",
      widths: [180, 120, 120],
      rows: [
        ["Sentiment", "Volume", "Part"],
        ...getSentimentRows(filteredPrompts),
      ],
    },
    {
      name: "Visibilite modeles",
      widths: [220, 130, 130, 130, 130],
      rows: [
        ["Modele", "Taux mention", "Score visibilite", "Taux citation", "Position moyenne"],
        ...buildModelRows(data, filteredPrompts),
      ],
    },
    {
      name: "Visibilite marques",
      widths: [220, 130, 120, 130, 130],
      rows: [
        ["Marque", "Type", "Mentions", "Taux mention", "Share of voice"],
        ...buildBrandRows(data, filteredPrompts),
      ],
    },
    {
      name: "Pages citees",
      widths: [520, 120, 130],
      rows: [
        ["Page", "Citations", "Part citations"],
        ...buildCitedPageRows(filteredPrompts),
      ],
    },
  ];
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function exportMonitoringWorkbook(args: MonitoringExportArgs) {
  if (typeof document === "undefined") return;

  const worksheets = buildWorksheets(args);
  const workbookXml = buildWorkbookXml(worksheets);
  const blob = new Blob([workbookXml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const brandSlug = slugify(args.data.project.name) || "monitoring";
  const dateSlug = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `${brandSlug}-monitoring-${dateSlug}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
