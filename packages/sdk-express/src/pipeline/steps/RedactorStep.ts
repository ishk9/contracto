import type { PipelineContext } from '../PipelineContext.js';
import { PipelineStep } from '../PipelineStep.js';
import type { IRedactor } from '@contractcheck/core';

export class RedactorStep extends PipelineStep {
  constructor(private readonly redactor: IRedactor) {
    super();
  }

  async process(context: PipelineContext): Promise<PipelineContext | null> {
    if (typeof context.rawBody === 'object' && context.rawBody !== null && !Array.isArray(context.rawBody)) {
      context = { ...context, rawBody: this.redactor.redact(context.rawBody as Record<string, unknown>) };
    }
    return this.passToNext(context);
  }
}
