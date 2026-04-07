import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DriftDetector } from '../../src/drift/DriftDetector.js';
import type { ContractSchema, FieldSchema, ConsumerDep } from '../../src/types/index.js';
import type { ShapeNode, ShapeObject } from '../../src/types/index.js';
import { DriftChangeType } from '../../src/types/index.js';

function field(partial: Partial<FieldSchema> & Pick<FieldSchema, 'types'>): FieldSchema {
  return {
    presence: 1,
    required: true,
    nullable: false,
    sampleCount: 100,
    ...partial,
  };
}

function sampleConsumer(overrides: Partial<ConsumerDep> = {}): ConsumerDep {
  return {
    consumer: 'order-service',
    provider: 'user-service',
    endpoint: '/users/:id',
    method: 'GET',
    fieldsAccessed: ['id', 'email'],
    sampleCount: 50,
    firstSeen: '2024-01-01T00:00:00Z',
    lastSeen: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('DriftDetector', () => {
  beforeEach(() => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
  });

  const userBaseline: ContractSchema = {
    _type: 'object',
    fields: {
      id: field({
        types: [{ type: 'number', count: 100, percentage: 1 }],
      }),
      email: field({
        types: [{ type: 'string', count: 100, percentage: 1 }],
      }),
    },
  };

  const matchingIncoming: ShapeObject = {
    _type: 'object',
    fields: {
      id: 'number',
      email: 'string',
    },
  };

  it('returns no events when incoming matches baseline', () => {
    const detector = new DriftDetector();
    expect(detector.detect(userBaseline, matchingIncoming, [])).toEqual([]);
  });

  it('emits FIELD_ADDED when incoming has an extra field', () => {
    const detector = new DriftDetector();
    const incoming: ShapeObject = {
      _type: 'object',
      fields: {
        ...matchingIncoming.fields,
        phone: 'string',
      },
    };
    const events = detector.detect(userBaseline, incoming, []);
    expect(events).toHaveLength(1);
    expect(events[0].changeType).toBe(DriftChangeType.FIELD_ADDED);
    expect(events[0].field).toBe('phone');
    expect(events[0].severity).toBe('info');
    expect(events[0].details.before).toBe('absent');
    expect(events[0].details.after).toBe('string');
  });

  it('emits FIELD_REMOVED when a required baseline field is missing', () => {
    const detector = new DriftDetector();
    const incoming: ShapeObject = {
      _type: 'object',
      fields: {
        id: 'number',
      },
    };
    const events = detector.detect(userBaseline, incoming, []);
    expect(events).toHaveLength(1);
    expect(events[0].changeType).toBe(DriftChangeType.FIELD_REMOVED);
    expect(events[0].field).toBe('email');
  });

  it('emits TYPE_CHANGED when a field type changes', () => {
    const detector = new DriftDetector();
    const incoming: ShapeObject = {
      _type: 'object',
      fields: {
        id: 'string',
        email: 'string',
      },
    };
    const events = detector.detect(userBaseline, incoming, []);
    expect(events).toHaveLength(1);
    expect(events[0].changeType).toBe(DriftChangeType.TYPE_CHANGED);
    expect(events[0].field).toBe('id');
    expect(events[0].details.before).toContain('number');
    expect(events[0].details.after).toBe('string');
  });

  it('emits NULLABLE_ADDED when a non-nullable field becomes null', () => {
    const detector = new DriftDetector();
    const incoming: ShapeObject = {
      _type: 'object',
      fields: {
        id: 'null',
        email: 'string',
      },
    };
    const events = detector.detect(userBaseline, incoming, []);
    expect(events).toHaveLength(1);
    expect(events[0].changeType).toBe(DriftChangeType.NULLABLE_ADDED);
    expect(events[0].field).toBe('id');
  });

  it('emits STRUCTURAL_CHANGE when object becomes array', () => {
    const baseline: ContractSchema = {
      _type: 'object',
      fields: {
        meta: field({
          types: [{ type: 'object', count: 10, percentage: 1 }],
          nested: {
            _type: 'object',
            fields: {},
          },
        }),
      },
    };
    const incoming: ShapeObject = {
      _type: 'object',
      fields: {
        meta: { _type: 'array', items: 'string' },
      },
    };
    const detector = new DriftDetector();
    const events = detector.detect(baseline, incoming, []);
    expect(events).toHaveLength(1);
    expect(events[0].changeType).toBe(DriftChangeType.STRUCTURAL_CHANGE);
    expect(events[0].field).toBe('meta');
  });

  it('downgrades FIELD_REMOVED severity to info when no consumer uses the field', () => {
    const detector = new DriftDetector();
    const incoming: ShapeObject = {
      _type: 'object',
      fields: {
        id: 'number',
      },
    };
    const deps = [sampleConsumer({ fieldsAccessed: ['id'] })];
    const events = detector.detect(userBaseline, incoming, deps);
    const removed = events.find((e) => e.changeType === DriftChangeType.FIELD_REMOVED);
    expect(removed).toBeDefined();
    expect(removed!.field).toBe('email');
    expect(removed!.severity).toBe('info');
  });

  it('keeps FIELD_REMOVED severity breaking when a consumer uses the field', () => {
    const detector = new DriftDetector();
    const incoming: ShapeObject = {
      _type: 'object',
      fields: {
        id: 'number',
      },
    };
    const deps = [sampleConsumer({ fieldsAccessed: ['id', 'email'] })];
    const events = detector.detect(userBaseline, incoming, deps);
    const removed = events.find((e) => e.changeType === DriftChangeType.FIELD_REMOVED);
    expect(removed).toBeDefined();
    expect(removed!.field).toBe('email');
    expect(removed!.severity).toBe('breaking');
  });

  it('returns an empty array when incoming is not a shape object (primitive)', () => {
    const detector = new DriftDetector();
    const incoming: ShapeNode = 'string';
    expect(detector.detect(userBaseline, incoming, [])).toEqual([]);
  });

  it('returns an empty array when incoming is not a shape object (array node)', () => {
    const detector = new DriftDetector();
    const incoming: ShapeNode = { _type: 'array', items: 'string' };
    expect(detector.detect(userBaseline, incoming, [])).toEqual([]);
  });

  it('detects drift in nested object fields', () => {
    const baseline: ContractSchema = {
      _type: 'object',
      fields: {
        profile: field({
          types: [{ type: 'object', count: 1, percentage: 1 }],
          nested: {
            _type: 'object',
            fields: {
              bio: field({
                types: [{ type: 'string', count: 10, percentage: 1 }],
              }),
            },
          },
        }),
      },
    };
    const incoming: ShapeObject = {
      _type: 'object',
      fields: {
        profile: {
          _type: 'object',
          fields: {
            bio: 'number',
          },
        },
      },
    };
    const detector = new DriftDetector();
    const events = detector.detect(baseline, incoming, []);
    expect(events).toHaveLength(1);
    expect(events[0].changeType).toBe(DriftChangeType.TYPE_CHANGED);
    expect(events[0].field).toBe('profile.bio');
  });
});
