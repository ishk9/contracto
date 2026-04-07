import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestServer } from '../helpers/createTestServer.js';
import type { TestServer } from '../helpers/createTestServer.js';

describe('Server Integration', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = createTestServer();
    await server.app.ready();
  });

  afterAll(async () => {
    await server.teardown();
  });

  describe('Health', () => {
    it('GET /health returns ok', async () => {
      const res = await server.app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(typeof body.uptime).toBe('number');
    });
  });

  describe('Ingestion', () => {
    it('POST /ingest/provider accepts valid batch', async () => {
      const batch = {
        sdk_version: '0.1.0',
        service: 'user-service',
        samples: [
          {
            endpoint: 'GET /users/:id',
            statusCode: 200,
            shapeFingerprint: 'abc123',
            shape: { _type: 'object', fields: { id: 'number', name: 'string' } },
            caller: null,
            count: 1,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const res = await server.app.inject({
        method: 'POST',
        url: '/ingest/provider',
        payload: batch,
      });

      expect(res.statusCode).toBe(202);
      const body = res.json();
      expect(body.stored).toBeGreaterThan(0);
    });

    it('POST /ingest/provider rejects invalid batch', async () => {
      const res = await server.app.inject({
        method: 'POST',
        url: '/ingest/provider',
        payload: { service: '' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('POST /ingest/consumer accepts valid batch', async () => {
      const batch = {
        sdk_version: '0.1.0',
        service: 'order-service',
        accesses: [
          {
            provider: 'user-service',
            endpoint: 'GET /users/:id',
            fieldsAccessed: ['id', 'name'],
            count: 5,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const res = await server.app.inject({
        method: 'POST',
        url: '/ingest/consumer',
        payload: batch,
      });

      expect(res.statusCode).toBe(202);
    });
  });

  describe('Contracts', () => {
    it('GET /contracts returns empty initially', async () => {
      const res = await server.app.inject({ method: 'GET', url: '/contracts' });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('GET /contracts/:service returns contracts for service', async () => {
      const res = await server.app.inject({ method: 'GET', url: '/contracts/user-service' });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Graph', () => {
    it('GET /graph returns dependency graph', async () => {
      const res = await server.app.inject({ method: 'GET', url: '/graph' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty('providers');
    });

    it('GET /graph/:service returns consumer deps', async () => {
      const res = await server.app.inject({ method: 'GET', url: '/graph/order-service' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.service).toBe('order-service');
    });
  });

  describe('Drift', () => {
    it('GET /drift returns active events', async () => {
      const res = await server.app.inject({ method: 'GET', url: '/drift' });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('GET /drift/:id returns 404 for unknown event', async () => {
      const res = await server.app.inject({ method: 'GET', url: '/drift/nonexistent' });
      expect(res.statusCode).toBe(404);
    });

    it('POST /drift/:id/acknowledge returns 404 for unknown event', async () => {
      const res = await server.app.inject({
        method: 'POST',
        url: '/drift/nonexistent/acknowledge',
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
