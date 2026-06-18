import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const projectAiBriefSettings = pgTable("project_ai_brief_settings", {
    projectId: text("project_id").primaryKey(),
    briefModelId: text("brief_model_id").notNull(),
    briefProvider: text("brief_provider").default("openrouter").notNull(),
    briefProviderModelId: text("brief_provider_model_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ProjectAiBriefSettings = typeof projectAiBriefSettings.$inferSelect;
export type NewProjectAiBriefSettings = typeof projectAiBriefSettings.$inferInsert;
