import type { FastifyInstance } from 'fastify';
import type { IngestionService } from '../ingestion/index.js';

export interface IngestRouteDeps {
  ingestionService: IngestionService;
}

const providerBatchSchema = {
  body: {
    type: 'object',
    required: ['service', 'samples'],
    properties: {
      sdk_version: { type: 'string' },
      service: { type: 'string', minLength: 1 },
      samples: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['endpoint', 'statusCode', 'shapeFingerprint'],
          properties: {
            endpoint: { type: 'string' },
            statusCode: { type: 'integer' },
            shapeFingerprint: { type: 'string' },
            shape: {},
            caller: { type: ['string', 'null'] },
            count: { type: 'integer', minimum: 1, default: 1 },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

const consumerBatchSchema = {
  body: {
    type: 'object',
    required: ['service', 'accesses'],
    properties: {
      sdk_version: { type: 'string' },
      service: { type: 'string', minLength: 1 },
      accesses: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['provider', 'endpoint', 'fieldsAccessed'],
          properties: {
            provider: { type: 'string' },
            endpoint: { type: 'string' },
            fieldsAccessed: { type: 'array', items: { type: 'string' } },
            count: { type: 'integer', minimum: 1, default: 1 },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

export function registerIngestRoutes(app: FastifyInstance, deps: IngestRouteDeps): void {
  app.post('/ingest/provider', { schema: providerBatchSchema }, async (request, reply) => {
    const result = deps.ingestionService.ingestProviderBatch(request.body as any);

    if (result.missingFingerprints.length > 0) {
      reply.header('X-Missing-Fingerprints', result.missingFingerprints.join(','));
    }

    return reply.status(202).send({ stored: result.stored });
  });

  app.post('/ingest/consumer', { schema: consumerBatchSchema }, async (request, reply) => {
    deps.ingestionService.ingestConsumerBatch(request.body as any);
    return reply.status(202).send({ accepted: true });
  });
}
