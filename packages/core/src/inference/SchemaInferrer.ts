import type { ShapeNode } from '../types/index.js';
import type { ContractSchema, InferenceConfig } from '../types/index.js';
import { isShapeObject } from '../types/index.js';
import type { ISchemaInferrer } from '../interfaces/index.js';
import { FieldStatsAccumulator } from './FieldStatsAccumulator.js';
import { ContractSchemaBuilder } from './ContractSchemaBuilder.js';

export class SchemaInferrer implements ISchemaInferrer {
  private readonly accumulator: FieldStatsAccumulator;
  private readonly builder: ContractSchemaBuilder;

  constructor(accumulator?: FieldStatsAccumulator, builder?: ContractSchemaBuilder) {
    this.accumulator = accumulator ?? new FieldStatsAccumulator();
    this.builder = builder ?? new ContractSchemaBuilder();
  }

  infer(shapes: ShapeNode[], config: InferenceConfig): ContractSchema {
    const rootStats = new Map<string, ReturnType<FieldStatsAccumulator['create']>>();
    const totalSamples = shapes.length;

    for (const shape of shapes) {
      if (!isShapeObject(shape)) continue;

      for (const [key, child] of Object.entries(shape.fields)) {
        if (!rootStats.has(key)) {
          rootStats.set(key, this.accumulator.create(totalSamples));
        }
        this.accumulator.accumulate(rootStats.get(key)!, child);
      }
    }

    return this.builder.buildSchema(rootStats, config);
  }

  update(
    existing: ContractSchema,
    newShapes: ShapeNode[],
    config: InferenceConfig,
  ): ContractSchema {
    const allFieldKeys = new Set<string>();
    for (const key of Object.keys(existing.fields)) allFieldKeys.add(key);
    for (const shape of newShapes) {
      if (isShapeObject(shape)) {
        for (const key of Object.keys(shape.fields)) allFieldKeys.add(key);
      }
    }

    const rootStats = new Map<string, ReturnType<FieldStatsAccumulator['create']>>();
    const existingSampleCount = Math.max(
      ...Object.values(existing.fields).map((f) => f.sampleCount),
      0,
    );
    const totalSamples = existingSampleCount + newShapes.length;

    for (const key of allFieldKeys) {
      const stats = this.accumulator.create(totalSamples);

      const existingField = existing.fields[key];
      if (existingField) {
        stats.presenceCount = Math.round(existingField.presence * existingSampleCount);
        for (const tf of existingField.types) {
          stats.typeCounts.set(tf.type, tf.count);
        }
        if (existingField.nullable) {
          stats.nullCount = Math.max(1, stats.nullCount);
        }
      }

      rootStats.set(key, stats);
    }

    for (const shape of newShapes) {
      if (!isShapeObject(shape)) continue;

      for (const [key, child] of Object.entries(shape.fields)) {
        if (!rootStats.has(key)) {
          rootStats.set(key, this.accumulator.create(totalSamples));
        }
        this.accumulator.accumulate(rootStats.get(key)!, child);
      }
    }

    return this.builder.buildSchema(rootStats, config);
  }
}
