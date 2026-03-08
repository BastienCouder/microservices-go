import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core";

/**
 * Projects - Site + marque à monitorer
 */
export const projects = pgTable("projects", {
    id: text("id").primaryKey(),
    organizationId: integer("organization_id").notNull(),
    createdBy: integer("created_by").notNull(),

    // Identité projet
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    websiteUrl: text("website_url").notNull(),

    // Marque (auto-détection + éditable)
    brandName: text("brand_name"),
    brandDescription: text("brand_description"),
    industry: text("industry"),

    // Localisation
    primaryLanguage: text("primary_language").default("fr"),
    country: text("country").default("FR"),

    // Status
    status: text("status").default("draft").notNull(), // draft | active | paused

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
    organizationIdIdx: index("projects_organization_id_idx").on(table.organizationId),
    createdByIdx: index("projects_created_by_idx").on(table.createdBy),
    domainIdx: index("projects_domain_idx").on(table.domain),
}));

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
