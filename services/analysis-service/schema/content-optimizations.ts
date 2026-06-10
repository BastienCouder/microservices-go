import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const contentOptimizations = pgTable("content_optimizations", {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    pageUrl: text("page_url").notNull(),
    pageTitle: text("page_title"),
    currentScore: integer("current_score").default(0).notNull(),
    factorScores: jsonb("factor_scores").default({}).notNull(),
    recommendations: jsonb("recommendations").default([]).notNull(),
    estimatedImpact: integer("estimated_impact"),
    implemented: boolean("implemented").default(false).notNull(),
    sourceHash: text("source_hash"),
    analyzedAt: timestamp("analyzed_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    projectIdIdx: index("content_optimizations_project_id_idx").on(table.projectId),
    projectPageIdx: index("content_optimizations_project_page_idx").on(table.projectId, table.pageUrl),
    projectPageUnique: uniqueIndex("content_optimizations_project_page_unique").on(table.projectId, table.pageUrl),
}));

export type ContentOptimizationRow = typeof contentOptimizations.$inferSelect;
export type NewContentOptimizationRow = typeof contentOptimizations.$inferInsert;

