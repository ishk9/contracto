import { describe, it, expect } from 'vitest';
import { ShapeFlattener } from '../../src/visitors/ShapeFlattener.js';
import { acceptVisitor } from '../../src/interfaces/index.js';
import type { ShapeNode, ShapeObject, ShapeUnion } from '../../src/types/index.js';

describe('ShapeFlattener', () => {
  const flattener = new ShapeFlattener();

  it('flattens a flat object to top-level field names', () => {
    const shape: ShapeObject = {
      _type: 'object',
      fields: {
        id: 'number',
        name: 'string',
      },
    };
    expect(acceptVisitor(shape, flattener, '')).toEqual(['id', 'name']);
  });

  it('includes nested object fields as dot paths', () => {
    const shape: ShapeObject = {
      _type: 'object',
      fields: {
        address: {
          _type: 'object',
          fields: {
            city: 'string',
            zip: 'string',
          },
        },
      },
    };
    const paths = acceptVisitor(shape, flattener, '');
    expect(paths).toEqual(expect.arrayContaining(['address', 'address.city', 'address.zip']));
    expect(paths).toHaveLength(3);
  });

  it('uses [] in paths for array item shapes', () => {
    const shape: ShapeObject = {
      _type: 'object',
      fields: {
        tags: {
          _type: 'array',
          items: 'string',
        },
      },
    };
    expect(acceptVisitor(shape, flattener, '')).toEqual(['tags', 'tags[]']);
  });

  it('returns a single path for a primitive when path is set', () => {
    expect(flattener.visitPrimitive('number', 'foo')).toEqual(['foo']);
  });

  it('returns an empty list for a primitive when path is empty', () => {
    expect(flattener.visitPrimitive('number', '')).toEqual([]);
  });

  it('deduplicates paths when flattening unions', () => {
    const shape: ShapeUnion = {
      _type: 'union',
      variants: [
        {
          _type: 'object',
          fields: { a: 'string' },
        },
        {
          _type: 'object',
          fields: { a: 'number' },
        },
      ],
    };
    expect(acceptVisitor(shape as ShapeNode, flattener, '')).toEqual(['a']);
  });

  it('merges all variant paths in a union and deduplicates overlapping keys', () => {
    const shape: ShapeUnion = {
      _type: 'union',
      variants: [
        { _type: 'object', fields: { x: 'string', shared: 'number' } },
        { _type: 'object', fields: { y: 'boolean', shared: 'string' } },
      ],
    };
    const paths = acceptVisitor(shape as ShapeNode, flattener, '');
    expect(paths).toHaveLength(3);
    expect(new Set(paths)).toEqual(new Set(['x', 'y', 'shared']));
  });
});
