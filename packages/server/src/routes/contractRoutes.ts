import type { FastifyInstance } from 'fastify';
import type { IContractReader } from '../interfaces/index.js';

export interface ContractRouteDeps {
  contractStore: IContractReader;
}

export function registerContractRoutes(app: FastifyInstance, deps: ContractRouteDeps): void {
  app.get('/contracts', async () => {
    return deps.contractStore.getAllContracts();
  });

  app.get<{ Params: { service: string } }>('/contracts/:service', async (request) => {
    return deps.contractStore.listContracts(request.params.service);
  });

  app.get<{ Params: { service: string; endpoint: string } }>(
    '/contracts/:service/:endpoint',
    async (request, reply) => {
      const contract = deps.contractStore.getContract(
        request.params.service,
        decodeURIComponent(request.params.endpoint),
        'GET',
      );

      if (!contract) {
        return reply.status(404).send({ error: 'Contract not found' });
      }

      return contract;
    },
  );
}
