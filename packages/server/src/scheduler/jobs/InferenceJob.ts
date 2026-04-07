import type { IContractStore, ISampleStore } from '../../interfaces/index.js';
import type { ISchedulerJob } from '../../interfaces/index.js';
import type { EventBus } from '../../events/index.js';
import type { ISchemaInferrer, InferenceConfig, ShapeNode } from '@contractcheck/core';

export class InferenceJob implements ISchedulerJob {
  readonly name = 'inference';
  readonly intervalMs = 5 * 60 * 1000;

  constructor(
    private readonly contractStore: IContractStore,
    private readonly sampleStore: ISampleStore,
    private readonly inferrer: ISchemaInferrer,
    private readonly config: InferenceConfig,
    private readonly eventBus: EventBus,
  ) {}

  async execute(): Promise<void> {
    const contracts = this.contractStore.getAllContracts();

    for (const contract of contracts) {
      if (contract.status !== 'learning') continue;

      const shapeRows = this.sampleStore.getShapesByEndpoint(
        contract.provider,
        contract.endpoint,
        contract.method,
      );

      if (shapeRows.length === 0) continue;

      const shapes: ShapeNode[] = shapeRows.map((r) => r.shape);
      const totalSamples = shapeRows.reduce((sum, r) => sum + r.count, 0);

      const schema = this.inferrer.infer(shapes, this.config);

      const newStatus = totalSamples >= this.config.minSamplesForStable ? 'stable' : 'learning';
      const confidence = Math.min(totalSamples / this.config.minSamplesForStable, 1);

      this.contractStore.upsertContract({
        ...contract,
        schema,
        sampleCount: totalSamples,
        confidence,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });

      this.eventBus.emit('contract:updated', {
        contractId: contract.id,
        provider: contract.provider,
        status: newStatus,
      });
    }
  }
}
