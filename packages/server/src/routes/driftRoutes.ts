import type { FastifyInstance } from 'fastify';
import type { IDriftStore } from '../interfaces/index.js';

export interface DriftRouteDeps {
  driftStore: IDriftStore;
}

export function registerDriftRoutes(app: FastifyInstance, deps: DriftRouteDeps): void {
  app.get('/drift', async () => {
    return deps.driftStore.getActiveEvents();
  });

  app.get<{ Params: { id: string } }>('/drift/:id', async (request, reply) => {
    const event = deps.driftStore.getEvent(request.params.id);
    if (!event) {
      return reply.status(404).send({ error: 'Drift event not found' });
    }
    return event;
  });

  app.post<{ Params: { id: string } }>('/drift/:id/acknowledge', async (request, reply) => {
    const event = deps.driftStore.getEvent(request.params.id);
    if (!event) {
      return reply.status(404).send({ error: 'Drift event not found' });
    }

    deps.driftStore.updateEvent(request.params.id, {
      status: 'acknowledged',
    });

    return { acknowledged: true, id: request.params.id };
  });
}
