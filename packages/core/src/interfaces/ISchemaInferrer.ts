import type { ShapeNode } from '../types/index.js';
import type { ContractSchema, InferenceConfig } from '../types/index.js';

export interface ISchemaInferrer {
  infer(shapes: ShapeNode[], config: InferenceConfig): ContractSchema;
  update(existing: ContractSchema, newShapes: ShapeNode[], config: InferenceConfig): ContractSchema;
}
