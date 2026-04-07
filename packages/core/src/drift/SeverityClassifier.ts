import { DriftChangeType } from '../types/index.js';
import type { Severity, ConsumerDep } from '../types/index.js';

const BASE_SEVERITY: Record<DriftChangeType, Severity> = {
  [DriftChangeType.FIELD_ADDED]: 'info',
  [DriftChangeType.FIELD_REMOVED]: 'breaking',
  [DriftChangeType.TYPE_CHANGED]: 'breaking',
  [DriftChangeType.NULLABLE_ADDED]: 'warning',
  [DriftChangeType.NULLABLE_REMOVED]: 'info',
  [DriftChangeType.ENUM_VALUE_ADDED]: 'warning',
  [DriftChangeType.ENUM_VALUE_REMOVED]: 'breaking',
  [DriftChangeType.REQUIRED_TO_OPTIONAL]: 'breaking',
  [DriftChangeType.OPTIONAL_TO_REQUIRED]: 'info',
  [DriftChangeType.NESTED_SHAPE_CHANGED]: 'breaking',
  [DriftChangeType.STRUCTURAL_CHANGE]: 'critical',
  [DriftChangeType.STATUS_CODE_CHANGED]: 'warning',
};

export class SeverityClassifier {
  classify(changeType: DriftChangeType, field: string, consumerDeps: ConsumerDep[]): Severity {
    const base = BASE_SEVERITY[changeType];

    const affectedConsumers = consumerDeps.filter((dep) =>
      dep.fieldsAccessed.some((f) => f === field || f.startsWith(field + '.') || field.startsWith(f + '.')),
    );

    if (affectedConsumers.length === 0) {
      if (base === 'breaking' || base === 'critical') return 'info';
      return base;
    }

    return base;
  }

  getAffectedConsumers(field: string, consumerDeps: ConsumerDep[]): ConsumerDep[] {
    return consumerDeps.filter((dep) =>
      dep.fieldsAccessed.some((f) => f === field || f.startsWith(field + '.') || field.startsWith(f + '.')),
    );
  }
}
