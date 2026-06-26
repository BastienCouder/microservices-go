import type {
  TrafficDailyPoint,
  TrafficPage,
  TrafficPeriod,
  TrafficReport,
  TrafficSource,
} from "./types";

type CellValue = string | number | boolean | null | undefined;

type Worksheet = {
  name: string;
  rows: CellValue[][];
  widths?: number[];
};

type TrafficExportArgs = {
  projectName: string;
  period: TrafficPeriod;
  report: TrafficReport;
};

const PERIOD_LABELS: Record<TrafficPeriod, string> = {
  "7d": "7 jours",
  "30d": "30 jours",
  "90d": "90 jours",
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
  if (typeof value === "boolean") return value ? "Oui" : "Non";
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

function formatDate(value: string | null | undefined) {
  if (!value) return "Non renseigne";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDay(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

function scoreWithGrade(score: number) {
  const rounded = Math.round(score);
  if (rounded >= 85) return `${rounded}% - tres bon`;
  if (rounded >= 70) return `${rounded}% - bon`;
  if (rounded >= 50) return `${rounded}% - a renforcer`;
  return `${rounded}% - prioritaire`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function sortSources(sources: TrafficSource[]) {
  return [...sources].sort((left, right) => right.sessions - left.sessions);
}

function sortPages(pages: TrafficPage[]) {
  return [...pages].sort((left, right) => right.sessions - left.sessions);
}

function sortTimeseries(points: TrafficDailyPoint[]) {
  return [...points].sort((left, right) => left.date.localeCompare(right.date));
}

function buildWorksheets(args: TrafficExportArgs): Worksheet[] {
  const { projectName, period, report } = args;
  const { summary } = report;

  return [
    {
      name: "Resume client",
      widths: [230, 520],
      rows: [
        ["Indicateur", "Valeur"],
        ["Projet", projectName || "Non renseigne"],
        ["Periode analysee", PERIOD_LABELS[period]],
        ["Fenetre GA4", `${report.dateRange.startDate} - ${report.dateRange.endDate}`],
        ["Visites IA detectees", summary.totalTrafficSessions],
        ["Part des visites GA4", scoreWithGrade(summary.trafficShareOfTotal)],
        ["Moteur IA principal", summary.topEngine || "Non renseigne"],
        ["Taux d'engagement", scoreWithGrade(summary.trafficEngagementRate)],
        ["Conversions", summary.trafficConversions],
        ["Taux de conversion", scoreWithGrade(summary.trafficConversionRate)],
        ["Duree moyenne", formatDuration(summary.trafficAvgSessionSeconds)],
        ["Export genere le", formatDate(new Date().toISOString())],
      ],
    },
    {
      name: "Scores cles",
      widths: [230, 130, 430],
      rows: [
        ["Indicateur", "Valeur", "Lecture"],
        ["Visites IA detectees", summary.totalTrafficSessions, "Sessions GA4 attribuees a une source IA identifiable."],
        ["Part des visites GA4", `${Math.round(summary.trafficShareOfTotal)}%`, "Poids du trafic IA dans l'ensemble du trafic mesure par GA4."],
        ["Sessions engagees", summary.trafficEngagedSessions, "Visites IA que GA4 considere comme engagees."],
        ["Taux d'engagement", `${Math.round(summary.trafficEngagementRate)}%`, "Qualite moyenne des visites provenant des moteurs IA."],
        ["Conversions", summary.trafficConversions, "Conversions ou key events generes par ces visites IA."],
        ["Taux de conversion", `${Math.round(summary.trafficConversionRate)}%`, "Part des visites IA qui convertissent."],
        ["Pages vues", summary.trafficPageViews, "Volume de pages vues pendant les visites IA."],
        ["Taux de rebond", `${Math.round(summary.trafficBounceRate)}%`, "Part des visites IA sans engagement significatif."],
      ],
    },
    {
      name: "Sources IA",
      widths: [190, 130, 120, 120, 140, 130, 120, 120],
      rows: [
        ["Moteur IA", "Source / medium", "Sessions", "Part trafic", "Taux engagement", "Conversions", "Pages vues", "Duree moyenne"],
        ...sortSources(report.bySource).map((source) => [
          source.engine || "Non renseigne",
          source.sourceMedium || [source.source, source.medium].filter(Boolean).join(" / "),
          source.sessions,
          `${Math.round(source.shareOfTrafficSessions)}%`,
          `${Math.round(source.engagementRate)}%`,
          source.conversions,
          source.pageViews,
          formatDuration(source.avgSessionSeconds),
        ]),
      ],
    },
    {
      name: "Pages d'entree",
      widths: [360, 240, 150, 120, 140, 120, 120],
      rows: [
        ["Page", "Titre", "Moteur IA", "Sessions", "Taux engagement", "Conversions", "Pages vues"],
        ...sortPages(report.topPages).map((page) => [
          page.path || "/",
          page.title || "Sans titre",
          page.engine || "Non renseigne",
          page.sessions,
          `${Math.round(page.engagementRate)}%`,
          page.conversions,
          page.pageViews,
        ]),
      ],
    },
    {
      name: "Evolution",
      widths: [160, 120, 150, 120],
      rows: [
        ["Date", "Sessions IA", "Sessions engagees", "Conversions"],
        ...sortTimeseries(report.timeseries).map((point) => [
          formatDay(point.date),
          point.sessions,
          point.engagedSessions,
          point.conversions,
        ]),
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

export function exportTrafficWorkbook(args: TrafficExportArgs) {
  if (typeof document === "undefined") return;

  const worksheets = buildWorksheets(args);
  const workbookXml = buildWorkbookXml(worksheets);
  const blob = new Blob([workbookXml], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const projectSlug = slugify(args.projectName) || "traffic";
  const dateSlug = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `${projectSlug}-traffic-${dateSlug}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
