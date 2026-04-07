import type { PipelineContext } from '../PipelineContext.js';
import { PipelineStep } from '../PipelineStep.js';
import type { IFingerprinter } from '@contractcheck/core';

export class FingerprintStep extends PipelineStep {
  constructor(private readonly fingerprinter: IFingerprinter) {
    super();
  }

  async process(context: PipelineContext): Promise<PipelineContext | null> {
    if (!context.shape) return null;
    const fingerprint = await this.fingerprinter.fingerprint(context.shape);
    return this.passToNext({ ...context, fingerprint });
  }
}
