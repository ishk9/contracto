import type { SDKConfig } from '@contractcheck/core';
import { ShapeExtractor, Fingerprinter, Redactor } from '@contractcheck/core';
import { Pipeline } from './pipeline/Pipeline.js';
import { SamplerStep } from './pipeline/steps/SamplerStep.js';
import { RedactorStep } from './pipeline/steps/RedactorStep.js';
import { ExtractorStep } from './pipeline/steps/ExtractorStep.js';
import { FingerprintStep } from './pipeline/steps/FingerprintStep.js';
import { ProviderMiddleware } from './middleware/ProviderMiddleware.js';
import { ConsumerMiddleware } from './middleware/ConsumerMiddleware.js';
import { ShapeReporter } from './reporter/ShapeReporter.js';
import { ConsumerReporter } from './tracking/ConsumerReporter.js';
import { TransportFactory } from './transport/TransportFactory.js';
import type { RequestHandler } from './middleware/BaseMiddleware.js';

export const contractcheck = {
  provider(config: SDKConfig): RequestHandler {
    const transport = TransportFactory.create({
      type: 'http',
      url: config.serverUrl,
    });

    const redactor = new Redactor([...(config.redact ?? [])]);
    const extractor = new ShapeExtractor();
    const fingerprinter = new Fingerprinter();

    const pipeline = new Pipeline([
      new SamplerStep(config.sampleRate ?? 1),
      new RedactorStep(redactor),
      new ExtractorStep(extractor),
      new FingerprintStep(fingerprinter),
    ]);

    const reporter = new ShapeReporter(transport, config.service);
    const middleware = new ProviderMiddleware(pipeline, reporter);
    return middleware.createHandler();
  },

  consumer(config: SDKConfig): RequestHandler {
    const transport = TransportFactory.create({
      type: 'http',
      url: config.serverUrl,
    });

    const redactor = new Redactor([...(config.redact ?? [])]);
    const extractor = new ShapeExtractor();
    const fingerprinter = new Fingerprinter();

    const pipeline = new Pipeline([
      new SamplerStep(config.sampleRate ?? 1),
      new RedactorStep(redactor),
      new ExtractorStep(extractor),
      new FingerprintStep(fingerprinter),
    ]);

    const providerReporter = new ShapeReporter(transport, config.service);
    const consumerReporter = new ConsumerReporter(transport, config.service);

    const middleware = new ConsumerMiddleware(
      pipeline,
      providerReporter,
      consumerReporter,
      config.service,
    );
    return middleware.createHandler();
  },
};
