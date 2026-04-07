import { describe, it, expect } from 'vitest';
import { EndpointParameterizer } from '../../src/parameterization/EndpointParameterizer.js';

describe('EndpointParameterizer', () => {
  const parameterizer = new EndpointParameterizer();

  describe('parameterize', () => {
    it('maps numeric ID segments to :id', () => {
      const paths = ['/users/1', '/users/2', '/users/3'];
      const map = parameterizer.parameterize(paths);
      expect(map.get('/users/1')).toBe('/users/:id');
      expect(map.get('/users/2')).toBe('/users/:id');
      expect(map.get('/users/3')).toBe('/users/:id');
    });

    it('maps UUID segments to :id', () => {
      const paths = [
        '/users/550e8400-e29b-41d4-a716-446655440000',
        '/users/6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      ];
      const map = parameterizer.parameterize(paths);
      expect(map.get(paths[0])).toBe('/users/:id');
      expect(map.get(paths[1])).toBe('/users/:id');
    });

    it('preserves static paths when all values agree', () => {
      const paths = ['/health', '/health'];
      const map = parameterizer.parameterize(paths);
      expect(map.get('/health')).toBe('/health');
    });

    it('parameterizes mixed static and varying segments', () => {
      const paths = ['/api/v1/users/1', '/api/v1/users/2'];
      const map = parameterizer.parameterize(paths);
      expect(map.get('/api/v1/users/1')).toBe('/api/v1/users/:id');
      expect(map.get('/api/v1/users/2')).toBe('/api/v1/users/:id');
    });

    it('groups paths by segment count so 2-segment and 3-segment routes are templated independently', () => {
      const map = parameterizer.parameterize([
        '/users/1',
        '/users/2',
        '/api/v1/items/10',
        '/api/v1/items/20',
      ]);
      expect(map.get('/users/1')).toBe('/users/:id');
      expect(map.get('/users/2')).toBe('/users/:id');
      expect(map.get('/api/v1/items/10')).toBe('/api/v1/items/:id');
      expect(map.get('/api/v1/items/20')).toBe('/api/v1/items/:id');
    });
  });

  describe('parameterizeSingle', () => {
    it('returns the input path unchanged', () => {
      expect(parameterizer.parameterizeSingle('/any/path')).toBe('/any/path');
    });
  });
});
