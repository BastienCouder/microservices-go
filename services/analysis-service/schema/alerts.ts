import { pgTable, text, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { analysisRuns } from "./analysis-runs";

/**
 * Alerts - Alertes de monitoring
 */
export const alerts = pgTable("alerts", {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(), // Référence projects.id via project-service

    alertType: text("alert_type").notNull(), // visibility_drop | competitor_appeared | citation_lost
    severity: text("severity").default("medium").notNull(), // low | medium | high

    title: text("title").notNull(),
    description: text("description"),

    // Comparaison runs
    currentRunId: text("current_run_id").references(() => analysisRuns.id, { onDelete: "set null" }),
    previousRunId: text("previous_run_id").references(() => analysisRuns.id, { onDelete: "set null" }),

    // Contexte détaillé pour dashboard / drill-down (sans dépendance cross-service)
    promptRunId: text("prompt_run_id"),
    promptId: text("prompt_id"),
    modelId: text("model_id"),
    alertGroup: text("alert_group"),
    uiLink: text("ui_link"),

    payload: jsonb("payload").default({}), // Détails (prompt, model, competitor...)

    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    projectIdIdx: index("alerts_project_id_idx").on(table.projectId),
    readIdx: index("alerts_read_idx").on(table.projectId, table.isRead),
    promptIdx: index("alerts_prompt_id_idx").on(table.projectId, table.promptId),
    modelIdx: index("alerts_model_id_idx").on(table.projectId, table.modelId),
}));

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
