import type { ContractSchema, FieldSchema } from '../types/index.js';
import type { ShapeNode, ShapeObject } from '../types/index.js';
import type { ConsumerDep, DriftEvent, ConsumerImpact } from '../types/index.js';
import { DriftChangeType } from '../types/index.js';
import { isShapeObject, isShapeArray, isPrimitive } from '../types/index.js';
import type { IDriftDetector } from '../interfaces/index.js';
import { SeverityClassifier } from './SeverityClassifier.js';
import { DriftEventBuilder } from './DriftEventBuilder.js';

export class DriftDetector implements IDriftDetector {
  private readonly classifier: SeverityClassifier;

  constructor(classifier?: SeverityClassifier) {
    this.classifier = classifier ?? new SeverityClassifier();
  }

  detect(baseline: ContractSchema, incoming: ShapeNode, consumerDeps: ConsumerDep[]): DriftEvent[] {
    if (!isShapeObject(incoming)) return [];

    const events: DriftEvent[] = [];
    this.compareFields(baseline, incoming, consumerDeps, '', events);
    return events;
  }

  private compareFields(
    schema: ContractSchema,
    incoming: ShapeObject,
    consumerDeps: ConsumerDep[],
    parentPath: string,
    events: DriftEvent[],
  ): void {
    const baselineKeys = new Set(Object.keys(schema.fields));
    const incomingKeys = new Set(Object.keys(incoming.fields));

    for (const key of incomingKeys) {
      if (!baselineKeys.has(key)) {
        const field = parentPath ? `${parentPath}.${key}` : key;
        events.push(
          this.createEvent(
            DriftChangeType.FIELD_ADDED,
            field,
            {
              before: 'absent',
              after: this.describeNode(incoming.fields[key]),
              description: `New field "${key}" appeared`,
            },
            consumerDeps,
          ),
        );
      }
    }

    for (const key of baselineKeys) {
      const field = parentPath ? `${parentPath}.${key}` : key;
      const baseField = schema.fields[key];

      if (!incomingKeys.has(key)) {
        if (baseField.required) {
          events.push(
            this.createEvent(
              DriftChangeType.FIELD_REMOVED,
              field,
              {
                before: this.describeFieldSchema(baseField),
                after: 'absent',
                description: `Required field "${key}" is missing`,
              },
              consumerDeps,
            ),
          );
        }
        continue;
      }

      const incomingNode = incoming.fields[key];
      this.compareFieldToSchema(baseField, incomingNode, field, consumerDeps, events);
    }
  }

  private compareFieldToSchema(
    baseline: FieldSchema,
    incoming: ShapeNode,
    field: string,
    consumerDeps: ConsumerDep[],
    events: DriftEvent[],
  ): void {
    if (isPrimitive(incoming) && incoming === 'null' && !baseline.nullable) {
      events.push(
        this.createEvent(
          DriftChangeType.NULLABLE_ADDED,
          field,
          {
            before: 'non-nullable',
            after: 'nullable',
            description: `Field "${field}" is now nullable`,
          },
          consumerDeps,
        ),
      );
      return;
    }

    const baselineTypes = new Set(baseline.types.map((t) => t.type));
    const incomingType = this.getNodeType(incoming);

    if (!baselineTypes.has(incomingType) && baselineTypes.size > 0) {
      const wasObject = baselineTypes.has('object');
      const wasArray = baselineTypes.has('array');
      const isObject = incomingType === 'object';
      const isArray = incomingType === 'array';

      if ((wasObject && isArray) || (wasArray && isObject)) {
        events.push(
          this.createEvent(
            DriftChangeType.STRUCTURAL_CHANGE,
            field,
            {
              before: [...baselineTypes].join(' | '),
              after: incomingType,
              description: `Structural type change at "${field}"`,
            },
            consumerDeps,
          ),
        );
        return;
      }

      events.push(
        this.createEvent(
          DriftChangeType.TYPE_CHANGED,
          field,
          {
            before: [...baselineTypes].join(' | '),
            after: incomingType,
            description: `Type changed at "${field}"`,
          },
          consumerDeps,
        ),
      );
    }

    if (isShapeObject(incoming) && baseline.nested) {
      this.compareFields(baseline.nested, incoming, consumerDeps, field, events);
    }

    if (isShapeArray(incoming) && baseline.arrayItems) {
      if (isShapeObject(incoming.items) && baseline.arrayItems.nested) {
        this.compareFields(baseline.arrayItems.nested, incoming.items, consumerDeps, `${field}[]`, events);
      }
    }
  }

  private createEvent(
    changeType: DriftChangeType,
    field: string,
    details: { before: string; after: string; description: string },
    consumerDeps: ConsumerDep[],
  ): DriftEvent {
    const severity = this.classifier.classify(changeType, field, consumerDeps);
    const affected = this.classifier.getAffectedConsumers(field, consumerDeps);

    const consumers: ConsumerImpact[] = affected.map((dep) => ({
      consumer: dep.consumer,
      field,
      sampleCount: dep.sampleCount,
      lastSeen: dep.lastSeen,
    }));

    return DriftEventBuilder.create()
      .withId(crypto.randomUUID())
      .withProvider('')
      .withEndpoint('')
      .withMethod('')
      .withChangeType(changeType)
      .withSeverity(severity)
      .withField(field)
      .withDetails(details)
      .withConsumers(consumers)
      .build();
  }

  private getNodeType(node: ShapeNode): string {
    if (isPrimitive(node)) return node;
    return node._type;
  }

  private describeNode(node: ShapeNode): string {
    if (isPrimitive(node)) return node;
    return node._type;
  }

  private describeFieldSchema(field: FieldSchema): string {
    return field.types.map((t) => t.type).join(' | ') || 'unknown';
  }
}
