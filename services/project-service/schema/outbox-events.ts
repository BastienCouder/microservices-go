import { pgTable, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

/**
 * Outbox Events — transactional outbox for reliable event publishing.
 * Events are inserted in the same DB transaction as domain writes,
 * then published to RabbitMQ by the OutboxWorker.
 */
export const outboxEvents = pgTable("outbox_events", {
    id: text("id").primaryKey(),
    exchange: text("exchange").notNull(),
    routingKey: text("routing_key").notNull(),
    payload: jsonb("payload").notNull(),
    published: boolean("published").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
