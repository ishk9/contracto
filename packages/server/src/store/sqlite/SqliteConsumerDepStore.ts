import type { Statement } from 'better-sqlite3';
import type { ConsumerDep, DependencyGraph, ProviderNode, EndpointNode } from '@contractcheck/core';
import type { IConsumerDepStore } from '../../interfaces/index.js';
import type { SqliteConnection } from './SqliteConnection.js';

interface DepRow {
  id: string;
  consumer: string;
  provider: string;
  endpoint: string;
  method: string;
  fields_accessed: string;
  sample_count: number;
  first_seen: string;
  last_seen: string;
}

export class SqliteConsumerDepStore implements IConsumerDepStore {
  private stmts: {
    upsert: Statement;
    getByProvider: Statement;
    getByConsumer: Statement;
    getAll: Statement;
    markStale: Statement;
  };

  constructor(conn: SqliteConnection) {
    this.stmts = {
      upsert: conn.db.prepare(`
        INSERT INTO consumer_deps (id, consumer, provider, endpoint, method, fields_accessed, sample_count, first_seen, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(consumer, provider, endpoint, method) DO UPDATE SET
          fields_accessed = excluded.fields_accessed,
          sample_count = consumer_deps.sample_count + excluded.sample_count,
          last_seen = excluded.last_seen
      `),
      getByProvider: conn.db.prepare(
        'SELECT * FROM consumer_deps WHERE provider = ? AND endpoint = ? AND method = ?',
      ),
      getByConsumer: conn.db.prepare('SELECT * FROM consumer_deps WHERE consumer = ?'),
      getAll: conn.db.prepare('SELECT * FROM consumer_deps'),
      markStale: conn.db.prepare('DELETE FROM consumer_deps WHERE last_seen < ?'),
    };
  }

  upsertDep(dep: ConsumerDep): void {
    this.stmts.upsert.run(
      crypto.randomUUID(),
      dep.consumer, dep.provider, dep.endpoint, dep.method,
      JSON.stringify(dep.fieldsAccessed),
      dep.sampleCount, dep.firstSeen, dep.lastSeen,
    );
  }

  getConsumersOf(provider: string, endpoint: string, method: string): ConsumerDep[] {
    return (this.stmts.getByProvider.all(provider, endpoint, method) as DepRow[]).map((r) =>
      this.toDep(r),
    );
  }

  getDependenciesOf(consumer: string): ConsumerDep[] {
    return (this.stmts.getByConsumer.all(consumer) as DepRow[]).map((r) => this.toDep(r));
  }

  getFullGraph(): DependencyGraph {
    const rows = this.stmts.getAll.all() as DepRow[];
    const providerMap = new Map<string, Map<string, ConsumerDep[]>>();

    for (const row of rows) {
      const dep = this.toDep(row);
      const key = `${dep.provider}`;
      const endpointKey = `${dep.endpoint}|${dep.method}`;

      if (!providerMap.has(key)) providerMap.set(key, new Map());
      const endpoints = providerMap.get(key)!;
      if (!endpoints.has(endpointKey)) endpoints.set(endpointKey, []);
      endpoints.get(endpointKey)!.push(dep);
    }

    const providers = new Map<string, ProviderNode>();
    for (const [service, endpointMap] of providerMap) {
      const endpoints: EndpointNode[] = [];
      for (const [key, consumers] of endpointMap) {
        const [endpoint, method] = key.split('|');
        endpoints.push({ endpoint, method, consumers });
      }
      providers.set(service, { service, endpoints });
    }

    return { providers };
  }

  markStale(olderThan: Date): number {
    const result = this.stmts.markStale.run(olderThan.toISOString());
    return result.changes;
  }

  private toDep(row: DepRow): ConsumerDep {
    return {
      consumer: row.consumer,
      provider: row.provider,
      endpoint: row.endpoint,
      method: row.method,
      fieldsAccessed: JSON.parse(row.fields_accessed),
      sampleCount: row.sample_count,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
    };
  }
}
