import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const optimizeActions = pgTable("optimize_actions", {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    priority: text("priority").default("medium").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    issue: text("issue").notNull(),
    impact: text("impact"),
    generatedContent: text("generated_content").notNull(),
    status: text("status").default("draft").notNull(),
    sourceErrorId: text("source_error_id"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    projectIdIdx: index("optimize_actions_project_id_idx").on(table.projectId),
    statusIdx: index("optimize_actions_status_idx").on(table.projectId, table.status),
}));

export type OptimizeAction = typeof optimizeActions.$inferSelect;
export type NewOptimizeAction = typeof optimizeActions.$inferInsert;
