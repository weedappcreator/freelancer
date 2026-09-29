/**
 * Event system for Freelance Revenue OS.
 * Records all meaningful actions for observability and analytics.
 */

import { v4 as uuid } from "uuid";
import { getDb } from "../db/database.js";
import { logger } from "../core/logger.js";
import type { Event } from "../core/schemas.js";

type EventHandler = (event: Event) => void | Promise<void>;

class EventBus {
  private handlers = new Map<string, EventHandler[]>();

  /** Subscribe to an event type (or '*' for all) */
  on(eventType: string, handler: EventHandler) {
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }

  /** Emit an event — persists to DB and notifies subscribers */
  async emit(params: {
    eventType: string;
    actor: string;
    entityType?: string;
    entityId?: string;
    campaignId?: string;
    metadata?: Record<string, unknown>;
    correlationId?: string;
    causationId?: string;
  }): Promise<Event> {
    const event: Event = {
      eventId: uuid(),
      eventType: params.eventType,
      occurredAt: new Date().toISOString(),
      actor: params.actor,
      entityType: params.entityType,
      entityId: params.entityId,
      campaignId: params.campaignId,
      metadata: params.metadata ?? {},
      correlationId: params.correlationId,
      causationId: params.causationId,
    };

    // Persist
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO events (event_id, event_type, occurred_at, actor, entity_type, entity_id, campaign_id, metadata, correlation_id, causation_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.eventId,
        event.eventType,
        event.occurredAt,
        event.actor,
        event.entityType ?? null,
        event.entityId ?? null,
        event.campaignId ?? null,
        JSON.stringify(event.metadata),
        event.correlationId ?? null,
        event.causationId ?? null,
      );
    } catch (err) {
      logger.error("Failed to persist event", { eventType: event.eventType, error: String(err) });
    }

    // Notify handlers
    const handlers = [
      ...(this.handlers.get(event.eventType) ?? []),
      ...(this.handlers.get("*") ?? []),
    ];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        logger.error("Event handler error", { eventType: event.eventType, error: String(err) });
      }
    }

    logger.debug(`Event: ${event.eventType}`, {
      entityType: event.entityType,
      entityId: event.entityId,
    });

    return event;
  }

  /** Query recent events */
  query(params?: {
    eventType?: string;
    entityId?: string;
    limit?: number;
  }): Event[] {
    const db = getDb();
    let sql = "SELECT * FROM events WHERE 1=1";
    const args: unknown[] = [];

    if (params?.eventType) {
      sql += " AND event_type = ?";
      args.push(params.eventType);
    }
    if (params?.entityId) {
      sql += " AND entity_id = ?";
      args.push(params.entityId);
    }
    sql += " ORDER BY occurred_at DESC LIMIT ?";
    args.push(params?.limit ?? 50);

    const rows = db.prepare(sql).all(...args) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      eventId: r.event_id as string,
      eventType: r.event_type as string,
      occurredAt: r.occurred_at as string,
      actor: r.actor as string,
      entityType: r.entity_type as string | undefined,
      entityId: r.entity_id as string | undefined,
      campaignId: r.campaign_id as string | undefined,
      metadata: JSON.parse((r.metadata as string) || "{}"),
      correlationId: r.correlation_id as string | undefined,
      causationId: r.causation_id as string | undefined,
    }));
  }
}

export const events = new EventBus();
