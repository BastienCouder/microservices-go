import { pgTable, text, timestamp, boolean, primaryKey, index } from "drizzle-orm/pg-core";
import { projects } from "./projects";
import { aiModels } from "./ai-models";

/**
 * Project Models - Modèles IA activés par projet
 */
export const projectModels = pgTable("project_models", {
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    modelId: text("model_id").notNull().references(() => aiModels.id, { onDelete: "restrict" }),

    isEnabled: boolean("is_enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    pk: primaryKey({ columns: [table.projectId, table.modelId] }),
    projectIdIdx: index("project_models_project_id_idx").on(table.projectId),
}));

export type ProjectModel = typeof projectModels.$inferSelect;
export type NewProjectModel = typeof projectModels.$inferInsert;
