import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Redactor, ShapeExtractor, Fingerprinter, isShapeObject } from '@contractcheck/core';
import { Pipeline } from '../../src/pipeline/Pipeline.js';
import type { PipelineContext } from '../../src/pipeline/PipelineContext.js';
import { SamplerStep } from '../../src/pipeline/steps/SamplerStep.js';
import { RedactorStep } from '../../src/pipeline/steps/RedactorStep.js';
import { ExtractorStep } from '../../src/pipeline/steps/ExtractorStep.js';
import { FingerprintStep } from '../../src/pipeline/steps/FingerprintStep.js';

const baseContext = (rawBody: unknown): PipelineContext => ({
  rawBody,
  endpoint: 'GET /users',
  statusCode: 200,
  caller: null,
  timestamp: '2026-04-07T12:00:00.000Z',
});

describe('Pipeline', () => {
  it('runs full pipeline and produces ShapeObject shape and hex fingerprint', async () => {
    const redactor = new Redactor(['password']);
    const extractor = new ShapeExtractor();
    const fingerprinter = new Fingerprinter();
    const pipeline = new Pipeline([
      new SamplerStep(1),
      new RedactorStep(redactor),
      new ExtractorStep(extractor),
      new FingerprintStep(fingerprinter),
    ]);

    const result = await pipeline.execute(baseContext({ id: 1, name: 'test' }));

    expect(result).not.toBeNull();
    expect(result!.shape).toBeDefined();
    expect(isShapeObject(result!.shape!)).toBe(true);
    expect(result!.fingerprint).toBeDefined();
    expect(result!.fingerprint).toMatch(/^[0-9a-f]+$/i);
  });

  describe('SamplerStep', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('with rate 0 always returns null (skips)', async () => {
      const pipeline = new Pipeline([new SamplerStep(0)]);
      const result = await pipeline.execute(baseContext({ a: 1 }));
      expect(result).toBeNull();
    });

    it('with rate 1 always passes context through', async () => {
      const pipeline = new Pipeline([new SamplerStep(1)]);
      const ctx = baseContext({ a: 1 });
      const result = await pipeline.execute(ctx);
      expect(result).toEqual(ctx);
    });
  });

  it('RedactorStep removes configured keys from object rawBody', async () => {
    const redactor = new Redactor(['password']);
    const pipeline = new Pipeline([new RedactorStep(redactor)]);
    const result = await pipeline.execute(
      baseContext({ password: 'secret', name: 'test' }),
    );
    expect(result).not.toBeNull();
    expect(result!.rawBody).toEqual({ name: 'test' });
    expect(Object.prototype.hasOwnProperty.call(result!.rawBody, 'password')).toBe(false);
  });

  it('ExtractorStep sets shape to expected ShapeNode for object body', async () => {
    const extractor = new ShapeExtractor();
    const pipeline = new Pipeline([new ExtractorStep(extractor)]);
    const result = await pipeline.execute(baseContext({ id: 1, name: 'test' }));
    expect(result).not.toBeNull();
    expect(result!.shape).toEqual({
      _type: 'object',
      fields: {
        id: 'number',
        name: 'string',
      },
    });
  });

  it('FingerprintStep sets fingerprint to a hex string when shape is present', async () => {
    const extractor = new ShapeExtractor();
    const fingerprinter = new Fingerprinter();
    const pipeline = new Pipeline([new ExtractorStep(extractor), new FingerprintStep(fingerprinter)]);
    const result = await pipeline.execute(baseContext({ x: true }));
    expect(result).not.toBeNull();
    expect(result!.fingerprint).toMatch(/^[0-9a-f]+$/i);
  });

  it('FingerprintStep returns null when shape is missing', async () => {
    const fingerprinter = new Fingerprinter();
    const pipeline = new Pipeline([new FingerprintStep(fingerprinter)]);
    const ctx: PipelineContext = {
      rawBody: {},
      endpoint: 'GET /x',
      statusCode: 200,
      caller: null,
      timestamp: '2026-04-07T12:00:00.000Z',
    };
    const result = await pipeline.execute(ctx);
    expect(result).toBeNull();
  });

  it('throws when constructed with no steps', () => {
    expect(() => new Pipeline([])).toThrow(Error);
    expect(() => new Pipeline([])).toThrow('Pipeline requires at least one step');
  });
});
