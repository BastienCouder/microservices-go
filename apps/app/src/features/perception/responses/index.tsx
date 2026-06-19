"use client";

import { useEffect, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";

import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON, requireGatewayResult, unwrapGatewayPayload } from "@/shared/api/gateway";
import {
  readOrganizationIdFromSearch,
  readSelectedOrganizationPublicID,
} from "@/shared/selection";
import {
  loadPerceptionData,
  type PerceptionResponseRecord,
} from "../_lib/shared/perception-data";

type PerceptionResponsesPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

type RawPerceptionResults = {
  projectId: string;
  derivedResponses: PerceptionResponseRecord[];
  rawPayload: unknown;
  rawResponses: unknown[];
  sourceMode: string;
  latestRunId: string;
  brandReadiness: unknown;
};

const pageStyle = {
  position: "absolute",
  inset: 0,
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  padding: 24,
  boxSizing: "border-box",
} satisfies CSSProperties;

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#fff",
} satisfies CSSProperties;

const cellStyle = {
  border: "1px solid #ddd",
  padding: "8px 10px",
  textAlign: "left",
  verticalAlign: "top",
  fontSize: 13,
} satisfies CSSProperties;

const preStyle = {
  maxHeight: 520,
  overflow: "auto",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  border: "1px solid #ddd",
  padding: 12,
} satisfies CSSProperties;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readArrayField(record: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function readObjectField(record: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  for (const key of keys) {
    const value = asRecord(record[key]);
    if (Object.keys(value).length > 0) return value;
  }
  return {};
}

function readStringField(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value;
  }
  return "";
}

function extractRawResponses(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  const record = asRecord(payload);
  const direct = readArrayField(record, ["responses", "Responses", "aiResponses", "AIResponses"]);
  if (direct.length > 0) return direct;

  const data = unwrapGatewayPayload(payload);
  if (data !== payload) return extractRawResponses(data);

  return [];
}

function resolveOrganizationId(routeSearch: string): string | undefined {
  return (
    readOrganizationIdFromSearch(routeSearch) ||
    readSelectedOrganizationPublicID() ||
    undefined
  );
}

async function loadRawPerceptionResults(
  apiBaseURL: string,
  routeSearch: string,
  signal?: AbortSignal,
): Promise<RawPerceptionResults> {
  const perception = await loadPerceptionData(apiBaseURL, routeSearch, { signal });
  if (!perception.projectId) {
    throw new Error("Aucun projet actif.");
  }

  const rawResult = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.analysis.perception(encodeURIComponent(perception.projectId), {
      includeDashboard: true,
    }),
    {
      method: "GET",
      organizationId: resolveOrganizationId(routeSearch),
      signal,
    },
  );

  const rawPayload = unwrapGatewayPayload(
    requireGatewayResult(rawResult, "Impossible de charger les resultats perception."),
  );
  const metadata = readObjectField(asRecord(rawPayload), ["metadata", "Metadata"]);
  const sourceMode = readStringField(metadata, ["sourceMode", "SourceMode"]);

  return {
    projectId: perception.projectId,
    derivedResponses: perception.data.responses.filter(
      (response) => response.runType === "perception" || response.promptKind === "perception",
    ),
    rawPayload,
    rawResponses: extractRawResponses(rawPayload),
    sourceMode,
    latestRunId: readStringField(metadata, ["latestRunId", "LatestRunID", "LatestRunId"]),
    brandReadiness: metadata.brandReadiness ?? metadata.BrandReadiness ?? null,
  };
}

export function PerceptionResponsesPage({
  apiBaseURL,
  routeSearch,
}: PerceptionResponsesPageProps) {
  const resultsQuery = useQuery({
    queryKey: ["perception-responses-debug", apiBaseURL, routeSearch],
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadRawPerceptionResults(apiBaseURL, routeSearch, signal),
  });

  useEffect(() => {
    if (!resultsQuery.data) return;
    console.log("Perception prompt results", resultsQuery.data);
  }, [resultsQuery.data]);

  if (resultsQuery.isLoading) {
    return <main style={pageStyle}>Chargement des resultats perception...</main>;
  }

  if (resultsQuery.error) {
    return (
      <main style={pageStyle}>
        <h1>Resultats prompts perception</h1>
        <pre style={preStyle}>
          {resultsQuery.error instanceof Error
            ? resultsQuery.error.message
            : "Erreur inconnue"}
        </pre>
      </main>
    );
  }

  const data = resultsQuery.data;
  const allResponses = data?.derivedResponses ?? [];
  const responses = data?.latestRunId
    ? allResponses.filter((response) => response.runId === data.latestRunId)
    : allResponses;

  return (
    <main style={pageStyle}>
      <h1>Resultats prompts perception</h1>
      <p>Projet: {data?.projectId ?? "-"}</p>
      <p>Source: {data?.sourceMode || "-"}</p>
      <p>Run: {data?.latestRunId || "tous"}</p>
      <p>Reponses perception: {responses.length}</p>

      {responses.length === 0 ? (
        <>
          <p>Aucune reponse perception exploitable.</p>
          <h2>Brand readiness</h2>
          <pre style={preStyle}>{JSON.stringify(data?.brandReadiness ?? null, null, 2)}</pre>
        </>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={cellStyle}>Heure</th>
              <th style={cellStyle}>IA</th>
              <th style={cellStyle}>Positioning</th>
              <th style={cellStyle}>Factual</th>
              <th style={cellStyle}>Use cases</th>
              <th style={cellStyle}>Features</th>
              <th style={cellStyle}>Sentiment</th>
              <th style={cellStyle}>Competitors</th>
            </tr>
          </thead>
          <tbody>
            {responses.map((response) => (
              <tr key={response.id || `${response.promptRunId}-${response.modelId}`}>
                <td style={cellStyle}>
                  {response.createdAt
                    ? new Date(response.createdAt).toLocaleString("fr-FR")
                    : "-"}
                </td>
                <td style={cellStyle}>{response.modelName || response.modelId || "-"}</td>
                <td style={cellStyle}>{response.metrics.positioning}</td>
                <td style={cellStyle}>{response.metrics.factual}</td>
                <td style={cellStyle}>{response.metrics.use_cases}</td>
                <td style={cellStyle}>{response.metrics.features}</td>
                <td style={cellStyle}>{response.metrics.sentiment}</td>
                <td style={cellStyle}>{response.metrics.competitors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <details style={{ marginTop: 24 }}>
        <summary>Debug JSON</summary>
        <h2>Raw responses</h2>
        <pre style={preStyle}>{JSON.stringify(data?.rawResponses ?? [], null, 2)}</pre>

        <h2>Derived responses</h2>
        <pre style={preStyle}>{JSON.stringify(data?.derivedResponses ?? [], null, 2)}</pre>

        <h2>Payload complet</h2>
        <pre style={preStyle}>{JSON.stringify(data?.rawPayload ?? null, null, 2)}</pre>
      </details>
    </main>
  );
}
