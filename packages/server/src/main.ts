import Fastify from 'fastify';
import { ConfigLoader } from './config/index.js';
import { ContainerFactory } from './container/ContainerFactory.js';
import { Tokens } from './container/Tokens.js';
import { registerIngestRoutes } from './routes/ingestRoutes.js';
import { registerContractRoutes } from './routes/contractRoutes.js';
import { registerGraphRoutes } from './routes/graphRoutes.js';
import { registerDriftRoutes } from './routes/driftRoutes.js';
import { registerHealthRoutes } from './routes/healthRoutes.js';
import type { IContractStore } from './interfaces/index.js';
import type { IConsumerDepStore } from './interfaces/index.js';
import type { IDriftStore } from './interfaces/index.js';
import type { IScheduler } from './interfaces/index.js';
import type { IngestionService } from './ingestion/index.js';

export async function main(): Promise<void> {
  const config = await ConfigLoader.load();
  const container = ContainerFactory.build(config);

  const app = Fastify({ logger: true });

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

  const scheduler = container.resolve<IScheduler>(Tokens.Scheduler);
  scheduler.start();

  await app.listen({ port: config.port, host: '0.0.0.0' });

  const shutdown = async () => {
    scheduler.stop();
    await app.close();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
