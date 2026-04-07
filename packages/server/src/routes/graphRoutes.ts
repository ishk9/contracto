import type { FastifyInstance } from 'fastify';
import type { IConsumerDepReader } from '../interfaces/index.js';

export interface GraphRouteDeps {
  consumerDepStore: IConsumerDepReader;
}

export function registerGraphRoutes(app: FastifyInstance, deps: GraphRouteDeps): void {
  app.get('/graph', async () => {
    const graph = deps.consumerDepStore.getFullGraph();
    const providers: Record<string, unknown> = {};
    for (const [key, node] of graph.providers) {
      providers[key] = node;
    }
    return { providers };
  });

  app.get<{ Params: { service: string } }>('/graph/:service', async (request) => {
    const consumes = deps.consumerDepStore.getDependenciesOf(request.params.service);
    return { service: request.params.service, consumes };
  });
}
