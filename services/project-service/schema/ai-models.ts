import { pgTable, text, timestamp, boolean, unique } from "drizzle-orm/pg-core";

/**
 * AI Models - Catalogue des modèles IA disponibles
 */
export const aiModels = pgTable("ai_models", {
    id: text("id").primaryKey(),

    provider: text("provider").notNull(), // openai | anthropic | perplexity | google
    displayName: text("display_name").notNull(), // ex: "GPT-4.1 Mini"
    groupName: text("group_name").notNull(),     // ex: "chatgpt" | "claude" | "perplexity"
    iconKey: text("icon_key").notNull(),         // ex: "openai" | "claude" | "gemini"
    providerModelId: text("provider_model_id").notNull(),
    hasLiveSearch: boolean("has_live_search").default(false).notNull(),

    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
    providerModelUnique: unique("ai_models_provider_provider_model_id_unique").on(table.provider, table.providerModelId),
}));

export type AiModel = typeof aiModels.$inferSelect;
export type NewAiModel = typeof aiModels.$inferInsert;
