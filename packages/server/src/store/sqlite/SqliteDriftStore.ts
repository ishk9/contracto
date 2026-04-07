import type { Statement } from 'better-sqlite3';
import type { DriftEvent, DriftChangeType, Severity, DriftStatus } from '@contractcheck/core';
import type { IDriftStore } from '../../interfaces/index.js';
import type { SqliteConnection } from './SqliteConnection.js';

interface DriftRow {
  id: string;
  provider: string;
  endpoint: string;
  method: string;
  change_type: string;
  severity: string;
  field: string;
  details: string;
  affected_consumers: string;
  confirmation_count: number;
  status: string;
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
}

export class SqliteDriftStore implements IDriftStore {
  private stmts: {
    create: Statement;
    getActive: Statement;
    getOne: Statement;
    getByProvider: Statement;
    update: Statement;
    increment: Statement;
  };

  constructor(conn: SqliteConnection) {
    this.stmts = {
      create: conn.db.prepare(`
        INSERT INTO drift_events (id, provider, endpoint, method, change_type, severity, field, details, affected_consumers, confirmation_count, status, first_seen, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),
      getActive: conn.db.prepare(
        "SELECT * FROM drift_events WHERE status IN ('pending', 'active') ORDER BY first_seen DESC",
      ),
      getOne: conn.db.prepare('SELECT * FROM drift_events WHERE id = ?'),
      getByProvider: conn.db.prepare(
        'SELECT * FROM drift_events WHERE provider = ? ORDER BY first_seen DESC',
      ),
      update: conn.db.prepare(
        'UPDATE drift_events SET status = ?, resolved_at = ? WHERE id = ?',
      ),
      increment: conn.db.prepare(`
        UPDATE drift_events
        SET confirmation_count = confirmation_count + 1,
            last_seen = datetime('now'),
            status = CASE WHEN confirmation_count + 1 >= 3 AND status = 'pending' THEN 'active' ELSE status END
        WHERE id = ?
      `),
    };
  }

  createEvent(event: DriftEvent): void {
    this.stmts.create.run(
      event.id, event.provider, event.endpoint, event.method,
      event.changeType, event.severity, event.field,
      JSON.stringify(event.details), JSON.stringify(event.affectedConsumers),
      event.confirmationCount, event.status, event.firstSeen, event.lastSeen,
    );
  }

  getActiveEvents(): DriftEvent[] {
    return (this.stmts.getActive.all() as DriftRow[]).map((r) => this.toEvent(r));
  }

  getEvent(id: string): DriftEvent | null {
    const row = this.stmts.getOne.get(id) as DriftRow | undefined;
    return row ? this.toEvent(row) : null;
  }

  getEventsByProvider(provider: string): DriftEvent[] {
    return (this.stmts.getByProvider.all(provider) as DriftRow[]).map((r) => this.toEvent(r));
  }

  updateEvent(id: string, updates: Partial<Pick<DriftEvent, 'status' | 'resolvedAt'>>): void {
    const current = this.getEvent(id);
    if (!current) return;
    this.stmts.update.run(
      updates.status ?? current.status,
      updates.resolvedAt ?? current.resolvedAt ?? null,
      id,
    );
  }

  incrementConfirmation(id: string): void {
    this.stmts.increment.run(id);
  }

  private toEvent(row: DriftRow): DriftEvent {
    return {
      id: row.id,
      provider: row.provider,
      endpoint: row.endpoint,
      method: row.method,
      changeType: row.change_type as DriftChangeType,
      severity: row.severity as Severity,
      field: row.field,
      details: JSON.parse(row.details),
      affectedConsumers: JSON.parse(row.affected_consumers),
      confirmationCount: row.confirmation_count,
      status: row.status as DriftStatus,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
      resolvedAt: row.resolved_at ?? undefined,
    };
  }
}
