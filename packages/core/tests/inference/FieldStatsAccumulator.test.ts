import { describe, it, expect } from 'vitest';
import { FieldStatsAccumulator } from '../../src/inference/FieldStatsAccumulator.js';
import type { ShapeNode } from '../../src/types/index.js';

describe('FieldStatsAccumulator', () => {
  const acc = new FieldStatsAccumulator();

  it('create() returns zeroed stats', () => {
    const stats = acc.create(42);
    expect(stats.totalSamples).toBe(42);
    expect(stats.presenceCount).toBe(0);
    expect(stats.nullCount).toBe(0);
    expect(stats.typeCounts.size).toBe(0);
    expect(stats.stringValues.size).toBe(0);
    expect(stats.nestedStats).toBeNull();
    expect(stats.arrayItemStats).toBeNull();
  });

  it("accumulate with primitive 'string' increments presenceCount and typeCounts", () => {
    const stats = acc.create(10);
    acc.accumulate(stats, 'string');
    expect(stats.presenceCount).toBe(1);
    expect(stats.typeCounts.get('string')).toBe(1);
  });

  it("accumulate with 'null' increments nullCount", () => {
    const stats = acc.create(10);
    acc.accumulate(stats, 'null');
    expect(stats.nullCount).toBe(1);
    expect(stats.typeCounts.get('null')).toBe(1);
  });

  it('accumulate with ShapeObject creates nestedStats', () => {
    const stats = acc.create(5);
    const node: ShapeNode = {
      _type: 'object',
      fields: {
        a: 'number',
        b: 'string',
      },
    };
    acc.accumulate(stats, node);
    expect(stats.typeCounts.get('object')).toBe(1);
    expect(stats.nestedStats).not.toBeNull();
    expect(stats.nestedStats!.has('a')).toBe(true);
    expect(stats.nestedStats!.has('b')).toBe(true);
    const nestedA = stats.nestedStats!.get('a')!;
    const nestedB = stats.nestedStats!.get('b')!;
    expect(nestedA.totalSamples).toBe(5);
    expect(nestedB.totalSamples).toBe(5);
    expect(nestedA.typeCounts.get('number')).toBe(1);
    expect(nestedB.typeCounts.get('string')).toBe(1);
    expect(nestedA.presenceCount).toBe(1);
    expect(nestedB.presenceCount).toBe(1);
  });

  it('accumulate with ShapeArray creates arrayItemStats', () => {
    const stats = acc.create(3);
    const node: ShapeNode = {
      _type: 'array',
      items: 'boolean',
    };
    acc.accumulate(stats, node);
    expect(stats.typeCounts.get('array')).toBe(1);
    expect(stats.arrayItemStats).not.toBeNull();
    expect(stats.arrayItemStats!.totalSamples).toBe(3);
    expect(stats.arrayItemStats!.typeCounts.get('boolean')).toBe(1);
    expect(stats.arrayItemStats!.presenceCount).toBe(1);
  });

  it('accumulate with ShapeUnion recurses into variants (each variant type is counted)', () => {
    const stats = acc.create(1);
    const node: ShapeNode = {
      _type: 'union',
      variants: ['string', 'number'],
    };
    acc.accumulate(stats, node);
    expect(stats.typeCounts.get('string')).toBe(1);
    expect(stats.typeCounts.get('number')).toBe(1);
  });

  it('accumulate with ShapeUnion counts three primitive variants separately', () => {
    const stats = acc.create(1);
    const node: ShapeNode = {
      _type: 'union',
      variants: ['string', 'boolean', 'null'],
    };
    acc.accumulate(stats, node);
    expect(stats.typeCounts.get('string')).toBe(1);
    expect(stats.typeCounts.get('boolean')).toBe(1);
    expect(stats.typeCounts.get('null')).toBe(1);
    expect(stats.nullCount).toBe(1);
  });

  it('trackStringValue updates stringValues map', () => {
    const stats = acc.create(10);
    acc.trackStringValue(stats, 'x');
    acc.trackStringValue(stats, 'x');
    acc.trackStringValue(stats, 'y');
    expect(stats.stringValues.get('x')).toBe(2);
    expect(stats.stringValues.get('y')).toBe(1);
  });

  it('multiple accumulations: 3 strings then 1 number → string:3, number:1, presenceCount:4', () => {
    const stats = acc.create(100);
    acc.accumulate(stats, 'string');
    acc.accumulate(stats, 'string');
    acc.accumulate(stats, 'string');
    acc.accumulate(stats, 'number');
    expect(stats.presenceCount).toBe(4);
    expect(stats.typeCounts.get('string')).toBe(3);
    expect(stats.typeCounts.get('number')).toBe(1);
  });
});
