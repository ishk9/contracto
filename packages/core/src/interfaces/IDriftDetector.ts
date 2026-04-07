import type { ContractSchema } from '../types/index.js';
import type { ShapeNode } from '../types/index.js';
import type { ConsumerDep, DriftEvent } from '../types/index.js';

export interface IDriftDetector {
  detect(
    baseline: ContractSchema,
    incoming: ShapeNode,
    consumerDeps: ConsumerDep[],
  ): DriftEvent[];
}
