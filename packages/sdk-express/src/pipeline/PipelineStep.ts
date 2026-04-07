import type { PipelineContext } from './PipelineContext.js';

export abstract class PipelineStep {
  private next: PipelineStep | null = null;

  setNext(step: PipelineStep): PipelineStep {
    this.next = step;
    return step;
  }

  protected async passToNext(context: PipelineContext): Promise<PipelineContext | null> {
    return this.next ? this.next.process(context) : context;
  }

  abstract process(context: PipelineContext): Promise<PipelineContext | null>;
}
