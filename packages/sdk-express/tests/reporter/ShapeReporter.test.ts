import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShapeReporter } from '../../src/reporter/ShapeReporter.js';
import { NoopTransport } from '../../src/transport/NoopTransport.js';

describe('ShapeReporter', () => {
  let transport: NoopTransport;
  let reporter: ShapeReporter;

  beforeEach(() => {
    vi.useFakeTimers();
    transport = new NoopTransport();
    reporter = new ShapeReporter(transport, 'test-service', 10000, 999999);
  });

  afterEach(() => {
    reporter.destroy();
    vi.useRealTimers();
  });

  const sample = (overrides: Partial<Parameters<ShapeReporter['add']>[0]> = {}) => ({
    endpoint: 'GET /api',
    statusCode: 200,
    shapeFingerprint: 'fp-default',
    shape: { _type: 'object', fields: { a: 'string' } } as const,
    caller: null as string | null,
    count: 1,
    timestamp: '2026-04-07T12:00:00.000Z',
    ...overrides,
  });

  it('deduplicates by endpoint and fingerprint, merging count', () => {
    const fp = 'same-fp';
    for (let i = 0; i < 5; i++) {
      reporter.add(
        sample({
          shapeFingerprint: fp,
          shape: { _type: 'object', fields: { n: 'number' } },
        }),
      );
    }
    reporter.flush();
    expect(transport.batches).toHaveLength(1);
    const batch = transport.batches[0] as { samples: { count: number }[] };
    expect(batch.samples).toHaveLength(1);
    expect(batch.samples[0].count).toBe(5);
  });

  it('flush() sends one batch to transport when buffer has samples', () => {
    reporter.add(sample());
    reporter.flush();
    expect(transport.batches.length).toBe(1);
  });

  it('flush() on empty buffer does not send', () => {
    reporter.flush();
    expect(transport.batches.length).toBe(0);
  });

  it('destroy() flushes remaining buffered samples', () => {
    reporter.add(sample());
    reporter.destroy();
    expect(transport.batches.length).toBe(1);
  });

  it('omits shape on later samples when fingerprint was already seen after flush', () => {
    reporter.add(
      sample({
        shapeFingerprint: 'abc',
        shape: { _type: 'object', fields: { x: 'string' } },
      }),
    );
    reporter.flush();
    reporter.add(
      sample({
        shapeFingerprint: 'abc',
        shape: { _type: 'object', fields: { y: 'number' } },
      }),
    );
    reporter.flush();
    expect(transport.batches).toHaveLength(2);
    const second = (transport.batches[1] as { samples: { shape?: unknown }[] }).samples[0];
    expect(second.shape).toBeUndefined();
  });

  it('keeps separate entries for different fingerprints', () => {
    reporter.add(sample({ shapeFingerprint: 'a', shape: { _type: 'object', fields: {} } }));
    reporter.add(sample({ shapeFingerprint: 'b', shape: { _type: 'object', fields: {} } }));
    reporter.add(sample({ shapeFingerprint: 'c', shape: { _type: 'object', fields: {} } }));
    reporter.flush();
    expect(transport.batches).toHaveLength(1);
    const batch = transport.batches[0] as { samples: unknown[] };
    expect(batch.samples.length).toBe(3);
  });
});
