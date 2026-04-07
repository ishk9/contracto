import type { PipelineContext } from '../PipelineContext.js';
import { PipelineStep } from '../PipelineStep.js';

export class SamplerStep extends PipelineStep {
  constructor(private readonly sampleRate: number) {
    super();
  }

  async process(context: PipelineContext): Promise<PipelineContext | null> {
    if (Math.random() > this.sampleRate) return null;
    return this.passToNext(context);
  }
}
