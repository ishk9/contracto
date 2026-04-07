import type { PipelineContext } from './PipelineContext.js';
import type { PipelineStep } from './PipelineStep.js';

export class Pipeline {
  private readonly head: PipelineStep;

  constructor(steps: PipelineStep[]) {
    if (steps.length === 0) throw new Error('Pipeline requires at least one step');
    this.head = steps[0];
    for (let i = 0; i < steps.length - 1; i++) {
      steps[i].setNext(steps[i + 1]);
    }
  }

  async execute(context: PipelineContext): Promise<PipelineContext | null> {
    return this.head.process(context);
  }
}
