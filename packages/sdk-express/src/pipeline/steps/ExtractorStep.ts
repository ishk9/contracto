import type { PipelineContext } from '../PipelineContext.js';
import { PipelineStep } from '../PipelineStep.js';
import type { IShapeExtractor } from '@contractcheck/core';

export class ExtractorStep extends PipelineStep {
  constructor(private readonly extractor: IShapeExtractor) {
    super();
  }

  async process(context: PipelineContext): Promise<PipelineContext | null> {
    const shape = this.extractor.extract(context.rawBody);
    return this.passToNext({ ...context, shape });
  }
}
