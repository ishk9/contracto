import type { IContractStore } from '../interfaces/index.js';
import type { ISampleStore } from '../interfaces/index.js';
import type { IDriftStore } from '../interfaces/index.js';
import type { IConsumerDepStore } from '../interfaces/index.js';
import type { StorageConfig } from '../config/index.js';
import { SqliteConnection } from './sqlite/SqliteConnection.js';
import { SqliteContractStore } from './sqlite/SqliteContractStore.js';
import { SqliteSampleStore } from './sqlite/SqliteSampleStore.js';
import { SqliteDriftStore } from './sqlite/SqliteDriftStore.js';
import { SqliteConsumerDepStore } from './sqlite/SqliteConsumerDepStore.js';

export interface StoreSet {
  contracts: IContractStore;
  samples: ISampleStore;
  drift: IDriftStore;
  consumerDeps: IConsumerDepStore;
  connection: SqliteConnection;
}

export class StoreFactory {
  static create(config: StorageConfig): StoreSet {
    switch (config.driver) {
      case 'sqlite': {
        const conn = new SqliteConnection(config.path);
        return {
          contracts: new SqliteContractStore(conn),
          samples: new SqliteSampleStore(conn),
          drift: new SqliteDriftStore(conn),
          consumerDeps: new SqliteConsumerDepStore(conn),
          connection: conn,
        };
      }
      case 'postgres':
        throw new Error('PostgreSQL support not yet implemented');
      default:
        throw new Error(`Unknown storage driver: ${config.driver}`);
    }
  }
}
