import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { projects } from "./projects";

/**
 * Competitors - Concurrents à tracker
 */
export const competitors = pgTable("competitors", {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    domain: text("domain"),
    websiteUrl: text("website_url"),

    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    projectIdIdx: index("competitors_project_id_idx").on(table.projectId),
}));

export type Competitor = typeof competitors.$inferSelect;
export type NewCompetitor = typeof competitors.$inferInsert;
