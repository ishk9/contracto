import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { DEFAULT_SERVER_CONFIG } from '../../src/config/index.js';
import { ContainerFactory } from '../../src/container/ContainerFactory.js';
import { Tokens } from '../../src/container/Tokens.js';
import { registerIngestRoutes } from '../../src/routes/ingestRoutes.js';
import { registerContractRoutes } from '../../src/routes/contractRoutes.js';
import { registerGraphRoutes } from '../../src/routes/graphRoutes.js';
import { registerDriftRoutes } from '../../src/routes/driftRoutes.js';
import { registerHealthRoutes } from '../../src/routes/healthRoutes.js';
import type {
  IContractStore,
  ISampleStore,
  IDriftStore,
  IConsumerDepStore,
} from '../../src/interfaces/index.js';
import type { IngestionService } from '../../src/ingestion/index.js';
import type { Container } from '../../src/container/Container.js';

export interface TestServer {
  app: FastifyInstance;
  container: Container;
  stores: {
    contracts: IContractStore;
    samples: ISampleStore;
    drift: IDriftStore;
    consumerDeps: IConsumerDepStore;
  };
  teardown: () => Promise<void>;
}

export function createTestServer(): TestServer {
  const config = {
    ...DEFAULT_SERVER_CONFIG,
    storage: { driver: 'sqlite' as const, path: ':memory:' },
  };

  const container = ContainerFactory.build(config);
  const app = Fastify({ logger: false });

  registerIngestRoutes(app, {
    ingestionService: container.resolve<IngestionService>(Tokens.IngestionService),
  });

  registerContractRoutes(app, {
    contractStore: container.resolve<IContractStore>(Tokens.ContractStore),
  });

  registerGraphRoutes(app, {
    consumerDepStore: container.resolve<IConsumerDepStore>(Tokens.ConsumerDepStore),
  });

  registerDriftRoutes(app, {
    driftStore: container.resolve<IDriftStore>(Tokens.DriftStore),
  });

  registerHealthRoutes(app);

  return {
    app,
    container,
    stores: {
      contracts: container.resolve<IContractStore>(Tokens.ContractStore),
      samples: container.resolve<ISampleStore>(Tokens.SampleStore),
      drift: container.resolve<IDriftStore>(Tokens.DriftStore),
      consumerDeps: container.resolve<IConsumerDepStore>(Tokens.ConsumerDepStore),
    },
    teardown: async () => {
      await app.close();
    },
  };
}
