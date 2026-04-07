import type { Pipeline } from '../pipeline/Pipeline.js';
import type { PipelineContext } from '../pipeline/PipelineContext.js';

export type RequestHandler = (req: any, res: any, next: (err?: any) => void) => void;

export interface ShapeReporterLike {
  add(sample: {
    endpoint: string;
    statusCode: number;
    shapeFingerprint: string;
    shape?: unknown;
    caller: string | null;
    count: number;
    timestamp: string;
  }): void;
}

function safeMiddleware(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    try {
      fn(req, res, next);
    } catch {
      next();
    }
  };
}

export abstract class BaseMiddleware {
  protected readonly pipeline: Pipeline;
  protected readonly reporter: ShapeReporterLike;

  constructor(pipeline: Pipeline, reporter: ShapeReporterLike) {
    this.pipeline = pipeline;
    this.reporter = reporter;
  }

  createHandler(): RequestHandler {
    return safeMiddleware((req, res, next) => {
      this.intercept(req, res, next);
    });
  }

  protected abstract intercept(req: any, res: any, next: (err?: any) => void): void;

  protected async reportShape(context: PipelineContext): Promise<void> {
    const result = await this.pipeline.execute(context);
    if (!result || !result.shape || !result.fingerprint) return;

    this.reporter.add({
      endpoint: result.endpoint,
      statusCode: result.statusCode,
      shapeFingerprint: result.fingerprint,
      shape: result.shape,
      caller: result.caller,
      count: 1,
      timestamp: result.timestamp,
    });
  }
}
