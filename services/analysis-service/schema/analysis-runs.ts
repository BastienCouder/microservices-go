import { pgTable, text, timestamp, integer, numeric, index, jsonb } from "drizzle-orm/pg-core";

/**
 * Analysis Runs - Une exécution globale d'analyse
 */
export const analysisRuns = pgTable("analysis_runs", {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(), // Référence projects.id via project-service
    organizationId: integer("organization_id").notNull(),
    createdBy: integer("created_by").notNull(),

    runType: text("run_type").default("manual").notNull(), // manual | scheduled | perception
    status: text("status").default("queued").notNull(), // queued | running | completed | failed

    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),

    promptsCount: integer("prompts_count").default(0).notNull(),
    modelsCount: integer("models_count").default(0).notNull(),

    visibilityScore: numeric("visibility_score", { precision: 5, scale: 2 }),
    notes: text("notes"),

    // Dénormalisation optionnelle pour dashboard (évite de dépendre uniquement de project-service)
    brandNameSnapshot: text("brand_name_snapshot"),
    brandDescriptionSnapshot: text("brand_description_snapshot"),
    industrySnapshot: text("industry_snapshot"),
    modelsSnapshot: jsonb("models_snapshot").default([]),
    dashboardSnapshot: jsonb("dashboard_snapshot").default({}),

    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    projectIdIdx: index("analysis_runs_project_id_idx").on(table.projectId),
    organizationIdIdx: index("analysis_runs_organization_id_idx").on(table.organizationId),
    statusIdx: index("analysis_runs_status_idx").on(table.status),
}));

export type AnalysisRun = typeof analysisRuns.$inferSelect;
export type NewAnalysisRun = typeof analysisRuns.$inferInsert;
