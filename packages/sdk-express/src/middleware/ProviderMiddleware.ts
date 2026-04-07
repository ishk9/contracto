import { BaseMiddleware } from './BaseMiddleware.js';

export class ProviderMiddleware extends BaseMiddleware {
  protected intercept(req: any, res: any, next: (err?: any) => void): void {
    const originalJson = res.json.bind(res);

    res.json = (body: unknown) => {
      setImmediate(() => {
        this.reportShape({
          rawBody: body,
          endpoint: `${req.method} ${req.route?.path || req.path}`,
          statusCode: res.statusCode,
          caller: (req.headers['x-service-name'] as string) || null,
          timestamp: new Date().toISOString(),
        });
      });
      return originalJson(body);
    };

    next();
  }
}
