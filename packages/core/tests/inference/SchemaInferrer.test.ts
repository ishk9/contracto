import { describe, it, expect } from 'vitest';
import { SchemaInferrer } from '../../src/inference/SchemaInferrer.js';
import { DEFAULT_INFERENCE_CONFIG } from '../../src/types/index.js';
import type { ShapeNode } from '../../src/types/index.js';

function obj(fields: Record<string, ShapeNode>): ShapeNode {
  return { _type: 'object', fields };
}

describe('SchemaInferrer', () => {
  const inferrer = new SchemaInferrer();

  it('infer: consistent fields id:number + name:string → 100% presence, required true', () => {
    const shapes: ShapeNode[] = Array.from({ length: 100 }, () =>
      obj({
        id: 'number',
        name: 'string',
      }),
    );
    const schema = inferrer.infer(shapes, DEFAULT_INFERENCE_CONFIG);
    expect(schema._type).toBe('object');
    expect(schema.fields.id.presence).toBe(1);
    expect(schema.fields.id.required).toBe(true);
    expect(schema.fields.id.sampleCount).toBe(100);
    expect(schema.fields.name.presence).toBe(1);
    expect(schema.fields.name.required).toBe(true);
    expect(schema.fields.name.sampleCount).toBe(100);
  });

  it('infer: field missing in some shapes → fractional presence, required false', () => {
    const withStatus = Array.from({ length: 40 }, () =>
      obj({
        id: 'number',
        status: 'string',
      }),
    );
    const withoutStatus = Array.from({ length: 60 }, () =>
      obj({
        id: 'number',
      }),
    );
    const shapes = [...withStatus, ...withoutStatus];
    const schema = inferrer.infer(shapes, DEFAULT_INFERENCE_CONFIG);
    expect(schema.fields.id.presence).toBe(1);
    expect(schema.fields.id.required).toBe(true);
    expect(schema.fields.status.presence).toBe(0.4);
    expect(schema.fields.status.required).toBe(false);
    expect(schema.fields.status.sampleCount).toBe(40);
  });

  it('infer: nullable when field appears as string and null', () => {
    const shapes: ShapeNode[] = [
      ...Array.from({ length: 50 }, () => obj({ flag: 'string' })),
      ...Array.from({ length: 50 }, () => obj({ flag: 'null' })),
    ];
    const schema = inferrer.infer(shapes, DEFAULT_INFERENCE_CONFIG);
    expect(schema.fields.flag.nullable).toBe(true);
    expect(schema.fields.flag.types.some((t) => t.type === 'string')).toBe(true);
    expect(schema.fields.flag.types.some((t) => t.type === 'null')).toBe(true);
  });

  it('infer: nested object produces nested ContractSchema', () => {
    const shapes: ShapeNode[] = [
      obj({
        meta: obj({
          version: 'number',
        }),
      }),
    ];
    const schema = inferrer.infer(shapes, DEFAULT_INFERENCE_CONFIG);
    expect(schema.fields.meta.nested).toBeDefined();
    expect(schema.fields.meta.nested!._type).toBe('object');
    expect(schema.fields.meta.nested!.fields.version.types[0].type).toBe('number');
    expect(schema.fields.meta.nested!.fields.version.presence).toBe(1);
  });

  it('infer: array field gets arrayItems with item type frequencies', () => {
    const shapes: ShapeNode[] = [
      obj({
        tags: { _type: 'array', items: 'string' },
      }),
    ];
    const schema = inferrer.infer(shapes, DEFAULT_INFERENCE_CONFIG);
    expect(schema.fields.tags.arrayItems).toBeDefined();
    expect(schema.fields.tags.arrayItems!.types[0].type).toBe('string');
    expect(schema.fields.tags.types.some((t) => t.type === 'array')).toBe(true);
  });

  it('update: preserves existing stats and merges new shapes', () => {
    const first = Array.from({ length: 50 }, () =>
      obj({
        id: 'number',
      }),
    );
    const existing = inferrer.infer(first, DEFAULT_INFERENCE_CONFIG);
    expect(existing.fields.id.sampleCount).toBe(50);
    expect(existing.fields.id.presence).toBe(1);

    const next = Array.from({ length: 50 }, () =>
      obj({
        id: 'number',
        extra: 'string',
      }),
    );
    const merged = inferrer.update(existing, next, DEFAULT_INFERENCE_CONFIG);
    expect(merged.fields.id.presence).toBe(1);
    expect(merged.fields.id.sampleCount).toBe(100);
    expect(merged.fields.extra.presence).toBe(0.5);
    expect(merged.fields.extra.required).toBe(false);
    expect(merged.fields.extra.types[0].type).toBe('string');
  });

  it('infer: non-object shapes are skipped (only ShapeObject processed)', () => {
    const shapes: ShapeNode[] = [
      obj({ a: 'string' }),
      'string' as ShapeNode,
      'number' as ShapeNode,
    ];
    const schema = inferrer.infer(shapes, DEFAULT_INFERENCE_CONFIG);
    expect(Object.keys(schema.fields)).toEqual(['a']);
    expect(schema.fields.a.presence).toBe(1 / 3);
  });

  it('update: skips non-object newShapes when merging', () => {
    const existing = inferrer.infer([obj({ x: 'number' })], DEFAULT_INFERENCE_CONFIG);
    const merged = inferrer.update(
      existing,
      ['string' as ShapeNode, obj({ y: 'string' })],
      DEFAULT_INFERENCE_CONFIG,
    );
    // 1 prior sample + 2 new shapes → totalSamples 3; string root skipped; y seen once
    expect(merged.fields.x.presence).toBeCloseTo(1 / 3, 10);
    expect(merged.fields.y.presence).toBeCloseTo(1 / 3, 10);
  });
});
