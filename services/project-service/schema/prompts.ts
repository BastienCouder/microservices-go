import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { projects } from "./projects";

/**
 * Prompts - Questions à monitorer sur les IA
 */
export const prompts = pgTable("prompts", {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),

    text: text("text").notNull(), // Le prompt
    intent: text("intent").default("organic"), // organic | informational | commercial | transactional | branded
    kind: text("kind").default("monitoring").notNull(), // monitoring | perception
    language: text("language").default("fr"),
    country: text("country").default("FR"),

    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    projectIdIdx: index("prompts_project_id_idx").on(table.projectId),
    activeIdx: index("prompts_active_idx").on(table.projectId, table.isActive),
}));

export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;
