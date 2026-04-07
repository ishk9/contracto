import { describe, it, expect } from 'vitest';
import { ShapeExtractor, Fingerprinter } from '@contractcheck/core';
import { ProviderMiddleware } from '../../src/middleware/ProviderMiddleware.js';
import { BaseMiddleware } from '../../src/middleware/BaseMiddleware.js';
import { Pipeline } from '../../src/pipeline/Pipeline.js';
import { SamplerStep } from '../../src/pipeline/steps/SamplerStep.js';
import { ExtractorStep } from '../../src/pipeline/steps/ExtractorStep.js';
import { FingerprintStep } from '../../src/pipeline/steps/FingerprintStep.js';
import type { Pipeline } from '../../src/pipeline/Pipeline.js';
import type { ShapeReporterLike } from '../../src/middleware/BaseMiddleware.js';

function createPipeline(): Pipeline {
  return new Pipeline([
    new SamplerStep(1),
    new ExtractorStep(new ShapeExtractor()),
    new FingerprintStep(new Fingerprinter()),
  ]);
}

const mockReq = {
  method: 'GET',
  path: '/users',
  headers: {} as Record<string, string>,
  route: { path: '/users' },
};

const mockRes = {
  statusCode: 200,
  json: (body: unknown) => body,
};

describe('ProviderMiddleware', () => {
  it('calls next()', () => {
    const samples: unknown[] = [];
    const mockReporter: ShapeReporterLike = {
      add: (sample) => {
        samples.push(sample);
      },
    };
    const middleware = new ProviderMiddleware(createPipeline(), mockReporter);
    const handler = middleware.createHandler();
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };
    handler(mockReq, mockRes, next);
    expect(nextCalled).toBe(true);
  });

  it('res.json returns the result of the original json call', () => {
    const samples: unknown[] = [];
    const mockReporter = { add: (sample: unknown) => samples.push(sample) };
    const middleware = new ProviderMiddleware(createPipeline(), mockReporter);
    const handler = middleware.createHandler();
    const res = {
      statusCode: 200,
      json: (body: unknown) => ({ wrapped: body }),
    };
    handler(mockReq, res, () => {});
    const out = res.json({ id: 1 });
    expect(out).toEqual({ wrapped: { id: 1 } });
  });

  it('reporter receives a sample with shape and fingerprint after setImmediate', async () => {
    const samples: unknown[] = [];
    const mockReporter = { add: (sample: unknown) => samples.push(sample) };
    const middleware = new ProviderMiddleware(createPipeline(), mockReporter);
    const handler = middleware.createHandler();
    const res = { ...mockRes };
    handler(mockReq, res, () => {});
    res.json({ id: 1, name: 'test' });
    await new Promise<void>((r) => setTimeout(r, 50));
    expect(samples.length).toBe(1);
    const sample = samples[0] as { shape?: unknown; shapeFingerprint?: string };
    expect(sample.shape).toBeDefined();
    expect(sample.shapeFingerprint).toBeDefined();
  });

  it('sets caller from X-Service-Name header', async () => {
    const samples: unknown[] = [];
    const mockReporter = { add: (sample: unknown) => samples.push(sample) };
    const middleware = new ProviderMiddleware(createPipeline(), mockReporter);
    const handler = middleware.createHandler();
    const req = {
      ...mockReq,
      headers: { 'x-service-name': 'order-service' },
    };
    const res = { ...mockRes };
    handler(req, res, () => {});
    res.json({ ok: true });
    await new Promise<void>((r) => setTimeout(r, 50));
    expect(samples.length).toBe(1);
    expect((samples[0] as { caller: string | null }).caller).toBe('order-service');
  });
});

class ThrowingMiddleware extends BaseMiddleware {
  protected intercept(): void {
    throw new Error('intercept error');
  }
}

describe('safe middleware (BaseMiddleware)', () => {
  it('calls next when intercept throws', () => {
    const samples: unknown[] = [];
    const mockReporter = { add: (sample: unknown) => samples.push(sample) };
    const middleware = new ThrowingMiddleware(createPipeline(), mockReporter);
    const handler = middleware.createHandler();
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };
    handler(mockReq, mockRes, next);
    expect(nextCalled).toBe(true);
  });
});
