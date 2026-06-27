import type {
  PerceptionHeatmapAxis,
  PerceptionHeatmapRow,
  PerceptionRadarPoint,
  PerceptionTrendPoint,
  PerceptionViewData,
} from "./shared/perception-data";

type ExportScoreCard = {
  id: string;
  title: string;
  value: number;
  hint: string;
};

type ExportWorkbookArgs = {
  data: PerceptionViewData;
  periodLabel: string;
  selectedModels: string[];
  scoreCards: ExportScoreCard[];
  radar: PerceptionRadarPoint[];
  heatmap: {
    axes: PerceptionHeatmapAxis[];
    rows: PerceptionHeatmapRow[];
  };
  trendData: PerceptionTrendPoint[];
};

type CellValue = string | number | boolean | null | undefined;

type Worksheet = {
  name: string;
  rows: CellValue[][];
  widths?: number[];
};

const BOOLEAN_LABELS = {
  true: "Oui",
  false: "Non",
} as const;

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

function cellToStyledXml(value: CellValue, styleId?: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell${styleId ? ` ss:StyleID="${styleId}"` : ""}><Data ss:Type="Number">${Math.round(value)}</Data></Cell>`;
  }

  return `<Cell${styleId ? ` ss:StyleID="${styleId}"` : ""}><Data ss:Type="String">${escapeXml(normalizeText(value))}</Data></Cell>`;
}

function rowToXml(row: CellValue[], rowIndex: number) {
  const styleId = rowIndex === 0 ? "Header" : undefined;
  return `<Row>${row.map((cell) => cellToStyledXml(cell, styleId)).join("")}</Row>`;
}

function worksheetToXml(worksheet: Worksheet) {
  const columns = (worksheet.widths ?? [])
    .map((width) => `<Column ss:Width="${width}"/>`)
    .join("");
  const title = `<Row ss:Height="24"><Cell ss:StyleID="Title"><Data ss:Type="String">${escapeXml(worksheet.name)}</Data></Cell></Row><Row/>`;
  const rows = worksheet.rows.map(rowToXml).join("");

  return `<Worksheet ss:Name="${escapeXml(cleanSheetName(worksheet.name))}"><Table>${columns}${title}${rows}</Table></Worksheet>`;
}

function joinList(values: string[]) {
  const joined = values.filter(Boolean).join(", ");
  return joined || "Non renseigne";
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

function scoreWithGrade(score: number) {
  const rounded = Math.round(score);
  if (rounded >= 85) return `${rounded}/100 - tres bon`;
  if (rounded >= 70) return `${rounded}/100 - bon`;
  if (rounded >= 50) return `${rounded}/100 - a renforcer`;
  return `${rounded}/100 - prioritaire`;
}

function average(values: number[]) {
  const validValues = values.filter((value) => Number.isFinite(value));
  if (validValues.length === 0) return 0;
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function findBestAxis(radar: PerceptionRadarPoint[]) {
  return radar.reduce<PerceptionRadarPoint | null>(
    (best, point) => (!best || point.score > best.score ? point : best),
    null,
  );
}

function findWeakestAxis(radar: PerceptionRadarPoint[]) {
  return radar.reduce<PerceptionRadarPoint | null>(
    (weakest, point) => (!weakest || point.score < weakest.score ? point : weakest),
    null,
  );
}

function buildWorksheets(args: ExportWorkbookArgs): Worksheet[] {
  const {
    data,
    heatmap,
    periodLabel,
    radar,
    scoreCards,
    selectedModels,
    trendData,
  } = args;
  const modelFilter =
    selectedModels.length > 0 ? joinList(selectedModels) : "Tous les modeles";
  const overallScore = average(scoreCards.map((card) => card.value));
  const bestAxis = findBestAxis(radar);
  const weakestAxis = findWeakestAxis(radar);

  return [
    {
      name: "Resume client",
      widths: [210, 520],
      rows: [
        ["Indicateur", "Valeur"],
        ["Marque", data.brandCanon.brandName],
        ["Categorie", data.brandCanon.category],
        ["Periode analysee", periodLabel],
        ["Modeles inclus", modelFilter],
        ["Score global perception", scoreWithGrade(overallScore)],
        ["Point fort principal", bestAxis ? `${bestAxis.label} (${scoreWithGrade(bestAxis.score)})` : "Non renseigne"],
        ["Priorite d'amelioration", weakestAxis ? `${weakestAxis.label} (${scoreWithGrade(weakestAxis.score)})` : "Non renseigne"],
        ["Export genere le", formatDate(new Date().toISOString())],
      ],
    },
    {
      name: "Profil de marque",
      widths: [210, 520],
      rows: [
        ["Champ", "Information client"],
        ["Positionnement attendu", data.brandCanon.positioning],
        ["Cas d'usage", joinList(data.brandCanon.useCases)],
        ["Fonctionnalites importantes", joinList(data.brandCanon.features)],
      ],
    },
    {
      name: "Scores cles",
      widths: [210, 130, 180, 420],
      rows: [
        ["Indicateur", "Score", "Niveau", "Ce que cela veut dire"],
        ...scoreCards.map((card) => [
          card.title,
          Math.round(card.value),
          scoreWithGrade(card.value).replace(`${Math.round(card.value)}/100 - `, ""),
          card.hint,
        ]),
      ],
    },
    {
      name: "Axes de perception",
      widths: [190, 110, 110, 120, 230],
      rows: [
        ["Axe", "Score actuel", "Objectif", "Ecart", "Lecture"],
        ...radar.map((point) => [
          point.label,
          point.score,
          point.target,
          point.score - point.target,
          point.score >= point.target
            ? "Au niveau attendu"
            : "A renforcer pour atteindre l'objectif",
        ]),
      ],
    },
    {
      name: "Scores par modele",
      widths: [190, ...heatmap.axes.map(() => 120)],
      rows: [
        ["Modele", ...heatmap.axes.map((axis) => axis.label)],
        ...heatmap.rows.map((row) => [
          row.model,
          ...heatmap.axes.map((axis) => row.values[axis.key] ?? 0),
        ]),
      ],
    },
    {
      name: "Evolution",
      widths: [160, 130, 130, 130, 210],
      rows: [
        ["Periode", "Positionnement", "Exactitude", "Sentiment", "Lecture rapide"],
        ...trendData.map((point) => [
          point.label,
          point.positioning,
          point.factual,
          point.sentiment,
          scoreWithGrade(average([point.positioning, point.factual, point.sentiment])),
        ]),
      ],
    },
  ];
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

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function exportPerceptionWorkbook(args: ExportWorkbookArgs) {
  if (typeof document === "undefined") return;

  const worksheets = buildWorksheets(args);
  const workbookXml = buildWorkbookXml(worksheets);
  const blob = new Blob([workbookXml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const brandSlug = slugify(args.data.brandCanon.brandName) || "perception";
  const dateSlug = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `${brandSlug}-perception-${dateSlug}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
