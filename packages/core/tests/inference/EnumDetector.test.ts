import { describe, it, expect } from 'vitest';
import { EnumDetector } from '../../src/inference/EnumDetector.js';
import { FieldStatsAccumulator } from '../../src/inference/FieldStatsAccumulator.js';
import { DEFAULT_INFERENCE_CONFIG } from '../../src/types/index.js';

describe('EnumDetector', () => {
  const detector = new EnumDetector();
  const acc = new FieldStatsAccumulator();

  it('matches DEFAULT_INFERENCE_CONFIG: minSamplesForStable 50, enumMaxCardinality 20', () => {
    expect(DEFAULT_INFERENCE_CONFIG.minSamplesForStable).toBe(50);
    expect(DEFAULT_INFERENCE_CONFIG.enumMaxCardinality).toBe(20);
  });

  it('returns undefined when totalSamples < minSamplesForStable', () => {
    const stats = acc.create(DEFAULT_INFERENCE_CONFIG.minSamplesForStable - 1);
    stats.typeCounts.set('string', 10);
    stats.stringValues.set('a', 5);
    stats.stringValues.set('b', 5);
    expect(detector.detect(stats, DEFAULT_INFERENCE_CONFIG)).toBeUndefined();
  });

  it('returns undefined when no string type count', () => {
    const stats = acc.create(100);
    stats.typeCounts.set('number', 5);
    stats.stringValues.set('a', 5);
    stats.stringValues.set('b', 5);
    expect(detector.detect(stats, DEFAULT_INFERENCE_CONFIG)).toBeUndefined();
  });

  it('returns undefined when stringValues is empty', () => {
    const stats = acc.create(100);
    stats.typeCounts.set('string', 10);
    expect(detector.detect(stats, DEFAULT_INFERENCE_CONFIG)).toBeUndefined();
  });

  it('returns undefined when stringValues.size > enumMaxCardinality', () => {
    const stats = acc.create(100);
    stats.typeCounts.set('string', 25);
    for (let i = 0; i <= DEFAULT_INFERENCE_CONFIG.enumMaxCardinality; i++) {
      stats.stringValues.set(`v${i}`, 1);
    }
    expect(stats.stringValues.size).toBe(DEFAULT_INFERENCE_CONFIG.enumMaxCardinality + 1);
    expect(detector.detect(stats, DEFAULT_INFERENCE_CONFIG)).toBeUndefined();
  });

  it('returns undefined when only 1 unique string value', () => {
    const stats = acc.create(100);
    stats.typeCounts.set('string', 50);
    stats.stringValues.set('only', 50);
    expect(detector.detect(stats, DEFAULT_INFERENCE_CONFIG)).toBeUndefined();
  });

  it('returns sorted enum values when ≥2 unique strings, enough samples, within cardinality', () => {
    const stats = acc.create(DEFAULT_INFERENCE_CONFIG.minSamplesForStable);
    stats.typeCounts.set('string', 60);
    stats.stringValues.set('zebra', 10);
    stats.stringValues.set('alpha', 20);
    stats.stringValues.set('beta', 30);
    expect(detector.detect(stats, DEFAULT_INFERENCE_CONFIG)).toEqual(['alpha', 'beta', 'zebra']);
  });

  it('at boundary totalSamples === minSamplesForStable returns enum when other gates pass', () => {
    const stats = acc.create(DEFAULT_INFERENCE_CONFIG.minSamplesForStable);
    stats.typeCounts.set('string', 50);
    stats.stringValues.set('x', 25);
    stats.stringValues.set('y', 25);
    expect(detector.detect(stats, DEFAULT_INFERENCE_CONFIG)).toEqual(['x', 'y']);
  });

  it('at boundary stringValues.size === enumMaxCardinality returns sorted keys', () => {
    const stats = acc.create(100);
    stats.typeCounts.set('string', 100);
    const keys = Array.from({ length: DEFAULT_INFERENCE_CONFIG.enumMaxCardinality }, (_, i) =>
      String.fromCharCode(97 + (i % 26)) + Math.floor(i / 26),
    );
    for (const k of keys) {
      stats.stringValues.set(k, 1);
    }
    expect(stats.stringValues.size).toBe(DEFAULT_INFERENCE_CONFIG.enumMaxCardinality);
    const result = detector.detect(stats, DEFAULT_INFERENCE_CONFIG);
    expect(result).toBeDefined();
    expect(result!.length).toBe(DEFAULT_INFERENCE_CONFIG.enumMaxCardinality);
    expect(result).toEqual([...keys].sort());
  });
});
