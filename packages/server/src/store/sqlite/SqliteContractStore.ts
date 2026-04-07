import type { Statement } from 'better-sqlite3';
import type { Contract, ContractStatus } from '@contractcheck/core';
import type { IContractStore } from '../../interfaces/index.js';
import type { SqliteConnection } from './SqliteConnection.js';

interface ContractRow {
  id: string;
  provider: string;
  endpoint: string;
  method: string;
  schema: string;
  sample_count: number;
  confidence: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export class SqliteContractStore implements IContractStore {
  private stmts: {
    getOne: Statement;
    listByProvider: Statement;
    getAll: Statement;
    upsert: Statement;
    updateStatus: Statement;
  };

  constructor(conn: SqliteConnection) {
    this.stmts = {
      getOne: conn.db.prepare(
        'SELECT * FROM contracts WHERE provider = ? AND endpoint = ? AND method = ?',
      ),
      listByProvider: conn.db.prepare('SELECT * FROM contracts WHERE provider = ?'),
      getAll: conn.db.prepare('SELECT * FROM contracts'),
      upsert: conn.db.prepare(`
        INSERT INTO contracts (id, provider, endpoint, method, schema, sample_count, confidence, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(provider, endpoint, method) DO UPDATE SET
          schema = excluded.schema,
          sample_count = excluded.sample_count,
          confidence = excluded.confidence,
          status = excluded.status,
          updated_at = datetime('now')
      `),
      updateStatus: conn.db.prepare(
        "UPDATE contracts SET status = ?, updated_at = datetime('now') WHERE id = ?",
      ),
    };
  }

  getContract(provider: string, endpoint: string, method: string): Contract | null {
    const row = this.stmts.getOne.get(provider, endpoint, method) as ContractRow | undefined;
    return row ? this.toContract(row) : null;
  }

  listContracts(provider: string): Contract[] {
    return (this.stmts.listByProvider.all(provider) as ContractRow[]).map((r) => this.toContract(r));
  }

  getAllContracts(): Contract[] {
    return (this.stmts.getAll.all() as ContractRow[]).map((r) => this.toContract(r));
  }

  upsertContract(contract: Contract): void {
    this.stmts.upsert.run(
      contract.id,
      contract.provider,
      contract.endpoint,
      contract.method,
      JSON.stringify(contract.schema),
      contract.sampleCount,
      contract.confidence,
      contract.status,
    );
  }

  updateStatus(id: string, status: ContractStatus): void {
    this.stmts.updateStatus.run(status, id);
  }

  private toContract(row: ContractRow): Contract {
    return {
      id: row.id,
      provider: row.provider,
      endpoint: row.endpoint,
      method: row.method,
      schema: JSON.parse(row.schema),
      sampleCount: row.sample_count,
      confidence: row.confidence,
      status: row.status as ContractStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
