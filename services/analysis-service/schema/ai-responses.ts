import { pgTable, text, timestamp, numeric, boolean, jsonb, index, unique, integer } from "drizzle-orm/pg-core";
import { promptRuns } from "./prompt-runs";

/**
 * AI Responses - Réponse brute + analyse par modèle IA
 */
export const aiResponses = pgTable("ai_responses", {
    id: text("id").primaryKey(),
    promptRunId: text("prompt_run_id").notNull().references(() => promptRuns.id, { onDelete: "cascade" }),
    modelId: text("model_id").notNull(), // Référence ai_models.id via project-service

    // Réponse brute
    rawResponse: text("raw_response").notNull(),
    rawSources: jsonb("raw_sources"), // Liens cités (si dispo)
    rawMetadata: jsonb("raw_metadata"), // tokens, latency, etc.

    // Analyse
    brandMentioned: boolean("brand_mentioned").default(false).notNull(),
    brandPosition: text("brand_position"), // top | mid | bottom | unknown
    citationFound: boolean("citation_found").default(false).notNull(),
    citedUrls: jsonb("cited_urls").default([]),

    competitorsDetected: jsonb("competitors_detected").default([]), // [{name, domain}]
    sentiment: text("sentiment").default("neutral"), // positive | neutral | negative
    responseScore: numeric("response_score", { precision: 5, scale: 2 }),

    // Dénormalisation optionnelle dashboard/perception
    modelDisplayName: text("model_display_name"),
    responseRank: integer("response_rank"),
    latencyMs: integer("latency_ms"),
    promptPersonaSnapshot: text("prompt_persona_snapshot"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
}, (table) => ({
    promptRunIdIdx: index("ai_responses_prompt_run_id_idx").on(table.promptRunId),
    modelIdIdx: index("ai_responses_model_id_idx").on(table.modelId),
    sentimentIdx: index("ai_responses_sentiment_idx").on(table.sentiment),
    uniqueResponse: unique("ai_responses_unique").on(table.promptRunId, table.modelId),
}));

export type AiResponse = typeof aiResponses.$inferSelect;
export type NewAiResponse = typeof aiResponses.$inferInsert;
