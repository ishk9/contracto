import { describe, it, expect } from 'vitest';
import { DriftEventBuilder } from '../../src/drift/DriftEventBuilder.js';
import { DriftChangeType } from '../../src/types/index.js';

describe('DriftEventBuilder', () => {
  it('builds a complete DriftEvent with defaults for status and confirmationCount', () => {
    const event = DriftEventBuilder.create()
      .withId('evt-1')
      .withProvider('user-service')
      .withEndpoint('/users/:id')
      .withMethod('GET')
      .withChangeType(DriftChangeType.FIELD_ADDED)
      .withSeverity('info')
      .withField('nickname')
      .withDetails({
        before: 'absent',
        after: 'string',
        description: 'New field "nickname" appeared',
      })
      .withConsumers([
        {
          consumer: 'orders',
          field: 'nickname',
          sampleCount: 3,
          lastSeen: '2024-02-01T00:00:00Z',
        },
      ])
      .build();

    expect(event.id).toBe('evt-1');
    expect(event.provider).toBe('user-service');
    expect(event.endpoint).toBe('/users/:id');
    expect(event.method).toBe('GET');
    expect(event.changeType).toBe(DriftChangeType.FIELD_ADDED);
    expect(event.severity).toBe('info');
    expect(event.field).toBe('nickname');
    expect(event.details).toEqual({
      before: 'absent',
      after: 'string',
      description: 'New field "nickname" appeared',
    });
    expect(event.affectedConsumers).toHaveLength(1);
    expect(event.status).toBe('pending');
    expect(event.confirmationCount).toBe(1);
    expect(event.firstSeen).toBe(event.lastSeen);
    expect(typeof event.firstSeen).toBe('string');
  });

  it('throws when a required property is missing, naming the field in the Error message', () => {
    try {
      DriftEventBuilder.create()
        .withId('x')
        .withProvider('p')
        .withEndpoint('/e')
        .withMethod('POST')
        .withChangeType(DriftChangeType.TYPE_CHANGED)
        .withSeverity('breaking')
        .withField('f')
        .withConsumers([])
        .build();
      expect.fail('expected build to throw');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect((e as Error).message).toBe('DriftEvent missing required field: details');
    }
  });

  it('throws with the first missing required key when multiple are absent', () => {
    expect(() =>
      DriftEventBuilder.create().withId('only-id').build(),
    ).toThrowError('DriftEvent missing required field: provider');
  });
});
