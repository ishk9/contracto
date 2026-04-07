import { describe, it, expect } from 'vitest';
import { ShapeExtractor } from '../../src/extraction/ShapeExtractor.js';
import type { IShapeMerger } from '../../src/interfaces/index.js';
import type { ShapeNode } from '../../src/types/index.js';
import { isShapeArray, isShapeObject, isShapeUnion } from '../../src/types/index.js';

describe('ShapeExtractor', () => {
  describe('constructor', () => {
    it('supports new ShapeExtractor() with defaults', () => {
      expect(new ShapeExtractor()).toBeInstanceOf(ShapeExtractor);
    });

    it('supports new ShapeExtractor({ maxDepth })', () => {
      const ex = new ShapeExtractor({ maxDepth: 5 });
      expect(ex).toBeInstanceOf(ShapeExtractor);
    });

    it('supports new ShapeExtractor({ merger })', () => {
      let mergeCallCount = 0;
      const merger: IShapeMerger = {
        merge(nodes: ShapeNode[]) {
          mergeCallCount += 1;
          return nodes[0] ?? 'unknown';
        },
      };
      const ex = new ShapeExtractor({ merger });
      expect(ex.extract([1, 2])).toEqual({ _type: 'array', items: 'number' });
      expect(mergeCallCount).toBe(1);
    });
  });

  describe('extract(value): ShapeNode', () => {
    it('1. primitives: string, number, boolean, null, undefined', () => {
      const ex = new ShapeExtractor();
      expect(ex.extract('hello')).toBe('string');
      expect(ex.extract(42)).toBe('number');
      expect(ex.extract(true)).toBe('boolean');
      expect(ex.extract(null)).toBe('null');
      expect(ex.extract(undefined)).toBe('undefined');
    });

    it('2. simple flat object', () => {
      const ex = new ShapeExtractor();
      expect(ex.extract({ id: 42, name: 'Alice' })).toEqual({
        _type: 'object',
        fields: { id: 'number', name: 'string' },
      });
    });

    it('3. nested object → nested ShapeObject', () => {
      const ex = new ShapeExtractor();
      const shape = ex.extract({ user: { name: 'Bob' } });
      expect(isShapeObject(shape)).toBe(true);
      if (!isShapeObject(shape)) return;
      expect(shape.fields.user).toEqual({
        _type: 'object',
        fields: { name: 'string' },
      });
    });

    it('4. array of primitives', () => {
      const ex = new ShapeExtractor();
      expect(ex.extract([1, 2, 3])).toEqual({ _type: 'array', items: 'number' });
    });

    it('5. array of mixed types → union of item shapes', () => {
      const ex = new ShapeExtractor();
      const shape = ex.extract([1, 'two', true]);
      expect(isShapeArray(shape)).toBe(true);
      if (!isShapeArray(shape)) return;
      expect(isShapeUnion(shape.items)).toBe(true);
      if (!isShapeUnion(shape.items)) return;
      expect(shape.items.variants).toHaveLength(3);
      expect(shape.items.variants).toEqual(
        expect.arrayContaining(['number', 'string', 'boolean']),
      );
    });

    it('6. empty array → items unknown', () => {
      const ex = new ShapeExtractor();
      expect(ex.extract([])).toEqual({ _type: 'array', items: 'unknown' });
    });

    it('7. maxDepth: depth at limit collapses deeper structure to unknown', () => {
      const ex = new ShapeExtractor({ maxDepth: 2 });
      expect(ex.extract({ a: { b: { c: 1 } } })).toEqual({
        _type: 'object',
        fields: {
          a: {
            _type: 'object',
            fields: { b: 'unknown' },
          },
        },
      });
    });

    it('8. complex API-like response', () => {
      const ex = new ShapeExtractor();
      expect(
        ex.extract({
          id: 1,
          name: 'Alice',
          address: { city: 'Berlin', zip: '10115' },
          tags: ['vip'],
          metadata: null,
        }),
      ).toEqual({
        _type: 'object',
        fields: {
          id: 'number',
          name: 'string',
          address: {
            _type: 'object',
            fields: { city: 'string', zip: 'string' },
          },
          tags: { _type: 'array', items: 'string' },
          metadata: 'null',
        },
      });
    });

    it('9. array of objects → array of object shape', () => {
      const ex = new ShapeExtractor();
      expect(ex.extract([{ id: 1 }, { id: 2 }])).toEqual({
        _type: 'array',
        items: { _type: 'object', fields: { id: 'number' } },
      });
    });
  });
});
