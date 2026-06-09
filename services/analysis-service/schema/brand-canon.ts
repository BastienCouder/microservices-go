import { pgTable, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

export const brandCanon = pgTable("brand_canon", {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    brandName: text("brand_name"),
    category: text("category"),
    positioning: text("positioning"),
    audience: jsonb("audience").default([]),
    useCases: jsonb("use_cases").default([]),
    pricing: jsonb("pricing").default({}),
    features: jsonb("features").default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    projectIdIdx: index("brand_canon_project_id_idx").on(table.projectId),
    projectIdUniqueIdx: uniqueIndex("brand_canon_project_id_unique").on(table.projectId),
}));

export type BrandCanonRow = typeof brandCanon.$inferSelect;
export type NewBrandCanonRow = typeof brandCanon.$inferInsert;
