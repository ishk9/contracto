import {
  ShapeExtractor,
  Fingerprinter,
  SchemaInferrer,
  DriftDetector,
} from '@contractcheck/core';
import type { ServerConfig } from '../config/index.js';
import { Container } from './Container.js';
import { Tokens } from './Tokens.js';
import { EventBus } from '../events/index.js';
import { StoreFactory } from '../store/index.js';
import type { StoreSet } from '../store/index.js';
import { AlertRouter } from '../alerting/AlertRouter.js';
import { AlertChannelFactory } from '../alerting/AlertChannelFactory.js';
import { Scheduler } from '../scheduler/Scheduler.js';
import { InferenceJob } from '../scheduler/jobs/InferenceJob.js';
import { DriftResolutionJob } from '../scheduler/jobs/DriftResolutionJob.js';
import { SamplePruningJob } from '../scheduler/jobs/SamplePruningJob.js';
import { StaleConsumerJob } from '../scheduler/jobs/StaleConsumerJob.js';
import { IngestionService } from '../ingestion/index.js';

export class ContainerFactory {
  static build(config: ServerConfig): Container {
    const container = new Container();
    container.register(Tokens.Config, config);

    const extractor = new ShapeExtractor();
    const fingerprinter = new Fingerprinter();
    const inferrer = new SchemaInferrer();
    const driftDetector = new DriftDetector();

    container.register(Tokens.ShapeExtractor, extractor);
    container.register(Tokens.Fingerprinter, fingerprinter);
    container.register(Tokens.SchemaInferrer, inferrer);
    container.register(Tokens.DriftDetector, driftDetector);

    const stores: StoreSet = StoreFactory.create(config.storage);
    container.register(Tokens.ContractStore, stores.contracts);
    container.register(Tokens.SampleStore, stores.samples);
    container.register(Tokens.DriftStore, stores.drift);
    container.register(Tokens.ConsumerDepStore, stores.consumerDeps);

    const alertRouter = new AlertRouter();
    for (const channel of AlertChannelFactory.createAll(config.alerts)) {
      alertRouter.register(channel);
    }
    container.register(Tokens.AlertRouter, alertRouter);

    const eventBus = new EventBus();

    eventBus.on('sample:ingested', ({ provider, endpoint, method, fingerprint }) => {
      const contract = stores.contracts.getContract(provider, endpoint, method);
      if (!contract || contract.status !== 'stable') return;

      const shape = stores.samples.getShape(fingerprint);
      if (!shape) return;

      const consumers = stores.consumerDeps.getConsumersOf(provider, endpoint, method);
      const events = driftDetector.detect(contract.schema, shape, consumers);

      for (const event of events) {
        stores.drift.createEvent(event);
        eventBus.emit('drift:detected', { event });
      }
    });

    eventBus.on('drift:confirmed', async ({ event }) => {
      await alertRouter.route(event);
    });

    container.register(Tokens.EventBus, eventBus);

    const ingestionService = new IngestionService(
      stores.samples,
      stores.consumerDeps,
      eventBus,
    );
    container.register(Tokens.IngestionService, ingestionService);

    const scheduler = new Scheduler();
    scheduler.register(new InferenceJob(
      stores.contracts, stores.samples, inferrer, config.inference, eventBus,
    ));
    scheduler.register(new DriftResolutionJob(stores.drift, config.drift));
    scheduler.register(new SamplePruningJob(stores.samples, config.ingestion.sampleRetentionDays));
    scheduler.register(new StaleConsumerJob(stores.consumerDeps));
    container.register(Tokens.Scheduler, scheduler);

    return container;
  }
}
