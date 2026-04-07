import { describe, it, expect } from 'vitest';
import { SeverityClassifier } from '../../src/drift/SeverityClassifier.js';
import { DriftChangeType } from '../../src/types/index.js';
import type { ConsumerDep } from '../../src/types/index.js';

function dep(overrides: Partial<ConsumerDep> = {}): ConsumerDep {
  return {
    consumer: 'c1',
    provider: 'p1',
    endpoint: '/a',
    method: 'GET',
    fieldsAccessed: [],
    sampleCount: 1,
    firstSeen: '2024-01-01T00:00:00Z',
    lastSeen: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('SeverityClassifier', () => {
  const classifier = new SeverityClassifier();

  describe('classify', () => {
    it('returns info for FIELD_ADDED regardless of consumers', () => {
      expect(
        classifier.classify(DriftChangeType.FIELD_ADDED, 'x', [
          dep({ fieldsAccessed: ['x'] }),
        ]),
      ).toBe('info');
      expect(classifier.classify(DriftChangeType.FIELD_ADDED, 'x', [])).toBe('info');
    });

    it('returns breaking for FIELD_REMOVED when consumers use the field', () => {
      expect(
        classifier.classify(DriftChangeType.FIELD_REMOVED, 'email', [
          dep({ fieldsAccessed: ['email'] }),
        ]),
      ).toBe('breaking');
    });

    it('downgrades FIELD_REMOVED to info when no consumer references the field', () => {
      expect(
        classifier.classify(DriftChangeType.FIELD_REMOVED, 'legacyFlag', [
          dep({ fieldsAccessed: ['id'] }),
        ]),
      ).toBe('info');
    });

    it('returns breaking for TYPE_CHANGED when consumers use the field', () => {
      expect(
        classifier.classify(DriftChangeType.TYPE_CHANGED, 'userId', [
          dep({ fieldsAccessed: ['userId'] }),
        ]),
      ).toBe('breaking');
    });

    it('returns critical for STRUCTURAL_CHANGE when consumers use the field', () => {
      expect(
        classifier.classify(DriftChangeType.STRUCTURAL_CHANGE, 'data', [
          dep({ fieldsAccessed: ['data'] }),
        ]),
      ).toBe('critical');
    });

    it('downgrades STRUCTURAL_CHANGE to info when no consumer references the field', () => {
      expect(
        classifier.classify(DriftChangeType.STRUCTURAL_CHANGE, 'data', [
          dep({ fieldsAccessed: ['other'] }),
        ]),
      ).toBe('info');
    });
  });

  describe('getAffectedConsumers', () => {
    it('matches exact field paths and parent/child path relationships', () => {
      const consumers = [
        dep({ consumer: 'a', fieldsAccessed: ['id'] }),
        dep({ consumer: 'b', fieldsAccessed: ['profile.bio'] }),
        dep({ consumer: 'c', fieldsAccessed: ['profile'] }),
      ];

      expect(classifier.getAffectedConsumers('id', consumers).map((d) => d.consumer)).toEqual([
        'a',
      ]);

      expect(
        classifier.getAffectedConsumers('profile', consumers).map((d) => d.consumer).sort(),
      ).toEqual(['b', 'c']);

      expect(
        classifier.getAffectedConsumers('profile.bio', consumers).map((d) => d.consumer).sort(),
      ).toEqual(['b', 'c']);
    });

    it('matches when consumer lists a nested path prefix of the drift field', () => {
      const consumers = [dep({ consumer: 'nested-user', fieldsAccessed: ['profile'] })];
      expect(classifier.getAffectedConsumers('profile.avatar', consumers)).toHaveLength(1);
      expect(classifier.getAffectedConsumers('profile.avatar', consumers)[0].consumer).toBe(
        'nested-user',
      );
    });

    it('matches when consumer lists a path that extends the drift field', () => {
      const consumers = [dep({ consumer: 'detail-user', fieldsAccessed: ['profile.settings.theme'] })];
      expect(classifier.getAffectedConsumers('profile.settings', consumers)).toHaveLength(1);
    });
  });
});
