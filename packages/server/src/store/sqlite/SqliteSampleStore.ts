import type { Statement } from 'better-sqlite3';
import type { ShapeNode, SampleAggregate } from '@contractcheck/core';
import type { ISampleStore } from '../../interfaces/index.js';
import type { SqliteConnection } from './SqliteConnection.js';

export class SqliteSampleStore implements ISampleStore {
  private stmts: {
    storeShape: Statement;
    upsertAgg: Statement;
    getShape: Statement;
    getShapesByEndpoint: Statement;
    getAggregates: Statement;
    prune: Statement;
  };

  constructor(conn: SqliteConnection) {
    this.stmts = {
      storeShape: conn.db.prepare(
        'INSERT OR IGNORE INTO shapes (fingerprint, shape) VALUES (?, ?)',
      ),
      upsertAgg: conn.db.prepare(`
        INSERT INTO sample_aggregates (id, provider, endpoint, method, shape_fingerprint, caller, status_code, count, first_seen, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(provider, endpoint, method, shape_fingerprint, caller, status_code) DO UPDATE SET
          count = sample_aggregates.count + excluded.count,
          last_seen = excluded.last_seen
      `),
      getShape: conn.db.prepare('SELECT shape FROM shapes WHERE fingerprint = ?'),
      getShapesByEndpoint: conn.db.prepare(`
        SELECT s.fingerprint, s.shape, sa.count
        FROM sample_aggregates sa
        JOIN shapes s ON s.fingerprint = sa.shape_fingerprint
        WHERE sa.provider = ? AND sa.endpoint = ? AND sa.method = ?
      `),
      getAggregates: conn.db.prepare(
        'SELECT * FROM sample_aggregates WHERE provider = ? AND endpoint = ? AND method = ?',
      ),
      prune: conn.db.prepare('DELETE FROM sample_aggregates WHERE last_seen < ?'),
    };
  }

  storeShape(fingerprint: string, shape: ShapeNode): void {
    this.stmts.storeShape.run(fingerprint, JSON.stringify(shape));
  }

  upsertAggregate(aggregate: Omit<SampleAggregate, 'id'>): void {
    const id = crypto.randomUUID();
    this.stmts.upsertAgg.run(
      id,
      aggregate.provider,
      aggregate.endpoint,
      aggregate.method,
      aggregate.shapeFingerprint,
      aggregate.caller,
      aggregate.statusCode,
      aggregate.count,
      aggregate.firstSeen,
      aggregate.lastSeen,
    );
  }

  getShape(fingerprint: string): ShapeNode | null {
    const row = this.stmts.getShape.get(fingerprint) as { shape: string } | undefined;
    return row ? JSON.parse(row.shape) : null;
  }

  getShapesByEndpoint(
    provider: string,
    endpoint: string,
    method: string,
  ): Array<{ fingerprint: string; shape: ShapeNode; count: number }> {
    const rows = this.stmts.getShapesByEndpoint.all(provider, endpoint, method) as Array<{
      fingerprint: string;
      shape: string;
      count: number;
    }>;
    return rows.map((r) => ({ fingerprint: r.fingerprint, shape: JSON.parse(r.shape), count: r.count }));
  }

  getAggregates(provider: string, endpoint: string, method: string): SampleAggregate[] {
    const rows = this.stmts.getAggregates.all(provider, endpoint, method) as Array<{
      id: string;
      provider: string;
      endpoint: string;
      method: string;
      shape_fingerprint: string;
      caller: string | null;
      status_code: number;
      count: number;
      first_seen: string;
      last_seen: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      endpoint: r.endpoint,
      method: r.method,
      shapeFingerprint: r.shape_fingerprint,
      caller: r.caller,
      statusCode: r.status_code,
      count: r.count,
      firstSeen: r.first_seen,
      lastSeen: r.last_seen,
    }));
  }

  pruneOlderThan(date: Date): number {
    const result = this.stmts.prune.run(date.toISOString());
    return result.changes;
  }
}
