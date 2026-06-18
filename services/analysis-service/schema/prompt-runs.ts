import { pgTable, text, timestamp, numeric, boolean, jsonb, index, unique, integer } from "drizzle-orm/pg-core";
import { analysisRuns } from "./analysis-runs";

/**
 * Prompt Runs - Résultat par prompt dans une analyse
 */
export const promptRuns = pgTable("prompt_runs", {
    id: text("id").primaryKey(),
    analysisRunId: text("analysis_run_id").notNull().references(() => analysisRuns.id, { onDelete: "cascade" }),
    promptId: text("prompt_id").notNull(), // Référence prompts.id via project-service
    kind: text("kind").notNull().default("monitoring"),

    status: text("status").default("queued").notNull(), // queued | running | completed | failed

    promptVisibilityScore: numeric("prompt_visibility_score", { precision: 5, scale: 2 }),
    brandMentioned: boolean("brand_mentioned"),
    brandCitationFound: boolean("brand_citation_found"),

    competitorsMentioned: jsonb("competitors_mentioned").default([]), // [{name, domain, count}]

    // Dénormalisation dashboard / exports
    promptTextSnapshot: text("prompt_text_snapshot"),
    promptIntentSnapshot: text("prompt_intent_snapshot"),
    promptPersonaSnapshot: text("prompt_persona_snapshot"),
    promptLanguageSnapshot: text("prompt_language_snapshot"),
    promptCountrySnapshot: text("prompt_country_snapshot"),
    topRank: integer("top_rank"),
    timeLabelSnapshot: text("time_label_snapshot"),
    metadata: jsonb("metadata").default({}),

    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    analysisRunIdIdx: index("prompt_runs_analysis_run_id_idx").on(table.analysisRunId),
    analysisRunIdRankIdx: index("prompt_runs_analysis_run_id_rank_idx").on(table.analysisRunId, table.topRank),
    uniquePromptRun: unique("prompt_runs_unique").on(table.analysisRunId, table.promptId),
}));

export type PromptRun = typeof promptRuns.$inferSelect;
export type NewPromptRun = typeof promptRuns.$inferInsert;
